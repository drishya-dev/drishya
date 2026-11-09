import {describe, expect, it} from 'vitest';
import type {QueueTimelineItem, TimelineItem} from '@drishya/contracts';
import {queuePage, type QueueEvidence} from '../src/queued-inputs.ts';
const queued = (n: number, extra: Partial<QueueTimelineItem> = {}): QueueTimelineItem => ({type:'queue',id:`queue_${n}`,sourceObservationId:`obs_${n}`,ownerRecordingId:'r',sequence:n,agentId:'r.agent:main',sourceId:'s',generation:0,operation:'enqueue',preview:'same',inputArtifactId:`art_${n}`,...extra});
const prompt = (n: number, text = 'same'): Extract<TimelineItem,{type:'turn'}> => ({type:'turn',id:`turn_${n}`,sequence:n,agentId:'r.agent:main',prompt:text});
const evidence: QueueEvidence = {input:item=>item.type==='queue'?{text:'same',sourceId:item.sourceId,generation:item.generation}:{text:'same',sourceId:'s',generation:0}};
describe('pending queue and historical receipts',()=>{
 it('consumes one oldest identical receipt per exact prompt, preserving every receipt',()=>{
  const timeline=[queued(0),queued(1),prompt(2)];
  const page=queuePage(timeline,'r',{},evidence);
  expect(page.items.map(item=>item.state)).toEqual(['recorded','delivered']);
  expect(page.pendingTotal).toBe(1);expect(page.total).toBe(2);
  expect(queuePage(timeline,'r',{state:'pending'},evidence).items.map(item=>item.id)).toEqual(['obs_1']);
  expect(queuePage(timeline,'r',{state:'history'},evidence).items.map(item=>item.id)).toEqual(['obs_0']);
 });
 it('requires complete text and image evidence, never a shared truncated preview',()=>{
  const timeline=[queued(0),prompt(1)];
  expect(queuePage(timeline,'r').items[0]?.state).toBe('recorded');
  expect(queuePage(timeline,'r',{}, {input:item=>({text:item.type==='queue'?'same A':'same B',sourceId:'s',generation:0})}).pendingTotal).toBe(1);
  const image={sha:'image-a'};
  expect(queuePage([queued(0,{images:[image]}),{...prompt(1,''),images:[image]}],'r',{}, {input:()=>({text:'',sourceId:'s',generation:0})}).pendingTotal).toBe(0);
  expect(queuePage([queued(0,{images:[{omitted:'missing'}]}),prompt(1,'')],'r',{}, {input:()=>({text:'',sourceId:'s',generation:0})}).pendingTotal).toBe(1);
  expect(queuePage([queued(0,{preview:undefined,inputArtifactId:undefined}),prompt(1,'')],'r',{}, {input:()=>({text:'',sourceId:'s',generation:0})}).pendingTotal).toBe(1);
 });
 it('moves anonymous queue changes into history without claiming delivery and permits later exact prompt proof',()=>{
  const timeline=[queued(0),queued(1),queued(2,{operation:'dequeue'})];
  expect(queuePage(timeline,'r').pendingTotal).toBe(0);
  expect(queuePage(timeline,'r').items.map(item=>item.state)).toEqual(['unknown','unknown']);
  expect(queuePage([...timeline,prompt(3)],'r',{},evidence).items.map(item=>item.state)).toEqual(['unknown','delivered']);
 });
 it('keeps native delivered bookkeeping unknown until its prompt is visible',()=>{
  const timeline:TimelineItem[]=[queued(0,{nativeQueueId:'native'}),queued(1,{nativeQueueId:'native',operation:'delivered'}),{...prompt(1),id:'turn_obs_1'}];
  expect(queuePage(timeline,'r',{step:2})).toMatchObject({pendingTotal:0,items:[{state:'unknown',changeObservationId:'obs_1'}]});
  expect(queuePage(timeline,'r',{step:3})).toMatchObject({pendingTotal:0,items:[{state:'delivered',changeObservationId:'obs_1'}]});
 });
 it('keeps owners, generations and child agents independent',()=>{
  const base=[queued(0)];
  for(const mutation of [queued(1,{operation:'remove',agentId:'r.agent:child'}),queued(1,{operation:'remove',sourceId:'other'}),queued(1,{operation:'remove',generation:1}),queued(1,{operation:'remove',ownerRecordingId:'other'})])expect(queuePage([...base,mutation],'r').pendingTotal).toBe(1);
  expect(queuePage([...base,prompt(1)],'r',{}, {input:item=>({text:'same',sourceId:item.type==='queue'?'s':'other',generation:0})}).pendingTotal).toBe(1);
 });
 it('bounds prompt and completed-turn resolution to the whole exact replay prefix',()=>{
  const timeline=[queued(100),prompt(2),queued(3,{preview:'later'})];
  const completed={...evidence,completions:[{afterStep:2,agentId:'r.agent:main',sourceId:'s',generation:0,observationId:'end'}]};
  expect(queuePage(timeline,'r',{step:1},completed).pendingTotal).toBe(1);
  expect(queuePage(timeline,'r',{step:2},completed).pendingTotal).toBe(0);
  expect(queuePage(timeline,'r',{step:3},completed).pendingTotal).toBe(1);
  expect(queuePage(timeline,'r',{through:'obs_100'},completed).pendingTotal).toBe(1);
  expect(queuePage(timeline,'r',{step:2},{completions:completed.completions}).items[0]?.state).toBe('unknown');
 });
 it('computes pending totals across all receipts before pagination and after reloading',()=>{
  const timeline=Array.from({length:137},(_,n)=>queued(n));
  timeline.push(queued(137,{operation:'dequeue'}),queued(138));
  const first=queuePage(timeline,'r',{count:20});
  expect(first.total).toBe(138);expect(first.pendingTotal).toBe(1);
  expect(queuePage(timeline,'r',{state:'pending',before:100}).pendingTotal).toBe(1);
  expect(queuePage(structuredClone(timeline),'r')).toEqual(first);
  expect(queuePage(timeline,'r',{state:'history',count:50}).items).toHaveLength(50);
  for(const step of [-1,1.5,NaN])expect(()=>queuePage(timeline,'r',{step})).toThrow();
 });
});
