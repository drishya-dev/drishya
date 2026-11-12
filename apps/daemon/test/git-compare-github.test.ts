import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {afterAll,beforeAll,expect,it} from 'vitest';
import {App} from '../src/app.ts';
import {GithubLinks} from '../src/github-links.ts';

let dir:string,app:App;
beforeAll(()=>{dir=mkdtempSync(join(tmpdir(),'drishya-compare-gh-'));app=new App(join(dir,'data'));});
afterAll(async()=>{await app.close();if(resolve(dir).startsWith(resolve(tmpdir())+sep))rmSync(dir,{recursive:true,force:true});});

const pull={number:7,title:'Fix the thing',user:{login:'octo'},draft:true,head:{sha:'a'.repeat(40),ref:'octo/fix'},base:{ref:'main'}};

it('runs nothing until the person has allowed GitHub lookups',async()=>{
  const calls:string[][]=[];
  const links=new GithubLinks(app,async args=>{calls.push(args);return '[]';});
  expect(await links.pulls('o/r')).toEqual({status:'disabled',pulls:[]});
  expect(await links.compare('o/r','main','a'.repeat(40))).toEqual({status:'disabled'});
  expect(calls).toEqual([]);
});

it('lists open pull requests and compares through read-only gh api GET calls only',async()=>{
  const calls:string[][]=[];
  const links=new GithubLinks(app,async args=>{
    calls.push(args);
    if(args[0]==='--version')return 'gh version 2.0.0';
    return args[1]?.includes('/compare/')?JSON.stringify({ahead_by:1,files:[]}):JSON.stringify([pull,{number:8,title:'No head',head:{ref:'x'},base:{ref:'main'}}]);
  });
  await links.set(true);
  const listed=await links.pulls('o/r');
  expect(listed.status).toBe('ready');
  expect(listed.pulls).toEqual([{number:7,title:'Fix the thing',author:'octo',draft:true,url:'https://github.com/o/r/pull/7',baseName:'main',headName:'octo/fix',headOid:'a'.repeat(40)}]);
  const compared=await links.compare('o/r','release/1.0','b'.repeat(40));
  expect(compared).toEqual({status:'ready',value:{ahead_by:1,files:[]}});
  const gh=calls.filter(call=>call[0]!=='--version');
  expect(gh.map(call=>call[0])).toEqual(['api','api']);
  // `gh api` defaults to GET; no method, field or input flag may appear, so nothing can write.
  for(const call of gh)expect(call.filter(arg=>arg.startsWith('-'))).toEqual([]);
  expect(gh[1]![1]).toBe(`repos/o/r/compare/${encodeURIComponent('release/1.0')}...${'b'.repeat(40)}`);
});

it('refuses unexpected repository names, commits and branch names before running anything',async()=>{
  const calls:string[][]=[];
  const links=new GithubLinks(app,async args=>{calls.push(args);return args[0]==='--version'?'gh':'[]';});
  await links.set(true);calls.length=0;
  expect((await links.pulls('o/r --repo=evil')).status).toBe('failed');
  expect((await links.pulls('../../x')).status).toBe('failed');
  expect(await links.compare('o/r','main','not-a-commit')).toEqual({status:'failed'});
  expect(await links.compare('o/r','x'.repeat(201),'a'.repeat(40))).toEqual({status:'failed'});
  expect(calls).toEqual([]);
});

it('says why gh could not answer: missing, signed out, or unreachable',async()=>{
  const failing=(code:string|undefined,stderr:string)=>new GithubLinks(app,async args=>{
    if(args[0]==='--version')return 'gh';
    throw Object.assign(new Error('failed'),{code,stderr});
  });
  const signedOut=failing(undefined,'To get started with GitHub CLI, please run: gh auth login');
  await signedOut.set(true);
  expect((await signedOut.pulls('o/r')).status).toBe('gh-unauthenticated');
  expect(await signedOut.compare('o/r','main','a'.repeat(40))).toEqual({status:'gh-unauthenticated'});
  const offline=failing(undefined,'dial tcp: lookup api.github.com: no such host');
  await offline.set(true);
  expect((await offline.pulls('o/r')).status).toBe('failed');
  const missing=new GithubLinks(app,async()=>{throw Object.assign(new Error('spawn gh ENOENT'),{code:'ENOENT'});});
  await missing.set(true);
  expect((await missing.pulls('o/r')).status).toBe('gh-missing');
  await missing.set(false);
});
