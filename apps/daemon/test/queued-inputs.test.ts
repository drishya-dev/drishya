import {queuePage} from '../../../packages/scene/src/queued-inputs.ts';
import {reduce} from '@drishya/projection';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve, sep} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {Store} from '@drishya/store';
import {seal} from '@drishya/capture-core';
import {defaultAdapters} from '@drishya/ingest';
import {queuedInputChunk} from '../src/queued-inputs.ts';

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
  return queuePage(projection.timeline, id, query);
}
describe('sealed, bounded queue receipts', () => {
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
