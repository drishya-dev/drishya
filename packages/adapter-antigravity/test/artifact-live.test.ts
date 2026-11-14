import { reduce } from '../../projection/src/reduce.ts';
import { afterEach, expect, it, vi } from 'vitest';
import { appendFile, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { seal, type RawObservation } from '@drishya/capture-core';
import type { Observation } from '@drishya/contracts';
import { createAntigravityAdapter, createParser, descriptor } from '../src/index.ts';
import { liveParser } from '../src/live.ts';
import { Ingestor } from '../../ingest/src/index.ts';
import { Store } from '../../store/src/index.ts';

const roots: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) {
    if (!resolve(root).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe scratch cleanup');
    await rm(root, { recursive: true, force: true });
  }
});
async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'ag-artifact-live-')); roots.push(root);
  const dir = join(root, 'brain', 'one'), logs = join(dir, '.system_generated', 'logs');
  await mkdir(logs, { recursive: true });
  const ctx = { recordingId: 'r', sourceId: 's', sourcePath: join(logs, 'transcript.jsonl') };
  let latest = 2, now = 10000;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  const make = () => liveParser(createParser(ctx), ctx, root, 'one', () => undefined, () => latest);
  let parser = make();
  const saved: Observation[] = [];
  const save = (raws: RawObservation[]) => raws.forEach(raw => saved.push({ ...seal({ raw, recordingId: 'r', adapter: descriptor, sourceId: 's', generation: 0, byteOffset: saved.length, observedAt: '2026-11-14T10:00:00Z' }), receivedSequence: saved.length }));
  const ingest = async (row: Record<string, unknown>) => { await parser.prepare?.(row); const raws = parser.parse(row); save(raws); return raws; };
  const refresh = async () => { now += 6000; const raws = await parser.refresh?.() ?? []; save(raws); return raws.filter(r => r.kind === 'artifact.plan'); };
  const restart = () => { parser = make(); parser.prime(saved); };
  const call = (path: string) => ingest({ step_index: 1, type: 'PLANNER_RESPONSE', source: 'MODEL', tool_calls: [{ name: 'write_file', args: { Path: JSON.stringify(path), Content: JSON.stringify('- [ ] Original'), ArtifactMetadata: '{}' } }] });
  const result = (status = 'DONE') => ingest({ step_index: 2, type: 'GENERIC', status, content: 'Synthetic result' });
  return { root, dir, ctx, ingest, refresh, restart, call, result, saved, setLatest: (n: number) => { latest = n; } };
}

it('keeps distinct transitions A → B → A and restores deduplication and transition counters on restart', async () => {
  const h = await setup(), file = join(h.dir, 'task.md');
  await writeFile(file, 'A'); await h.call(file); await h.result();
  const a = await h.refresh();
  await writeFile(file, 'B'); const b = await h.refresh();
  await writeFile(file, 'A'); const again = await h.refresh();
  expect([a[0]?.payload.text, b[0]?.payload.text, again[0]?.payload.text]).toEqual(['A', 'B', 'A']);
  expect(new Set([a[0]?.recordId, b[0]?.recordId, again[0]?.recordId]).size).toBe(3);
  expect([a[0]?.payload.artifactTransition, b[0]?.payload.artifactTransition, again[0]?.payload.artifactTransition]).toEqual([1, 2, 3]);
  h.restart(); h.setLatest(3);
  await h.ingest({ step_index: 3, type: 'PLANNER_RESPONSE', content: 'Unrelated', tool_calls: [] });
  expect(await h.refresh()).toEqual([]);
  await writeFile(file, 'C'); const c = await h.refresh();
  expect(c).toHaveLength(1); expect(c[0]!.payload.artifactTransition).toBe(4);
});

it('emits missing current and later removal of both current and resolved files exactly once', async () => {
  const h = await setup(), file = join(h.dir, 'task.md'), snapshot = `${file}.resolved.2`;
  await h.call(file); await h.result();
  expect(await h.refresh()).toMatchObject([{ payload: { current: true, unavailable: 'removed' } }]);
  await writeFile(file, 'current'); await writeFile(snapshot, 'snapshot');
  expect(await h.refresh()).toHaveLength(2);
  await rm(file); await rm(snapshot);
  const removed = await h.refresh();
  expect(removed).toHaveLength(2);
  expect(removed.map(r => r.payload.unavailable)).toEqual(['removed', 'removed']);
  expect(new Set(removed.map(r => r.payload.filePath))).toEqual(new Set([file, snapshot]));
  expect(await h.refresh()).toEqual([]);
  h.restart(); expect(await h.refresh()).toEqual([]);
});

