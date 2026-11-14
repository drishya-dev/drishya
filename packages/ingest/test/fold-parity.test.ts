import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Observation, Projection } from '@drishya/contracts';
import { orderObservations, projectionDigest, ProjectionFold, reduce, REDUCER_VERSION } from '@drishya/projection';
import { Store } from '@drishya/store';
import { Ingestor } from '../src/index.ts';
import { createAntigravityAdapter } from '../../adapter-antigravity/src/index.ts';

// LIVE-7b parity guard: folding the observations of a journal in two steps (everything up to a split, then the
// rest appended) gives exactly the projection a full rebuild gives, at every split point, for every synthetic
// fixture (the sources of the golden scenes included) and for hand-made timelines with the awkward cases: records
// without a time, a clock that goes backwards, a second workspace root, a replayed (truncated) source.
const fixtures = fileURLToPath(new URL('../../../fixtures/synthetic', import.meta.url));
let dir: string;
let store: Store;
let ingest: Ingestor;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-fold-'));
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
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (JSON.stringify((a as never)[key]) !== JSON.stringify((b as never)[key])) return key;
  }
  return 'none';
}

/** Split points: all of them for a short journal, otherwise both ends and an even sample. */
function splits(n: number): number[] {
  if (n <= 160) return Array.from({ length: n - 1 }, (_, i) => i + 1);
  const picks = new Set<number>();
  for (let i = 1; i <= 8; i++) { picks.add(i); picks.add(n - i); }
  for (let i = 1; i <= 60; i++) picks.add(Math.max(1, Math.min(n - 1, Math.round((n * i) / 61))));
  return [...picks].sort((a, b) => a - b);
}

interface Tally { appended: number; rebuilt: number }

function checkSplits(recordingId: string, live: boolean): Tally {
  const bySequence = store.observations(recordingId);
  const opts = { adapters: ingest.descriptors, live, ordered: true } as const;
  const full = reduce(recordingId, store.orderedObservations(recordingId), store.blobs, opts);
  const fullDigest = projectionDigest(full);
  const tally: Tally = { appended: 0, rebuilt: 0 };
  for (const k of splits(bySequence.length)) {
    const prefix = orderObservations(bySequence.slice(0, k));
    const rest = bySequence.slice(k);
    // The rest in one batch.
    const bulk = ProjectionFold.build([recordingId], prefix, store.blobs, opts);
    if (bulk.append(rest)) {
      tally.appended++;
      const got = bulk.snapshot(live);
      if (projectionDigest(got) !== fullDigest) throw new Error(`bulk append at split ${k}/${bySequence.length} differs from a rebuild in "${firstDifference(got, full)}"`);
      expect(bulk.observationCount).toBe(bySequence.length);
    } else tally.rebuilt++;
    // The rest a few at a time, as a followed journal grows (the fold survives each step or says rebuild).
    const stepped = ProjectionFold.build([recordingId], prefix, store.blobs, opts);
    const size = rest.length > 24 ? 7 : 1;
    let alive = true;
    for (let i = 0; i < rest.length && alive; i += size) {
      alive = stepped.append(rest.slice(i, i + size));
      if (alive) {
        const upto = orderObservations(bySequence.slice(0, k + Math.min(rest.length, i + size)));
        const expected = projectionDigest(reduce(recordingId, upto, store.blobs, opts));
        const got = stepped.snapshot(live);
        if (projectionDigest(got) !== expected) throw new Error(`stepped append to ${k + Math.min(rest.length, i + size)}/${bySequence.length} (from split ${k}) differs from a rebuild`);
      }
    }
  }
  return tally;
}

