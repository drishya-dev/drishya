import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {afterAll,beforeAll,expect,it} from 'vitest';
import {App} from '../src/app.ts';
import {WorkspaceAccess} from '../src/workspace.ts';
import {GitReview} from '../src/git-review.ts';
import {GithubLinks} from '../src/github-links.ts';
import {GitCompareService} from '../src/git-compare-service.ts';

// GIT-8 behind its consent: Git approval first, a local compare, a pull request whose head is here, and one that is only on GitHub.
let dir:string,root:string,id:string,app:App,access:WorkspaceAccess,review:GitReview,links:GithubLinks,service:GitCompareService,topic:string;
const calls:string[][]=[];
const git=(...args:string[])=>execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true}).trim();
const absent='e'.repeat(40);
beforeAll(async()=>{
  dir=mkdtempSync(join(tmpdir(),'drishya-compare-svc-'));root=join(dir,'repo');mkdirSync(root);
  git('init','-b','main');git('config','user.name','Synthetic');git('config','user.email','synthetic@example.invalid');git('config','core.autocrlf','false');
  writeFileSync(join(root,'a.ts'),'one\n');git('add','.');git('commit','-m','Base');
  git('switch','-c','topic');writeFileSync(join(root,'a.ts'),'one\ntwo\n');git('add','.');git('commit','-m','Topic');topic=git('rev-parse','HEAD');git('switch','main');
  git('remote','add','origin','git@github.com:owner/repo.git');
  const journal=join(dir,'session.jsonl');
  writeFileSync(journal,JSON.stringify({type:'user',uuid:'u1',sessionId:'66666666-6666-4666-8666-666666666666',cwd:root,message:{role:'user',content:'Compare'}})+'\n');
  app=new App(join(dir,'store'));id=(await app.ingest.importSource('claude-code',journal)).recordingId;
  access=new WorkspaceAccess(app);review=new GitReview(access);
  links=new GithubLinks(app,async args=>{
    calls.push(args);
    if(args[0]==='--version')return 'gh version 2';
    if(args[1]?.startsWith('repos/owner/repo/pulls'))return JSON.stringify([
      {number:1,title:'Local head',head:{sha:topic,ref:'topic'},base:{ref:'main'}},
      {number:2,title:'Only on GitHub',head:{sha:absent,ref:'someone/else'},base:{ref:'main'}},
    ]);
    if(args[1]?.includes('/compare/'))return JSON.stringify({ahead_by:1,behind_by:0,total_commits:1,files:[{filename:'z.ts',status:'added',additions:1,deletions:0,patch:'@@ -0,0 +1 @@\n+z'}],commits:[]});
    throw new Error('unexpected gh call');
  });
  service=new GitCompareService(app,review,links);
});
afterAll(async()=>{await app.close();if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('unsafe fixture');rmSync(dir,{recursive:true,force:true});});

it('asks for the Git approval before reading anything',async()=>{
  await expect(service.refs(id)).rejects.toMatchObject({status:403});
  await access.approve(id);await expect(service.compare(id,{base:'refs/heads/main',head:'refs/heads/topic'})).rejects.toMatchObject({status:403});
  await review.approve(id);
});

it('compares local branches without moving a ref and with no gh call',async()=>{
  const before=git('for-each-ref')+git('rev-parse','HEAD');
  const refs=await service.refs(id);expect(refs.defaultBase?.name).toBe('main');
  const result=await service.compare(id,{base:'refs/heads/main',head:'refs/heads/topic'});
  expect(result).toMatchObject({source:'local',ahead:1,behind:0});expect(result.files).toMatchObject([{path:'a.ts',group:'head',added:1}]);
  expect((await service.file(id,{base:'refs/heads/main',head:'refs/heads/topic',path:'a.ts',side:'head'})).patch).toContain('+two');
  expect(git('for-each-ref')+git('rev-parse','HEAD')).toBe(before);
  expect(calls).toEqual([]);
});

it('keeps pull requests off until GitHub lookups are allowed, then reads them through gh api only',async()=>{
  expect(await service.pulls(id)).toEqual({status:'disabled',repo:'owner/repo',pulls:[]});
  await expect(service.remote(id,2)).rejects.toMatchObject({status:409});
  expect(calls).toEqual([]);
  await links.set(true);
  const listed=await service.pulls(id);
  expect(listed.status).toBe('ready');
  expect(listed.pulls.map(pull=>[pull.number,pull.local])).toEqual([[1,true],[2,false]]);
  expect(listed.pulls[0]).toMatchObject({baseRef:{ref:'refs/heads/main'},headRef:{ref:'refs/heads/topic'}});
  const local=await service.compare(id,{base:listed.pulls[0]!.baseRef!.ref,head:listed.pulls[0]!.headOid});
  expect(local.files.map(file=>file.path)).toEqual(['a.ts']);
  const remote=await service.remote(id,2);
  expect(remote).toMatchObject({source:'github',state:'remote',ahead:1,files:[{path:'z.ts',group:'head',headStatus:'A'}]});
  expect(remote.files[0]!.patch).toContain('+z');
  for(const call of calls.filter(call=>call[0]!=='--version'))expect(call[0]).toBe('api');
  await expect(service.remote(id,99)).rejects.toMatchObject({status:404});
  await links.set(false);
});
