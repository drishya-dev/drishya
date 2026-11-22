import {Worker} from 'node:worker_threads';
import type {DiscoveredSource} from '@drishya/contracts';
import type {Adapter} from '../../../packages/capture-core/src/index.ts';
import {claudeAdapter} from '../../../packages/adapter-claude/src/index.ts';
import {codexAdapter} from '../../../packages/adapter-codex/src/index.ts';
import {sanitize} from '@drishya/privacy';

export interface DiscoveryResult {
  id:string;
  sources?:DiscoveredSource[];
  error?:{code?:string;message:string};
}
interface Pending {resolve:(sources:DiscoveredSource[])=>void;reject:(error:Error)=>void}
const stock=new Map([[claudeAdapter,claudeAdapter.discover],[codexAdapter,codexAdapter.discover]]);

/** Journal parsing has a short lifetime. Releasing its isolate keeps discovery's
 * temporary strings/heap capacity out of capture and later checkpoint writes.
 * Stateful Antigravity inspection and caller-supplied adapters keep their owner. */
export class DiscoveryService {
  readonly adapters:Adapter[];
  private active=new Map<string,Promise<DiscoveredSource[]>>();
  private queued=new Map<string,Pending>();
  private running:Promise<void>|undefined;
  private closed=false;

  constructor(adapters:Adapter[]){
    this.adapters=adapters.map(adapter=>stock.get(adapter)===adapter.discover
      ? {...adapter,discover:()=>this.discover(adapter.descriptor.id)}
      : adapter);
  }

  private discover(id:string):Promise<DiscoveredSource[]>{
    if(this.closed)return Promise.reject(Error('Discovery service is closed'));
    const current=this.active.get(id);
    if(current)return current;
    const promise=new Promise<DiscoveredSource[]>((resolve,reject)=>{this.queued.set(id,{resolve,reject});});
    this.active.set(id,promise);
    const clear=()=>{if(this.active.get(id)===promise)this.active.delete(id);};
    void promise.then(clear,clear);
    if(this.queued.size===1)queueMicrotask(()=>this.flush());
    return promise;
  }

  private flush():void{
    if(!this.queued.size || this.running)return;
    const batch=this.queued;this.queued=new Map();
    const job=this.run([...batch.keys()]).then(results=>{
      for(const [id,pending] of batch){
        const result=results.find(result=>result.id===id);
        if(result?.error)pending.reject(Object.assign(Error(result.error.message),{code:result.error.code}));
        else if(result?.sources)pending.resolve(result.sources);
        else pending.reject(Error('Discovery worker returned no result'));
      }
    },error=>{for(const pending of batch.values())pending.reject(error);});
    this.running=job;
    void job.then(()=>{this.running=undefined;this.flush();});
  }

  private async run(ids:string[]):Promise<DiscoveryResult[]>{
    const extension=import.meta.url.endsWith('.mjs')?'mjs':'ts';
    const worker=new Worker(new URL(`./discovery-worker.${extension}`,import.meta.url),{workerData:{ids}});
    try{
      return await new Promise<DiscoveryResult[]>((resolve,reject)=>{
        worker.once('message',resolve);
        worker.once('error',error=>reject(Error(sanitize(error.message).value)));
        worker.once('exit',code=>reject(Error(`Discovery worker exited before returning sources (${code})`)));
      });
    }finally{
      // Resolve callers only after the worker's heap and read handles are gone.
      await worker.terminate();
    }
  }

  async close():Promise<void>{
    this.closed=true;
    this.flush();
    while(this.running)await this.running;
  }
}
