// SITE-3: measure a whole visit to the landing site (apps/site) the same way every time, so before/after tables compare.
//   node scripts/site-trace.ts [--dist apps/site/dist] [--widths 1440,2000] [--runs 3] [--label before] [--throttle 4]
// Serves the built site on a free port, drives Edge through Playwright with CDP CPU throttling and records, per run:
//   load (first 3.5 s) · hover · scroll through every section · resize.
// Frame times come from a requestAnimationFrame recorder installed before the page runs; long tasks, long animation
// frames and layout shifts from PerformanceObservers; task attribution from a CDP trace. Output: .local/site-trace/<label>.json
import {createReadStream,existsSync,mkdirSync,statSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {extname,join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium,type Page,type CDPSession} from '@playwright/test';

const repo=fileURLToPath(new URL('../',import.meta.url));
const arg=(name:string,fallback:string)=>{const i=process.argv.indexOf(`--${name}`);return i>=0?process.argv[i+1]!:fallback;};
const dist=resolve(repo,arg('dist','apps/site/dist'));
const widths=arg('widths','1440,2000').split(',').map(Number);
const runs=Number(arg('runs','3'));
const label=arg('label','run');
const throttle=Number(arg('throttle','4'));
const only=arg('only','');
// --hz 60 models a 60 Hz display on a faster one: page code gets requestAnimationFrame at most 60 times a second.
const hz=Number(arg('hz','0'));

const types:Record<string,string>={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.txt':'text/plain'};
const server=createServer((req,res)=>{
  let p=decodeURIComponent((req.url??'/').split('?')[0]!);if(p.endsWith('/'))p+='index.html';
  const file=resolve(dist,'.'+p);
  if(!file.startsWith(dist+sep)||!existsSync(file)||!statSync(file).isFile()){res.writeHead(404).end();return;}
  res.writeHead(200,{'content-type':types[extname(file)]??'application/octet-stream','cache-control':'no-store'});
  createReadStream(file).pipe(res);
});
await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
const port=(server.address() as {port:number}).port;
const base=`http://127.0.0.1:${port}/`;

// Recorder, installed before any page script. Everything is stamped with performance.now() (ms since navigation).
const cap=`(() => {
  const HZ=${hz};if(!HZ)return;
  const orig=window.requestAnimationFrame.bind(window);let q=[],id=0,pending=false,lastT=-1e9;
  const gap=1000/HZ-1;
  const step=t=>{if(t-lastT<gap){orig(step);return;}lastT=t;pending=false;const run=q;q=[];for(const [,cb] of run)cb(t);};
  window.requestAnimationFrame=cb=>{q.push([++id,cb]);if(!pending){pending=true;orig(step);}return id;};
  window.cancelAnimationFrame=i=>{q=q.filter(x=>x[0]!==i);};
})();`;
const recorder=`(() => {
  const frames=[],tasks=[],loaf=[],shifts=[];let phase='load';
  window.__trace={frames,tasks,loaf,shifts,setPhase(p){phase=p;},scrollY:()=>scrollY};
  let last=0;
  const tick=t=>{frames.push([t,last?t-last:0,phase,Math.round(scrollY)]);last=t;requestAnimationFrame(tick);};
  requestAnimationFrame(tick);
  const obs=(type,fn)=>{try{new PerformanceObserver(l=>l.getEntries().forEach(fn)).observe({type,buffered:true});}catch{}};
  obs('longtask',e=>tasks.push([e.startTime,e.duration,phase,(e.attribution&&e.attribution[0]&&e.attribution[0].containerType)||'']));
  obs('long-animation-frame',e=>loaf.push([e.startTime,e.duration,e.blockingDuration,phase,(e.scripts||[]).map(s=>[s.invokerType,s.sourceFunctionName||'',s.sourceURL.split('/').pop(),Math.round(s.duration)])]));
  obs('layout-shift',e=>{if(!e.hadRecentInput)shifts.push([e.startTime,e.value,phase,(e.sources||[]).map(s=>s.node&&(s.node.className||s.node.nodeName)).join(',')]);});
})();`;

const pct=(a:number[],q:number)=>{if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.floor(q*s.length))]!;};
const r1=(n:number)=>Math.round(n*10)/10;

type Frame=[number,number,string,number];
function summarize(frames:Frame[],from:number,to:number){
  const d=frames.filter(f=>f[0]>=from&&f[0]<to&&f[1]>0).map(f=>f[1]);
  return {frames:d.length,p50:r1(pct(d,.5)),p95:r1(pct(d,.95)),p99:r1(pct(d,.99)),max:r1(Math.max(0,...d)),over33:d.filter(x=>x>33.4).length,over50:d.filter(x=>x>50).length};
}

