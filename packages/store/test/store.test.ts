import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Observation } from '@drishya/contracts';
import { Store } from '../src/index.ts';
import { orderObservations } from '../../projection/src/reduce.ts';

let dir: string;
let store: Store;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-store-'));
  store = new Store(dir);
});

it('finds beyond a source page with bounded locations and single-use immutable cursors', () => {
  const { sha } = store.blobs.put(Array.from({ length: 30_000 }, (_, n) => `line ${n}${n === 22_345 ? ' distant NEEDLE' : ''}`).join('\n'));
  let result = store.blobs.findLines(sha, 'needle')!;
  expect(result.matches).toEqual([]); expect(result.continuation).toBeDefined();
  const used = result.continuation!;
  result = store.blobs.findLines(sha, 'needle', 0, used)!;
  expect(store.blobs.findLines(sha, 'needle', 0, used)?.reason).toBe('continuation-expired');
  result = store.blobs.findLines(sha, 'needle', 0, result.continuation)!;
  expect(result.matches).toEqual([22_345]); expect(result.continuation).toBeUndefined();
});

it('resumes an oversized line without unbounded memory or pretending it was searched completely', () => {
  const { sha } = store.blobs.put('x'.repeat(5 * 1024 * 1024) + '\nneedle after a huge line\n');
  const first = store.blobs.findLines(sha, 'needle')!;
  expect(first.matches).toEqual([]); expect(first.continuation).toBeDefined();
  const next = store.blobs.findLines(sha, 'needle', 0, first.continuation)!;
  expect(next.matches).toEqual([1]); expect(next.skippedLines).toBe(1);
  expect(next.continuation).toBeUndefined();
});

