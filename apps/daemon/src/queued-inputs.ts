// Queue receipts are captured bookkeeping, not delivered prompts or controller state.
// Read only sealed observations; a physical observation id bounds replay exactly.
import {createHash} from 'node:crypto';
import {isBlobText, type Projection} from '@drishya/contracts';
import type {Store, TextChunk} from '@drishya/store';
import type {QueueEvidence, QueueInputEvidence} from '../../../packages/scene/src/queued-inputs.ts';

const value = (input: unknown): Record<string, unknown> => input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {};
const CHUNK = 256 * 1024;

export function queuedInputChunk(store: Store, recordingId: string, id: string, through?: string, start = 0): TextChunk | undefined {
  if (recordingId.includes('+') || !Number.isSafeInteger(start) || start < 0) throw Error('Invalid queue reading.');
  const observation = store.observationById(recordingId, id);
  if (!observation || observation.kind !== 'queue.operation' || value(observation.payload).operation !== 'enqueue') return;
  if (through) {
    const boundary = store.observationById(recordingId, through);
    if (!boundary || !(boundary.kind === 'queue.operation' || boundary.kind === 'message.user' && typeof value(boundary.payload).nativeQueueId === 'string')) return;
    let visible=false;
    for (const item of store.orderedObservations(recordingId)) {
      if (item.id===observation.id) visible=true;
      if (item.id===boundary.id) break;
    }
    if (!visible) return;
  }
  const text = value(observation.payload).text;
  if (isBlobText(text)) return store.blobs.readTextChunk(text.$blob, start, CHUNK);
  if (typeof text !== 'string') return;
  const buffer = Buffer.from(text), begin = Math.min(start, buffer.length);
  if (begin < buffer.length && (buffer[begin]! & 0xc0) === 0x80) throw Error('Invalid UTF-8 boundary.');
  let next = Math.min(begin + CHUNK, buffer.length);
  while (next < buffer.length && (buffer[next]! & 0xc0) === 0x80) next--;
  return {text: buffer.subarray(begin, next).toString('utf8'), start: begin, next, totalBytes: buffer.length, hasMore: next < buffer.length};
}


/** Build once per physical owner revision in the history worker. No raw-sequence cursor arithmetic. */
export function queueResolutionEvidence(store: Store, projection: Projection, owner: string): QueueEvidence {
  if (!projection.timeline.some(item=>item.type==='queue' && item.ownerRecordingId===owner)) return {completions:[]};
  const positions = new Map<string,number>();
  const bySequence = new Map<number,string[]>();
  const inputs = new Map<string,QueueInputEvidence>();
  const ends: {id:string;agentId:string;sourceId:string;generation:number}[] = [];
  const ids=projection.lineage?.recordingIds ?? projection.recordingId.split('+');
  let position=0;
  // Match the reducer exactly: proven continuations concatenate and deduplicate physical sources.
  const orderedInput=projection.lineage ? store.lineageObservations({...projection.lineage}) : store.orderedObservations(ids);
  for (const observation of orderedInput) {
    positions.set(observation.id,position++);
    const candidates=bySequence.get(observation.receivedSequence) ?? [];
    candidates.push(observation.id);bySequence.set(observation.receivedSequence,candidates);
    if (observation.recordingId !== owner) continue;
    if (observation.availability !== 'complete') continue;
    if (observation.kind==='message.user' || observation.kind==='queue.operation') {
      const stored=value(observation.payload).text;
      const text=typeof stored==='string' ? stored : isBlobText(stored) ? store.blobs.get(stored.$blob) : undefined;
      if (text !== undefined) inputs.set(observation.id,{textFingerprint:createHash('sha256').update(text).digest('hex')+':'+Buffer.byteLength(text),hasText:text.length>0,sourceId:observation.source.sourceId,generation:observation.source.generation});
    }
    if (observation.kind==='turn.end' && !value(observation.payload).reason) ends.push({id:observation.id,agentId:observation.agentId,sourceId:observation.source.sourceId,generation:observation.source.generation});
  }
  const operations=new Map(projection.operations.map(item=>[item.id,item.observationIds]));
  const prose=new Map(projection.prose.map(item=>[item.id,item.observationIds]));
  const notices=new Map(projection.notices?.map(item=>[item.id,item.observationIds]));
  const material=projection.timeline.map((item,index)=>{
    const candidates=bySequence.get(item.sequence) ?? [];
    const references=item.type==='queue' ? [item.sourceObservationId] : item.type==='turn' ? [item.id.slice(5)] : item.type==='prose' ? prose.get(item.proseId) : item.type==='op-start' || item.type==='op-end' ? operations.get(item.operationId) : item.type==='notice' ? notices.get(item.noticeId) : item.type==='agent-stop' ? operations.get(item.id.slice(2)) : undefined;
    const id=candidates.find(id=>references?.includes(id) || item.id.includes(id)) ?? (candidates.length===1 ? candidates[0] : undefined);
    return {position:id ? positions.get(id) : undefined,step:index+1};
  });
  // Unknown material ownership cannot be used to bring a completion into replay early.
  const exact=material.every(item=>item.position!==undefined);
  const ordered=material.filter((item):item is {position:number;step:number}=>item.position!==undefined).sort((a,b)=>a.position-b.position);
  let maximum=0;
  for (const item of ordered) item.step=maximum=Math.max(maximum,item.step);
  return {
    input:inputResolver(inputs),
    ...(exact ? {completions:ends.map(observation=>{
      const position=positions.get(observation.id)!;
      let low=0,high=ordered.length;
      while(low<high){const middle=(low+high)>>>1;if(ordered[middle]!.position<=position)low=middle+1;else high=middle;}
      return {afterStep:low ? ordered[low-1]!.step : 0,agentId:`${projection.lineage?.currentRecordingId ?? owner}.${observation.agentId}`,sourceId:observation.sourceId,generation:observation.generation,observationId:observation.id};
    })} : {}),
  };
}

// Keep the returned closure scoped only to compact fingerprints, not the stream-position workspace.
function inputResolver(inputs: Map<string,QueueInputEvidence>): NonNullable<QueueEvidence['input']> {
  return item=>inputs.get(item.type==='queue' ? item.sourceObservationId : item.id.slice(5));
}

/** One resident owner/view/revision: paging reuses evidence; new views or arrivals evict it. */
export function createQueueEvidenceCache(store: Store) {
  let cached: {owner:string;viewId:string;revision:string;evidence:QueueEvidence} | undefined;
  return (projection:Projection, owner:string, revision:string, viewId=projection.recordingId): QueueEvidence => {
    if (!cached || cached.owner!==owner || cached.viewId!==viewId || cached.revision!==revision) cached={owner,viewId,revision,evidence:queueResolutionEvidence(store,projection,owner)};
    return cached.evidence;
  };
}
