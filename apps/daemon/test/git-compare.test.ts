import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {afterAll,beforeAll,expect,it} from 'vitest';
import {readGit} from '../src/git-review.ts';
import {gitCompare,gitCompareFile,gitCompareRefs,githubCompareResult,githubRepo,githubRepoOf,resolvePulls} from '../src/git-compare.ts';
import {compareEvidence} from '../src/git-compare-evidence.ts';

let dir:string,root:string,topicTip:string,mainTip:string;
const git=(...args:string[])=>execFileSync('git',args,{cwd:root,windowsHide:true,encoding:'utf8'}).trim();
const read=(args:string[])=>readGit(root,args);
const write=(name:string,text:string)=>{mkdirSync(join(root,name,'..'),{recursive:true});writeFileSync(join(root,name),text);};
const commit=(message:string)=>{git('add','.');git('commit','-m',message);};
/** Everything a read could disturb: every ref, HEAD, the index state and the working tree. */
const snapshot=()=>[git('for-each-ref'),git('rev-parse','HEAD'),git('symbolic-ref','HEAD'),git('status','--porcelain'),git('stash','list')].join('\n--\n');

beforeAll(()=>{
  dir=mkdtempSync(join(tmpdir(),'drishya-compare-'));root=join(dir,'repo');mkdirSync(root);
  git('init','-b','main');git('config','user.name','Synthetic');git('config','user.email','synthetic@example.invalid');
  git('config','core.autocrlf','false');
  write('a.ts','a1\na2\n');write('b.ts','b1\nb2\n');write('c.ts','c1\nc2\n');write('assets/logo.bin','\u0000\u0001\u0002');commit('Base');
  git('switch','-c','topic');
  write('a.ts','a1\na2\na3\n');write('b.ts','b1 topic\nb2\n');write('d.ts','new file\n');commit('Topic one');
  write('assets/logo.bin','\u0000\u0001\u0002\u0003');commit('Topic binary');
  topicTip=git('rev-parse','HEAD');
  git('switch','main');
  write('b.ts','b1\nb2 main\n');write('c.ts','c1\nc2\nc3\n');commit('Main one');
  mainTip=git('rev-parse','HEAD');
  git('update-ref','refs/remotes/origin/main',mainTip);git('symbolic-ref','refs/remotes/origin/HEAD','refs/remotes/origin/main');
  git('tag','v1',mainTip);
  git('switch','--orphan','unrelated');write('z.ts','z\n');commit('Unrelated root');
  git('switch','main');
});
afterAll(()=>{if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe fixture path');rmSync(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100});}});

it('lists branches, remote-tracking branches and tags with the default base and the current branch',async()=>{
  const refs=await gitCompareRefs(read);
  expect(refs.current).toMatchObject({name:'main',kind:'branch',current:true});
  expect(refs.defaultBase).toMatchObject({ref:'refs/heads/main',name:'main'});
  expect([...new Set(refs.refs.map(ref=>ref.kind))].sort()).toEqual(['branch','remote','tag']);
  expect(refs.refs.some(ref=>ref.ref==='refs/remotes/origin/HEAD')).toBe(false);
  expect(refs.refs.find(ref=>ref.name==='topic')?.ref).toBe('refs/heads/topic');
});

it('splits files into changed on both, only the compare side, and only the base side from the merge-base',async()=>{
  const before=snapshot();
  const calls:string[][]=[];
  const result=await gitCompare(args=>{calls.push(args);return read(args);},{base:'refs/heads/main',head:'refs/heads/topic'});
  expect(calls.filter(args=>args[0]==='merge-base'&&args.length===3)).toHaveLength(1);
  expect(result.source).toBe('local');
  expect(result.mergeBase).toBe(git('merge-base','main','topic'));
  expect(result).toMatchObject({state:'known',ahead:2,behind:1});
  expect(result.files.map(file=>[file.path,file.group])).toEqual([
    ['b.ts','both'],
    ['a.ts','head'],['assets/logo.bin','head'],['d.ts','head'],
    ['c.ts','base'],
  ]);
  const byPath=Object.fromEntries(result.files.map(file=>[file.path,file]));
  expect(byPath['b.ts']).toMatchObject({headStatus:'M',baseStatus:'M',added:1,removed:1,baseAdded:1,baseRemoved:1});
  expect(byPath['a.ts']).toMatchObject({headStatus:'M',added:1,removed:0});
  expect(byPath['d.ts']).toMatchObject({headStatus:'A',added:1,removed:0});
  expect(byPath['c.ts']).toMatchObject({baseStatus:'M',added:1,removed:0});
  expect(byPath['c.ts']?.headStatus).toBeUndefined();
  expect(byPath['assets/logo.bin']).toMatchObject({binary:true});
  expect(result.commits.map(item=>item.subject)).toEqual(['Topic binary','Topic one']);
  expect(snapshot()).toBe(before);
});

// Check each real operation separately so its read-only guarantee has its own execution budget.
it.each([
  {operation:'listing refs',run:()=>gitCompareRefs(read)},
  {operation:'comparing a remote-tracking branch',run:()=>gitCompare(read,{base:'refs/remotes/origin/main',head:'refs/heads/topic'})},
  {operation:'comparing a tag with a commit',run:()=>gitCompare(read,{base:'refs/tags/v1',head:topicTip})},
  {operation:'reading the base patch',run:()=>gitCompareFile(read,{base:'refs/heads/main',head:'refs/heads/topic',path:'b.ts',side:'base'})},
  {operation:'reading the head patch',run:()=>gitCompareFile(read,{base:'refs/heads/main',head:'refs/heads/topic',path:'b.ts',side:'head'})},
])('is read-only: every ref, HEAD, the tree, stash and object inventory are identical after $operation',async({run})=>{
  const before=snapshot(),objects=git('count-objects','-v');
  await run();
  expect(snapshot()).toBe(before);
  expect(git('count-objects','-v')).toBe(objects);
});

it('shows each side of a shared file against the merge-base',async()=>{
  const query={base:'refs/heads/main',head:'refs/heads/topic',path:'b.ts'};
  const own=await gitCompareFile(read,{...query,side:'head'}),other=await gitCompareFile(read,{...query,side:'base'});
  expect(own.patch.startsWith('Commit changes\n')).toBe(true);
  expect(own.patch).toContain('+b1 topic');expect(own.patch).not.toContain('b2 main');
  expect(other.patch).toContain('+b2 main');expect(other.patch).not.toContain('b1 topic');
  expect(own.fingerprint).not.toBe(other.fingerprint);
  expect((await gitCompareFile(read,{...query,path:'assets/logo.bin',side:'head'})).binary).toBe(true);
});

it('accepts a commit id as a side and refuses names that are not refs, options and protected paths',async()=>{
  const byId=await gitCompare(read,{base:'refs/heads/main',head:topicTip});
  expect(byId.head).toMatchObject({ref:topicTip,tip:topicTip});expect(byId.files.length).toBe(5);
  await expect(gitCompare(read,{base:'--output=x',head:'refs/heads/topic'})).rejects.toMatchObject({status:404});
  await expect(gitCompare(read,{base:'refs/heads/main',head:'refs/heads/missing'})).rejects.toMatchObject({status:404});
  await expect(gitCompare(read,{base:'refs/heads/main',head:'0'.repeat(40)})).rejects.toMatchObject({status:404});
  await expect(gitCompareFile(read,{base:'refs/heads/main',head:'refs/heads/topic',path:'../x',side:'head'})).rejects.toMatchObject({status:400});
  await expect(gitCompareFile(read,{base:'refs/heads/main',head:'refs/heads/topic',path:'.git/config',side:'head'})).rejects.toMatchObject({status:400});
});

it('compares unrelated histories as a plain difference and says so',async()=>{
  const result=await gitCompare(read,{base:'refs/heads/main',head:'refs/heads/unrelated'});
  expect(result.state).toBe('unrelated');expect(result.mergeBase).toBeUndefined();
  expect(result.files.find(file=>file.path==='z.ts')).toMatchObject({group:'head',headStatus:'A'});
});

it('equal sides have no files and a known zero count',async()=>{
  const result=await gitCompare(read,{base:'refs/heads/main',head:'refs/remotes/origin/main'});
  expect(result).toMatchObject({state:'known',ahead:0,behind:0,files:[],commits:[]});
});

it('marks which pull requests have their head commit here and finds the local base ref',async()=>{
  const pulls=await resolvePulls(read,[
    {number:1,title:'Local',url:'u',baseName:'main',headName:'topic',headOid:topicTip},
    {number:2,title:'Remote only',url:'u',baseName:'main',headName:'someone/else',headOid:'f'.repeat(40)},
  ]);
  expect(pulls[0]).toMatchObject({local:true,baseRef:{ref:'refs/heads/main'},headRef:{ref:'refs/heads/topic'}});
  expect(pulls[1]).toMatchObject({local:false});expect(pulls[1]!.headRef).toBeUndefined();
});

it('reads GitHub remotes and turns GitHub compare JSON into the same result shape',()=>{
  expect(githubRepoOf('https://github.com/drishya-dev/drishya.git')).toBe('drishya-dev/drishya');
  expect(githubRepoOf('git@github.com:drishya-dev/drishya.git')).toBe('drishya-dev/drishya');
  expect(githubRepoOf('https://example.com/a/b.git')).toBeUndefined();
  expect(githubRepoOf('https://github.com/a/b/../c')).toBeUndefined();
  const result=githubCompareResult({ahead_by:2,behind_by:5,total_commits:2,merge_base_commit:{sha:'a'.repeat(40)},
    files:[{filename:'src/x.ts',status:'modified',additions:3,deletions:1,patch:'@@ -1 +1,3 @@\n-a\n+b\n+c\n+d'},{filename:'img.png',status:'added',additions:0,deletions:0},{filename:'.git/config',status:'modified',additions:1,deletions:0,patch:'@@ -1 +1 @@\n-a\n+b'}],
    commits:[{sha:'b'.repeat(40),commit:{message:'Second\n\nbody',author:{name:'N',date:'2026-01-02T00:00:00Z'}}},{sha:'c'.repeat(40),commit:{message:'First',author:{name:'N',date:'2026-01-01T00:00:00Z'}}}]},
    {ref:'refs/heads/main',name:'main',tip:'d'.repeat(40)},{ref:'e'.repeat(40),name:'feature',tip:'e'.repeat(40)});
  expect(result).toMatchObject({source:'github',state:'remote',ahead:2,behind:5,mergeBase:'a'.repeat(40),protectedCount:1});
  expect(result.files.map(file=>file.path)).toEqual(['img.png','src/x.ts']);
  expect(result.files[1]!.patch).toContain('Commit changes\ndiff --git a/src/x.ts b/src/x.ts');
  expect(result.files[0]).toMatchObject({binary:true});
  expect(result.commits.map(item=>item.subject)).toEqual(['First','Second']);
});

it('resolves a GitHub origin with a single Git read and honors URL rewriting',async()=>{
  const repo=mkdtempSync(join(dir,'origin-lookup-'));
  git('init','-q',repo);
  git('-C',repo,'remote','add','origin','fixture:owner/repo.git');
  git('-C',repo,'config','url.https://github.com/.insteadOf','fixture:');
  const calls:string[][]=[];
  const resolved=await githubRepo(args=>{calls.push(args);return readGit(repo,args);});
  expect(resolved).toBe('owner/repo');
  expect(calls).toEqual([['remote','get-url','origin']]);
});

it('keeps the four-remote discovery bound when origin points elsewhere',async()=>{
  const calls:string[][]=[];
  const result=await githubRepo(async args=>{
    calls.push(args);
    if(args.length===1)return 'a\nb\nc\nd\norigin\n';
    return args.at(-1)==='d'?'https://github.com/owner/repo.git':'https://example.invalid/local';
  });
  expect(result).toBeUndefined();
  expect(calls.filter(args=>args[1]==='get-url').map(args=>args.at(-1))).toEqual(['origin','a','b','c']);
});

it('summarises which agents wrote a path from captured edits only',()=>{
  const op=(id:string,agentId:string,kind:string,status:string,path:string,extra:object={})=>({id,agentId,kind,status,paths:[{path,role:'write'}],...extra});
  const projection={operations:[
    op('o1','main','edit','ok','a.ts',{startTime:'2026-01-01T00:00:00Z'}),op('o2','main','edit','ok','a.ts'),op('o3','sub','write','unknown','a.ts'),
    op('o4','main','edit','error','b.ts'),op('o5','main','read','ok','c.ts'),op('o6','main','edit','ok','b.ts',{declined:true}),
    op('o7','main','edit','ok','worktree-97c8a64485/d.ts'),op('o8','sub','edit','ok','worktree-97c8a64485/a.ts'),
  ]} as never;
  const evidence=compareEvidence(projection,['a.ts','b.ts','c.ts','d.ts','/abs/x']);
  expect(Object.keys(evidence).sort()).toEqual(['a.ts','d.ts']);
  // An edit made in another checkout of the repository is the same repository path, and says so.
  expect(evidence['d.ts']!.agents).toEqual([{agentId:'main',edits:1,firstOperationId:'o7',lastOperationId:'o7',elsewhere:true}]);
  expect(evidence['a.ts']!.agents).toEqual([
    {agentId:'main',edits:2,firstOperationId:'o1',lastOperationId:'o2',firstTime:'2026-01-01T00:00:00Z'},
    {agentId:'sub',edits:2,firstOperationId:'o3',lastOperationId:'o8'},
  ]);
});

// Comparing both sides makes several dozen real Git calls, which can exceed 5 s on a hosted Windows runner.
it('gives every file the same content fingerprint in the list and in its patch, per side, so reviewed marks can key on it',async()=>{
  const list=await gitCompare(read,{base:'refs/heads/main',head:'refs/heads/topic'}),query={base:'refs/heads/main',head:'refs/heads/topic'};
  const shared=list.files.find(file=>file.path==='b.ts')!;
  expect(shared.fingerprint).toMatch(/^[a-f0-9]{64}$/);expect(shared.baseFingerprint).toMatch(/^[a-f0-9]{64}$/);expect(shared.fingerprint).not.toBe(shared.baseFingerprint);
  expect((await gitCompareFile(read,{...query,path:'b.ts',side:'head'})).fingerprint).toBe(shared.fingerprint);
  expect((await gitCompareFile(read,{...query,path:'b.ts',side:'base'})).fingerprint).toBe(shared.baseFingerprint);
  for(const file of list.files.filter(item=>item.group==='head'))expect((await gitCompareFile(read,{...query,path:file.path,side:'head'})).fingerprint).toBe(file.fingerprint);
  const onlyMain=list.files.find(file=>file.group==='base')!;
  expect((await gitCompareFile(read,{...query,path:onlyMain.path,side:'base'})).fingerprint).toBe(onlyMain.fingerprint);
  // The same change is the same fingerprint wherever it is read (a tag at main's tip has the same merge-base), and the two sides of one path differ.
  const other=await gitCompare(read,{base:'refs/tags/v1',head:'refs/heads/topic'});
  expect(other.files.find(file=>file.path==='b.ts')?.fingerprint).toBe(shared.fingerprint);
  expect((await gitCompare(read,query)).files.find(file=>file.path==='b.ts')?.fingerprint).toBe(shared.fingerprint);
},20_000);
