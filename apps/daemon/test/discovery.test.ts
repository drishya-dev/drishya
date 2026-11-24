import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const workerStarts=vi.hoisted(()=>({count:0}));
vi.mock('node:worker_threads',async importOriginal=>{
  const actual=await importOriginal<typeof import('node:worker_threads')>();
  return {...actual,Worker:class extends actual.Worker{
    constructor(...args:ConstructorParameters<typeof actual.Worker>){super(...args);workerStarts.count++;}
  }};
});
import {claudeAdapter} from '../../../packages/adapter-claude/src/index.ts';
import {codexAdapter} from '../../../packages/adapter-codex/src/index.ts';
import {App} from '../src/app.ts';

let dir:string,app:App;
let previous:(string|undefined)[];
const keys=['DRISHYA_CLAUDE_HOME','DRISHYA_CODEX_HOME'];
beforeEach(()=>{
  workerStarts.count=0;
  dir=mkdtempSync(join(tmpdir(),'drishya-discovery-worker-'));
  previous=keys.map(key=>process.env[key]);
  keys.forEach((key,index)=>{process.env[key]=join(dir,String(index));});
  mkdirSync(join(dir,'0','projects','synthetic'),{recursive:true});
  mkdirSync(join(dir,'1','sessions'),{recursive:true});
  app=new App(join(dir,'data'));
  // The stateful adapter stays in its existing owner and remains replaceable.
  const index=app.ingest.adapters.findIndex(adapter=>adapter.descriptor.id==='antigravity');
  app.ingest.adapters[index]={...app.ingest.adapters[index]!,discover:async()=>[],diagnostics:()=>[{code:'synthetic-diagnostic',message:'Synthetic unavailable transcript'}]};
});
afterEach(async()=>{
  await app.close();
  keys.forEach((key,index)=>{if(previous[index]===undefined)delete process.env[key];else process.env[key]=previous[index];});
  if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('Unsafe discovery fixture');
  rmSync(dir,{recursive:true,force:true});
});
const marker='synthetic-discovery-thread-marker';

it('avoids parser workers for empty roots and notices a later source fixture',async()=>{
  rmSync(join(dir,'0','projects','synthetic'),{recursive:true});
  expect(await app.ingest.discover('codex')).toEqual([]);
  expect(await app.ingest.discover('claude-code')).toEqual([]);
  expect(workerStarts.count).toBe(0);
  const {codex}=journals();
  const sources=await app.ingest.discover('codex');
  expect(sources.map(source=>source.path)).toEqual([codex]);
  expect(workerStarts.count).toBe(1);
});

it('avoids parser workers when the native discovery directory does not exist',async()=>{
  rmSync(join(dir,'1','sessions'),{recursive:true});
  expect(await app.ingest.discover('codex')).toEqual([]);
  expect(workerStarts.count).toBe(0);
});

it('preserves adapter errors when the configured root cannot be read as a directory',async()=>{
  rmSync(join(dir,'1','sessions'),{recursive:true});
  writeFileSync(join(dir,'1','sessions'),'Synthetic file, not a source directory');
  const report=await app.ingest.discoverReport('codex');
  expect(report.sources).toEqual([]);
  expect(report.errors).toMatchObject([{adapterId:'codex',code:'read-failed'}]);
  expect(workerStarts.count).toBe(1);
});
function journals(){
  mkdirSync(join(dir,'0','projects','synthetic'),{recursive:true});
  const codex=join(dir,'1','sessions','rollout-synthetic.jsonl');
  writeFileSync(codex,[{type:'session_meta',payload:{id:'synthetic-codex',cwd:'/synthetic/workspace',parent_thread_id:'synthetic-parent',agent_nickname:'Synthetic child'}},{type:'response_item',payload:{type:'message',role:'user',content:[{type:'input_text',text:marker}]}}].map(row=>JSON.stringify(row)).join('\n')+'\n');
  const claude=join(dir,'0','projects','synthetic','synthetic-claude.jsonl');
  writeFileSync(claude,JSON.stringify({type:'user',uuid:'synthetic-uuid',sessionId:'synthetic-claude',cwd:'/synthetic/workspace',message:{content:'Synthetic Claude prompt'}})+'\n');
  mkdirSync(join(dir,'0','projects','synthetic','synthetic-claude','subagents'),{recursive:true});
  writeFileSync(join(dir,'0','projects','synthetic','synthetic-claude','subagents','agent-child.jsonl'),'{}\n');
  return {codex,claude};
}

it('does not parse discovery journal bodies on the capture isolate',async()=>{
  journals();
  const parse=vi.spyOn(JSON,'parse');
  try{
    const report=await app.ingest.discoverReport('codex');
    expect(report.errors).toEqual([]);
    expect(report.sources[0]?.title).toBe(marker);
    expect(parse.mock.calls.some(([text])=>String(text).includes(marker))).toBe(false);
  }finally{parse.mockRestore();}
});

it('preserves direct metadata, companions, imported identity and custom diagnostics',async()=>{
  const files=journals();
  const direct=[...await claudeAdapter.discover(),...await codexAdapter.discover()].sort((a,b)=>b.modifiedAt.localeCompare(a.modifiedAt));
  const report=await app.ingest.discoverReport();
  expect(report.sources).toEqual(direct);
  expect(report.errors).toEqual([{adapterId:'antigravity',code:'synthetic-diagnostic',message:'Synthetic unavailable transcript'}]);
  const imported=await app.ingest.importSource('codex',files.codex);
  expect(imported.added).toBe(3); // metadata, prompt and captured parent link
  expect((await app.ingest.discover('codex'))[0]?.importedRecordingId).toBe(imported.recordingId);
});

it('keeps custom discovery direct and preserves permission-denied errors beside successful sources',async()=>{
  journals();
  const index=app.ingest.adapters.findIndex(adapter=>adapter.descriptor.id==='claude-code');
  const discover=vi.fn(async()=>{throw Object.assign(Error('Synthetic denied'),{code:'EACCES'});});
  app.ingest.adapters[index]={...app.ingest.adapters[index]!,discover};
  const report=await app.ingest.discoverReport();
  expect(discover).toHaveBeenCalledOnce();
  expect(report.sources).toHaveLength(1);
  expect(report.sources[0]?.adapterId).toBe('codex');
  expect(report.errors).toContainEqual({adapterId:'claude-code',code:'permission-denied',message:'Synthetic denied'});
});
