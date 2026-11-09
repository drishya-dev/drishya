import {queuePage} from '../../../packages/scene/src/queued-inputs.ts';
import {reduce} from '@drishya/projection';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve, sep} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {Store} from '@drishya/store';
import {seal} from '@drishya/capture-core';
import {defaultAdapters} from '@drishya/ingest';
import {createQueueEvidenceCache, queueResolutionEvidence, queuedInputChunk} from '../src/queued-inputs.ts';
import {midTurnInput} from '../../../scripts/real-cases/mid-turn-input.ts';

let store: Store, dir: string, index: number;
const recording = 'rec_queue', source = 'src_queue', cursor = {offset: 1, generation: 0, fingerprint: 'fixture'};
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-queue-')); store = new Store(dir); index = 0;
  store.upsertRecording({id: recording, adapterId: 'claude-code', harness: 'claude-code', sourcePath: join(dir, 'never-opened.jsonl')});
  store.upsertSource({id: source, recordingId: recording, path: join(dir, 'never-opened.jsonl'), role: 'main', cursor});
});
afterEach(() => {store.close(); if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw Error('Unsafe temporary path'); rmSync(dir, {recursive: true, force: true});});
function append(operation: string, extra: Record<string, unknown> = {}, owner = 'agent:main', sourceId = source, generation = 0) {
  const observation = seal({raw: {part: 0, recordId: `record-${index++}`, kind: 'queue.operation', agentId: owner, payload: {operation, ...extra}, contentKeys: ['text', 'images']},
    recordingId: recording, adapter: defaultAdapters()[0]!.descriptor, sourceId, generation, byteOffset: index, observedAt: '2026-11-01T00:00:00Z'});
  store.appendObservations(recording, source, cursor, [observation]); return observation.id;
}
function recordedQueue(store: Store, id: string, query: import('@drishya/contracts').QueueQuery = {}) {
  if (id.includes('+')) throw Error('Physical owner required.');
  const projection = reduce(id, store.observations(id, -1, 1000), store.blobs, {adapters: Object.fromEntries(defaultAdapters().map(adapter => [adapter.descriptor.id, adapter.descriptor]))});
  return queuePage(projection.timeline, id, query, queueResolutionEvidence(store,projection,id));
}
describe('sealed, bounded queue receipts', () => {
  it('checks the scanned physical source independently of agent names and continuation sources', () => {
    append('enqueue', {text: 'main'});
    append('enqueue', {text: 'sidechain in the same journal'}, 'agent:child');
    append('enqueue', {text: 'another journal with a main agent'}, 'agent:main', 'other-source');
    const projection = reduce(recording, store.observations(recording), store.blobs, {adapters: Object.fromEntries(defaultAdapters().map(adapter => [adapter.descriptor.id, adapter.descriptor]))});
    const lines = midTurnInput.verify!(projection, {hits: 2, only: 0, sourceId: source});
    expect(lines[0]).toMatch(/^PASS 2 native enqueue receipts \/ 2 projected from the scanned source; 1 receipts from other sources/);
    expect(midTurnInput.verify!(projection, {hits: 1, only: 0, sourceId: source})[0]).toMatch(/^FAIL/);
    expect(projection.timeline.filter(item => item.type === 'queue')).toHaveLength(3);
  });
  it('keeps anonymous queue changes unknown and never correlates identical text', () => {
    const first = append('enqueue', {text: 'same'}), second = append('enqueue', {text: 'same'});
    expect(recordedQueue(store, recording).items.map(row => row.state)).toEqual(['recorded', 'recorded']);
    append('remove', {text: 'same'});
    expect(recordedQueue(store, recording).items.map(row => row.state)).toEqual(['unknown', 'unknown']);
    expect(recordedQueue(store, recording, {through: first}).items.map(row => row.id)).toEqual([first]);
    expect(queuedInputChunk(store, recording, second, first)).toBeUndefined();
  });
  it('marks removal only with exact native identity and retains that evidence after anonymous changes', () => {
    append('enqueue', {text: 'a', nativeQueueId: 'a'}); append('enqueue', {text: 'b', nativeQueueId: 'b'});
    append('remove', {nativeQueueId: 'a'}); append('dequeue');
    const page = recordedQueue(store, recording);
    expect(page.items.map(row => [row.nativeQueueId, row.state])).toEqual([['b', 'unknown'], ['a', 'removed']]);
  });
  it('does not apply another source, generation or agent mutation', () => {
    append('enqueue', {text: 'main'});
    append('dequeue', {}, 'agent:child'); append('dequeue', {}, 'agent:main', 'other-source'); append('dequeue', {}, 'agent:main', source, 1);
    expect(recordedQueue(store, recording).items[0]?.state).toBe('recorded');
  });
  it('pages the entire receipt history without header-size growth or future replay disclosure', () => {
    const ids = Array.from({length: 125}, (_,n) => append('enqueue', {text: `input ${n}`}));
    const seen: string[] = []; let before: number | undefined;
    do {const page = recordedQueue(store, recording, {count: 500, before}); expect(page.items.length).toBeLessThanOrEqual(50); seen.push(...page.items.map(row => row.id)); before = page.before;} while (before !== undefined);
    expect(seen).toEqual(ids.toReversed());
    expect(recordedQueue(store, recording, {through: ids[23]}).total).toBe(24);
    expect(() => recordedQueue(store, recording, {through: 'unknown'})).toThrow();
    expect(() => recordedQueue(store, recording + '+another')).toThrow();
    expect(queuedInputChunk(store, 'rec_other', ids[0]!)).toBeUndefined();
  });
  it('reads redacted long inputs in UTF-8 aligned bounded chunks, including literal formatting', () => {
    const original = 'start\n\t@literal\r\n' + 'दृश्य🙂'.repeat(45000) + '\nend';
    const id = append('enqueue', {text: original}); let start = 0, text = '';
    do {const chunk = queuedInputChunk(store, recording, id, undefined, start)!; expect(Buffer.byteLength(chunk.text)).toBeLessThanOrEqual(256 * 1024); text += chunk.text; if (!chunk.hasMore) break; expect(chunk.next).toBeGreaterThan(start); start = chunk.next;} while (true);
    expect(text).toBe(original);
    expect(() => queuedInputChunk(store, recording, id, undefined, -1)).toThrow();
    const secret = 'AKIA' + 'ABCDEFGHIJKLMNOP';
    const redacted = append('enqueue', {text: `credential ${secret}`});
    expect(queuedInputChunk(store, recording, redacted)?.text).not.toContain(secret);
    expect(recordedQueue(store, recording).items[0]?.preview).not.toContain(secret);
  });
});


