import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import type { Observation, TurnDetailPayload } from '@drishya/contracts';
import { SCHEMA_VERSION, Store } from '../src/index.ts';

let dir: string, store: Store;
const cursor = { offset: 1000, generation: 0, fingerprint: 'synthetic' };
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'drishya-stats-')); store = new Store(dir); });
afterEach(() => { store.close(); rmSync(dir, { recursive: true, force: true }); });
function seed(harness = 'claude-code', id = 'rec') {
  store.upsertRecording({ id, harness, adapterId: harness, sourcePath: join(dir, 'synthetic') });
}
function record(id: string, offset: number, kind: string, payload: Observation['payload']): Omit<Observation, 'receivedSequence'> {
  return { id, recordingId: 'rec', kind, payload,
    source: { adapterId: 'claude-code', adapterVersion: 'test', sourceId: 'src', generation: 0, byteOffset: offset, part: 0 },
    observedAt: '2026-10-29T00:00:00Z', agentId: 'main', privacyPolicyVersion: 'p3', redactions: [], availability: 'complete' };
}
const cost = (id: string, offset: number, work: Record<string, number> = {}) => record(id, offset, 'usage', { source: 'claude-cost-state', cumulative: true, work });
const turn = (id: string, offset: number, detail: TurnDetailPayload) => record(id, offset, 'turn.detail', detail);
const append = (...records: Omit<Observation, 'receivedSequence'>[]) => store.appendObservations('rec', 'src', cursor, records);

it('uses the latest Claude snapshot, never its sum, and returns it in listRecordings', () => {
  seed();
  append(cost('old', 10, { durationMs: 200, linesAdded: 5, linesRemoved: 2 }), cost('latest', 20, { durationMs: 300, linesAdded: 8, linesRemoved: 4 }));
  expect(store.listRecordings()[0]!.stats).toEqual({ source: 'claude-cost-state', durationMs: 300, linesAdded: 8, linesRemoved: 4 });
  expect(store.getRecording('rec')!.stats).toEqual(store.listRecordings()[0]!.stats);
});

it('orders by source id, generation, numeric offset and part, not append order or source time', () => {
  seed();
  const newest = cost('new', 20, { durationMs: 30 });
  newest.source = { ...newest.source, sourceId: 'src_z', generation: 2, part: 1 };
  newest.sourceTime = '2020-01-01T00:00:00Z';
  append(newest);
  for (const [id, sourceId, generation, byteOffset, part] of [
    ['source', 'src_a', 99, 999, 99], ['generation', 'src_z', 1, 999, 99],
    ['offset', 'src_z', 2, 9, 99], ['part', 'src_z', 2, 20, 0],
  ] as const) {
    const older = cost(id, byteOffset, { durationMs: 999 });
    older.source = { ...older.source, sourceId, generation, byteOffset, part };
    older.sourceTime = '2030-01-01T00:00:00Z';
    append(older);
    expect(store.getRecording('rec')!.stats).toEqual({ source: 'claude-cost-state', durationMs: 30 });
  }
});

it('does not update stats on duplicate reimport or an irrelevant usage record', () => {
  seed(); const snapshot = cost('same', 10, { linesAdded: 4 }); append(snapshot);
  store.db.exec(`CREATE TRIGGER reject_stats_update BEFORE UPDATE OF stats ON recordings BEGIN SELECT RAISE(ABORT, 'unexpected stats write'); END`);
  expect(append({ ...snapshot, payload: { source: 'claude-cost-state', cumulative: true, work: { linesAdded: 999 } } })).toHaveLength(0);
  append(record('tokens', 20, 'usage', { source: 'claude-message-usage', cumulative: false, tokens: { input: 10 } }));
  expect(store.getRecording('rec')!.stats).toEqual({ source: 'claude-cost-state', linesAdded: 4 });
});

it('sums distinct Codex turns once, taking the latest detail and journal-last outcome', () => {
  seed('codex');
  append(turn('a', 10, { turnId: 'a', durationMs: 100, outcome: 'completed' }),
    turn('b', 20, { turnId: 'b', durationMs: 200, outcome: 'completed' }),
    turn('a-new', 30, { turnId: 'a', durationMs: 150, outcome: 'aborted' }));
  const expected = { source: 'codex-turns', durationMs: 350, lastOutcome: 'aborted' };
  expect(store.getRecording('rec')!.stats).toEqual(expected);
  append(turn('a-late', 5, { turnId: 'a', durationMs: 999, outcome: 'completed' }));
  expect(store.getRecording('rec')!.stats).toEqual(expected);
  expect(append(turn('a-new', 30, { turnId: 'a', durationMs: 150, outcome: 'aborted' }))).toHaveLength(0);
  expect(store.getRecording('rec')!.stats).toEqual(expected);
});

