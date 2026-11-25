import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {afterAll,beforeAll,expect,it} from 'vitest';
import {gitHistory} from '../src/git-history.ts';
import {readGit} from '../src/git-review.ts';
import {compareBranch} from '../src/git-branches.ts';

let dir:string,root:string,topic:string;
const git=(...args:string[])=>execFileSync('git',args,{cwd:root,windowsHide:true,encoding:'utf8'}).trim();
const history=(options:Parameters<typeof gitHistory>[1]={})=>gitHistory(args=>readGit(root,args),options);
beforeAll(()=>{
  dir=mkdtempSync(join(tmpdir(),'drishya-branches-'));root=join(dir,'repo');mkdirSync(root);
  git('init','-b','main');git('config','user.name','Synthetic');git('config','user.email','synthetic@example.invalid');
  writeFileSync(join(root,'base.ts'),'export const base = true;\n');git('add','.');git('commit','-m','Base');
  git('switch','-c','topic');writeFileSync(join(root,'topic.ts'),'export const topic = true;\n');git('add','.');git('commit','-m','Topic one');git('commit','--allow-empty','-m','Topic two');topic=git('rev-parse','HEAD');
  git('switch','main');git('commit','--allow-empty','-m','Main one');
  git('update-ref','refs/remotes/origin/main',git('rev-parse','HEAD'));git('symbolic-ref','refs/remotes/origin/HEAD','refs/remotes/origin/main');
  git('config','remote.origin.url','.');git('config','remote.origin.fetch','+refs/heads/*:refs/remotes/origin/*');
  git('config','branch.main.remote','origin');git('config','branch.main.merge','refs/heads/main');
});
afterAll(()=>{if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe fixture path');rmSync(dir,{recursive:true,force:true});}});

it('reads the selected branch and returns exact current/default counts without changing checkout',async()=>{
  const before=git('rev-parse','HEAD'),refs=git('show-ref'),initial=await history();
  const chosen=initial.references.find(ref=>ref.name==='topic')!;
  const calls:string[][]=[];
  const result=await gitHistory(args=>{calls.push(args);return readGit(root,args);},{reference:chosen.id});
  expect(calls.filter(args=>args[0]==='merge-base'&&args.length===3)).toHaveLength(1);
  const [behind,ahead]=git('rev-list','--left-right','--count','main...topic').split(/\s+/).map(Number);
  expect(result.commits[0]?.hash).toBe(topic);expect(result.commits.some(commit=>commit.subject==='Main one')).toBe(false);
  expect(result.branchComparison?.current).toEqual({name:'main',state:'known',ahead,behind});
  expect(result.branchComparison?.default).toEqual({name:'main',basis:'remote-head',state:'known',ahead,behind});
  expect(result.selectedReference?.upstream).toBeUndefined();expect(result.selectedReference?.lastCommit).toMatch(/^\d{4}-/);
  expect(initial.references[0]).toMatchObject({name:'main',current:true,upstream:'origin/main'});
  const filtered=await history({query:'topic',referenceStart:100});
  expect(filtered.references).toEqual([]);expect(filtered.localBranches?.[0]).toMatchObject({name:'main',current:true});
  expect(git('rev-parse','HEAD')).toBe(before);expect(git('show-ref')).toBe(refs);expect(git('status','--porcelain')).toBe('');
});
it('keeps detached HEAD explicit and does not infer an upstream',async()=>{
  git('switch','--detach',topic);
  try {
    const result=await history();expect(result.branch).toBe('Detached HEAD');expect(result.references.some(ref=>ref.current)).toBe(false);
    expect(result.branchComparison?.current).toMatchObject({name:'Detached HEAD',state:'known',ahead:0,behind:0});
  }finally{git('switch','main');}
});
it('distinguishes unrelated histories and shallow ancestry from exact zero counts',async()=>{
  const tree=git('rev-parse','HEAD^{tree}');
  const orphan=execFileSync('git',['commit-tree',tree,'-m','Unrelated'],{cwd:root,windowsHide:true,encoding:'utf8'}).trim();git('update-ref','refs/heads/unrelated',orphan);
  const initial=await history(),branch=initial.references.find(ref=>ref.name==='unrelated')!;
  expect((await history({reference:branch.id})).branchComparison?.current).toMatchObject({state:'unrelated'});
  const shallow=join(dir,'shallow');git('clone','--depth=1','--no-local',root,shallow);
  const other=execFileSync('git',['-c','user.name=Synthetic','-c','user.email=synthetic@example.invalid','commit-tree',tree,'-p',git('rev-parse','HEAD'),'-m','Shallow topic'],{cwd:shallow,windowsHide:true,encoding:'utf8'}).trim();
  execFileSync('git',['update-ref','refs/heads/other',other],{cwd:shallow,windowsHide:true});
  const read=(options:Parameters<typeof gitHistory>[1]={})=>gitHistory(args=>readGit(shallow,args),options);
  const first=await read(),ref=first.references.find(ref=>ref.name==='other')!;
  expect((await read({reference:ref.id})).branchComparison?.current).toMatchObject({state:'shallow'});
},20_000);
it('conservatively withholds shallow counts and distinguishes failed reads',async()=>{
  expect(await compareBranch(async()=>{throw new Error('not available');},topic,{name:'main',tip:'a'.repeat(40)},true)).toEqual({name:'main',state:'shallow'});
  expect(await compareBranch(async()=>'',topic,{name:'main',tip:topic},true)).toEqual({name:'main',state:'known',ahead:0,behind:0});
  expect(await compareBranch(async args=>args[0]==='merge-base'?topic:'invalid',topic,{name:'main',tip:'a'.repeat(40)},false)).toEqual({name:'main',state:'unavailable'});
  expect(await compareBranch(async()=>{throw new Error('missing objects');},topic,{name:'main',tip:'a'.repeat(40)},false)).toEqual({name:'main',state:'unavailable'});
});
it('orders the current branch first and remaining local branches by commit recency',async()=>{
  const tree=git('rev-parse','HEAD^{tree}');
  for(const [name,date] of [['older','2010-01-01T00:00:00Z'],['newer','2030-01-01T00:00:00Z']]){
    const tip=execFileSync('git',['commit-tree',tree,'-m',name!],{cwd:root,windowsHide:true,encoding:'utf8',env:{...process.env,GIT_AUTHOR_DATE:date,GIT_COMMITTER_DATE:date}}).trim();
    git('update-ref',`refs/heads/${name}`,tip);
  }
  const refs=(await history()).references.filter(ref=>ref.kind==='branch');
  expect(refs[0]?.name).toBe('main');expect(refs[1]?.name).toBe('newer');expect(refs.at(-1)?.name).toBe('older');
});
