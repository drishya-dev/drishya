import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach,beforeEach,expect,it} from 'vitest';
import {sessionSegments} from '../src/session-segments.ts';
import type {DiscoveredSource} from '@drishya/contracts';

const family='11111111-1111-1111-1111-111111111111',parentThread='22222222-2222-2222-2222-222222222222',childThread='33333333-3333-3333-3333-333333333333';
let dir:string,parent:string;
beforeEach(()=>{dir=mkdtempSync(join(tmpdir(),'drishya-segments-'));parent=join(dir,`rollout-${family}_${parentThread}.jsonl`);writeFileSync(parent,JSON.stringify({type:'session_meta',payload:{id:family,cwd:dir}})+'\n');});
afterEach(()=>rmSync(dir,{recursive:true,force:true}));
function candidate(overrides:Record<string,unknown>={},name=childThread):DiscoveredSource {
  const path=join(dir,`rollout-${family}_${name}.jsonl`);
  writeFileSync(path,JSON.stringify({type:'session_meta',payload:{id:family,cwd:dir,history_mode:'paginated',history_base:{thread_id:parentThread,end_ordinal_exclusive:10,end_byte_offset:50},...overrides}})+'\n');
  return {adapterId:'codex',harness:'codex',path,cwd:dir,bytes:100,modifiedAt:'2026-10-17T00:00:00Z',companions:[],importedRecordingId:'rec_child'};
}
it('offers only explicit same-family native children, retaining their exact source and boundary',async()=>{
  const child=candidate();expect(await sessionSegments(parent,[child])).toEqual({items:[{source:child,boundary:{ordinal:10,bytes:50}}],partial:false});
});
it('never guesses ancestry from titles, folders, time, family alone or invalid native boundaries',async()=>{
  for(const overrides of [{history_base:undefined},{id:'44444444-4444-4444-4444-444444444444'},{session_id:childThread},{cwd:join(dir,'other')},{history_mode:'full'},{history_base:{thread_id:childThread,end_ordinal_exclusive:10,end_byte_offset:50}},{history_base:{thread_id:parentThread,end_ordinal_exclusive:1.5,end_byte_offset:50}},{history_base:{thread_id:parentThread,end_ordinal_exclusive:10,end_byte_offset:999999}}]) expect((await sessionSegments(parent,[candidate(overrides)])).items).toEqual([]);
});
it('does not infer a child from an unknown parent or a self-referencing copied filename',async()=>{
  writeFileSync(parent,'{}\n');expect(await sessionSegments(parent,[candidate()])).toEqual({items:[],partial:false});
  writeFileSync(parent,JSON.stringify({type:'session_meta',payload:{id:family,cwd:dir}})+'\n');
  const copy=candidate({},parentThread);copy.path=copy.path.replace('rollout-','copy-');
  expect((await sessionSegments(parent,[copy])).items).toEqual([]);
});
it('bounds candidate metadata reads and reports incomplete inspection',async()=>{
  const child=candidate();const missing={...child,path:join(dir,`missing-${childThread}.jsonl`)};
  expect(await sessionSegments(parent,[missing])).toEqual({items:[],partial:true});
  expect((await sessionSegments(parent,Array.from({length:65},()=>child)))).toMatchObject({partial:true});
});
