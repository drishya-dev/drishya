import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {expect,it} from 'vitest';
import {App} from '../src/app.ts';
import {WorkspaceAccess} from '../src/workspace.ts';
import {GitReview} from '../src/git-review.ts';

it('App close aborts and joins owned Git work before SQLite and checkout cleanup',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'drishya-git-lifecycle-')),root=join(dir,'repo');mkdirSync(root);
  execFileSync('git',['init','-q'],{cwd:root,windowsHide:true});
  const journal=join(dir,'source.jsonl');writeFileSync(journal,JSON.stringify({type:'session_meta',payload:{id:'synthetic-git-lifecycle',cwd:root}})+'\n');
  const app=new App(join(dir,'data')),id=(await app.ingest.importSource('codex',journal)).recordingId;
  const workspace=new WorkspaceAccess(app);await workspace.approve(id);
  let began!:()=>void,release!:()=>void;
  const started=new Promise<void>(resolve=>{began=resolve;});
  let signal:AbortSignal|undefined,aborted=false,cleanupReadsStore=false;
  const review=new GitReview(workspace,async(_root,args,ownedSignal)=>{
    if(args[0]==='rev-parse')return root;
    signal=ownedSignal;signal?.addEventListener('abort',()=>{aborted=true;},{once:true});began();
    return new Promise<string>(resolve=>{release=()=>{try{cleanupReadsStore=app.store.listRecordings().some(recording=>recording.id===id);}catch{cleanupReadsStore=false;}resolve('synthetic completed');};});
  });
  await review.approve(id);
  const work=review.inspect(id,git=>git(['synthetic-held-read']));
  // Handle rejection immediately; closing is expected to cancel inspection.
  const outcome=work.then(()=>undefined,error=>error);
  await started;
  let queuedRan=false;
  const queued=review.inspect(id,async()=>{queuedRan=true;return 'must not run';}).then(()=>undefined,error=>error);
  let closed=false;
  const closing=app.close().then(()=>{closed=true;});
  try{
    await new Promise<void>(resolve=>setImmediate(resolve));
    expect(signal).toBeDefined();expect(aborted).toBe(true);expect(closed).toBe(false);
    await expect(review.inspect(id,async()=>undefined)).rejects.toMatchObject({status:503});
  }finally{
    release();await outcome;await queued;await closing;
    if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('Unsafe Git fixture');rmSync(dir,{recursive:true,force:true});
  }
  expect(cleanupReadsStore).toBe(true);expect(closed).toBe(true);
  expect(queuedRan).toBe(false);expect(await outcome).toMatchObject({status:409});
});
