import { appendFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { Store } from '@drishya/store';
import { Ingestor } from '../src/index.ts';
import { createAntigravityAdapter } from '../../adapter-antigravity/src/index.ts';
import { App } from '../../../apps/daemon/src/app.ts';
import { codexAdapter } from '../../adapter-codex/src/index.ts';
import { orderObservations } from '../../projection/src/reduce.ts';

let dir: string, journal: string, store: Store, ingest: Ingestor;
const row = (step_index: number, type: string, content = '', extra: Record<string, unknown> = {}) => ({ step_index, type, source: 'MODEL', status: 'DONE', created_at: `2026-11-13T10:00:${String(step_index).padStart(2, '0')}Z`, content, tool_calls: [], ...extra });
const line = (value: unknown) => JSON.stringify(value) + '\n';
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-ag-import-'));
  journal = join(dir, 'brain', 'conversation', '.system_generated', 'logs', 'transcript.jsonl');
  mkdirSync(join(journal, '..'), { recursive: true });
  store = new Store(join(dir, 'store')); ingest = new Ingestor(store, [createAntigravityAdapter([dir])]);
});
afterEach(async () => { await ingest.close(); store.close(); if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe scratch cleanup'); rmSync(dir, { recursive: true, force: true }); });

it('imports idempotently and replaces a repeated result in the projection and search', async () => {
  const call = { name: 'run_command', args: { CommandLine: '"echo synthetic"' } };
  writeFileSync(journal, line(row(0, 'PLANNER_RESPONSE', '', { tool_calls: [call] })) + line(row(1, 'RUN_COMMAND', 'obsoleteword')));
  const first = await ingest.importSource('antigravity', journal);
  const count = store.countObservations(first.recordingId);
  expect((await ingest.importSource('antigravity', journal)).added).toBe(0);
  expect(store.search(first.recordingId, 'obsoleteword')).toHaveLength(1);
  appendFileSync(journal, line(row(1, 'RUN_COMMAND', 'replacementword')));
  await ingest.sync(first.recordingId);
  expect(store.countObservations(first.recordingId)).toBe(count);
  expect(store.search(first.recordingId, 'obsoleteword')).toHaveLength(0);
  expect(store.search(first.recordingId, 'replacementword')).toHaveLength(1);
  expect(JSON.stringify(ingest.projection(first.recordingId))).toContain('replacementword');
  expect(JSON.stringify(ingest.projection(first.recordingId))).not.toContain('obsoleteword');
});

it('preserves step order when the source clock moves backwards', async () => {
  writeFileSync(journal, line(row(0, 'USER_INPUT', 'question', { source: 'USER_EXPLICIT', created_at: '2026-11-13T10:00:12Z' })) + line(row(1, 'PLANNER_RESPONSE', 'answer', { created_at: '2026-11-13T10:00:00Z' })));
  const result = await ingest.importSource('antigravity', journal);
  const timeline = ingest.projection(result.recordingId).timeline;
  expect(timeline.findIndex(item => item.type === 'turn')).toBeLessThan(timeline.findIndex(item => item.type === 'prose'));
});

it('keeps native Antigravity order in a combined Codex view and agrees with in-memory reduction', async () => {
  writeFileSync(journal, line(row(0, 'USER_INPUT', 'ag prompt', { source: 'USER_EXPLICIT', created_at: '2026-11-13T10:00:12Z' })) + line(row(1, 'PLANNER_RESPONSE', 'ag answer', { created_at: '2026-11-13T10:00:00Z' })));
  const ag = await ingest.importSource('antigravity', journal);
  const codexPath = join(dir, 'codex.jsonl');
  writeFileSync(codexPath, line({ type: 'session_meta', timestamp: '2026-11-13T10:00:05Z', payload: { id: 'synthetic-codex' } }) + line({ type: 'response_item', timestamp: '2026-11-13T10:00:05Z', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'codex answer' }] } }));
  ingest.adapters.push(codexAdapter);
  const codex = await ingest.importSource('codex', codexPath);
  const ordered = [...store.orderedObservations([ag.recordingId, codex.recordingId])];
  const inMemory = orderObservations([...store.observations(ag.recordingId), ...store.observations(codex.recordingId)]);
  expect(ordered.map(o => o.id)).toEqual(inMemory.map(o => o.id));
  const messages = ordered.filter(o => o.kind === 'message.user' || o.kind === 'message.assistant');
  expect(messages.map(o => (o.payload as { text: string }).text)).toEqual(['codex answer', 'ag prompt', 'ag answer']);
  expect(JSON.stringify(ingest.combinedProjection([ag.recordingId, codex.recordingId]))).toContain('ag answer');
  appendFileSync(journal, line(row(1, 'PLANNER_RESPONSE', 'replacement ag prose', { created_at: '2026-11-13T10:00:00Z' })));
  await ingest.sync(ag.recordingId);
  const updated = JSON.stringify(ingest.combinedProjection([ag.recordingId, codex.recordingId]));
  expect(updated).toContain('replacement ag prose');
  expect(updated).not.toContain('ag answer');
});

