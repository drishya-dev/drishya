import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({workers:[] as any[],startError:false}));
vi.mock('node:fs/promises',async importOriginal=>({
  ...await importOriginal<typeof import('node:fs/promises')>(),
  opendir:async()=>({read:async()=>({name:'synthetic-entry'}),close:async()=>{}}),
}));
vi.mock('node:worker_threads',async()=>{
  const {EventEmitter}=await import('node:events');
  return {Worker:class extends EventEmitter{
    terminate=vi.fn(async()=>0);
    readonly url:URL;
    readonly options:unknown;
    constructor(url:URL,options:unknown){super();this.url=url;this.options=options;if(state.startError)throw Error('Synthetic startup failure');state.workers.push(this);}
  }};
});
import {DiscoveryService} from '../src/discovery.ts';
import {claudeAdapter} from '../../../packages/adapter-claude/src/index.ts';
import {codexAdapter} from '../../../packages/adapter-codex/src/index.ts';
let service:DiscoveryService;
beforeEach(()=>{state.workers=[];state.startError=false;service=new DiscoveryService([claudeAdapter,codexAdapter]);});
afterEach(async()=>{await service.close();});
const tick=()=>new Promise<void>(resolve=>setImmediate(resolve));

it('coalesces same-adapter callers and batches adapters without mutating their owners',async()=>{
  const original=codexAdapter.discover;
  const first=service.adapters[1]!.discover(),second=service.adapters[1]!.discover();
  const claude=service.adapters[0]!.discover();
  expect(first).toBe(second);
  await tick();
  expect(state.workers).toHaveLength(1);
  const worker=state.workers[0];
  expect(worker.options).toMatchObject({workerData:{ids:['codex','claude-code']}});
  worker.emit('message',[{id:'codex',sources:[]},{id:'claude-code',sources:[]}]);
  await Promise.all([first,second,claude]);
  expect(worker.terminate).toHaveBeenCalledOnce();
  expect(codexAdapter.discover).toBe(original);
});

it('joins worker release before returning sources or finishing close',async()=>{
  let released!:()=>void;
  const exit=new Promise<number>(resolve=>{released=()=>resolve(0);});
  let returned=false,closed=false;
  const finding=service.adapters[1]!.discover().then(()=>{returned=true;});
  await tick();
  const worker=state.workers[0];
  worker.terminate.mockReturnValue(exit);
  worker.emit('message',[{id:'codex',sources:[]}]);
  const closing=service.close().then(()=>{closed=true;});
  await tick();
  expect(returned).toBe(false);expect(closed).toBe(false);
  await expect(service.adapters[0]!.discover()).rejects.toThrow('Discovery service is closed');
  released();await Promise.all([finding,closing]);
  expect(returned).toBe(true);expect(closed).toBe(true);
});

it('serializes staggered batches and drains the queued batch before close',async()=>{
  const codex=service.adapters[1]!.discover();
  await tick();
  const first=state.workers[0];
  let release!:()=>void;
  first.terminate.mockReturnValue(new Promise<number>(resolve=>{release=()=>resolve(0);}));
  const claude=service.adapters[0]!.discover();
  await tick();
  let closed=false;
  const closing=service.close().then(()=>{closed=true;});
  try{
    expect(state.workers).toHaveLength(1);
    first.emit('message',[{id:'codex',sources:[]}]);
    await tick();expect(state.workers).toHaveLength(1);
    release();await codex;await tick();
    expect(state.workers).toHaveLength(2);
    expect(closed).toBe(false);
  }finally{
    release();first.emit('message',[{id:'codex',sources:[]}]);
    await codex;await tick();
    state.workers[1]?.emit('message',[{id:'claude-code',sources:[]}]);
    await Promise.all([claude,closing]);
  }
  expect(closed).toBe(true);
});

it('preserves one adapter error without discarding another result',async()=>{
  const bad=service.adapters[0]!.discover(),good=service.adapters[1]!.discover();
  const rejection=expect(bad).rejects.toMatchObject({message:'Synthetic denied',code:'EACCES'});
  await tick();
  state.workers[0].emit('message',[{id:'claude-code',error:{message:'Synthetic denied',code:'EACCES'}},{id:'codex',sources:[]}]);
  await rejection;await expect(good).resolves.toEqual([]);
});

for(const event of ['error','exit'] as const)it(`rejects and releases a worker on ${event}`,async()=>{
  const finding=service.adapters[0]!.discover();
  const rejected=expect(finding).rejects.toThrow(event==='error'?'Synthetic worker failure':'exited before returning sources');
  await tick();
  state.workers[0].emit(event,event==='error'?Error('Synthetic worker failure'):1);
  await rejected;
  expect(state.workers[0].terminate).toHaveBeenCalledOnce();
});

it('reports startup failure without hanging close',async()=>{
  state.startError=true;
  await expect(service.adapters[0]!.discover()).rejects.toThrow('Synthetic startup failure');
  await service.close();
});

it('leaves copied/custom adapters in their original owner',async()=>{
  const discover=vi.fn(async()=>[]);
  const custom={...codexAdapter,discover};
  const customService=new DiscoveryService([custom]);
  try{
    expect(customService.adapters[0]).toBe(custom);
    await customService.adapters[0]!.discover();
    expect(discover).toHaveBeenCalledOnce();expect(state.workers).toHaveLength(0);
  }finally{await customService.close();}
});
