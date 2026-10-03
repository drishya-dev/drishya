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