it('keeps missing stats absent, preserves reported zero, and never carries an older missing field', () => {
  seed(); expect(store.getRecording('rec')).not.toHaveProperty('stats');
  append(cost('old', 10, { durationMs: 10, linesAdded: 2, linesRemoved: 3 }));
  append(cost('new', 20, { linesAdded: 0 }));
  expect(store.getRecording('rec')!.stats).toEqual({ source: 'claude-cost-state', linesAdded: 0 });
  append(cost('empty', 30)); expect(store.getRecording('rec')).not.toHaveProperty('stats');
});

it('uses absent latest Codex values as absent rather than retaining earlier turn details', () => {
  seed('codex'); append(turn('a', 10, { turnId: 'a', durationMs: 50, outcome: 'completed' }));
  append(turn('a-settings', 20, { turnId: 'a', settings: { model: 'synthetic' } }));
  expect(store.getRecording('rec')).not.toHaveProperty('stats');
  append(turn('b', 30, { turnId: 'b', durationMs: 0 }));
  expect(store.getRecording('rec')!.stats).toEqual({ source: 'codex-turns', durationMs: 0 });
});

it('ignores non-accounting data, invalid numbers and data from the other harness', () => {
  seed('codex'); append(cost('claude', 10, { durationMs: 99 }), turn('negative', 20, { turnId: 'a', durationMs: -1 }));
  expect(store.getRecording('rec')).not.toHaveProperty('stats');
  seed('claude-code', 'other');
  store.appendObservations('other', 'src', cursor, [{ ...turn('codex', 30, { turnId: 'a', durationMs: 99, outcome: 'completed' }), recordingId: 'other' }]);
  expect(store.getRecording('other')).not.toHaveProperty('stats');
});

it('rolls accounting back together with observations and revision', () => {
  seed(); append(cost('old', 10, { durationMs: 10 }));
  store.db.exec(`CREATE TRIGGER reject_revision BEFORE UPDATE OF revision ON recordings BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END`);
  expect(() => append(cost('new', 20, { durationMs: 20 }))).toThrow('synthetic failure');
  expect(store.getRecording('rec')!.stats).toEqual({ source: 'claude-cost-state', durationMs: 10 });
  expect(store.getRecording('rec')!.revision).toBe(1);
  expect(store.observationById('rec', 'new')).toBeUndefined();
});

it('migrates a v4 database and backfills both harnesses once without reading other kinds', () => {
  seed(); append(cost('cost', 20, { linesAdded: 4, durationMs: 20 }));
  seed('codex', 'codex');
  store.appendObservations('codex', 'src', cursor, [{ ...turn('turn', 10, { turnId: 't', durationMs: 5, outcome: 'completed' }), recordingId: 'codex' }]);
  seed('claude-code', 'empty');
  // A deliberately non-JSON unrelated body proves backfill is limited to accounting kinds.
  append(record('unrelated', 30, 'message.user', { text: 'synthetic' }));
  store.db.exec(`UPDATE observations SET body='not JSON' WHERE id='unrelated'; ALTER TABLE recordings DROP COLUMN stats; UPDATE meta SET value='4' WHERE key='schema_version'`);
  store.close(); store = new Store(dir);
  expect(SCHEMA_VERSION).toBe(5);
  expect(store.db.prepare("SELECT value FROM meta WHERE key='schema_version'").get()?.value).toBe('5');
  expect(store.getRecording('rec')!.stats).toEqual({ source: 'claude-cost-state', linesAdded: 4, durationMs: 20 });
  expect(store.getRecording('codex')!.stats).toEqual({ source: 'codex-turns', durationMs: 5, lastOutcome: 'completed' });
  expect(store.getRecording('empty')).not.toHaveProperty('stats');
  store.db.exec(`CREATE TRIGGER reject_backfill BEFORE UPDATE OF stats ON recordings BEGIN SELECT RAISE(ABORT, 'backfill ran twice'); END`);
  store.close(); store = new Store(dir);
  expect(store.listRecordings()).toHaveLength(3);
});
