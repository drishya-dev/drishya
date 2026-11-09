import {isPersonPrompt, type OperationImage, type QueuePage, type QueueQuery, type QueueReceipt, type QueueTimelineItem, type TimelineItem} from '@drishya/contracts';

export interface QueueInputEvidence {text?: string; /** SHA-256 and UTF-8 byte length of complete sealed text. */ textFingerprint?: string; hasText?: boolean; sourceId: string; generation: number}
/** Derived reading evidence only. afterStep is computed from the captured ordered stream. */
export interface QueueEvidence {
  input?: (item: QueueTimelineItem | Extract<TimelineItem, {type:'turn'}>) => QueueInputEvidence | undefined;
  completions?: {afterStep: number; agentId: string; sourceId: string; generation: number; observationId: string}[];
}
const sameText = (a: QueueInputEvidence, b: QueueInputEvidence) => a.text !== undefined && b.text !== undefined ? a.text === b.text : !!a.textFingerprint && a.textFingerprint === b.textFingerprint;
const sameImages = (a: OperationImage[] = [], b: OperationImage[] = []) => a.length === b.length && a.every((image, i) => !!image.sha && image.sha === b[i]?.sha);

/** A raw ingest sequence is not a replay cursor: sources can arrive out of order. */
export function queuePage(timeline: TimelineItem[], owner: string, query: QueueQuery = {}, evidence: QueueEvidence = {}): QueuePage {
  if (query.step !== undefined && (!Number.isSafeInteger(query.step) || query.step < 0) || query.state !== undefined && !['pending','history'].includes(query.state)) throw Error('Invalid queue range.');
  const boundary = query.through ? timeline.findIndex(item => item.type === 'queue' && item.ownerRecordingId === owner && item.sourceObservationId === query.through) : undefined;
  if (boundary !== undefined && boundary < 0) throw Error('Invalid recorded queue boundary.');
  const step = Math.min(timeline.length, query.step ?? timeline.length, boundary === undefined ? Infinity : boundary + 1);
  const receipts: {item: QueueTimelineItem; receipt: QueueReceipt}[] = [];
  const complete = (change: NonNullable<QueueEvidence['completions']>[number]) => {
    for (const row of receipts) if (row.receipt.state === 'recorded' && row.item.agentId === change.agentId && row.item.sourceId === change.sourceId && row.item.generation === change.generation) {
      row.receipt.state = 'unknown'; row.receipt.changeObservationId = change.observationId;
    }
  };
  const completions = (evidence.completions ?? []).filter(change => change.afterStep <= step && (boundary === undefined || change.afterStep < step)).sort((a,b)=>a.afterStep-b.afterStep);
  let completion = 0;
  const deliveries = new Map<string,QueueTimelineItem>();
  for (let index = 0; index < step; index++) {
    while (completion < completions.length && completions[completion]!.afterStep <= index) complete(completions[completion++]!);
    const item = timeline[index]!;
    if (item.type === 'queue' && item.ownerRecordingId === owner) {
      if (item.operation === 'enqueue') {
        receipts.push({item,receipt:{id:item.sourceObservationId,ownerRecordingId:owner,sequence:item.sequence,agentId:item.agentId,time:item.time,preview:item.preview ?? '',images:item.images,inputArtifactId:item.inputArtifactId,...(item.nativeQueueId ? {nativeQueueId:item.nativeQueueId}:{}),state:'recorded'}});
      } else {
        if (item.operation === 'delivered') deliveries.set(item.sourceObservationId,item);
        const candidates = receipts.filter(row => row.item.agentId === item.agentId && row.item.sourceId === item.sourceId && row.item.generation === item.generation && (!item.nativeQueueId || item.nativeQueueId === row.item.nativeQueueId));
        for (const row of candidates) {
          if (row.receipt.state === 'removed' || row.receipt.state === 'delivered') continue;
          // A native delivery marker clears waiting, but only a visible prompt can confirm delivery.
          row.receipt.state = item.nativeQueueId && item.operation === 'remove' ? 'removed' : 'unknown';
          row.receipt.changeObservationId = item.sourceObservationId;
        }
      }
    } else if (item.type === 'turn' && isPersonPrompt(item.prompt)) {
      const delivery=deliveries.get(item.id.startsWith('turn_') ? item.id.slice(5) : item.id);
      const identified=delivery?.nativeQueueId ? receipts.find(row=>row.item.agentId===item.agentId && row.item.sourceId===delivery.sourceId && row.item.generation===delivery.generation && row.item.nativeQueueId===delivery.nativeQueueId && !['removed','delivered'].includes(row.receipt.state)) : undefined;
      if (identified) {identified.receipt.state='delivered';identified.receipt.changeObservationId=delivery!.sourceObservationId;continue;}
      const input = evidence.input?.(item);
      if (!input || input.text === undefined && !input.textFingerprint) continue;
      const row = receipts.find(row => row.item.agentId === item.agentId && !['removed','delivered'].includes(row.receipt.state) && row.item.sourceId === input.sourceId && row.item.generation === input.generation && (()=>{
        const queued = evidence.input?.(row.item);
        return !!queued && sameText(queued,input) && (!!input.text || input.hasText === true || !!item.images?.length) && sameImages(row.item.images,item.images);
      })());
      if (row) {row.receipt.state='delivered'; row.receipt.changeObservationId=item.id.startsWith('turn_') ? item.id.slice(5) : item.id;}
    }
  }
  while (completion < completions.length) complete(completions[completion++]!);
  const pendingTotal = receipts.filter(row=>row.receipt.state==='recorded').length;
  const count = Math.min(50, Math.max(1, Math.floor(query.count ?? 20)));
  if (!Number.isSafeInteger(count) || query.before !== undefined && (!Number.isSafeInteger(query.before) || query.before < 0)) throw Error('Invalid queue range.');
  const rows = receipts.map(row=>row.receipt).sort((a,b)=>b.sequence-a.sequence).filter(item=>item.sequence < (query.before ?? Infinity) && (!query.receiptId || item.id===query.receiptId) && (!query.state || (item.state==='recorded') === (query.state==='pending')));
  const items = rows.slice(0,count);
  return {items,total:receipts.length,pendingTotal,completionEvidence:evidence.completions !== undefined,...(rows.length>count && items.length ? {before:items.at(-1)!.sequence}:{})};
}
