// Queue receipts are captured bookkeeping, not delivered prompts or controller state.
// Read only sealed observations; a physical observation id bounds replay exactly.
import {isBlobText, type Observation} from '@drishya/contracts';
import type {Store, TextChunk} from '@drishya/store';

const value = (input: unknown): Record<string, unknown> => input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {};
const CHUNK = 256 * 1024;

export function queuedInputChunk(store: Store, recordingId: string, id: string, through?: string, start = 0): TextChunk | undefined {
  if (recordingId.includes('+') || !Number.isSafeInteger(start) || start < 0) throw Error('Invalid queue reading.');
  const observation = store.observationById(recordingId, id);
  if (!observation || observation.kind !== 'queue.operation' || value(observation.payload).operation !== 'enqueue') return;
  if (through) {
    const boundary = store.observationById(recordingId, through);
    if (!boundary || !(boundary.kind === 'queue.operation' || boundary.kind === 'message.user' && typeof value(boundary.payload).nativeQueueId === 'string') || observation.receivedSequence > boundary.receivedSequence) return;
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
