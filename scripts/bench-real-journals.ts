// Opt-in real-journal benchmark. Native sources are read-only; only disposable snapshots
// are appended. Raw snapshot bytes and the redacted store are removed on exit.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createReadStream, createWriteStream, mkdtempSync, rmSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import { tmpdir, cpus, totalmem } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { App } from '../apps/daemon/src/app.ts';
import { startServer } from '../apps/daemon/src/server.ts';
import { sampleRss } from './resource-probe.ts';

const self = fileURLToPath(import.meta.url);
const percentile = (values: number[], p: number) => [...values].sort((a,b)=>a-b)[Math.max(0, Math.ceil(values.length*p)-1)] ?? 0;
const arg = (name: string, fallback: string) => { const i=process.argv.indexOf(name); return i<0?fallback:process.argv[i+1]; };
const browserEnabled=process.argv.includes('--browser');
const fullImport=process.argv.includes('--full-import');
assert.ok(!(fullImport&&browserEnabled),'run full import and browser append probes separately');

async function measure(source: string) {
  // Freeze the last complete line: an actively growing source can end in half a write.
  const observedBytes=statSync(source).size;
  const fd=openSync(source,'r');let bytes=0;
  try{let end=observedBytes;const buf=Buffer.alloc(1048576);while(end>0){const start=Math.max(0,end-buf.length);const read=readSync(fd,buf,0,end-start,start);const lf=buf.subarray(0,read).lastIndexOf(10);if(lf>=0){bytes=start+lf+1;break;}end=start;}}finally{closeSync(fd);}
  assert.ok(bytes>0,'journal has no complete line');
  assert.ok(bytes>1024, 'source too small');
  const dir=mkdtempSync(join(tmpdir(),'drishya-real-journal-'));
  const snapshot=join(dir,'rollout-benchmark.jsonl');
  const split=fullImport?bytes:Math.max(1024,bytes-Math.min(16*1048576,Math.floor(bytes/10)));
  let app: App|undefined;
  let server: Awaited<ReturnType<typeof startServer>>|undefined;
  let browser: { close(): Promise<void> }|undefined;
  let stopPeak: ReturnType<typeof sampleRss>|undefined;
  const stalls:number[]=[];
  let last=performance.now();
  const timer=setInterval(()=>{const now=performance.now();stalls.push(Math.max(0,now-last-20));last=now;},20);
  try {
    await pipeline(createReadStream(source,{start:0,end:split-1}),createWriteStream(snapshot));
    app=new App(join(dir,'data'));
    stopPeak=sampleRss();
    const t0=performance.now();
    const imported=await app.ingest.importSource('codex',snapshot);
    const importMs=performance.now()-t0;
    const pageAt=performance.now();
    const history=await app.history.page(imported.recordingId,{count:1});
    const historyPageMs=performance.now()-pageAt;
    if(fullImport){
      assert.equal((await app.ingest.sync(imported.recordingId)).added,0,'repeat import duplicated observations');
      const peakRssMiB=await stopPeak();stopPeak=undefined;
      return {mode:'complete import',sourceBytes:bytes,importMs,historyPageMs,observations:imported.added,gaps:imported.gaps,peakRssMiB,eventLoopMaxMs:Math.max(0,...stalls)};
    }
    let ui:Record<string,unknown>|undefined;
    let sample: Promise<unknown>|undefined;
    if(browserEnabled){
      const { chromium }=await import('@playwright/test');
      server=await startServer({app,port:0});
      const instance=await chromium.launch({channel:process.env.DRISHYA_BROWSER_CHANNEL||undefined});browser=instance;
      const page=await instance.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'});
      await page.goto(server.launchUrl);
      const open=page.locator('.mh-session-open, .home .row-main.link').first();
      await open.waitFor({timeout:60000});
      const openAt=performance.now();await open.click();
      await page.locator('.history').waitFor({timeout:60000});
      ui={openMs:performance.now()-openAt,mode:'default resource/motion settings, 1440x900'};
      sample=page.evaluate(async()=>{
        const frames:number[]=[],requests:number[]=[];let running=true,last=performance.now();
        const frame=(now:number)=>{frames.push(now-last);last=now;if(running)requestAnimationFrame(frame);};requestAnimationFrame(frame);
        for(let i=0;i<20;i++){
          const start=performance.now();const response=await fetch('/v1/recordings');
          if(!response.ok)throw new Error('heartbeat failed');await response.arrayBuffer();requests.push(performance.now()-start);
          const el=document.querySelector('.history');if(el)el.scrollTop+=i%2?48:-48;
          await new Promise(r=>setTimeout(r,50));
        }
        running=false;
        const p95=(xs:number[])=>xs.sort((a,b)=>a-b)[Math.ceil(xs.length*.95)-1]??0;
        return {frameP95Ms:p95(frames),frameMaxMs:Math.max(0,...frames),apiP95Ms:p95(requests),apiMaxMs:Math.max(...requests),domNodes:document.querySelectorAll('*').length};
      }).catch(()=>({probeError:'browser probe interrupted'}));
    }
    // Append only to our snapshot. Splitting through a record also tests the partial-line cursor.
    await pipeline(createReadStream(source,{start:split,end:bytes-1}),createWriteStream(snapshot,{flags:'a'}));
    const tailAt=performance.now();let tailAdded=0,tailGaps=0,turns=0,more=true;
    while(more){const r=await app.ingest.sync(imported.recordingId,{turnBytes:16*1048576,acceptUnterminated:false});tailAdded+=r.added;tailGaps+=r.gaps;more=r.more;turns++;assert.ok(turns<1000,'tail did not converge');await new Promise(r=>setImmediate(r));}
    const tailMs=performance.now()-tailAt;
    const stable=await app.ingest.sync(imported.recordingId,{turnBytes:16*1048576,acceptUnterminated:false});
    assert.equal(stable.added,0,'repeat tail duplicated observations');
    const count=app.store.getRecording(imported.recordingId)!.observationCount;
    assert.ok(count>=imported.added+tailAdded,'observation accounting mismatch');
    const capturedGaps=Number((app.store.db.prepare("SELECT count(*) AS n FROM observations WHERE recording_id = ? AND kind = 'capture.gap'").get(imported.recordingId) as {n:number}).n);
    const concurrentCaptured=count-imported.added-tailAdded; // The normal viewer also requests bounded native catch-up.
    if(sample){Object.assign(ui!,await sample);assert.ok(!ui!.probeError,'browser probe did not complete');}
    const peakRssMiB=await stopPeak();stopPeak=undefined;
    // Independently import the complete snapshot: accounting alone cannot detect dropped records.
    const identity=(owner:App)=>{const hash=createHash('sha256');for(const row of owner.store.db.prepare('SELECT id FROM observations WHERE recording_id = ? ORDER BY seq').iterate(imported.recordingId))hash.update(String(row.id)+'\n');return hash.digest('hex');};
    const expectedIdentity=identity(app);
    const reference=new App(join(dir,'reference'));
    try {const full=await reference.ingest.importSource('codex',snapshot);assert.equal(full.added,count,'tail lost or added observations versus fresh import');assert.equal(full.gaps,capturedGaps,'gap mismatch');assert.equal(identity(reference),expectedIdentity,'tail identity/order differs from fresh import');}finally{await reference.close();}
    return {verifiedAgainstFullImport:true,sourceBytes:bytes,importBytes:split,tailBytes:bytes-split,importMs,tailMs,tailTurns:turns,concurrentCaptured,historyPageMs,initialOperations:history.operationCount,observations:count,gaps:capturedGaps,peakRssMiB,eventLoopP95Ms:percentile(stalls,.95),eventLoopMaxMs:Math.max(0,...stalls),ui};
  } finally {
    clearInterval(timer);if(stopPeak)await stopPeak();if(browser)await browser.close();if(server)await server.close();if(app)await app.close();
    if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('benchmark escaped temp');
    rmSync(dir,{recursive:true,force:true,maxRetries:10,retryDelay:200});
  }
}

