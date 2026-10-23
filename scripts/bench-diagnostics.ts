import { getHeapStatistics } from 'node:v8';
import type { Page, CDPSession } from '@playwright/test';
import type { App } from '../apps/daemon/src/app.ts';
import type { RecordingsTiming } from '../apps/daemon/src/server.ts';
import type { RssSample } from './resource-probe.ts';

const mib = (bytes: number) => bytes / 1048576;
export const quantile = (xs: number[], p: number) => [...xs].sort((a,b) => a-b)[Math.max(0, Math.ceil(xs.length*p)-1)] ?? 0;
const clock = () => performance.now();
type Heap = { at: number; heapUsed: number; heapPhysical: number; external: number };
const mainHeap = (): Heap & { rss: number } => {
  const h = getHeapStatistics();
  return { at: clock(), rss: process.memoryUsage.rss(), heapUsed: h.used_heap_size, heapPhysical: h.total_physical_size, external: h.external_memory };
};
const observedBefore = <T extends { at: number }>(xs: T[], at: number) => xs.filter(x=>x.at<=at).at(-1);
const maximum = (xs: Heap[], key: 'heapUsed'|'heapPhysical'|'external') => Math.max(0,...xs.map(x=>x[key]));

/** Numeric-only observations. Nothing here is used to redefine the legacy gate metrics. */
export class BenchmarkDiagnostics {
  readonly phases: { name: string; at: number }[] = [];
  readonly main: (Heap & { rss: number })[] = [];
  readonly history: (Heap & { threadId: number })[] = [];
  readonly playwright: { label: string; memory: ReturnType<typeof mainHeap> }[] = [];
  readonly requests: RecordingsTiming[] = [];
  readonly stalls: { at: number; ms: number }[] = [];
  rss: RssSample[] = [];
  private pending?: Promise<void>;
  private errorCount = 0;
  private stopped = false;
  private timer: ReturnType<typeof setInterval>;
  private readonly app: App;
  constructor(app: App) {
    this.app=app;
    this.timer = setInterval(() => this.observe(), 100);
    this.timer.unref();
  }
  phase(name: string) { this.phases.push({ name, at: clock() }); this.observe(); }
  playwrightPoint(label: string) { this.playwright.push({label,memory:mainHeap()}); }
  private observe() {
    this.main.push(mainHeap());
    if (!this.pending) this.pending = this.app.history.diagnosticHeap().then(h => {
      if(h) this.history.push({ ...h, at: clock() });
    }).catch(() => { this.errorCount++; }).finally(() => { this.pending=undefined; });
  }
  stop() { if(this.stopped)return; this.stopped=true; clearInterval(this.timer); this.observe(); }
  async finish(pageData?: PageData) {
    this.stop();
    const end = clock();
    await this.pending;
    const phases=this.phases.map((phase,i) => {
      const stop=this.phases[i+1]?.at??end;
      const ticks=this.rss.filter(x=>x.at>=phase.at&&x.at<stop);
      const peak=ticks.reduce<RssSample|undefined>((a,b)=>!a||b.rss>a.rss?b:a,undefined);
      const main=this.main.filter(x=>x.at>=phase.at&&x.at<stop),history=this.history.filter(x=>x.at>=phase.at&&x.at<stop);
      const mh=peak&&observedBefore(this.main,peak.at),wh=peak&&observedBefore(this.history,peak.at);
      const residual=peak&&mh ? peak.rss-mh.heapPhysical-mh.external-(wh?.heapPhysical??0)-(wh?.external??0)-peak.samplerHeapPhysical-peak.samplerExternal : undefined;
      return { name:phase.name, elapsedMs:stop-phase.at, rssSamples:ticks.length, peakRssMiB:peak?mib(peak.rss):null,
        mainHeapUsedMaxMiB:mib(maximum(main,'heapUsed')),mainHeapPhysicalMaxMiB:mib(maximum(main,'heapPhysical')),mainExternalMaxMiB:mib(maximum(main,'external')),
        historyHeapSamples:history.length,historyHeapUsedMaxMiB:mib(maximum(history,'heapUsed')),historyHeapPhysicalMaxMiB:mib(maximum(history,'heapPhysical')),historyExternalMaxMiB:mib(maximum(history,'external')),
        atRssPeak:peak&&mh?{atMs:peak.at,mainHeapLagMs:Math.abs(mh.at-peak.at),historyHeapObserved:!!wh,historyHeapLagMs:wh?Math.abs(wh.at-peak.at):null,mainHeapPhysicalMiB:mib(mh.heapPhysical),mainExternalMiB:mib(mh.external),historyHeapPhysicalMiB:mib(wh?.heapPhysical??0),historyExternalMiB:mib(wh?.external??0),samplerHeapPhysicalMiB:mib(peak.samplerHeapPhysical),samplerExternalMiB:mib(peak.samplerExternal),unattributedResidualMiB:residual===undefined?null:mib(residual)}:null };
    });
    const api=(pageData?.requests??[]).map(r=>{
      const server=this.requests.find(s=>s.probeId===r.probeId);
      const handler=server?.responseEndAtMs===undefined?null:server.responseEndAtMs-server.receivedAtMs;
      return {...r,serverHandlerMs:handler,serverFinishMs:server?server.finishedAtMs-server.receivedAtMs:null,
        unattributedRoundTripMs:handler===null?null:r.durationMs-handler,
        longTaskOverlapMs:(pageData?.longTasks??[]).reduce((n,t)=>n+Math.max(0,Math.min(t.start+t.duration,r.endAtMs)-Math.max(t.start,r.startAtMs)),0)};
    });
    const sqliteConfig=(db: App['store']['db'])=>Object.fromEntries(['cache_size','mmap_size','page_size','temp_store'].map(k=>[k,Object.values(db.prepare('PRAGMA '+k).get()??{})[0]??null]));
    return { basis:'RSS is process-wide and includes the Playwright client and sampler. Isolate heaps are sampled (not exact per-thread RSS). Residual is NOT SQLite-only: includes code, native stacks, allocator/slack and unmatched allocations. Heap/RSS timestamps and lags are reported; component maxima are not additive.',
      errorCount:this.errorCount,phases,playwright:this.playwright.map((point,i)=>{
        const before=this.playwright[0]!.memory;
        return {label:point.label,rssMiB:mib(point.memory.rss),mainHeapUsedMiB:mib(point.memory.heapUsed),mainHeapPhysicalMiB:mib(point.memory.heapPhysical),mainExternalMiB:mib(point.memory.external),rssDeltaFromBeforeImportMiB:i?mib(point.memory.rss-before.rss):0,mainHeapUsedDeltaMiB:i?mib(point.memory.heapUsed-before.heapUsed):0};
      }), sqlite:{main:sqliteConfig(this.app.store.db),history:await this.app.history.diagnosticSqlite()},
      interaction:{ basis:'Twenty original fetches; server request-received to response-end is a lower bound (excludes pre-handler event-loop queueing). Residual includes transport/queueing/page scheduling. Resource Timing is matched to the earliest same-URL resource starting inside each sequential fetch; pageAfterResponse includes body/promise delivery and page scheduling after network completion. Missing entries remain null. Long-task overlap can overlap server work and is not additive. Quantiles cannot be subtracted.',requests:api,
        roundTripP95Ms:quantile(api.map(r=>r.durationMs),.95),pageAfterResponseP95Ms:quantile(api.flatMap(r=>r.pageAfterResponseMs===null?[]:[r.pageAfterResponseMs]),.95),serverHandlerP95Ms:quantile(api.flatMap(r=>r.serverHandlerMs===null?[]:[r.serverHandlerMs]),.95),residualP95Ms:quantile(api.flatMap(r=>r.unattributedRoundTripMs===null?[]:[r.unattributedRoundTripMs]),.95)},
      appendEventLoop:this.phases.find(x=>x.name==='append')?this.stalls.filter(x=>x.at>=this.phases.find(p=>p.name==='append')!.at&&x.at<end):[],page:pageData };
  }
}

