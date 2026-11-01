import type {QueuePage, QueueQuery, QueueTimelineItem, TimelineItem} from '@drishya/contracts';

/** A raw ingest sequence is not a replay cursor: sources can arrive out of order. */
export function queuePage(timeline: TimelineItem[], owner: string, query: QueueQuery = {}): QueuePage {
  const end = query.through ? timeline.findIndex(item => item.type === 'queue' && item.ownerRecordingId === owner && item.sourceObservationId === query.through) : timeline.length - 1;
  if (query.through && end < 0) throw Error('Invalid recorded queue boundary.');
  const visible = timeline.slice(0, end + 1).filter((item): item is QueueTimelineItem => item.type === 'queue' && item.ownerRecordingId === owner);
  const enqueues = visible.filter(item => item.operation === 'enqueue').sort((a,b) => b.sequence - a.sequence);
  const count = Math.min(50, Math.max(1, Math.floor(query.count ?? 20)));
  if (!Number.isSafeInteger(count) || query.before !== undefined && (!Number.isSafeInteger(query.before) || query.before < 0)) throw Error('Invalid queue range.');
  const rows = enqueues.filter(item => item.sequence < (query.before ?? Infinity) && (!query.receiptId || item.sourceObservationId === query.receiptId));
  const items = rows.slice(0, count).map(item => {
    const index = visible.indexOf(item);
    const changes = visible.slice(index + 1).filter(other => other.agentId === item.agentId && other.sourceId === item.sourceId && other.generation === item.generation
      && other.operation !== 'enqueue' && (!other.nativeQueueId || other.nativeQueueId === item.nativeQueueId));
    const exact = item.nativeQueueId ? changes.findLast(other => other.nativeQueueId === item.nativeQueueId && ['remove','delivered'].includes(other.operation)) : undefined;
    const change = exact ?? changes.at(-1);
    return {id: item.sourceObservationId, ownerRecordingId: owner, sequence: item.sequence, agentId: item.agentId, time: item.time,
      preview: item.preview ?? '', images: item.images, inputArtifactId: item.inputArtifactId, ...(item.nativeQueueId ? {nativeQueueId: item.nativeQueueId} : {}),
      state: exact?.operation === 'remove' ? 'removed' as const : exact?.operation === 'delivered' ? 'delivered' as const : change ? 'unknown' as const : 'recorded' as const,
      ...(change ? {changeObservationId: change.sourceObservationId} : {})};
  });
  return {items, total: enqueues.length, ...(rows.length > count && items.length ? {before: items.at(-1)!.sequence} : {})};
}