describe('a fold appended at any split point equals a full rebuild', () => {
  for (const path of journals(fixtures)) {
    it(`${relative(fixtures, path).replace(/\\/g, '/')} (${statSync(path).size} bytes)`, async () => {
      const { recordingId } = await ingest.importSource(adapterOf(path), path);
      const finished = checkSplits(recordingId, false);
      const live = checkSplits(recordingId, true);
      expect(finished.appended + live.appended).toBeGreaterThan(0);
      // A journal written in clock order never needs a rebuild: the fallback is for the awkward cases below.
      // checkout-fix has a sub-agent journal whose records interleave in time with the main one's, so a split
      // that stores the main journal first must send the caller back to a rebuild for the rest.
      if (!path.includes('checkout-fix')) { expect(finished.rebuilt).toBe(0); expect(live.rebuilt).toBe(0); }
    });
  }
});

// Antigravity (AG-1 to AG-5): a step journalled again replaces its receipt in place, and side files (task logs, artifacts) add
// observations without a new journal line. Whatever the fold does with those it must never serve something a rebuild would not:
// each split either appends to exactly the rebuild's projection or refuses (and the caller rebuilds once).
describe('Antigravity: a fold appended at any split point equals a full rebuild', () => {
  const names = ['corpus', 'native-cases'];
  const root = () => join(dir, 'ag-fixtures');
  const journalOf = (name: string) => join(root(), 'brain', `synthetic-${name}`, '.system_generated', 'logs', 'transcript.jsonl');
  const index = () => ingest.adapters.findIndex(a => a.descriptor.id === 'antigravity');
  let original: (typeof ingest.adapters)[number];
  beforeAll(() => {
    for (const name of names) { mkdirSync(join(journalOf(name), '..'), { recursive: true }); copyFileSync(join(fixtures, 'antigravity', `${name}.ndjson`), journalOf(name)); }
    original = ingest.adapters[index()]!;
    ingest.adapters.splice(index(), 1, createAntigravityAdapter([root()]));
  });
  afterAll(() => { ingest.adapters.splice(index(), 1, original); });
  for (const name of names) {
    it(`antigravity/${name}.ndjson`, async () => {
      const { recordingId } = await ingest.importSource('antigravity', journalOf(name));
      const finished = checkSplits(recordingId, false);
      const live = checkSplits(recordingId, true);
      expect(finished.appended + finished.rebuilt).toBeGreaterThan(0);
      expect(live.appended + live.rebuilt).toBeGreaterThan(0);
      // Antigravity never appends: its receipts are replaced in place and ordered by step index, so every split is a rebuild.
      expect(finished.appended + live.appended).toBe(0);
    });
  }
});

// ── hand-made timelines ──────────────────────────────────────────────────────────────────────

let seq = 0;
function observation(over: Partial<Observation> & { kind: string; payload: unknown }, recordingId: string): Observation {
  const n = seq++;
  return {
    id: `obs_t${n}`, recordingId, receivedSequence: n, observedAt: '2026-01-01T00:00:00.000Z', agentId: 'agent:main', privacyPolicyVersion: 'p', redactions: [], availability: 'full',
    source: { adapterId: 'codex', adapterVersion: '1', sourceId: 'src_a', generation: 0, byteOffset: n * 100, part: 0 },
    ...over,
  } as Observation;
}