it('eventually reports deletions across bounded rotating pages without repeating receipts', async () => {
  const h = await setup(), file = join(h.dir, 'task.md');
  await writeFile(file, 'current');
  for (let n = 1; n <= 12; n++) await writeFile(`${file}.resolved.${n}`, `snapshot ${n}`);
  await h.call(file); await h.result();
  const initial = [...await h.refresh(), ...await h.refresh()];
  expect(initial).toHaveLength(13);
  await rm(`${file}.resolved.2`); await rm(`${file}.resolved.11`);
  const later = [];
  for (let i = 0; i < 6; i++) later.push(...await h.refresh());
  const removed = later.filter(row => row.payload.unavailable === 'removed');
  expect(removed.map(row => row.payload.filePath).sort()).toEqual([`${file}.resolved.11`, `${file}.resolved.2`].sort());
});

it('normalizes resolved call references and waits for both completion and inspected catch-up', async () => {
  const h = await setup(), file = join(h.dir, 'task.md'), snapshot = `${file}.resolved.2`;
  await writeFile(file, 'current'); await writeFile(snapshot, 'snapshot');
  h.setLatest(4);
  const rows = await h.call(snapshot), call = rows.find(r => r.kind === 'tool.call')!;
  expect(call.payload.nativeArtifact).toMatchObject({ path: resolve(file), name: 'task.md', recordedPath: snapshot });
  expect(await h.refresh()).toEqual([]);
  await h.result('RUNNING'); expect(await h.refresh()).toEqual([]);
  await h.result('DONE'); expect(await h.refresh()).toEqual([]);
  await h.ingest({ step_index: 4, type: 'PLANNER_RESPONSE', content: 'Catch-up', tool_calls: [] });
  const versions = await h.refresh();
  expect(versions.map(v => v.payload.filePath)).toEqual([snapshot, file]);
  expect(versions.every(v => v.payload.forOperationId === call.operationId)).toBe(true);
});

it('does not duplicate an unchanged artifact after a real ingestor restart and unrelated journal step', async () => {
  const h = await setup(), journal = h.ctx.sourcePath, file = join(h.dir, 'task.md');
  const row = (step_index: number, type: string, extra: object) => JSON.stringify({ step_index, type, source: 'MODEL', status: 'DONE', ...extra }) + '\n';
  await writeFile(file, 'Synthetic current');
  await writeFile(journal, row(1, 'PLANNER_RESPONSE', { tool_calls: [{ name: 'write_file', args: { Path: JSON.stringify(file), Content: JSON.stringify('Synthetic call'), ArtifactMetadata: '{}' } }] }) + row(2, 'GENERIC', { content: 'Synthetic result' }));
  const store = new Store(join(h.root, 'store'));
  let ingest = new Ingestor(store, [createAntigravityAdapter([h.root])]);
  try {
    const { recordingId } = await ingest.importSource('antigravity', journal);
    const first = store.observationsOfKinds(recordingId, ['artifact.plan']);
    expect(first).toHaveLength(1);
    const projected = reduce(recordingId, store.observations(recordingId), { get: () => undefined, put: () => ({sha:'synthetic',bytes:0}) }, {adapters:{}});
    expect(projected.operations.some(op => op.detail.kind === 'plan' && op.detail.artifactVersions?.length === 1)).toBe(true);
    await ingest.close();
    ingest = new Ingestor(store, [createAntigravityAdapter([h.root])]);
    await appendFile(journal, row(3, 'PLANNER_RESPONSE', { content: 'Synthetic later prose', tool_calls: [] }));
    await ingest.sync(recordingId);
    expect(store.observationsOfKinds(recordingId, ['artifact.plan'])).toHaveLength(1);
  } finally { await ingest.close(); store.close(); }
});
