import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { App } from '../src/app.ts';
import { createAntigravityAdapter } from '../../../packages/adapter-antigravity/src/index.ts';

let app: App | undefined, dir: string;
afterEach(async () => { await app?.close(); if (dir) rmSync(dir, { recursive: true, force: true }); });
const row = (step_index: number, type: string, content = '', extra: Record<string, unknown> = {}) => ({ step_index, type, content, source: 'MODEL', status: 'DONE', created_at: '2026-11-14T00:00:00Z', tool_calls: [], ...extra });
const line = (value: unknown) => JSON.stringify(value) + '\n';

// The worker's incremental reducer only appends rows newer than its last sequence. Antigravity replaces a step's
// receipt in place (same id and sequence), so a followed Antigravity history must be rebuilt, not appended to.
it('a followed Antigravity history page shows a step that is journalled again in place', async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-ag-live-history-')); app = new App(join(dir, 'store'));
  const journal = join(dir, 'brain', 'parent', '.system_generated', 'logs', 'transcript.jsonl');
  mkdirSync(join(journal, '..'), { recursive: true });
  const call = { name: 'run_command', args: { CommandLine: JSON.stringify('echo synthetic') } };
  writeFileSync(journal, line(row(0, 'PLANNER_RESPONSE', '', { tool_calls: [call] })) + line(row(1, 'GENERIC', 'Task ID: task-1', { status: 'RUNNING' })));
  const index = app.ingest.adapters.findIndex(a => a.descriptor.id === 'antigravity');
  app.ingest.adapters.splice(index, 1, createAntigravityAdapter([dir]));
  const { recordingId } = await app.ingest.importSource('antigravity', journal);
  app.store.updateRecordingMeta(recordingId, { live: true });
  const status = async () => (await app!.history.page(recordingId, { count: 50 })).projection.operations.map(op => `${op.status}:${op.detail.kind === 'shell' ? op.detail.outputPreview ?? '' : ''}`);
  const before = await status();
  appendFileSync(journal, line(row(1, 'GENERIC', 'Task ID: task-1', { status: 'DONE' })));
  await app.ingest.sync(recordingId);
  const expected = app.ingest.projection(recordingId).operations.map(op => `${op.status}:${op.detail.kind === 'shell' ? op.detail.outputPreview ?? '' : ''}`);
  expect(await status()).toEqual(expected);
  expect(expected).not.toEqual(before);
});