async function visit(width:number,run:number){
  const height=width>=2000?1100:900;
  const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-precise-memory-info']});
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
  const page=await context.newPage();
  await page.addInitScript(cap);
  await page.addInitScript(recorder);
  const cdp:CDPSession=await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:throttle});
  await cdp.send('Performance.enable');
  const chunks:any[]=[];
  cdp.on('Tracing.dataCollected',(e:any)=>chunks.push(...e.value));
  await cdp.send('Tracing.start',{transferMode:'ReportEvents',traceConfig:{includedCategories:['devtools.timeline','disabled-by-default-devtools.timeline','loading','blink.user_timing'],recordMode:'recordAsMuchAsPossible'}});
  const metric=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m:any)=>[m.name,m.value]));
  const m0=await metric();
  const t0=Date.now();
  await page.goto(base,{waitUntil:'load'});
  await page.waitForTimeout(3600); // the first 3.5 s are the load phase
  const loadEnd=await page.evaluate(()=>performance.now());
  await page.evaluate(()=>(window as any).__trace.setPhase('settle'));
  await page.waitForTimeout(1500);
  // Hover: move across the hero (the dots follow the pointer), then over the nav buttons.
  await page.evaluate(()=>(window as any).__trace.setPhase('hover-hero'));
  for(let i=0;i<60;i++){await page.mouse.move(200+i*18,200+Math.sin(i/6)*140);await page.waitForTimeout(16);}
  for(const sel of ['.nav .button.primary','.hero-actions .button.primary','.hero-actions .button.ghost']){await page.hover(sel).catch(()=>{});await page.waitForTimeout(260);}
  // Scroll through the page at a steady wheel rate (about 2400 px/s); phase = where we are.
  await page.mouse.move(width/2,height/2);
  await page.evaluate(()=>(window as any).__trace.setPhase('scroll'));
  const total=await page.evaluate(()=>document.documentElement.scrollHeight);
  const sectionTops=await page.evaluate(()=>[...document.querySelectorAll('[data-chapter]')].map(s=>[(s as HTMLElement).dataset.chapter,Math.round((s as HTMLElement).getBoundingClientRect().top+scrollY),Math.round((s as HTMLElement).getBoundingClientRect().height)]));
  let guard=0;
  while(guard++<2000){
    const y=await page.evaluate(()=>scrollY);
    if(y+height>=await page.evaluate(()=>document.documentElement.scrollHeight)-4)break;
    await page.mouse.wheel(0,120);await page.waitForTimeout(50);
  }
  await page.waitForTimeout(600);
  // Compare rows: hover each so the proof card opens and closes (needs scroll back to the section).
  await page.evaluate(()=>(window as any).__trace.setPhase('hover-compare'));
  await page.evaluate(()=>document.querySelector('.compare')?.scrollIntoView({block:'center'}));
  await page.waitForTimeout(900);
  const rows=await page.$$('[data-compare-row]');
  for(const row of rows.slice(0,6)){await row.hover().catch(()=>{});await page.waitForTimeout(420);}
  await page.mouse.move(5,5);await page.waitForTimeout(500);
  // Resize: narrower, then back.
  await page.evaluate(()=>(window as any).__trace.setPhase('resize'));
  for(const w of [width-240,width-480,width-240,width]){await page.setViewportSize({width:w,height});await page.waitForTimeout(500);}
  await page.waitForTimeout(800);
  const m1=await metric();
  await new Promise<void>(res=>{cdp.once('Tracing.tracingComplete',()=>res());void cdp.send('Tracing.end');});
  const data=await page.evaluate(()=>{const t=(window as any).__trace;return {frames:t.frames,tasks:t.tasks,loaf:t.loaf,shifts:t.shifts};});
  await browser.close();

  const frames=data.frames as Frame[];
  const mainFrames=frames; // all pages share one main thread; iframe work blocks the same rAF
  const phases=['load','settle','hover-hero','scroll','hover-compare','resize'];
  const byPhase:Record<string,any>={};
  for(const p of phases){const f=frames.filter(x=>x[2]===p);if(!f.length)continue;const a=f[0]![0],b=f[f.length-1]![0]+1;byPhase[p]=summarize(frames,a,b);}
  byPhase['first3.5s']=summarize(frames,0,3500);
  const loadFrames=frames.filter(f=>f[0]<3500&&f[1]>0).sort((a,b)=>b[1]-a[1]).slice(0,5).map(f=>[r1(f[0]),r1(f[1])]);
  // Scroll p95 per section (by scroll position).
  const sections:Record<string,any>={};
  const secs=sectionTops as [string,number,number][];
  for(const [name,top,h] of secs){const f=frames.filter(x=>x[2]==='scroll'&&x[1]>0&&x[3]+height/2>=top&&x[3]+height/2<top+h).map(x=>x[1]);sections[name]={frames:f.length,p95:r1(pct(f,.95)),max:r1(Math.max(0,...f)),over33:f.filter(x=>x>33.4).length};}
  // Trace attribution: main-thread tasks over 50 ms and what they were made of.
  const tasks:any[]=[];
  const rtMain=chunks.filter(e=>e.name==='RunTask'&&e.ph==='X'&&e.dur>50000);
  const kids=chunks.filter(e=>e.ph==='X'&&e.dur>0);
  const bucket=(n:string)=>/^(FunctionCall|EvaluateScript|v8\.run|V8\.|EventDispatch|FireAnimationFrame|TimerFire|RunMicrotasks|v8\.compile|CompileCode|ParseHTML)/.test(n)?'script':/Layout$|^UpdateLayoutTree$|RecalculateStyles|^Layout$|IntersectionObserverController|ResizeObserver/.test(n)?(/UpdateLayoutTree|RecalculateStyles/.test(n)?'style':'layout'):/Paint|PrePaint|Layerize|Commit|UpdateLayer|CompositeLayers|RasterTask|ImageDecode|Decode/.test(n)?'paint':'other';
  for(const t of rtMain){
    const inside=kids.filter(k=>k.pid===t.pid&&k.tid===t.tid&&k.ts>=t.ts&&k.ts+k.dur<=t.ts+t.dur&&k!==t);
    const sum:Record<string,number>={};const names:Record<string,number>={};
    // use only top-level children (not nested inside another child) so durations are not double counted
    const top=inside.filter(k=>!inside.some(o=>o!==k&&o.ts<=k.ts&&o.ts+o.dur>=k.ts+k.dur&&(o.dur>k.dur||o.ts<k.ts)));
    for(const k of top){const b=bucket(k.name);sum[b]=(sum[b]??0)+k.dur/1000;names[k.name]=(names[k.name]??0)+k.dur/1000;}
    const topNames=Object.entries(names).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([n,d])=>`${n} ${Math.round(d)}ms`);
    tasks.push({atMs:r1(t.ts/1000),ms:r1(t.dur/1000),parts:Object.fromEntries(Object.entries(sum).map(([k,v])=>[k,Math.round(v)])),top:topNames});
  }
  // Trace time origin differs from performance.now(); report order only plus the first one's offset from the first task.
  const shifts=(data.shifts as any[]);
  const cls=r1(shifts.reduce((s,x)=>s+x[1],0)*1000)/1000;
  // Paint/layout counts per phase come from CDP counters over the whole visit; scroll-linked repaints from the trace.
  const traceEvents=chunks.filter(e=>e.ph==='X'||e.ph==='I');
  const count=(re:RegExp)=>traceEvents.filter(e=>re.test(e.name)).length;
  const counters={layoutCount:Math.round((m1.LayoutCount??0)-(m0.LayoutCount??0)),recalcStyleCount:Math.round((m1.RecalcStyleCount??0)-(m0.RecalcStyleCount??0)),layoutMs:Math.round(((m1.LayoutDuration??0)-(m0.LayoutDuration??0))*1000),recalcStyleMs:Math.round(((m1.RecalcStyleDuration??0)-(m0.RecalcStyleDuration??0))*1000),scriptMs:Math.round(((m1.ScriptDuration??0)-(m0.ScriptDuration??0))*1000),taskMs:Math.round(((m1.TaskDuration??0)-(m0.TaskDuration??0))*1000),paintEvents:count(/^Paint$/),layoutEvents:count(/^Layout$/),rasterTasks:count(/^RasterTask$/)};
  const longTasks=(data.tasks as any[]).map(t=>({at:r1(t[0]),ms:r1(t[1]),phase:t[2],container:t[3]}));
  const loaf=(data.loaf as any[]).filter(x=>x[1]>50).map(x=>({at:r1(x[0]),ms:r1(x[1]),blocking:r1(x[2]),phase:x[3],scripts:x[4].slice(0,3)}));
  return {width,run,seconds:r1((Date.now()-t0)/1000),byPhase,worstLoadFrames:loadFrames,sections,longTasks,loaf,tasksOver50ms:tasks,cls,shifts:shifts.map(s=>({at:r1(s[0]),v:Math.round(s[1]*1000)/1000,phase:s[2],node:s[3]})),counters,page:{total}};
}

mkdirSync(resolve(repo,'.local/site-trace'),{recursive:true});
const results:any[]=[];
for(const w of widths)for(let r=1;r<=runs;r++){
  if(only&&!only.split(',').includes(String(w)))continue;
  const res=await visit(w,r);results.push(res);
  const s=res.byPhase;
  console.log(`${label} ${w}px${hz?` @${hz}Hz`:''} run ${r}: first3.5s p95 ${s['first3.5s'].p95} max ${s['first3.5s'].max} >33:${s['first3.5s'].over33} | scroll p95 ${s.scroll?.p95} max ${s.scroll?.max} >33:${s.scroll?.over33} | longtasks ${res.longTasks.length} cls ${res.cls}`);
}
writeFileSync(resolve(repo,`.local/site-trace/${label}.json`),JSON.stringify({label,throttle,hz,results},null,1));
server.close();