it('redacts the synthetic canary before the store, blobs, search and export', async () => {
  const canary = 'ghp_' + 'a1b2c3d4'.repeat(5);
  writeFileSync(journal, line(row(0, 'PLANNER_RESPONSE', '', { tool_calls: [{ name: 'run_command', args: { CommandLine: JSON.stringify('echo token=' + canary + ' synthetic'.repeat(3000)) } }] })) + line(row(1, 'GENERIC', 'Synthetic command output')));
  const app = new App(join(dir, 'export-store'));
  app.ingest.adapters.splice(0, app.ingest.adapters.length, createAntigravityAdapter([dir]));
  try {
    const result = await app.ingest.importSource('antigravity', journal);
    expect(JSON.stringify(app.store.observations(result.recordingId))).not.toContain(canary);
    expect(app.store.search(result.recordingId, canary)).toHaveLength(0);
    const blobs = readdirSync(app.store.blobs.dir, { recursive: true, withFileTypes: true }).filter(entry => entry.isFile());
    expect(blobs.length).toBeGreaterThan(0);
    for (const blob of blobs) expect(readFileSync(join(blob.parentPath, blob.name), 'utf8')).not.toContain(canary);
    expect(JSON.stringify(await app.exportBundle(result.recordingId))).not.toContain(canary);
  } finally { await app.close(); }
});

it('removes stale prose, calls and search text when a planner replacement shrinks', async () => {
  const first = row(0, 'PLANNER_RESPONSE', 'obsoleteprose', { tool_calls: [{ name: 'run_command', args: { CommandLine: '"echo obsoletecommand"' } }] });
  writeFileSync(journal, line(first) + line(row(0, 'PLANNER_RESPONSE', 'replacementprose')));
  const result = await ingest.importSource('antigravity', journal);
  expect(store.search(result.recordingId, 'obsoleteprose')).toHaveLength(0);
  expect(store.search(result.recordingId, 'obsoletecommand')).toHaveLength(0);
  expect(ingest.projection(result.recordingId).operations).toHaveLength(0);
  appendFileSync(journal, line(row(0, 'PLANNER_RESPONSE', 'latestprose', { tool_calls: [{ name: 'run_command', args: { CommandLine: '"echo latestcommand"' } }] })));
  await ingest.sync(result.recordingId);
  expect(store.search(result.recordingId, 'replacementprose')).toHaveLength(0);
  appendFileSync(journal, line(row(0, 'PLANNER_RESPONSE', 'finalprose')));
  await ingest.sync(result.recordingId);
  expect(ingest.projection(result.recordingId).operations).toHaveLength(0);
  expect(store.search(result.recordingId, 'latestcommand')).toHaveLength(0);
});

it('keeps the same recording when a fuller transcript appears, including after reopening', async () => {
  writeFileSync(journal, line(row(0, 'USER_INPUT', 'request', { source: 'USER_EXPLICIT' })));
  const first = await ingest.importSource('antigravity', journal);
  const full = join(journal, '..', 'transcript_full.jsonl');
  writeFileSync(full, line(row(0, 'USER_INPUT', 'request', { source: 'USER_EXPLICIT' })) + line(row(1, 'PLANNER_RESPONSE', 'full reply')));
  expect((await ingest.importSource('antigravity', full)).recordingId).toBe(first.recordingId);
  expect(JSON.stringify(ingest.projection(first.recordingId))).toContain('full reply');
  await ingest.close(); store.close();
  store = new Store(join(dir, 'store')); ingest = new Ingestor(store, [createAntigravityAdapter([dir])]);
  const discovered = await ingest.discover('antigravity');
  expect(discovered).toHaveLength(1);
  expect(discovered[0]!.importedRecordingId).toBe(first.recordingId);
  expect((await ingest.importSource('antigravity', discovered[0]!.path)).recordingId).toBe(first.recordingId);
  expect(store.listRecordings()).toHaveLength(1);
});
