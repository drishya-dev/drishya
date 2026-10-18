import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {beforeAll,afterAll,it,expect} from 'vitest';
import {App} from '../src/app.ts';
import {WorkspaceAccess} from '../src/workspace.ts';
import {GitReview,readGit} from '../src/git-review.ts';
import {startServer,type RunningServer} from '../src/server.ts';
import {gitHistory,gitCommit} from '../src/git-history.ts';

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
  for(let n=0;n<54;n++)git('commit','--allow-empty','-m',`History fixture ${n}`);
  const head=git('rev-parse','HEAD');
  execFileSync('git',['update-ref','--stdin'],{cwd:root,input:Array.from({length:112},(_,n)=>`update refs/heads/topic-${String(n).padStart(3,'0')} ${head}`).join('\n')+'\n',windowsHide:true});
  git('update-ref','refs/remotes/origin/main',head);
  git('update-ref','refs/heads/sk-proj-abcdefghijklmnopqrstuvw0123456789',first);
  const helper=`node -e "require('fs').writeFileSync('${join(dir,'helper-ran').replace(/\\/g,'/')}','bad')"`;
  git('config','core.fsmonitor',helper);git('config','diff.external',helper);git('config','gpg.program',helper);git('config','log.showSignature','true');
  const journal=join(dir,'fixture.jsonl');writeFileSync(journal,JSON.stringify({type:'user',uuid:'atlas-user',sessionId:'atlas-fixture',cwd:root,message:{role:'user',content:'Read local Git history'}})+'\n');
  app=new App(join(dir,'store'));id=(await app.ingest.importSource('claude-code',journal)).recordingId;access=new WorkspaceAccess(app);review=new GitReview(access);server=await startServer({app,port:0,uiDir:join(dir,'no-ui')});
},30_000);
afterAll(async()=>{if(server)await server.close();if(app)await app.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe fixture path');rmSync(dir,{recursive:true,force:true});}});

it('requires Git consent and pages real branches, tags and commit topology',async()=>{
  await expect(review.history(id)).rejects.toMatchObject({status:403});await access.approve(id);await review.approve(id);
  const firstPage=await review.history(id);
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