it('bounds match batches and rejects a cursor used for another blob/query', () => {
  const first = store.blobs.put('needle\n'.repeat(120)), second = store.blobs.put('other\n');
  const result = store.blobs.findLines(first.sha, 'needle')!;
  expect(result.matches).toHaveLength(50);
  expect(store.blobs.findLines(second.sha, 'needle', 0, result.continuation)?.available).toBe(false);
  expect(store.blobs.findLines(first.sha, 'other', 0, result.continuation)?.available).toBe(false);
  expect(store.blobs.findLines(first.sha, 'needle', 0, result.continuation)?.matches[0]).toBe(50);
  expect(() => store.blobs.findLines(first.sha, '', 0)).toThrow('Invalid stored search');
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
  it('recovers a main workspace after title-only metadata without taking a companion root', () => {
    seed();
    store.appendObservations('rec_a', 'src_a', cursor, [
      {...obs('title'),kind:'session.meta',payload:{title:'Named first',titleRank:2}},
      {...obs('child'),kind:'session.meta',agentId:'agent:child',workspaceRoot:'/unrelated',payload:{cwd:'/unrelated'}},
      {...obs('root'),kind:'session.meta',workspaceRoot:'/repo',payload:{cwd:'/repo'}},
    ]);
    expect(store.captureMetadata('rec_a')).toEqual({title:'Named first',workspaceRoot:'/repo'});
  });
  it('keeps late captured titles without reducing the whole recording', () => {
    seed();
    store.appendObservations('rec_a', 'src_a', cursor, [obs('prompt'),
      { ...obs('m1'), kind: 'session.meta', payload: { title: 'Initial', titleRank: 1, cwd: '/repo' } },
      { ...obs('m2'), kind: 'session.meta', payload: { title: 'Named session', titleRank: 2 } },
      { ...obs('m3'), kind: 'session.meta', payload: { title: 'Lower priority', titleRank: 1 } }]);
    expect(store.captureMetadata('rec_a')).toEqual({ title: 'Named session', workspaceRoot: '/repo' });
  });
  it('streams repeatable source-clock order, including missing and backwards timestamps', () => {
    seed();
    const records = [
      { ...obs('o1'), sourceTime: '2026-10-05T12:00:02Z' },
      { ...obs('o2'), sourceTime: '2026-10-05T12:00:01Z' },
      obs('o3'),
      { ...obs('o4'), sourceTime: 'invalid' },
      { ...obs('o5'), source: { ...obs('o5').source, sourceId: 'src_b' } },
      { ...obs('o6'), sourceTime: '2026-10-05T12:00:01.123999Z' },
      { ...obs('o7'), sourceTime: '2026-10-05T12:00:01.123001Z' },
      { ...obs('o8'), sourceTime: '2026-10-05T12:00:01.999999Z' },
    ];
    store.appendObservations('rec_a', 'src_a', cursor, records);
    const expected = orderObservations(store.observations('rec_a'));
    const reader = store.orderedObservations('rec_a');
    expect([...reader]).toEqual(expected);
    store.upsertRecording({ id: 'rec_b', adapterId: 'codex', harness: 'codex', sourcePath: join(dir, 'b.jsonl') });
    store.upsertSource({ id: 'src_b', recordingId: 'rec_b', path: join(dir, 'b.jsonl'), role: 'main', cursor });
    store.appendObservations('rec_b', 'src_b', cursor, [{ ...obs('b1'), recordingId: 'rec_b', sourceTime: '2026-10-05T12:00:01Z' }]);
    expect([...store.orderedObservations(['rec_a', 'rec_b'])]).toEqual(orderObservations([...store.observations('rec_a'), ...store.observations('rec_b')]));
    expect([...reader]).toEqual(expected);
  });
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
  it('backfills the reader clock without changing original source timestamps', () => {
    seed();
    store.appendObservations('rec_a', 'src_a', cursor, [{ ...obs('migration'), sourceTime: '2026-10-05T12:00:01.123999Z' }]);
    const captured = store.observations('rec_a');
    store.db.exec('ALTER TABLE observations DROP COLUMN clock_time');
    store.close(); store = new Store(dir);
    expect([...store.orderedObservations('rec_a')]).toEqual(captured);
    expect(store.db.prepare('SELECT clock_time FROM observations').get()?.clock_time).toBe('2026-10-05T12:00:01.123Z');
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

// P2-A: the reading boundary is local, moves only on an explicit mark, keeps the previous mark
// for undo, and goes with the recording when it is forgotten.
describe('reading boundaries', () => {
  it('migrates either prior version-3 layout without losing the other feature', () => {
    store.db.exec("DROP TABLE reading_boundaries; UPDATE meta SET value='3' WHERE key='schema_version'");
    store.close();
    store = new Store(dir);
    expect(store.db.prepare("SELECT name FROM sqlite_master WHERE name='reading_boundaries'").get()).toBeDefined();
    store.db.exec("ALTER TABLE observations DROP COLUMN clock_time; UPDATE meta SET value='3' WHERE key='schema_version'");
    store.close();
    store = new Store(dir);
    expect(store.db.prepare('PRAGMA table_info(observations)').all().some((row) => row.name === 'clock_time')).toBe(true);
    expect(store.db.prepare("SELECT value FROM meta WHERE key='schema_version'").get()?.value).toBe('5');
  });
  it('stores a mark with its previous value and removes it with the recording', () => {
    seed();
    expect(store.getBoundary('rec_a')).toBeUndefined();
    store.setBoundary('rec_a', 4, 1);
    expect(store.getBoundary('rec_a')).toMatchObject({ sequence: 4, previousSequence: undefined, revision: 1 });
    store.setBoundary('rec_a', 9, 2);
    expect(store.getBoundary('rec_a')).toMatchObject({ sequence: 9, previousSequence: 4, revision: 2 });
    store.deleteRecording('rec_a');
    expect(store.getBoundary('rec_a')).toBeUndefined();
  });
});

// PERF-2: the recordings list asks for policy versions on every poll; the answer is cached and grown
// on append rather than recomputed by scanning every stored body.
describe('policy versions', () => {
  it('grows with appended observations and forgets a deleted recording', () => {
    seed();
    store.appendObservations('rec_a', 'src_a', cursor, [obs('v1')]);
    expect(store.policyVersions('rec_a')).toEqual(['p3']);
    store.appendObservations('rec_a', 'src_a', cursor, [{ ...obs('v2'), privacyPolicyVersion: 'p4' }]);
    expect(store.policyVersions('rec_a').sort()).toEqual(['p3', 'p4']);
    store.appendObservations('rec_a', 'src_a', cursor, [{ ...obs('v2'), privacyPolicyVersion: 'p9' }]); // duplicate id: not stored
    expect(store.policyVersions('rec_a').sort()).toEqual(['p3', 'p4']);
    store.deleteRecording('rec_a');
    expect(store.policyVersions('rec_a')).toEqual([]);
  });
});