describe('the checks that send a caller back to a rebuild', () => {
  const opts = () => ({ adapters: ingest.descriptors, live: true, ordered: true } as const);
  const base = (recordingId: string) => [
    observation({ kind: 'session.meta', sourceTime: '2026-01-01T00:00:01.000Z', workspaceRoot: '/w/a', payload: { harness: 'codex', cwd: '/w/a' } }, recordingId),
    observation({ kind: 'message.user', sourceTime: '2026-01-01T00:00:02.000Z', payload: { text: 'hi' } }, recordingId),
  ];

  it('refuses an observation that sorts before the head', () => {
    const rec = 'rec_t1';
    const fold = ProjectionFold.build([rec], base(rec), store.blobs, opts());
    const older = observation({ kind: 'message.assistant', sourceTime: '2026-01-01T00:00:00.500Z', payload: { text: 'late' } }, rec);
    expect(fold.canAppend([older])).toBe(false);
    expect(fold.append([older])).toBe(false);
    expect(fold.observationCount).toBe(2); // refused means unchanged
  });

  it('carries a record without a time forward and refuses it when the carry is older than the head', () => {
    const rec = 'rec_t2';
    const fold = ProjectionFold.build([rec], base(rec), store.blobs, opts());
    const untimedSameSource = observation({ kind: 'message.assistant', payload: { text: 'no time' } }, rec);
    expect(fold.canAppend([untimedSameSource])).toBe(true);
    const timedElsewhere = observation({ kind: 'message.assistant', sourceTime: '2026-01-01T00:00:09.000Z', source: { adapterId: 'codex', adapterVersion: '1', sourceId: 'src_b', generation: 0, byteOffset: 0, part: 0 }, payload: { text: 'b' } }, rec);
    expect(fold.append([timedElsewhere])).toBe(true);
    const untimedOtherSource = observation({ kind: 'message.assistant', payload: { text: 'a, later' } }, rec); // carries 00:02, head is 00:09
    expect(fold.canAppend([untimedOtherSource])).toBe(false);
  });

  it('refuses a new workspace root, a new source generation and a truncation marker', () => {
    const rec = 'rec_t3';
    const fold = ProjectionFold.build([rec], base(rec), store.blobs, opts());
    const root = observation({ kind: 'tool.call', sourceTime: '2026-01-01T00:00:03.000Z', workspaceRoot: '/w/b', payload: { tool: 'x', input: {} } }, rec);
    const generation = observation({ kind: 'message.user', sourceTime: '2026-01-01T00:00:03.000Z', source: { adapterId: 'codex', adapterVersion: '1', sourceId: 'src_a', generation: 1, byteOffset: 0, part: 0 }, payload: { text: 'again' } }, rec);
    const truncated = observation({ kind: 'capture.gap', sourceTime: '2026-01-01T00:00:03.000Z', payload: { reason: 'source-truncated' } }, rec);
    for (const o of [root, generation, truncated]) expect(fold.canAppend([o])).toBe(false);
  });

  it('refuses another recording, a replayed sequence and a head from another reducer or format', () => {
    const rec = 'rec_t4';
    const obs = base(rec);
    const fold = ProjectionFold.build([rec], obs, store.blobs, opts());
    expect(fold.canAppend([observation({ kind: 'message.user', sourceTime: '2026-01-01T00:00:05.000Z', payload: { text: 'x' } }, 'rec_other')])).toBe(false);
    expect(fold.canAppend([obs[1]!])).toBe(false);
    expect(fold.head.reducerVersion).toBe(REDUCER_VERSION);
    const stale = JSON.parse(JSON.stringify(fold.head));
    expect(stale.format).toBe(1);
    expect(Object.keys(stale).sort()).toEqual(['clock', 'counts', 'format', 'generations', 'parts', 'recordingId', 'reducerVersion', 'roots', 'sequences', 'sourceClocks']);
  });

  it('a batch whose observations sort among themselves is appended in clock order, equal to a rebuild', () => {
    const rec = 'rec_t5';
    const first = base(rec);
    const batch = [
      observation({ kind: 'message.assistant', sourceTime: '2026-01-01T00:00:05.000Z', payload: { text: 'five' } }, rec),
      observation({ kind: 'message.assistant', sourceTime: '2026-01-01T00:00:04.000Z', source: { adapterId: 'codex', adapterVersion: '1', sourceId: 'src_b', generation: 0, byteOffset: 0, part: 0 }, payload: { text: 'four, other source' } }, rec),
    ];
    const fold = ProjectionFold.build([rec], first, store.blobs, opts());
    expect(fold.append(batch)).toBe(true);
    const full = reduce(rec, orderObservations([...first, ...batch]), store.blobs, opts());
    expect(projectionDigest(fold.snapshot(true))).toBe(projectionDigest(full));
  });
});
