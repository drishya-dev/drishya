import { mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Operation, Projection } from '@drishya/contracts';
import { projectionDigest, reduce } from '@drishya/projection';
import { Store } from '@drishya/store';
import { buildTail, ChunkedFold, Ingestor } from '../src/index.ts';

// PERF-4 guards for the two ways a large recording is opened:
//   1. folded in slices (any slice size), the projection is exactly the full rebuild, for every synthetic fixture;
//   2. a tail projection (the last few prompts only) carries the same operations, with the same identities and the
//      same content, as the full projection, so the swap from one to the other changes nothing the reader sees
//      except what the tail could not know (earlier history, whole-session totals, step numbering).
const fixtures = fileURLToPath(new URL('../../../fixtures/synthetic', import.meta.url));
let dir: string;
let store: Store;
let ingest: Ingestor;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-open-fold-'));
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

/** An operation without the numbers that count steps from the start of the history (a tail starts mid-way). */
function comparable(op: Operation): unknown {
  const { startSequence: _s, endSequence: _e, ...rest } = op;
  return JSON.parse(JSON.stringify(rest, (key, value) => (key === 'observedAtSequence' || key === 'availableAfterStep' ? undefined : value)));
}

describe('open-fold: a recording folded in slices equals a full rebuild', () => {
  for (const path of journals(fixtures)) {
    it(`${relative(fixtures, path).replace(/\\/g, '/')} (${statSync(path).size} bytes)`, async () => {
      const { recordingId } = await ingest.importSource(adapterOf(path), path);
      for (const live of [false, true]) {
        const opts = { adapters: ingest.descriptors, live, ordered: true } as const;
        const expected = projectionDigest(reduce(recordingId, store.orderedObservations(recordingId), store.blobs, opts));
        for (const slice of [1, 7, 4096]) {
          const chunked = new ChunkedFold(store, [recordingId], store.blobs, opts);
          let calls = 0;
          while (!chunked.step(slice)) calls++;
          expect(chunked.fold.observationCount).toBe(store.countObservations(recordingId));
          expect(projectionDigest(chunked.fold.snapshot(live))).toBe(expected);
          if (slice === 1) expect(calls).toBeGreaterThanOrEqual(store.countObservations(recordingId) - 1);
        }
      }
    });
  }
});

describe('open-fold: a tail projection matches the full projection', () => {
  const checked = { journals: 0, operations: 0, partial: 0 };
  for (const path of journals(fixtures)) {
    it(`${relative(fixtures, path).replace(/\\/g, '/')}`, async () => {
      const { recordingId } = await ingest.importSource(adapterOf(path), path);
      const opts = { adapters: ingest.descriptors, live: false, ordered: true } as const;
      const full: Projection = reduce(recordingId, store.orderedObservations(recordingId), store.blobs, opts);
      checked.journals++;
      for (const prompts of [1, 2, 3, 20]) {
        const tail = buildTail(store, [recordingId], store.blobs, opts, { prompts });
        const projection = tail.fold.snapshot(false);
        if (tail.complete) { expect(projectionDigest(projection)).toBe(projectionDigest(full)); continue; }
        checked.partial++;
        // Every operation the tail holds is an operation of the full projection with the same id and the same content,
        // unless the tail cut it (its call before the first prompt: it then has a result and no call).
        const fullById = new Map(full.operations.map((op) => [op.id, op]));
        for (const op of projection.operations) {
          const other = fullById.get(op.id);
          expect(other, `${op.id} is in the full projection`).toBeDefined();
          if (op.observationIds.length !== other!.observationIds.length) continue; // started before the tail: partial by construction
          expect(comparable(op), `${op.id} (${prompts} prompts)`).toEqual(comparable(other!));
          checked.operations++;
        }
        // The reading material (prose) is the same text with the same ids.
        const fullProse = new Map(full.prose.map((p) => [p.id, p]));
        for (const prose of projection.prose) expect(fullProse.get(prose.id)?.text).toBe(prose.text);
        // Roots decide path namespaces; the tail knows them all, so the workspace identity is the full one.
        expect(projection.workspaceRoot).toBe(full.workspaceRoot);
      }
    });
  }
  it('compared a meaningful number of operations', () => {
    expect(checked.journals).toBeGreaterThan(5);
    expect(checked.partial).toBeGreaterThan(5);
    expect(checked.operations).toBeGreaterThan(10);
  });
});
