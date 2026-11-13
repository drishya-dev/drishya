import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { Store } from '@drishya/store';
import { Ingestor } from '../src/index.ts';
import { createAntigravityAdapter } from '../../adapter-antigravity/src/index.ts';

let dir: string, journal: string, store: Store, ingest: Ingestor;
const row = (step_index: number, type: string, content = '', extra: Record<string, unknown> = {}) => ({ step_index, type, source: 'MODEL', status: 'DONE', created_at: `2026-11-13T10:00:${String(step_index).padStart(2, '0')}Z`, content, tool_calls: [], ...extra });
const line = (value: unknown) => JSON.stringify(value) + '\n';
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-ag-import-'));
  journal = join(dir, 'brain', 'conversation', '.system_generated', 'logs', 'transcript.jsonl');
  mkdirSync(join(journal, '..'), { recursive: true });
  store = new Store(join(dir, 'store')); ingest = new Ingestor(store, [createAntigravityAdapter([dir])]);
});
afterEach(async () => { await ingest.close(); store.close(); rmSync(dir, { recursive: true, force: true }); });

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
