/** Native queue bookkeeping is not a delivered user turn. Decoding adds no identity or outcome. */
export interface RecordedQueueOperation {
  operation: 'enqueue' | 'dequeue' | 'remove';
  nativeQueueId?: string;
  content?: unknown;
}
export function recordedQueueOperation(value: unknown): RecordedQueueOperation | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const row = value as Record<string, unknown>;
  if (row.type !== 'queue-operation' || typeof row.operation !== 'string' || !['enqueue','dequeue','remove'].includes(row.operation)) return;
  const id = typeof row.queueId === 'string' ? row.queueId : typeof row.queue_id === 'string' ? row.queue_id : undefined;
  return { operation: row.operation as RecordedQueueOperation['operation'],
    ...(id ? { nativeQueueId: id } : {}),
    ...(Object.hasOwn(row, 'content') ? { content: row.content } : {}) };
}
