import {existsSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {expect,it,vi} from 'vitest';
import setupBrowser from '../../../tests/browser/global-setup.ts';
import {useSyntheticHarnessHomes} from '../../../scripts/synthetic-harness-homes.ts';

// CLI compilation is external to discovery. Browser runs exercise the real
// metadata stubs; this unit keeps actual adapter discovery and setup cleanup.
vi.mock('../../../tests/browser/native-cli-stubs.ts',()=>({useNativeCliStubs:()=>{
  process.env.PATH='synthetic-cli-prefix';return ()=>{};
}}));

it('starts default discovery and watches inside the disposable unit scope',async()=>{
  for(const key of ['DRISHYA_CLAUDE_HOME','DRISHYA_CODEX_HOME','DRISHYA_ANTIGRAVITY_HOME'])expect(process.env[key],key).toBeDefined();
  const {defaultAdapters,defaultWatchRoots}=await import('../../../packages/ingest/src/index.ts');
  expect(defaultWatchRoots().map(root=>root.dir)).toEqual([join(process.env.DRISHYA_CLAUDE_HOME!,'projects'),join(process.env.DRISHYA_CODEX_HOME!,'sessions')]);
  for(const adapter of defaultAdapters())expect((await adapter.discover()).length,adapter.descriptor.id).toBe(0);
});

it('isolates browser discovery in empty homes, keeps real discovery working and restores the environment',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'drishya-discovery-canary-'));
  const keys=['DRISHYA_CODEX_HOME','DRISHYA_CLAUDE_HOME','DRISHYA_ANTIGRAVITY_HOME'] as const;
  const previous=keys.map(key=>process.env[key]);
  const previousPath=process.env.PATH;
  for(const key of keys)process.env[key]=dir;
  let cleanup:(()=>void)|undefined;
  try {
    cleanup=setupBrowser();
    for(const key of keys)expect(process.env[key],key).not.toBe(dir);
    const {defaultAdapters,defaultWatchRoots}=await import('../../../packages/ingest/src/index.ts');
    expect(defaultWatchRoots().map(root=>root.dir)).toEqual([
      join(process.env.DRISHYA_CLAUDE_HOME!,'projects'),join(process.env.DRISHYA_CODEX_HOME!,'sessions'),
    ]);
    for(const adapter of defaultAdapters())expect((await adapter.discover()).length,adapter.descriptor.id).toBe(0);
    // The real adapter still discovers fixtures explicitly written in its isolated home.
    const sessions=join(process.env.DRISHYA_CODEX_HOME!,'sessions');mkdirSync(sessions,{recursive:true});
    const journal=join(sessions,'rollout-canary.jsonl');
    writeFileSync(journal,JSON.stringify({type:'session_meta',payload:{id:'synthetic-canary',cwd:dir},timestamp:'2026-11-21T00:00:00Z'})+'\n');
    expect((await defaultAdapters().find(a=>a.descriptor.id==='codex')!.discover()).map(source=>source.path)).toEqual([journal]);
    cleanup();cleanup=undefined;
    for(const key of keys)expect(process.env[key]).toBe(dir);
    expect(process.env.PATH).toBe(previousPath);
  } finally {
    cleanup?.();
    keys.forEach((key,index)=>{if(previous[index]===undefined)delete process.env[key];else process.env[key]=previous[index];});
    if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('Discovery canary escaped system temp');
    rmSync(dir,{recursive:true,force:true});
  }
});

it('restores an unset override and removes only its own temporary homes',()=>{
  const keys=['DRISHYA_CODEX_HOME','DRISHYA_CLAUDE_HOME','DRISHYA_ANTIGRAVITY_HOME'] as const;
  const previous=keys.map(key=>process.env[key]);
  for(const key of keys)delete process.env[key];
  try {
    const cleanup=useSyntheticHarnessHomes();
    const homes=keys.map(key=>process.env[key]!);
    cleanup();cleanup();
    for(const key of keys)expect(process.env[key]).toBeUndefined();
    // Only paths returned by the helper are checked; no native home is touched.
    for(const home of homes)expect(existsSync(home)).toBe(false);
  } finally {keys.forEach((key,index)=>{if(previous[index]===undefined)delete process.env[key];else process.env[key]=previous[index];});}
});