it('uses ordered completion evidence after final material, independently of late physical arrival',()=>{
  const write=(kind:string,time:string,payload:Record<string,unknown>,agent='agent:main',sourceId=source,generation=0)=>{
    const raw={part:0,recordId:`evidence-${index++}`,kind,agentId:agent,sourceTime:time,payload,contentKeys:['text']};
    const observation=seal({raw,recordingId:recording,adapter:defaultAdapters()[0]!.descriptor,sourceId,generation,byteOffset:index,observedAt:'2026-11-01T00:00:00Z'});
    store.appendObservations(recording,source,cursor,[observation]);return observation.id;
  };
  const future=write('queue.operation','2026-11-01T00:00:05Z',{operation:'enqueue',text:'future'});
  const queued=write('queue.operation','2026-11-01T00:00:01Z',{operation:'enqueue',text:'waiting'});
  write('message.assistant','2026-11-01T00:00:02Z',{text:'whole final material'});
  const end=write('turn.end','2026-11-01T00:00:03Z',{});
  const projection=reduce(recording,store.observations(recording),store.blobs,{adapters:Object.fromEntries(defaultAdapters().map(adapter=>[adapter.descriptor.id,adapter.descriptor]))});
  const evidence=queueResolutionEvidence(store,projection,recording);
  expect(evidence.completions).toMatchObject([{afterStep:2,observationId:end}]);
  expect(queuePage(projection.timeline,recording,{step:1},evidence)).toMatchObject({pendingTotal:1,items:[{id:queued,state:'recorded'}]});
  expect(queuePage(projection.timeline,recording,{step:2},evidence)).toMatchObject({pendingTotal:0,items:[{id:queued,state:'unknown'}]});
  expect(queuePage(projection.timeline,recording,{step:3},evidence)).toMatchObject({pendingTotal:1,items:[{id:queued,state:'unknown'},{id:future,state:'recorded'}]});
  expect(queuePage(projection.timeline,recording,{through:queued},evidence).pendingTotal).toBe(1);
});
it('matches complete sealed text and separates completion agents, sources and generations',()=>{
  const id=append('enqueue',{text:'same full text'});
  const add=(kind:string,payload:Record<string,unknown>,agent='agent:main',sourceId=source,generation=0)=>{
    const observation=seal({raw:{part:0,recordId:`proof-${index++}`,kind,agentId:agent,payload,contentKeys:['text']},recordingId:recording,adapter:defaultAdapters()[0]!.descriptor,sourceId,generation,byteOffset:index,observedAt:'2026-11-01T00:00:00Z'});
    store.appendObservations(recording,sourceId,cursor,[observation]);
  };
  add('turn.end',{},'agent:child');add('turn.end',{},'agent:main','other-source');add('turn.end',{},'agent:main',source,1);
  expect(recordedQueue(store,recording).pendingTotal).toBe(1);
  add('message.user',{text:'same full text'});
  expect(recordedQueue(store,recording)).toMatchObject({pendingTotal:0,items:[{id,state:'delivered'}]});
  expect(recordedQueue(store,recording,{step:1}).pendingTotal).toBe(1);
});


