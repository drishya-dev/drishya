import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { projectionDigest, reduce } from '@drishya/projection';
import { ChunkedFold } from '@drishya/ingest';
import { App } from '../src/app.ts';

// PERF-4: a resumed Claude Code session is a lineage (the parent's journal, then the child's). The history worker folds
// it in slices and then appends the child's new records to the resident fold, passing them through the same repeat check
// a rebuild uses. Both must give exactly what a fresh rebuild of the same journals gives.
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const user = (n: number, content: unknown, second = 0) => ({ type: 'user', uuid: uuid(n), timestamp: `2026-01-01T00:00:${String(second).padStart(2, '0')}Z`, message: { content } });
const assistant = (n: number, content: unknown, second = 1) => ({ type: 'assistant', uuid: uuid(n), timestamp: `2026-01-01T00:00:${String(second).padStart(2, '0')}Z`, message: { id: `message-${n}`, content, usage: { input_tokens: 10, output_tokens: 1 } } });
const boundary = (n: number, parent: number) => ({ type: 'system', subtype: 'compact_boundary', uuid: uuid(n), logicalParentUuid: uuid(parent), timestamp: '2026-01-01T00:00:30Z', compactMetadata: { trigger: 'auto', preTokens: 20 } });
const lines = (rows: unknown[]) => rows.map((row) => JSON.stringify(row)).join(String.fromCharCode(10)) + String.fromCharCode(10);

const dirs: string[] = [];
const apps: App[] = [];
afterEach(async () => { for (const app of apps.splice(0)) await app.close(); for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

function journals() {
  const dir = mkdtempSync(join(tmpdir(), 'drishya-lineage-fold-')); dirs.push(dir);
  const parent = join(dir, 'parent.jsonl'), child = join(dir, 'child.jsonl');
  const earlier = Array.from({ length: 5 }, (_, i) => [user(10 + i * 2, `earlier prompt ${i}`, i), assistant(11 + i * 2, [{ type: 'text', text: `earlier answer ${i}` }], i)]).flat();
  writeFileSync(parent, lines(earlier));
  // The child repeats the parent's first message (a resumed session re-emits earlier rows), then carries on.
  writeFileSync(child, lines([boundary(100, 19), user(10, 'earlier prompt 0', 31), ...Array.from({ length: 4 }, (_, i) => [user(200 + i * 2, `later prompt ${i}`, 32 + i), assistant(201 + i * 2, [{ type: 'text', text: `later answer ${i}` }], 32 + i)]).flat()]));
  return { dir, parent, child, all: [parent, child] };
}

async function open(f: ReturnType<typeof journals>, home: string) {
  const app = new App(join(f.dir, home)); apps.push(app);
  const { recordingId } = await app.ingest.importSource('claude-code', f.child, { lineageSources: f.all });
  return { app, recordingId };
}

describe('lineage in the history worker', () => {
  it('a lineage folded in slices equals the rebuild, for any slice size', async () => {
    const f = journals();
    const { app, recordingId } = await open(f, 'a');
    const ids = app.readingId(recordingId).split('+');
    expect(ids).toHaveLength(2);
    const lineage = app.store.lineageForIds(ids)!;
    const opts = { adapters: app.ingest.descriptors, live: true, ordered: true, lineage } as const;
    const expected = projectionDigest(reduce(lineage.currentRecordingId, app.store.lineageObservations(lineage), app.store.blobs, opts));
    for (const slice of [1, 3, 1000]) {
      const chunked = new ChunkedFold(app.store, ids, app.store.blobs, { adapters: app.ingest.descriptors, live: true, ordered: true });
      while (!chunked.step(slice));
      expect(projectionDigest(chunked.fold.snapshot(true))).toBe(expected);
    }
  });

  it('new records of the child are appended to the resident fold and equal a fresh rebuild', async () => {
    const f = journals();
    const { app, recordingId } = await open(f, 'a');
    const id = app.readingId(recordingId);
    await app.history.page(id, { count: 8 });
    appendFileSync(f.child, lines([user(300, 'a prompt written while Drishya watched', 50), assistant(301, [{ type: 'text', text: 'and its answer' }], 51), user(10, 'earlier prompt 0', 52)]));
    await app.ingest.sync(recordingId);
    const grown = await app.history.page(id, { count: 64 });
    expect(grown.projection.prose.some((p) => p.text === 'and its answer')).toBe(true);
    const fresh = await open(f, 'b');
    const expected = await fresh.app.history.page(fresh.app.readingId(fresh.recordingId), { count: 64 });
    expect(JSON.stringify(grown.projection)).toBe(JSON.stringify(expected.projection));
    expect(JSON.stringify(grown.scene)).toBe(JSON.stringify(expected.scene));
  });
});
