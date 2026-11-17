import {isBlobText, type Observation, type WebResult} from '@drishya/contracts';
import type {Store} from '@drishya/store';
import {webMaterial, type WebResultPage, type WebResultOptions} from '../../../packages/scene/src/web.ts';
export type {WebResultPage,WebResultOptions} from '../../../packages/scene/src/web.ts';
type RecordValue = Record<string,unknown>;
const record = (value: unknown): RecordValue => value && typeof value === 'object' ? value as RecordValue : {};
const literal = (value: unknown) => typeof value === 'string' ? value : undefined;
const LIMIT = 64 * 1024;
function bounded(text: string) {
  const bytes = Buffer.from(text);
  if (bytes.length <= LIMIT) return text;
  let end = LIMIT;
  while (end > 0 && (bytes[end]! & 0xc0) === 0x80) end--;
  return bytes.subarray(0,end).toString('utf8');
}

/** Reads only sealed observations and the exact blob references those observations own. */
export function readWebResult(store: Store, recordingId: string, operationId: string, options: WebResultOptions = {}): WebResultPage {
  if (!store.getRecording(recordingId)) throw Error('Recording unavailable');
  if (!operationId.startsWith(`${recordingId}.`)) throw Error('Invalid web operation');
  const native = operationId.slice(recordingId.length+1);
  if (!native || native.includes('#')) throw Error('Invalid web operation');
  let call: Observation | undefined, receipt: Observation | undefined, intent: RecordValue, outcome: RecordValue;
  if (native.startsWith('item:')) {
    call = store.observationById(recordingId,native.slice(5));
    const payload = record(call?.payload);
    if (call?.kind !== 'item.completed' || payload.item !== 'web-search' || options.resultId) throw Error('Invalid web operation');
    intent = record(payload.web); outcome = {...intent,text:payload.output}; receipt = call;
  } else {
    const observations = store.operationObservations(recordingId,native);
    call = observations.find(o=>o.kind==='tool.call');
    intent = record(record(call?.payload).intent);
    if (!call || intent.kind !== 'web') throw Error('Invalid web operation');
    receipt = observations.find(o=>o.kind==='tool.result' && o.source.sourceId===call!.source.sourceId && o.source.generation===call!.source.generation && o.agentId===call!.agentId);
    if (options.resultId && (!receipt || receipt.id!==options.resultId)) throw Error('Invalid web result');
    outcome = record(record(receipt?.payload).outcome);
  }
  let removed = false;
  const resolveTextValue = (value: unknown): string | undefined => {
    if (typeof value === 'string') return value;
    if (!isBlobText(value)) return undefined;
    // BlobStore's content-addressed key must not become an arbitrary local path.
    if (!/^[a-f0-9]{64}$/.test(value.$blob)) { removed = true; return undefined; }
    const text = store.blobsFor([recordingId]).captured(value.$blob);
    if (text === undefined) removed = true;
    return text;
  };
  const payload = record(receipt?.payload);
  const full = resolveTextValue(outcome.text) ?? resolveTextValue(payload.text);
  const seeds: WebResult[] = Array.isArray(outcome.results) ? outcome.results.flatMap(value=>{
    const entry=record(value),url=resolveTextValue(entry.url);
    if (url===undefined) return [];
    const row: WebResult={url};
    for (const key of ['title','domain','snippet'] as const) { const text=resolveTextValue(entry[key]);if(text!==undefined)row[key]=text; }
    return [row];
  }) : [];
  const material = webMaterial(full ?? '',seeds);
  const query = options.q ?? '';
  const filtered = query ? material.results.filter(row=>[row.title,row.url,row.domain,row.snippet].some(value=>value?.toLocaleLowerCase().includes(query.toLocaleLowerCase()))) : material.results;
  const start = Math.max(0,Math.floor(Number.isFinite(options.start)?options.start!:0));
  const count = Math.min(200,Math.max(1,Math.floor(Number.isFinite(options.count)?options.count!:100)));
  const original = bounded(material.original), text = bounded(material.text);
  return {results:filtered.slice(start,start+count),total:material.results.length,matched:filtered.length,start,hasMore:start+count<filtered.length,
    text,original,originalComplete:!removed&&original===material.original&&text===material.text,
    query:literal(intent.query),url:literal(intent.url)??literal(outcome.url),time:receipt?.sourceTime,
    availability:removed?'removed':full!==undefined||material.listRecorded||Array.isArray(outcome.results)?'captured':'missing'};
}
