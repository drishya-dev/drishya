import { mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Observation, Projection } from '@drishya/contracts';
import { FOLD_FORMAT, orderObservations, projectionDigest, ProjectionFold, reduce, REDUCER_VERSION, type FoldCheckpoint } from '@drishya/projection';
import { Store } from '@drishya/store';
import { Ingestor } from '../src/index.ts';

// PERF-4 guard: a fold written out as a checkpoint (the head as JSON, the reducer's state as bytes), read back and appended
// with the rest of the recording, gives exactly what a full rebuild gives, at every split point, for every synthetic fixture
// (the sources of the golden scenes included), with the recording finished and live. Plus every input that must stop a
// checkpoint being resumed.
const fixtures = fileURLToPath(new URL('../../../fixtures/synthetic', import.meta.url));
let dir: string;
let store: Store;
let ingest: Ingestor;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-fold-checkpoint-'));
  store = new Store(join(dir, 'data'));
  ingest = new Ingestor(store);
});
afterAll(async () => {
  await ingest.close();
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

function journals(root: string, out: string[] = []): string[] {
  for (const e of readdirSync(root, { withFileTypes: true })) {
    const p = join(root, e.name);
    if (e.isDirectory()) { if (e.name !== 'subagents') journals(p, out); } else if (e.name.endsWith('.jsonl')) out.push(p);
  }
  return out;
}
const adapterOf = (path: string) => /(^|[\\/])claude[\\/-]|claude-usage|checkout-fix\.jsonl$/.test(relative(fixtures, path)) ? 'claude-code' : 'codex';

function firstDifference(a: Projection, b: Projection): string {
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) if (JSON.stringify((a as never)[key]) !== JSON.stringify((b as never)[key])) return key;
  return 'none';
}
function splits(n: number): number[] {
  if (n <= 160) return Array.from({ length: n - 1 }, (_, i) => i + 1);
  const picks = new Set<number>();
  for (let i = 1; i <= 8; i++) { picks.add(i); picks.add(n - i); }
  for (let i = 1; i <= 60; i++) picks.add(Math.max(1, Math.min(n - 1, Math.round((n * i) / 61))));
  return [...picks].sort((a, b) => a - b);
}
/** What persisting does to a checkpoint: the head becomes JSON text, the state stays bytes. */
const persisted = (c: FoldCheckpoint): FoldCheckpoint => ({ head: JSON.parse(JSON.stringify(c.head)), state: Buffer.from(c.state), blobs: [...c.blobs] });

function check(recordingId: string, live: boolean) {
  const bySequence = store.observations(recordingId);
  const opts = { adapters: ingest.descriptors, live, ordered: true } as const;
  const full = reduce(recordingId, store.orderedObservations(recordingId), store.blobs, opts);
  const fullDigest = projectionDigest(full);
  let resumed = 0, refused = 0;
  for (const k of splits(bySequence.length)) {
    const prefix = orderObservations(bySequence.slice(0, k));
    const rest = bySequence.slice(k);
    const written = ProjectionFold.build([recordingId], prefix, store.blobs, opts).checkpoint();
    const fold = ProjectionFold.restore(persisted(written), store.blobs, opts);
    expect(fold, `restore at ${k}`).toBeDefined();
    // Restored and not yet appended: the same projection as the fold it came from.
    expect(projectionDigest(fold!.snapshot(live))).toBe(projectionDigest(ProjectionFold.build([recordingId], prefix, store.blobs, opts).snapshot(live)));
    expect(fold!.observationCount).toBe(k);
    if (fold!.append(rest)) {
      resumed++;
      const got = fold!.snapshot(live);
      if (projectionDigest(got) !== fullDigest) throw new Error(`restored then appended at split ${k}/${bySequence.length} differs from a rebuild in "${firstDifference(got, full)}"`);
      expect(fold!.observationCount).toBe(bySequence.length);
    } else refused++;
    // A checkpoint written again from the restored fold is the same checkpoint (nothing is lost by a round trip).
    const again = ProjectionFold.restore(persisted(fold!.checkpoint()), store.blobs, opts);
    expect(again).toBeDefined();
    expect(projectionDigest(again!.snapshot(live))).toBe(projectionDigest(fold!.snapshot(live)));
  }
  return { resumed, refused };
}

describe('a fold restored from a checkpoint and appended equals a full rebuild at any split point', () => {
  for (const path of journals(fixtures)) {
    it(`${relative(fixtures, path).replace(/\\/g, '/')} (${statSync(path).size} bytes)`, async () => {
      const { recordingId } = await ingest.importSource(adapterOf(path), path);
      const finished = check(recordingId, false);
      const live = check(recordingId, true);
      expect(finished.resumed + live.resumed).toBeGreaterThan(0);
      if (!path.includes('checkout-fix')) { expect(finished.refused).toBe(0); expect(live.refused).toBe(0); }
    });
  }
});

describe('what stops a checkpoint being resumed', () => {
  const rec = 'rec_ck';
  let seq = 0;
  const obs = (over: Partial<Observation> & { kind: string; payload: unknown }): Observation => {
    const n = seq++;
    return {
      id: `obs_ck${n}`, recordingId: rec, receivedSequence: n, observedAt: '2026-01-01T00:00:00.000Z', agentId: 'agent:main', privacyPolicyVersion: 'p', redactions: [], availability: 'full',
      source: { adapterId: 'codex', adapterVersion: '1', sourceId: 'src_a', generation: 0, byteOffset: n * 100, part: 0 }, ...over,
    } as Observation;
  };
  const base = () => [
    obs({ kind: 'session.meta', sourceTime: '2026-01-01T00:00:01.000Z', workspaceRoot: '/w/a', payload: { harness: 'codex', cwd: '/w/a' } }),
    obs({ kind: 'message.user', sourceTime: '2026-01-01T00:00:02.000Z', payload: { text: 'hi' } }),
  ];
  const opts = () => ({ adapters: ingest.descriptors, live: true, ordered: true }) as const;
  const written = () => ProjectionFold.build([rec], base(), store.blobs, opts()).checkpoint();

  it('is resumed when nothing differs', () => {
    expect(ProjectionFold.restore(persisted(written()), store.blobs, opts())).toBeDefined();
  });
  it('is refused for another reducer version or fold format', () => {
    expect(ProjectionFold.restore({ ...persisted(written()), head: { ...written().head, reducerVersion: `${REDUCER_VERSION}-other` } }, store.blobs, opts())).toBeUndefined();
    expect(ProjectionFold.restore({ ...persisted(written()), head: { ...written().head, format: FOLD_FORMAT + 1 } }, store.blobs, opts())).toBeUndefined();
  });
  it('is refused when its bytes are damaged', () => {
    expect(ProjectionFold.restore({ head: written().head, state: Buffer.from('not a state'), blobs: [] }, store.blobs, opts())).toBeUndefined();
  });
  it('then refuses what the head says it cannot append: an observation before it, another recording, a new root, a new generation', () => {
    const fold = ProjectionFold.restore(persisted(written()), store.blobs, opts())!;
    expect(fold.canAppend([obs({ kind: 'message.assistant', sourceTime: '2026-01-01T00:00:00.500Z', payload: { text: 'late' } })])).toBe(false);
    expect(fold.canAppend([obs({ kind: 'message.assistant', sourceTime: '2026-01-01T00:00:09.000Z', recordingId: 'rec_other', payload: { text: 'x' } })])).toBe(false);
    expect(fold.canAppend([obs({ kind: 'message.assistant', sourceTime: '2026-01-01T00:00:09.000Z', workspaceRoot: '/w/b', payload: { text: 'x' } })])).toBe(false);
    expect(fold.canAppend([obs({ kind: 'message.assistant', sourceTime: '2026-01-01T00:00:09.000Z', source: { adapterId: 'codex', adapterVersion: '1', sourceId: 'src_a', generation: 1, byteOffset: 0, part: 0 }, payload: { text: 'x' } })])).toBe(false);
    expect(fold.canAppend([obs({ kind: 'message.assistant', sourceTime: '2026-01-01T00:00:09.000Z', payload: { text: 'fine' } })])).toBe(true);
  });
});