it('compares full blob-backed prompt evidence beyond the common clipped preview',()=>{
  const text='x'.repeat(80000)+'A';append('enqueue',{text});
  const user=(text:string)=>{
    const observation=seal({raw:{part:0,recordId:`long-${index++}`,kind:'message.user',agentId:'agent:main',payload:{text},contentKeys:['text']},recordingId:recording,adapter:defaultAdapters()[0]!.descriptor,sourceId:source,generation:0,byteOffset:index,observedAt:'2026-11-01T00:00:00Z'});
    store.appendObservations(recording,source,cursor,[observation]);
  };
  user('x'.repeat(80000)+'B');expect(recordedQueue(store,recording).pendingTotal).toBe(1);
  user(text);expect(recordedQueue(store,recording)).toMatchObject({pendingTotal:0,items:[{state:'delivered'}]});
});

it('does not establish anonymous delivery from partial sealed text',()=>{
  append('enqueue',{text:'same'});
  const observation=seal({raw:{part:0,recordId:'partial-prompt',kind:'message.user',agentId:'agent:main',payload:{text:'same'},availability:'partial',contentKeys:['text']},recordingId:recording,adapter:defaultAdapters()[0]!.descriptor,sourceId:source,generation:0,byteOffset:index++,observedAt:'2026-11-01T00:00:00Z'});
  store.appendObservations(recording,source,cursor,[observation]);
  expect(recordedQueue(store,recording)).toMatchObject({pendingTotal:1,items:[{state:'recorded'}]});
});
it('maps continuation completion using retained physical stream order instead of interleaved clocks',()=>{
  const prior='rec_prior',priorSource='src_prior';
  store.upsertRecording({id:prior,adapterId:'claude-code',harness:'claude-code',sourcePath:join(dir,'prior.jsonl')});
  const add=(owner:string,sourceId:string,recordId:string,time:string,kind:string,payload:Record<string,unknown>)=>{
    const observation=seal({raw:{part:0,recordId,kind,agentId:'agent:main',sourceTime:time,payload,contentKeys:['text']},recordingId:owner,adapter:defaultAdapters()[0]!.descriptor,sourceId,generation:0,byteOffset:index++,observedAt:'2026-11-01T00:00:00Z'});
    store.appendObservations(owner,sourceId,cursor,[observation]);
  };
  add(prior,priorSource,'prior-material','2026-11-01T00:00:05Z','message.assistant',{text:'Prior retained material'});
  add(recording,source,'current-queue','2026-11-01T00:00:01Z','queue.operation',{operation:'enqueue',text:'waiting'});
  add(recording,source,'current-end','2026-11-01T00:00:02Z','turn.end',{});
  add(recording,source,'current-after','2026-11-01T00:00:03Z','message.assistant',{text:'After completion'});
  const lineage:import('@drishya/contracts').SessionLineageView={kind:'derived',rule:'claude-native-parent-lineage-v1',currentRecordingId:recording,recordingIds:[prior,recording],links:[],duplicatePartsOmitted:0,differingReceiptPartsRetained:0};
  const projection=reduce(recording,store.lineageObservations(lineage),store.blobs,{adapters:Object.fromEntries(defaultAdapters().map(adapter=>[adapter.descriptor.id,adapter.descriptor])),ordered:true,lineage});
  const evidence=queueResolutionEvidence(store,projection,recording);
  expect(evidence.completions).toMatchObject([{afterStep:2}]);
  expect(queuePage(projection.timeline,recording,{through:projection.timeline.find(item=>item.type==='queue')!.id.replace('queue_','')},evidence).pendingTotal).toBe(1);
  expect(queuePage(projection.timeline,recording,{step:2},evidence).pendingTotal).toBe(0);
});

