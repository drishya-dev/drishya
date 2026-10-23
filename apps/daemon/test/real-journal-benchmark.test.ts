import { startServer, type RecordingsTiming } from '../src/server.ts';
import { BenchmarkDiagnostics } from '../../../scripts/bench-diagnostics.ts';
import { sampleRss } from '../../../scripts/resource-probe.ts';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from 'vitest';
import { generateLargeJournal } from '../../../scripts/make-large-journal.ts';
import { App } from '../src/app.ts';

const exec=promisify(execFile);
test('real-journal probe snapshots complete lines and preserves source bytes in both modes',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'drishya-journal-probe-test-'));
  const source=join(dir,'rollout-test.jsonl');
  const stamp='2026-10-20T10:00:00Z';
  const records=[
    {timestamp:stamp,type:'session_meta',payload:{id:'probe-test',cwd:dir}},
    {timestamp:stamp,type:'response_item',payload:{type:'function_call',name:'shell_command',call_id:'one',arguments:JSON.stringify({command:'echo sample'})}},
    {timestamp:stamp,type:'response_item',payload:{type:'function_call_output',call_id:'one',output:'invented sample '.repeat(400)}},
  ];
  // A writer has begun another line. It must not become a malformed gap or a complete event.
  writeFileSync(source,records.map(r=>JSON.stringify(r)+'\n').join('')+'{"unfinished":');
  const digest=()=>createHash('sha256').update(readFileSync(source)).digest('hex');
  const original=digest();
  try{
    for(const enabled of [false,true])for(const flags of [[],['--full-import']]){
      const {stdout}=await exec(process.execPath,['scripts/bench-real-journals.ts','--worker','--source',source,...flags],{cwd:resolve('.'),timeout:30000,env:{...process.env,DRISHYA_BENCH_DIAGNOSTICS:enabled?'1':'0'}});
      const result=JSON.parse(stdout.trim());
      if(enabled){expect(result.diagnostics.errorCount).toBe(0);expect(result.diagnostics.phases.map((p:{name:string})=>p.name)).toContain('prefix-import');expect(result.diagnostics.sqlite.main.cache_size).toBe(-8192);}
      else expect(result.diagnostics).toBeUndefined();
      expect(result.observations).toBe(3);expect(result.gaps).toBe(0);
      expect(result.rescanIdempotent).toBe(true);
      expect(result.sourceBytes).toBe(readFileSync(source).length-'{"unfinished":'.length);
      expect(digest()).toBe(original);
      expect(stdout).not.toContain('invented sample');expect(stdout).not.toContain(source);
      if(!flags.length)expect(result.verifiedAgainstFullImport).toBe(true);
    }
  }finally{
    if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('test escaped temp');
    rmSync(dir,{recursive:true,force:true,maxRetries:10,retryDelay:200});
  }
},60000);

test('invented large workload is deterministic and retains calibrated typed/usage observations',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'drishya-invented-probe-'));
  const source=join(dir,'rollout-invented.jsonl');
  const app=new App(join(dir,'data'));
  try{
    const first=generateLargeJournal(source,2);
    const second=generateLargeJournal(join(dir,'same.jsonl'),2);
    expect(second).toEqual(first);
    expect(()=>generateLargeJournal(source,2)).toThrow();
    expect(first.maxRecordBytes).toBeLessThan(16*1048576);
    const imported=await app.ingest.importSource('codex',source);
    expect(imported.added).toBe(first.expectedObservations);
    expect(imported.gaps).toBe(0);
    const before=app.store.observations(imported.recordingId).map(o=>o.id);
    expect((await app.ingest.rescan(imported.recordingId)).added).toBe(0);
    expect(app.store.observations(imported.recordingId).map(o=>o.id)).toEqual(before);
  }finally{await app.close();rmSync(dir,{recursive:true,force:true,maxRetries:10,retryDelay:200});}
},30000);


const fixture=resolve('fixtures/synthetic/codex/rollout-checkout-review.jsonl');
test('diagnostics preserve the recordings response and expose only numeric timing plus a bounded probe id', async()=>{
  const dir=mkdtempSync(join(tmpdir(),'drishya-timing-test-'));
  const app=new App(join(dir,'data')); const samples:RecordingsTiming[]=[];
  await app.ingest.importSource('codex',fixture);
  const plain=await startServer({app,port:0});
  try{
    const expected=await (await fetch(plain.url+'/v1/recordings',{headers:{authorization:'Bearer '+plain.token}})).json();
    await plain.close();
    const diagnostic=await startServer({app,port:0,recordingsTiming:s=>{samples.push(s);throw Error('observer failure');}});
    try{
      const response=await fetch(diagnostic.url+'/v1/recordings',{headers:{authorization:'Bearer '+diagnostic.token,'x-drishya-bench-id':'7'}});
      expect(response.status).toBe(200);expect(await response.json()).toEqual(expected);
      await fetch(diagnostic.url+'/v1/recordings',{headers:{authorization:'Bearer '+diagnostic.token,'x-drishya-bench-id':'not-a-probe'}});
      expect(samples).toHaveLength(2);
      expect(samples[0].probeId).toBe('7');expect(samples[1].probeId).toBeUndefined();
      for(const s of samples){expect(s.status).toBe(200);expect(s.responseEndAtMs).toBeGreaterThanOrEqual(s.receivedAtMs);expect(s.finishedAtMs).toBeGreaterThanOrEqual(s.responseEndAtMs!);}
      expect(JSON.stringify(samples)).not.toContain('not-a-probe');
      expect(Object.keys(samples[0]).sort()).toEqual(['finishedAtMs','probeId','receivedAtMs','responseEndAtMs','status']);
    }finally{await diagnostic.close();}
  }finally{await plain.close();await app.close();if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error("unsafe temp");rmSync(dir,{recursive:true,force:true});}
});

test('phase diagnostics never invent a worker before it exists or subtract future heap samples',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'drishya-memory-test-'));const app=new App(join(dir,'data'));
  const d=new BenchmarkDiagnostics(app);const stop=sampleRss(samples=>{d.rss=samples;});
  try{
    expect(await app.history.diagnosticHeap()).toBeUndefined();expect(await app.history.diagnosticSqlite()).toBeUndefined();
    d.phase('prefix-import');const imported=await app.ingest.importSource('codex',fixture);
    d.phase('first-history-page');await app.history.page(imported.recordingId,{count:1});
    await new Promise(r=>setTimeout(r,120));d.stop();const peak=await stop();const result=await d.finish();
    expect(result.errorCount).toBe(0);expect(result.phases[0].historyHeapSamples).toBe(0);
    expect(result.phases[0].atRssPeak?.historyHeapObserved??false).toBe(false);
    expect(result.phases[1].historyHeapSamples).toBeGreaterThan(0);
    expect(result.sqlite.main.cache_size).toBe(-8192);
    expect(result.sqlite.history).toMatchObject({fullProjectionResident:true,reducerResident:true});
    for(const phase of result.phases){if(phase.peakRssMiB!==null)expect(phase.peakRssMiB).toBeLessThanOrEqual(peak);if(phase.atRssPeak){expect(phase.atRssPeak.mainHeapLagMs).toBeGreaterThanOrEqual(0);if(phase.atRssPeak.historyHeapLagMs!==null)expect(phase.atRssPeak.historyHeapLagMs).toBeGreaterThanOrEqual(0);}}
    expect(result.basis).toContain('NOT SQLite-only');
  }finally{d.stop();await app.close();if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('unsafe temp');rmSync(dir,{recursive:true,force:true});}
},30000);
