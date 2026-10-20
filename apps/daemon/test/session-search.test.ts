import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {afterAll,beforeAll,expect,it} from 'vitest';
import {App} from '../src/app.ts';
import type {SessionSearchHit} from '../../../packages/store/src/search-types.ts';
let dir:string,app:App,id:string;
beforeAll(async()=>{
  dir=mkdtempSync(join(tmpdir(),'drishya-session-search-'));app=new App(join(dir,'store'));
  const t=(n:number)=>`2026-10-20T10:0${n}:00Z`,call=(n:number,name:string,args:object)=>[{type:'response_item',timestamp:t(n),payload:{type:'function_call',name,call_id:`c${n}`,arguments:JSON.stringify(args)}},{type:'response_item',timestamp:t(n),payload:{type:'function_call_output',call_id:`c${n}`,output:`result for needle${n}`}}];
  const rows=[{type:'session_meta',timestamp:t(0),payload:{id:'s',cwd:dir}},
    {type:'event_msg',timestamp:t(1),payload:{type:'task_started',turn_id:'t1'}},{type:'response_item',timestamp:t(1),payload:{type:'message',role:'assistant',content:[{type:'output_text',text:'first turn finds needle in prose'}]}},
    {type:'event_msg',timestamp:t(2),payload:{type:'task_started',turn_id:'t2'}},...call(2,'exec_command',{cmd:'grep needle src/cart.ts'})];
  const path=join(dir,'s.jsonl');writeFileSync(path,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');id=(await app.ingest.importSource('codex',path)).recordingId;
});
afterAll(async()=>{if(app)await app.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary directory');rmSync(dir,{recursive:true,force:true});}});

it('returns each in-session hit with its turn, kind and time, in capture order',()=>{
  const hits:SessionSearchHit[]=app.store.search(id,'needle',50);
  expect(hits.length).toBeGreaterThanOrEqual(2);
  expect(hits.map(hit=>hit.turn)).toEqual([...hits.map(hit=>hit.turn)].sort((a,b)=>(a??0)-(b??0)));
  const prose=hits.find(hit=>hit.kind==='message.assistant')!;
  expect(prose).toMatchObject({turn:1,time:'2026-10-20T10:01:00Z'});expect(prose.snippet).toContain('«needle»');
  const call=hits.find(hit=>hit.kind==='tool.call');
  expect(call).toMatchObject({turn:2,tool:'exec_command'});
  expect(hits.every(hit=>hit.observationId&&hit.snippet)).toBe(true);
});
it('matches every word of a multi-word query, not pieces of words',()=>{expect(app.store.search(id,'first turn finds').map(hit=>hit.kind)).toEqual(['message.assistant']);});
it('finds nothing for an empty or unsafe query',()=>{expect(app.store.search(id,'  ')).toEqual([]);expect(app.store.search(id,'"*^:()')).toEqual([]);});