type PageData = { requests: {probeId:string;startAtMs:number;endAtMs:number;durationMs:number;resourceStartAtMs:number|null;responseStartAtMs:number|null;responseEndAtMs:number|null;pageAfterResponseMs:number|null}[];longTasks:{start:number;duration:number}[];longTasksSupported:boolean;windowMs:number;windowStartMs:number;windowEndMs:number;cdp?:Record<string,number> };
type BrowserEntry={startTime:number;duration:number};
type BrowserObserver={observe(options:{type:string;buffered:boolean}):void;takeRecords():BrowserEntry[];disconnect():void};
type BrowserObserverConstructor={supportedEntryTypes:string[];new(callback:(list:{getEntries():BrowserEntry[]})=>void):BrowserObserver};
type PageState = { start: number; end?: number; requests: PageData['requests'];longTasks:PageData['longTasks'];observer?:BrowserObserver; supported:boolean };
export class PageDiagnostics {
  private cdp?:CDPSession;
  private before:Record<string,number>={};
  private after:Record<string,number>={};
  private readonly page:Page;
  constructor(page:Page){this.page=page;}
  async start() {
    this.cdp=await this.page.context().newCDPSession(this.page);
    await this.cdp.send('Performance.enable');
    this.before=Object.fromEntries((await this.cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
    await this.page.evaluate(()=>{
      const Observer=(globalThis as unknown as {PerformanceObserver:BrowserObserverConstructor}).PerformanceObserver;
      const state:PageState={start:performance.now(),requests:[],longTasks:[],supported:Observer.supportedEntryTypes.includes('longtask')};
      if(state.supported){state.observer=new Observer(list=>{for(const e of list.getEntries())state.longTasks.push({start:e.startTime,duration:e.duration});});state.observer.observe({type:'longtask',buffered:true});}
      (globalThis as unknown as {__drishyaBench:PageState}).__drishyaBench=state;
    });
  }
  async markAppend() {
    this.before=Object.fromEntries((await this.cdp!.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
    await this.page.evaluate(()=>{(globalThis as unknown as {__drishyaBench:PageState}).__drishyaBench.start=performance.now();});
  }
  async markReaderUpdate() {
    await this.page.evaluate(()=>{(globalThis as unknown as {__drishyaBench:PageState}).__drishyaBench.end=performance.now();});
    this.after=Object.fromEntries((await this.cdp!.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
  }
  async finish():Promise<PageData> {
    const data=await this.page.evaluate(()=>{
      const s=(globalThis as unknown as {__drishyaBench:PageState}).__drishyaBench,end=(globalThis as unknown as {__drishyaBench:PageState}).__drishyaBench.end??performance.now();
      for(const e of s.observer?.takeRecords()??[])s.longTasks.push({start:e.startTime,duration:e.duration});
      s.observer?.disconnect();
      return {requests:s.requests,longTasks:s.longTasks.filter(t=>t.start+t.duration>s.start&&t.start<end),longTasksSupported:s.supported,windowMs:end-s.start,windowStartMs:s.start,windowEndMs:end};
    });
    const after=this.after;
    const metrics:Record<string,number>={};
    for(const key of ['ScriptDuration','TaskDuration','LayoutDuration','RecalcStyleDuration','LayoutCount','RecalcStyleCount']) {
      const value=after[key],before=this.before[key];
      if(value===undefined||before===undefined)throw Error('CDP metric unavailable: '+key);
      metrics[key]=value-before;
    }
    const heap=after.JSHeapUsedSize;
    if(heap===undefined)throw Error('CDP heap metric unavailable');
    metrics.JSHeapUsedSize=heap;
    await this.cdp!.detach();return {...data,cdp:metrics};
  }
}
