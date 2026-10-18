import {it,expect} from 'vitest';
import type {Projection,Operation,Artifact} from '@drishya/contracts';
import {reviewInsights} from '../src/review-insights.ts';
const projection=():Projection=>({reducerVersion:'test',recordingId:'synthetic',observationCount:0,lastSequence:999,harnesses:[],agents:[],operations:[],prose:[],artifacts:[],links:[],timeline:[],passages:[],files:[],gaps:[],capabilities:{}});
const op=(n:number):Operation=>({id:`op-${n}`,agentId:'agent',kind:'shell',tool:'exec',title:'Captured command',titleProvenance:{kind:'captured',observationIds:[]},origin:{type:'native',tool:'exec'},status:'ok',startSequence:n,paths:[],detail:{kind:'shell',command:'echo same'},artifactIds:[],observationIds:[],classification:{kind:'derived',rule:'test',observationIds:[]}});
it('groups only proven identical commands and links factual unknown/missing/gap conditions',()=>{
  const p=projection();p.operations=Array.from({length:3},(_,n)=>op(n));
  p.operations.push({...op(4),status:'unknown'},{...op(5),kind:'edit',detail:{kind:'edit',path:'a.ts',hunks:[],created:false,reconstruction:'unavailable'}});
  // Same clipped prefix with three different full bodies must never imply repetition.
  for(let n=6;n<9;n++){const input=`art_${n}_input`;p.operations.push({...op(n),artifactIds:[input]});p.artifacts.push({id:input,kind:'excerpt',blob:`different-${n}`,availability:'complete'} as Artifact);}
  for(let n=10;n<15;n++)p.operations.push({...op(n),detail:{kind:'shell',command:'text(await tools.write_stdin({session_id:1,chars: ""}));'}});
  p.gaps=[{sequence:9,reason:'missing-content'}];
  const result=reviewInsights(p);expect(result.findings.filter(f=>f.kind==='repeated-command')).toHaveLength(1);
  const repeat=result.findings.find(f=>f.kind==='repeated-command')!;expect(repeat.count).toBe(4);expect(repeat.examples.map(e=>e.operationId)).toEqual(['op-0','op-4']);
  expect(result.findings.map(f=>f.kind)).toEqual(expect.arrayContaining(['unknown-outcome','missing-change','capture-gap']));
});
it('pages all prompts and counts operations by start window rather than late result sequence',()=>{
  const p=projection();
  for(let n=0;n<45;n++){p.timeline.push({type:'turn',id:`turn-${n}`,sequence:n*10,agentId:'agent',prompt:`Prompt ${n}`});p.operations.push({...op(n*10+1),endSequence:900});}
  const first=reviewInsights(p),second=reviewInsights(p,1),third=reviewInsights(p,2);
  expect(first.promptCount).toBe(45);expect(first.prompts[0]!.ordinal).toBe(45);expect(third.prompts).toHaveLength(5);
  const prompts=[...first.prompts,...second.prompts,...third.prompts];expect(new Set(prompts.map(p=>p.id)).size).toBe(45);expect(prompts.every(p=>p.operations===1)).toBe(true);
  expect(first.findingCount).toBe(1);expect(first.findings[0]!.count).toBe(45);
});