it('round-trips the reserved completion part without colliding with ordinary content or usage identities',()=>{
  const adapter=defaultAdapters().find(item=>item.descriptor.id==='claude-code')!;
  const parser=adapter.createParser({recordingId:recording,sourceId:source,sourcePath:'synthetic.jsonl'});
  const row={type:'assistant',uuid:'reserved-completion',message:{id:'reserved-message',stop_reason:'end_turn',usage:{input_tokens:1,output_tokens:2},content:[{type:'text',text:'first'},{type:'thinking',thinking:'recorded exposed rationale'},{type:'text',text:'last'}]}};
  const sealed=parser.parse(row).map(raw=>seal({raw,recordingId:recording,adapter:adapter.descriptor,sourceId:source,generation:0,byteOffset:index++,observedAt:'2026-11-01T00:00:00Z'}));
  store.appendObservations(recording,source,cursor,sealed);
  const retained=store.observations(recording);
  expect(retained.map(item=>item.source.part)).toEqual([0,0,1,2,0xffffffff]);
  expect(new Set(retained.map(item=>item.id)).size).toBe(5);
  expect(retained.at(-1)?.source.part).toBeGreaterThan(0x7fffffff);
  const original=adapter.createParser({recordingId:recording,sourceId:source,sourcePath:'synthetic.jsonl'}).parse({...row,message:{...row.message,stop_reason:'tool_use'}}).map(raw=>seal({raw,recordingId:recording,adapter:adapter.descriptor,sourceId:source,generation:0,byteOffset:index++,observedAt:'2026-11-01T00:00:00Z'}));
  expect(sealed.slice(0,-1).map(item=>item.id)).toEqual(original.map(item=>item.id));
  store.appendObservations(recording,source,cursor,sealed);
  expect(store.countObservations(recording)).toBe(5);
});

it('reuses one compact queue evidence cache and evicts it for owner, view or revision changes',()=>{
  append('enqueue',{text:'x'.repeat(80000)});
  const projection=reduce(recording,store.orderedObservations(recording),store.blobs,{adapters:Object.fromEntries(defaultAdapters().map(adapter=>[adapter.descriptor.id,adapter.descriptor])),ordered:true});
  const read=createQueueEvidenceCache(store),first=read(projection,recording,'revision-1');
  expect(read(projection,recording,'revision-1')).toBe(first);
  const input=first.input!(projection.timeline.find(item=>item.type==='queue') as import('@drishya/contracts').QueueTimelineItem);
  expect(input).toMatchObject({hasText:true,sourceId:source,generation:0});
  expect(input?.text).toBeUndefined();expect(input?.textFingerprint).toHaveLength(70);
  expect(read(projection,recording,'revision-2')).not.toBe(first);
  const changed=read(projection,recording,'revision-2');
  expect(read(projection,'other-owner','revision-2')).not.toBe(changed);
  expect(read(projection,recording,'revision-2')).not.toBe(changed);
  const restored=read(projection,recording,'revision-2');
  expect(read(projection,recording,'revision-2','different-view')).not.toBe(restored);
});

