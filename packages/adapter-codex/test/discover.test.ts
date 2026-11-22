import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {codexAdapter} from '../src/index.ts';

let dir:string,previous:string|undefined;
beforeEach(()=>{dir=mkdtempSync(join(tmpdir(),'drishya-codex-discovery-'));previous=process.env.DRISHYA_CODEX_HOME;process.env.DRISHYA_CODEX_HOME=dir;mkdirSync(join(dir,'sessions'));});
afterEach(()=>{if(previous===undefined)delete process.env.DRISHYA_CODEX_HOME;else process.env.DRISHYA_CODEX_HOME=previous;if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('Unsafe discovery fixture');rmSync(dir,{recursive:true,force:true});});
const user=(text:string)=>({type:'response_item',payload:{type:'message',role:'user',content:[{type:'input_text',text}]}});
const meta={type:'session_meta',payload:{id:'synthetic-session',cwd:'/synthetic/workspace',parent_thread_id:'synthetic-parent',agent_nickname:'Synthetic child'}};
const write=(rows:unknown[])=>writeFileSync(join(dir,'sessions','rollout-fixture.jsonl'),rows.map(row=>JSON.stringify(row)).join('\n')+'\n');

for(const promptFirst of [false,true])it(`preserves first metadata and eligible prompt when prompt-first=${promptFirst}`,async()=>{
  const first=user('Synthetic first prompt');
  const unnecessary={type:'response_item',payload:{type:'function_call_output',call_id:'unneeded-discovery-payload',output:'x'.repeat(50000)}};
  write([...(promptFirst?[first,meta]:[meta,first]),unnecessary,{...meta,payload:{...meta.payload,cwd:'/synthetic/later'}},user('Later prompt')]);
  const parse=vi.spyOn(JSON,'parse');
  try {
    const sources=await codexAdapter.discover();
    expect(sources).toHaveLength(1);
    expect(sources[0]).toMatchObject({sessionId:'synthetic-session',cwd:'/synthetic/workspace',title:'Synthetic first prompt',parentSessionId:'synthetic-parent',agentName:'Synthetic child'});
    expect(parse.mock.calls.some(([text])=>String(text).includes('unneeded-discovery-payload'))).toBe(false);
  } finally {parse.mockRestore();}
});

it('keeps scanning when either metadata or an eligible prompt is still missing',async()=>{
  write([meta,user('<environment_context>Injected environment</environment_context>'),{type:'response_item',payload:{type:'function_call_output',output:'Synthetic output'}},user('Actual first prompt')]);
  expect((await codexAdapter.discover())[0]).toMatchObject({sessionId:'synthetic-session',title:'Actual first prompt'});
});
