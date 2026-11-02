import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { Store } from '../../store/src/index.ts';
import { Ingestor } from '../../ingest/src/index.ts';

let dir: string, store: Store, ingest: Ingestor;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'drishya-logs-')); store = new Store(join(dir, 'store')); ingest = new Ingestor(store); });
afterEach(async () => { await ingest.close(); store.close(); if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); });

const gapsOf = async (adapter: string, rows: unknown[]) => {
  const journal = join(dir, `${adapter}.jsonl`);
  writeFileSync(journal, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
  return ingest.projection((await ingest.importSource(adapter, journal)).recordingId).gaps.map(gap => gap.detail);
};

it('does not call a repeated Codex notification a gap, and keeps one with no other record', async () => {
  const timestamp = '2026-10-21T00:00:00Z';
  const event = (type: string, id: string) => ({ timestamp, type: 'event_msg', payload: { type: 'item_completed', item: { type, id } } });
  const gaps = await gapsOf('codex', [
    { timestamp, type: 'session_meta', payload: { id: 'logs', cwd: dir } },
    event('Reasoning', 'a'), event('AgentMessage', 'b'), event('UserMessage', 'c'), event('ContextCompaction', 'd'), event('CollabAgentToolCall', 'e'),
    { timestamp, type: 'event_msg', payload: { type: 'item_completed', item: { type: 'Extension', id: 'f', kind: 'clock.sleep' } } },
  ]);
  expect(gaps).toEqual(['item_completed:Extension']);
});

it('does not call Claude Code request logs a gap, and keeps an unknown record', async () => {
  const base = { sessionId: 'logs', timestamp: '2026-10-21T00:00:00Z', cwd: dir };
  const gaps = await gapsOf('claude-code', [
    { ...base, type: 'user', uuid: 'u1', message: { role: 'user', content: 'Start' } },
    { ...base, type: 'api-request', id: 'r1' }, { ...base, type: 'api-request-blob', hash: 'h' }, { ...base, type: 'api-request-shape', shapeHash: 's' }, { ...base, type: 'tools-used', tools: [] },
    { ...base, type: 'a-future-record' },
  ]);
  expect(gaps).toEqual(['a-future-record']);
});