it('reads late-arriving receipts by ordered replay identity rather than append sequence',()=>{
  const add=(time:string,text:string)=>{
    const observation=seal({raw:{part:0,recordId: 'read-order-'+index++,kind:'queue.operation',agentId:'agent:main',sourceTime:time,payload:{operation:'enqueue',text},contentKeys:['text']},recordingId:recording,adapter:defaultAdapters()[0]!.descriptor,sourceId:source,generation:0,byteOffset:index,observedAt:'2026-11-01T00:00:00Z'});
    store.appendObservations(recording,source,cursor,[observation]);return observation.id;
  };
  const future=add('2026-11-01T00:00:05Z','future');
  const earlier=add('2026-11-01T00:00:01Z','earlier');
  expect(queuedInputChunk(store,recording,earlier,future)?.text).toBe('earlier');
  expect(queuedInputChunk(store,recording,future,earlier)).toBeUndefined();
});

it('keeps completion evidence exact across lineage agent-stop markers with overlapping ingest sequences',()=>{
 const prior='rec_spawn_prior';
 store.upsertRecording({id:prior,adapterId:'claude-code',harness:'claude-code',sourcePath:join(dir,'spawn-prior.jsonl')});
 const add=(owner:string,sourceId:string,kind:string,payload:Record<string,unknown>,operationId?:string)=>{
  const observation=seal({raw:{part:0,recordId:'spawn-evidence-'+index++,kind,agentId:'agent:main',operationId,payload,contentKeys:['text']},recordingId:owner,adapter:defaultAdapters()[0]!.descriptor,sourceId,generation:0,byteOffset:index,observedAt:'2026-11-01T00:00:00Z'});
  store.appendObservations(owner,sourceId,cursor,[observation]);
 };
 add(prior,'src_spawn_prior','message.assistant',{text:'Earlier retained material one'});
 add(prior,'src_spawn_prior','message.assistant',{text:'Earlier retained material two'});
 add(recording,source,'tool.call',{tool:'Task',intent:{kind:'spawn',description:'Synthetic delegation'}},'native-spawn');
 add(recording,source,'tool.result',{tool:'Task',outcome:{kind:'spawn',childAgentId:'agent:child'},text:'Synthetic child returned'},'native-spawn');
 add(recording,source,'queue.operation',{operation:'enqueue',text:'Still waiting'});
 add(recording,source,'message.assistant',{text:'Synthetic final material'});
 add(recording,source,'turn.end',{});
 const lineage:import('@drishya/contracts').SessionLineageView={kind:'derived',rule:'claude-native-parent-lineage-v1',currentRecordingId:recording,recordingIds:[prior,recording],links:[],duplicatePartsOmitted:0,differingReceiptPartsRetained:0};
 const projection=reduce(recording,store.lineageObservations(lineage),store.blobs,{adapters:Object.fromEntries(defaultAdapters().map(adapter=>[adapter.descriptor.id,adapter.descriptor])),ordered:true,lineage});
 expect(projection.timeline.filter(item=>item.type==='agent-stop')).toHaveLength(1);
 const evidence=queueResolutionEvidence(store,projection,recording);
 expect(evidence.completions).toHaveLength(1);
 const queued=projection.timeline.find(item=>item.type==='queue')!;
 expect(queuePage(projection.timeline,recording,{through:queued.id.replace('queue_','')},evidence).pendingTotal).toBe(1);
 expect(queuePage(projection.timeline,recording,{},evidence).pendingTotal).toBe(0);
});
