import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Observation } from '@drishya/contracts';
import { Store } from '../src/index.ts';

let dir: string;
let store: Store;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-store-'));
  store = new Store(dir);
});
afterEach(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

const cursor = { offset: 1, generation: 0, fingerprint: 'f' };
function obs(id: string): Omit<Observation, 'receivedSequence'> {
  return {
    id,
    recordingId: 'rec_a',
    source: { adapterId: 'claude-code', adapterVersion: '0', sourceId: 'src_a', generation: 0, byteOffset: 0, part: 0 },
    observedAt: '2026-10-03T00:00:00Z',
    agentId: 'agent:main',
    kind: 'message.user',
    payload: { text: id },
    privacyPolicyVersion: 'p3',
    redactions: [],
    availability: 'complete',
  };
}
function seed() {
  store.upsertRecording({ id: 'rec_a', adapterId: 'claude-code', harness: 'claude-code', sourcePath: join(dir, 'a.jsonl') });
  store.upsertSource({ id: 'src_a', recordingId: 'rec_a', path: join(dir, 'a.jsonl'), role: 'main', cursor });
}

// B1b (audit A07): a monotonic revision, committed with the data it describes, lets a viewer that
// missed notifications tell exactly which recordings changed.
describe('recording revisions', () => {
  it('increments once per commit that adds observations, and not for duplicates', () => {
    seed();
    expect(store.getRecording('rec_a')!.revision).toBe(0);
    store.appendObservations('rec_a', 'src_a', cursor, [obs('o1'), obs('o2')]);
    expect(store.getRecording('rec_a')!.revision).toBe(1);
    store.appendObservations('rec_a', 'src_a', cursor, [obs('o1')]); // already stored
    expect(store.getRecording('rec_a')!.revision).toBe(1);
    store.appendObservations('rec_a', 'src_a', cursor, [obs('o3')]);
    expect(store.revisions()).toEqual({ rec_a: 2 });
  });

  it('survives a restart', () => {
    seed();
    store.appendObservations('rec_a', 'src_a', cursor, [obs('o1')]);
    store.close();
    store = new Store(dir);
    expect(store.getRecording('rec_a')!.revision).toBe(1);
  });

  it('adds the column to a store created before revisions existed', () => {
    seed();
    store.db.exec('ALTER TABLE recordings DROP COLUMN revision');
    store.close();
    store = new Store(dir);
    expect(store.getRecording('rec_a')!.revision).toBe(0);
    store.appendObservations('rec_a', 'src_a', cursor, [obs('o1')]);
    expect(store.getRecording('rec_a')!.revision).toBe(1);
  });
});

// B2 (audit A15): artifact text is read in bounded line ranges, without loading and splitting the
// whole blob on every request, and the response says exactly what it returned.
describe('bounded blob reads', () => {
  const same = (text: string, start: number, count: number) => text.split('\n').slice(start, start + count).join('\n');

  it('returns exactly the lines a split would, for edge cases', () => {
    for (const text of ['', 'one', 'one\n', 'a\nb\nc', 'a\r\nb\r\n', 'ünï\ncödé\n✓ done', '\n\n\n']) {
      const { sha } = store.blobs.put(text);
      for (const [start, count] of [[0, 1], [0, 100], [1, 1], [2, 5], [10, 3]] as const) {
        const r = store.blobs.readLines(sha, start, count)!;
        expect(r.text).toBe(same(text, start, count));
        expect(r.totalLines).toBe(text.split('\n').length);
        expect(r.totalBytes).toBe(Buffer.byteLength(text));
      }
    }
  });

  it('reads a later range of a large blob without rescanning it', () => {
    const text = Array.from({ length: 100_000 }, (_, i) => `line ${i} ${'x'.repeat(i % 40)}`).join('\n');
    const { sha } = store.blobs.put(text);
    const first = store.blobs.readLines(sha, 50_000, 3)!; // builds the line index once
    expect(first.text).toBe(same(text, 50_000, 3));
    const before = store.blobs.stats.bytesRead;
    const second = store.blobs.readLines(sha, 90_000, 5)!;
    expect(second.text).toBe(same(text, 90_000, 5));
    expect(second.hasMore).toBe(true);
    const read = store.blobs.stats.bytesRead - before;
    expect(read).toBeLessThanOrEqual(2 * 64 * 1024); // a seek and a chunk or two, not a full read
    expect(read).toBeLessThan(second.totalBytes / 10);
  });

  it('caps one response by bytes and says so', () => {
    const text = Array.from({ length: 1000 }, () => 'y'.repeat(100)).join('\n');
    const { sha } = store.blobs.put(text);
    const r = store.blobs.readLines(sha, 0, 1000, 5000)!;
    expect(r.truncated).toBe(true);
    expect(r.returnedLines).toBeLessThan(1000);
    expect(r.text).toBe(same(text, 0, r.returnedLines));
    expect(r.hasMore).toBe(true);
  });

  it('reports a missing blob as unavailable rather than empty', () => {
    expect(store.blobs.readLines('0'.repeat(64), 0, 10)).toBeUndefined();
  });
});
