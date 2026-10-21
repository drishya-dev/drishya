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
    for(const flags of [[],['--full-import']]){
      const {stdout}=await exec(process.execPath,['scripts/bench-real-journals.ts','--worker','--source',source,...flags],{cwd:resolve('.'),timeout:30000});
      const result=JSON.parse(stdout.trim());
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
