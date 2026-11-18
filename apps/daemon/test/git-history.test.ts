import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {App} from '../src/app.ts';
import {WorkspaceAccess} from '../src/workspace.ts';
import {GitReview,readGit} from '../src/git-review.ts';
import {GithubLinks} from '../src/github-links.ts';
import {startServer,type RunningServer} from '../src/server.ts';
import {GitHistoryCache,gitHistory,gitCommit,gitRefGeneration} from '../src/git-history.ts';

let dir:string,root:string,id:string,first:string,merge:string,app:App,access:WorkspaceAccess,review:GitReview,server:RunningServer;
const git=(...args:string[])=>execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true}).trim();
beforeAll(async()=>{
  dir=mkdtempSync(join(tmpdir(),'drishya-atlas-'));root=join(dir,'repo');mkdirSync(root);
  git('init','-b','main');git('config','user.name','Synthetic');git('config','user.email','synthetic@example.invalid');
  writeFileSync(join(root,'a.ts'),'export const a=1;\n');writeFileSync(join(root,'.env'),'PRIVATE=hidden');
  git('add','.');git('commit','-m','Root fixture');first=git('rev-parse','HEAD');
  git('switch','-c','feature');writeFileSync(join(root,'feature.ts'),'export const token="sk-proj-abcdefghijklmnopqrstuvw0123456789";\n');git('add','.');git('commit','-m','Feature fixture');
  git('switch','main');writeFileSync(join(root,'main.ts'),'export const main=true;\n');git('add','.');git('commit','-m','Main fixture');
  git('merge','--no-ff','feature','-m','Merge fixture');merge=git('rev-parse','HEAD');
  git('tag','-a','v1',first,'-m','Annotated fixture');
  // One fast-import process writes the 54 empty history commits; one `git commit` each cost 54 process starts, and on a hosted
  // Windows runner busy with other test files that alone outran the hook's 30 s (18 Nov). The commits keep the merge's tree.
  const now=Math.floor(Date.now()/1000);
  execFileSync('git',['fast-import','--quiet'],{cwd:root,windowsHide:true,input:Array.from({length:54},(_,n)=>{const message=`History fixture ${n}\n`;return `commit refs/heads/main\ncommitter Synthetic <synthetic@example.invalid> ${now+n} +0000\ndata ${Buffer.byteLength(message)}\n${message}${n===0?`from ${merge}\n`:''}\n`;}).join('')});
  const head=git('rev-parse','HEAD');
  execFileSync('git',['update-ref','--stdin'],{cwd:root,input:Array.from({length:112},(_,n)=>`update refs/heads/topic-${String(n).padStart(3,'0')} ${head}`).join('\n')+'\n',windowsHide:true});
  git('update-ref','refs/remotes/origin/main',head);
  git('update-ref','refs/heads/sk-proj-abcdefghijklmnopqrstuvw0123456789',first);
  const helper=`node -e "require('fs').writeFileSync('${join(dir,'helper-ran').replace(/\\/g,'/')}','bad')"`;
  git('config','core.fsmonitor',helper);git('config','diff.external',helper);git('config','gpg.program',helper);git('config','log.showSignature','true');
  const journal=join(dir,'fixture.jsonl');writeFileSync(journal,JSON.stringify({type:'user',uuid:'atlas-user',sessionId:'atlas-fixture',cwd:root,message:{role:'user',content:'Read local Git history'}})+'\n');
  app=new App(join(dir,'store'));id=(await app.ingest.importSource('claude-code',journal)).recordingId;access=new WorkspaceAccess(app);review=new GitReview(access);server=await startServer({app,port:0,uiDir:join(dir,'no-ui')});
},60_000);
afterAll(async()=>{if(server)await server.close();if(app)await app.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe fixture path');rmSync(dir,{recursive:true,force:true});}});

it('requires Git consent and pages real branches, tags and commit topology',async()=>{
  await expect(review.history(id)).rejects.toMatchObject({status:403});await access.approve(id);await review.approve(id);
  const firstPage=await review.history(id);
  expect(firstPage.mainline).toMatchObject({name:'main',tip:git('rev-parse','refs/heads/main')});
  expect(firstPage.commits).toHaveLength(50);expect(firstPage.more).toBe(true);expect(firstPage.references).toHaveLength(100);expect(firstPage.referenceTotal).toBeGreaterThan(100);
  const next=await review.history(id,{start:50,referenceStart:100,generation:firstPage.generation});
  expect(next.commits.some(commit=>commit.hash===first)).toBe(true);expect(next.references.length).toBeGreaterThan(0);expect(next.more).toBe(false);
  const merged=next.commits.find(commit=>commit.hash===merge)!;expect(merged.parents).toHaveLength(2);
  const filtered=await review.history(id,{query:'v1'});expect(filtered.references[0]).toMatchObject({name:'v1',tip:first,kind:'tag'});
  const tagged=await review.history(id,{reference:filtered.references[0]!.id});expect(tagged.commits.map(commit=>commit.hash)).toEqual([first]);
  expect(JSON.stringify(firstPage)).not.toContain('abcdefghijklmnop');expect((await review.history(id,{query:'abcdefghijklmnop'})).referenceCount).toBe(0);
  expect(existsSync(join(dir,'helper-ran'))).toBe(false);
},20_000);
it('reads root/merge patches, excludes protected paths and redacts before delivery',async()=>{
  const rootCommit=await review.commit(id,first);expect(rootCommit.parent).toBeUndefined();expect(rootCommit.protectedCount).toBe(1);expect(rootCommit.files.map(file=>file.path)).toEqual(['a.ts']);expect(rootCommit.files[0]!.patch).toContain('+export const a=1;');
  const primary=await review.commit(id,merge),other=await review.commit(id,merge,1);
  expect(primary.parent).not.toBe(other.parent);expect(primary.files.map(file=>file.path)).toContain('feature.ts');expect(other.files.map(file=>file.path)).toContain('main.ts');
  expect(JSON.stringify(primary)).toContain('[REDACTED:');expect(JSON.stringify(primary)).not.toContain('abcdefghijklmnop');expect(existsSync(join(dir,'helper-ran'))).toBe(false);
},20_000);
it('rejects injection, missing refs, stale generations and revoked grants',async()=>{
  await expect(review.history(id,{reference:'--all'})).rejects.toMatchObject({status:400});await expect(review.commit(id,'HEAD; echo bad')).rejects.toMatchObject({status:400});await expect(review.history(id,{start:-1})).rejects.toMatchObject({status:400});await expect(review.history(id,{query:'x'.repeat(201)})).rejects.toMatchObject({status:400});
  await expect(review.history(id,{reference:'f'.repeat(64)})).rejects.toMatchObject({status:404});
  const sample=await review.history(id);git('update-ref','refs/heads/new-reference',first);await expect(review.history(id,{generation:sample.generation})).rejects.toMatchObject({status:409});
  const revoked=new GitReview(access,async(...args)=>{const result=await readGit(...args);if(args[1][0]==='log')revoked.revoke(id);return result;});await revoked.approve(id);await expect(revoked.history(id)).rejects.toMatchObject({status:403});
},20_000);
it('authenticates HTTP history and validates every page/object parameter',async()=>{
  const url=`${server.url}/v1/recordings/${id}`,headers={authorization:`Bearer ${server.token}`,'content-type':'application/json'};
  expect((await fetch(`${url}/git/history`)).status).toBe(401);expect((await fetch(`${url}/git/history`,{headers})).status).toBe(403);
  await fetch(`${url}/workspace/approve`,{method:'POST',headers,body:'{}'});await fetch(`${url}/git/approve`,{method:'POST',headers,body:'{}'});
  const response=await fetch(`${url}/git/history`,{headers});expect(response.status).toBe(200);expect((await response.json() as {commits:unknown[]}).commits).toHaveLength(50);
  expect((await fetch(`${url}/git/history?start=1.2`,{headers})).status).toBe(400);expect((await fetch(`${url}/git/commit?hash=${first}&parent=9000`,{headers})).status).toBe(400);
},20_000);
describe('squash-merge evidence',()=>{
  let repo:string,head:string,open:string,squash:string;
  // Real repository construction uses the same setup budget as the outer fixture.
  beforeAll(()=>{
    repo=join(dir,'squash');mkdirSync(repo);
    const sh=(...args:string[])=>execFileSync('git',args,{cwd:repo,encoding:'utf8',windowsHide:true}).trim();
    sh('init','-b','main');sh('config','user.name','Synthetic');sh('config','user.email','synthetic@example.invalid');
    writeFileSync(join(repo,'a.ts'),'a\n');sh('add','.');sh('commit','-m','Root');
    sh('switch','-c','feature');writeFileSync(join(repo,'f.ts'),'one\n');sh('add','.');sh('commit','-m','Feature one');
    writeFileSync(join(repo,'f.ts'),'two\n');writeFileSync(join(repo,'g.ts'),'g\n');sh('add','.');sh('commit','-m','Feature two');head=sh('rev-parse','HEAD');
    sh('switch','main');writeFileSync(join(repo,'m.ts'),'m\n');sh('add','.');sh('commit','-m','Unrelated main work');
    sh('switch','-c','open');writeFileSync(join(repo,'o.ts'),'o\n');sh('add','.');sh('commit','-m','Open work');open=sh('rev-parse','HEAD');
    sh('switch','main');sh('merge','--squash','feature');sh('commit','-m','Feature (#1)');squash=sh('rev-parse','HEAD');
  },30_000);

  it('a squash commit and its branch carry the same content signature, others do not',async()=>{
    const page=await gitHistory(args=>readGit(repo,args));
    expect(page.branchSignatures?.[head]).toBeTruthy();
    expect(page.changeSignatures?.[squash]).toBe(page.branchSignatures?.[head]);
    expect(page.branchSignatures?.[open]).toBeTruthy();
    // Only the open branch's own commit wrote its contents; nothing on main did.
    expect(Object.entries(page.changeSignatures??{}).filter(([,value])=>value===page.branchSignatures?.[open]).map(([hash])=>hash)).toEqual([open]);
    // The tip of the primary line is not a branch head of its own.
    expect(page.branchSignatures?.[squash]).toBeUndefined();
  });
});

it('handles unborn, detached and shallow repositories without inventing commits or parents',async()=>{
  const empty=join(dir,'empty');mkdirSync(empty);execFileSync('git',['init','-b','main',empty],{windowsHide:true});
  const unborn=await gitHistory(args=>readGit(empty,args));expect(unborn.head).toBe('');expect(unborn.commits).toEqual([]);expect(unborn.references).toEqual([]);
  git('-c','core.fsmonitor=false','switch','--detach',first);
  try{const detached=await review.history(id);expect(detached.head).toBe(first);expect(detached.branch).toBe('Detached HEAD');}finally{git('-c','core.fsmonitor=false','switch','main');}
  const shallow=join(dir,'shallow');execFileSync('git',['clone','--depth=1','--no-local','--no-checkout',root,shallow],{windowsHide:true});
  const shallowHistory=await gitHistory(args=>readGit(shallow,args));
  expect(shallowHistory.shallow).toBe(true);expect(shallowHistory.commits[0]!.parents).toEqual([git('rev-parse','HEAD^')]);
  await expect(gitCommit(args=>readGit(shallow,args),shallowHistory.head)).rejects.toMatchObject({status:422});
},20_000);
it('retains complete long messages and rejects a ref changing inside an inspection',async()=>{
  const head=git('rev-parse','HEAD'),tree=git('rev-parse','HEAD^{tree}'),message='Long message fixture\n\n'+'captured message body\n'.repeat(2500)+'FINAL_MESSAGE_MARKER\n';
  const commit=execFileSync('git',['commit-tree',tree,'-p',head],{cwd:root,windowsHide:true,encoding:'utf8',input:message}).trim();git('update-ref','refs/heads/long-message',commit);
  expect((await review.commit(id,commit)).message).toContain('FINAL_MESSAGE_MARKER');
  let moved=false;const racing=new GitReview(access,async(...args)=>{const output=await readGit(...args);if(args[1][0]==='log'&&!moved){moved=true;git('update-ref','refs/heads/mid-read',first);}return output;});await racing.approve(id);await expect(racing.history(id)).rejects.toMatchObject({status:409});
},20_000);
it('ignores ambient object/repository redirection for local inspection',async()=>{
  const expected=git('-c','core.fsmonitor=false','rev-parse','HEAD'),names=['GIT_OBJECT_DIRECTORY','GIT_COMMON_DIR','GIT_NAMESPACE'],previous=names.map(name=>process.env[name]);
  try{for(const name of names)process.env[name]=join(dir,'not-this-repository');expect((await readGit(root,['rev-parse','--verify','HEAD'])).trim()).toBe(expected);}
  finally{names.forEach((name,index)=>{if(previous[index]===undefined)delete process.env[name];else process.env[name]=previous[index];});}
});

it('caches history pages per root by generation, evicts LRU entries and drops stale generations',async()=>{
  const cache=new GitHistoryCache(2);
  let logCalls=0;
  const countingGit=async(args:string[])=>{if(args[0]==='log')logCalls++;return readGit(root,args);};

  const firstPage=await gitHistory(countingGit,{},{root,cache});
  expect(logCalls).toBe(1);
  // Second read with matching generation/query returns cached page without invoking git log.
  const hit=await gitHistory(countingGit,{},{root,cache});
  expect(hit.commits).toEqual(firstPage.commits);
  expect(hit.generation).toBe(firstPage.generation);
  expect(logCalls).toBe(1);

  // Distinct query params miss once and respect maxEntries=2 LRU bound.
  await gitHistory(countingGit,{start:50},{root,cache});
  expect(logCalls).toBe(2);
  expect(cache.size).toBe(2);
  // Touch start=0 so start=50 becomes least-recently-used.
  await gitHistory(countingGit,{start:0},{root,cache});
  expect(logCalls).toBe(2);
  // Adding query:'v1' evicts start=50 while keeping start=0.
  await gitHistory(countingGit,{query:'v1'},{root,cache});
  expect(logCalls).toBe(3);
  expect(cache.size).toBe(2);
  await gitHistory(countingGit,{start:0},{root,cache});
  expect(logCalls).toBe(3);
  await gitHistory(countingGit,{start:50},{root,cache});
  expect(logCalls).toBe(4);

  // Keep another root's cached page alive while updating refs on `root`.
  const otherRoot=`${root}-other`;
  cache.set(otherRoot,firstPage.generation,'all',0,'',0,firstPage);
  const head=git('rev-parse','HEAD');
  git('update-ref','refs/heads/cache-generation-bump',head);
  try{
    const updated=await gitHistory(countingGit,{},{root,cache});
    expect(updated.generation).not.toBe(firstPage.generation);
    expect(logCalls).toBe(5);
    expect(cache.get(otherRoot,firstPage.generation,'all',0,'',0)).toBe(firstPage);
  }finally{
    git('update-ref','-d','refs/heads/cache-generation-bump');
  }
},20_000);

it('provides patch-id and path-superset evidence when main drifts or branches merge main',async()=>{
  const repo=join(dir,'squash-advanced');mkdirSync(repo);
  const sh=(...args:string[])=>execFileSync('git',args,{cwd:repo,encoding:'utf8',windowsHide:true}).trim();
  sh('init','-b','main');sh('config','user.name','Synthetic');sh('config','user.email','synthetic@example.invalid');
  writeFileSync(join(repo,'shared.ts'),Array.from({length:20},(_,i)=>`export const s${i} = ${i};`).join('\n')+'\n');
  writeFileSync(join(repo,'b.ts'),'export const b = 0;\n');
  sh('add','.');sh('commit','-m','Base');
  sh('switch','-c','patch-branch');
  writeFileSync(join(repo,'shared.ts'),Array.from({length:20},(_,i)=>i===19?'export const s19 = 999;':`export const s${i} = ${i};`).join('\n')+'\n');
  sh('add','.');sh('commit','-m','Edit bottom of shared');const pHead=sh('rev-parse','HEAD');
  sh('switch','main');
  writeFileSync(join(repo,'shared.ts'),Array.from({length:20},(_,i)=>i===0?'export const s0 = 100;':`export const s${i} = ${i};`).join('\n')+'\n');
  sh('add','.');sh('commit','-m','Main edits top of shared');
  sh('merge','--squash','patch-branch');sh('commit','-m','Patch branch (#10)');const pSquash=sh('rev-parse','HEAD');

  sh('switch','-c','superset-branch','HEAD~1');
  writeFileSync(join(repo,'b.ts'),'export const b = 1;\n');sh('add','.');sh('commit','-m','Update b');const sHead=sh('rev-parse','HEAD');
  sh('switch','main');
  writeFileSync(join(repo,'b.ts'),'export const b = 1;\n');writeFileSync(join(repo,'extra.ts'),'export const extra = 1;\n');
  sh('add','.');sh('commit','-m','Superset squash (#11)');const sSquash=sh('rev-parse','HEAD');

  const page=await gitHistory(args=>readGit(repo,args));
  expect(page.branchSignatures?.[pHead]).not.toBe(page.changeSignatures?.[pSquash]);
  expect(page.branchPatchIds?.[pHead]).toBeTruthy();
  expect(page.changePatchIds?.[pSquash]).toBe(page.branchPatchIds?.[pHead]);

  expect(page.branchSignatures?.[sHead]).not.toBe(page.changeSignatures?.[sSquash]);
  expect(page.branchOwnFiles?.[sHead]?.['b.ts']).toBeTruthy();
  expect(page.changeFiles?.[sSquash]?.['b.ts']).toBe(page.branchOwnFiles?.[sHead]?.['b.ts']);
  expect(page.changeFiles?.[sSquash]?.['extra.ts']).toBeTruthy();
},20_000);

it('resolves opt-in GitHub PRs for Rule 2 and (#N) Rule 3 safely and never calls gh when disabled',async()=>{
  const repo=join(dir,'gh-squash');mkdirSync(repo);
  const sh=(...args:string[])=>execFileSync('git',args,{cwd:repo,encoding:'utf8',windowsHide:true}).trim();
  sh('init','-b','main');sh('config','user.name','Synthetic');sh('config','user.email','synthetic@example.invalid');
  sh('remote','add','origin','https://github.com/example/demo.git');
  writeFileSync(join(repo,'a.ts'),'export const a = 0;\n');sh('add','.');sh('commit','-m','Base');
  sh('switch','-c','rule2-branch');writeFileSync(join(repo,'a.ts'),'export const a = 1;\n');sh('add','.');sh('commit','-m','Rule 2 tip');const r2Tip=sh('rev-parse','HEAD');
  sh('switch','main');
  sh('switch','-c','rule3-branch');writeFileSync(join(repo,'b.ts'),'export const b = 1;\n');sh('add','.');sh('commit','-m','Rule 3 tip');const r3Tip=sh('rev-parse','HEAD');
  sh('switch','main');
  writeFileSync(join(repo,'a.ts'),'export const a = 2;\n');sh('add','.');sh('commit','-m','Merged two (#20)');const r2Squash=sh('rev-parse','HEAD');
  writeFileSync(join(repo,'b.ts'),'export const b = 2;\n');sh('add','.');sh('commit','-m','Older subject (#21)');const r3Squash=sh('rev-parse','HEAD');
  sh('switch','-c','reused-after');writeFileSync(join(repo,'c.ts'),'export const c = 1;\n');sh('add','.');sh('commit','-m','Post-merge work');const reusedTip=sh('rev-parse','HEAD');
  sh('switch','main');

  const j2=join(dir,'gh-squash.jsonl');
  writeFileSync(j2,JSON.stringify({type:'user',uuid:'gh-u',sessionId:'gh-squash',cwd:repo,message:{role:'user',content:'Inspect'}})+'\n');
  const ghRec=(await app.ingest.importSource('claude-code',j2)).recordingId;
  let ghCalls=0;
  const gh=new GithubLinks(app,async(args)=>{
    ghCalls++;
    if(args[0]==='--version')return 'gh version 2.0.0';
    if(args[1]==='repos/example/demo/pulls?state=closed&per_page=100&sort=updated&direction=desc'){
      return JSON.stringify([
        {number:20,merged_at:'2026-11-12T10:00:00Z',head:{ref:'rule2-branch',sha:r2Tip},merge_commit_sha:r2Squash},
        {number:22,merged_at:'2026-11-12T10:05:00Z',head:{ref:'reused-after',sha:'f'.repeat(40)},merge_commit_sha:r2Squash},
      ]);
    }
    if(args[1]==='repos/example/demo/pulls/21'){
      return JSON.stringify({number:21,merged_at:'2026-11-12T09:00:00Z',head:{ref:'rule3-branch',sha:r3Tip},merge_commit_sha:r3Squash});
    }
    throw new Error('Unexpected gh call: '+args.join(' '));
  });
  const ghReview=new GitReview(access,readGit,app.history,gh);
  await access.approve(ghRec);await ghReview.approve(ghRec);

  const offPage=await ghReview.history(ghRec);
  expect(ghCalls).toBe(0);
  expect(offPage.githubPulls).toBeUndefined();

  gh.set(true);
  const onPage=await ghReview.history(ghRec);
  expect(ghCalls).toBeGreaterThan(0);
  expect(onPage.githubPulls).toEqual(expect.arrayContaining([
    expect.objectContaining({pr:20,headRef:'rule2-branch',mergeCommit:r2Squash,basis:'github-pr',eligibleTips:[r2Tip]}),
    expect.objectContaining({pr:21,headRef:'rule3-branch',mergeCommit:r3Squash,basis:'github-subject-pr',eligibleTips:[r3Tip]}),
  ]));
  const reusedMatch=onPage.githubPulls?.find(p=>p.pr===22);
  expect(reusedMatch?.eligibleTips).not.toContain(reusedTip);
  gh.set(false);
},20_000);

it('serves /git/generation behind auth and Git consent with current ref digest',async()=>{
  const unauth=await fetch(`${server.url}/v1/recordings/${id}/git/generation`);
  expect(unauth.status).toBe(401);
  const headers={authorization:`Bearer ${server.token}`};
  const authed=await fetch(`${server.url}/v1/recordings/${id}/git/generation`,{headers});
  expect(authed.status).toBe(200);
  const body=await authed.json() as {generation:string};
  expect(body.generation).toBe(await gitRefGeneration(args=>readGit(root,args)));
});