if(process.argv.includes('--worker')){
  const result=await measure(arg('--source',''));console.log(JSON.stringify(result));
}else{
  const runs=Number(arg('--runs','5'));
  const sources=process.argv.filter((v,i)=>i>1&&!v.startsWith('--')&&process.argv[i-1]!=='--runs');
  assert.ok(Number.isSafeInteger(runs)&&runs>=1&&runs<=10&&sources.length>0,'usage: node scripts/bench-real-journals.ts [--runs 5] [--browser | --full-import] <journal...>');
  console.log(JSON.stringify({reference:{platform:process.platform,node:process.version,cpu:cpus()[0]?.model,logicalCpus:cpus().length,ramGiB:totalmem()/1073741824,powerMode:'not controlled',cache:'OS cache not flushed; first run and warm repeats reported separately',browser:browserEnabled?(process.env.DRISHYA_BROWSER_CHANNEL||'chromium'):'not measured'}}));
  for(let s=0;s<sources.length;s++)for(let run=1;run<=runs;run++){
    await new Promise<void>((ok,fail)=>{
      const child=spawn(process.execPath,[self,'--worker','--source',resolve(sources[s]),...(browserEnabled?['--browser']:[]),...(fullImport?['--full-import']:[])],{stdio:['ignore','pipe','pipe'],env:process.env});
      let out='';child.stdout.on('data',chunk=>{out+=chunk;});
      // Do not print exception messages or source-bearing diagnostics from real journals.
      child.stderr.on('data',()=>{});child.once('error',fail);
      child.once('exit',code=>{if(code!==0)return fail(new Error(`source ${s+1} run ${run} failed (${code}); no session content printed`));try{console.log(JSON.stringify({source:s+1,run,...JSON.parse(out.trim())}));ok();}catch{fail(new Error('invalid benchmark result'));}});
    });
  }
}
