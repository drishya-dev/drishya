import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readJsonl } from '@drishya/capture-core';
import { Store } from '@drishya/store';
import { Ingestor } from '../src/index.ts';
import { createAntigravityAdapter } from '../../adapter-antigravity/src/index.ts';

vi.mock('@drishya/capture-core', async importOriginal => {
  const actual = await importOriginal<typeof import('@drishya/capture-core')>();
  return { ...actual, readJsonl: vi.fn(actual.readJsonl) };
});
let root: string, journal: string, store: Store, ingest: Ingestor;
const line = (step_index: number, content = 'Synthetic assistant material') => JSON.stringify({ step_index, type: 'PLANNER_RESPONSE', source: 'MODEL', status: 'DONE', content, tool_calls: [] }) + '\n';
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'drishya-ag-checkpoint-'));
  journal = join(root, 'brain', 'test', '.system_generated', 'logs', 'transcript.jsonl'); mkdirSync(join(journal, '..'), { recursive: true });
  store = new Store(join(root, 'store')); ingest = new Ingestor(store, [createAntigravityAdapter([root])]);
});
afterEach(async () => {
  await ingest.close(); store.close();
  if (!resolve(root).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe scratch cleanup');
  rmSync(root, { recursive: true, force: true }); vi.clearAllMocks();
});

it('restores inspection before cold discovery and sync, without reading the consumed prefix again', async () => {
  writeFileSync(journal, Array.from({ length: 100 }, (_, i) => line(i)).join(''));
  const full = join(journal, '..', 'transcript_full.jsonl'); writeFileSync(full, Array.from({ length: 110 }, (_, i) => line(i)).join(''));
  const result = await ingest.importSource('antigravity', journal);
  const saved = store.getSources(result.recordingId)[0]!.cursor;
  expect(saved.adapterCheckpoint).toBeDefined(); expect(saved.offset).toBe(readFileSync(full).length);
  await ingest.close(); ingest = new Ingestor(store, [createAntigravityAdapter([root])]); vi.mocked(readJsonl).mockClear();
  await ingest.discover('antigravity'); expect((await ingest.sync(result.recordingId)).added).toBe(0);
  expect(vi.mocked(readJsonl).mock.calls.length).toBeGreaterThan(0);
  expect(vi.mocked(readJsonl).mock.calls.every(([, cursor]) => cursor.offset > 0)).toBe(true);
  appendFileSync(full, line(110, 'New whole material'));
  vi.mocked(readJsonl).mockClear(); await ingest.sync(result.recordingId);
  expect(vi.mocked(readJsonl).mock.calls.every(([, cursor]) => cursor.offset >= saved.offset)).toBe(true);
  expect(ingest.projection(result.recordingId).prose.at(-1)?.text).toBe('New whole material');
});

it('passes the persisted inspection state through privacy before SQLite', async () => {
  const canary = 'ghp_' + '1'.repeat(36);
  writeFileSync(journal, JSON.stringify({ step_index: 0, type: 'USER_INPUT', source: 'USER_EXPLICIT', content: canary }) + '\n');
  const result = await ingest.importSource('antigravity', journal);
  expect(JSON.stringify(store.getSources(result.recordingId)[0]!.cursor.adapterCheckpoint)).not.toContain(canary);
  expect(JSON.stringify(store.getSources(result.recordingId)[0]!.cursor.adapterCheckpoint)).toContain('REDACTED');
});

it('preserves stored transcript identity and checkpoints through a configured root alias', async () => {
  const native = join(root, 'native');
  const transcript = join(native, 'brain', 'test', '.system_generated', 'logs', 'transcript.jsonl');
  mkdirSync(join(transcript, '..'), { recursive: true });
  writeFileSync(transcript, line(0));
  const alias = join(root, 'alias');
  symlinkSync(native, alias, process.platform === 'win32' ? 'junction' : 'dir');
  const canonical = realpathSync(transcript);
  const adapter = createAntigravityAdapter([alias]);
  await ingest.close();
  ingest = new Ingestor(store, [adapter]);
  const result = await ingest.importSource('antigravity', canonical);
  expect(adapter.identity(canonical)).toBe('test');
  expect(store.getSources(result.recordingId)[0]!.cursor.adapterCheckpoint).toMatchObject({
    conversation: 'test', files: [{ name: 'transcript.jsonl' }],
  });
});

it('does not trust a malformed checkpoint or one from another conversation', async () => {
  writeFileSync(journal, line(0)); const adapter = createAntigravityAdapter([root]);
  adapter.restoreCheckpoint!(journal, { version: 1, conversation: 'other', files: [{ name: '../private', result: { lastStep: 999 } }] });
  adapter.restoreCheckpoint!(journal, { version: 1, conversation: 'test', files: [{ name: 'transcript.jsonl', size: -1, cursor: { offset: Infinity } }] });
  vi.mocked(readJsonl).mockClear(); await adapter.readPath(journal);
  expect(vi.mocked(readJsonl).mock.calls.some(([, cursor]) => cursor.offset === 0)).toBe(true);
});

it('invalidates restored inspection state when the native file is replaced', async () => {
  writeFileSync(journal, Array.from({ length: 100 }, (_, i) => line(i)).join(''));
  const result = await ingest.importSource('antigravity', journal);
  await ingest.close(); ingest = new Ingestor(store, [createAntigravityAdapter([root])]);
  writeFileSync(journal, line(0, 'Replaced source'));
  await ingest.sync(result.recordingId);
  expect(ingest.projection(result.recordingId).prose.some(p => p.text === 'Replaced source')).toBe(true);
});
