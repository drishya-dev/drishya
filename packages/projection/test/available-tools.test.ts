import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { Store } from '../../store/src/index.ts';
import { Ingestor } from '../../ingest/src/index.ts';
import { asOfProjection } from '@drishya/contracts';

// TOOLS-1: the tools a harness lists as available, kept as names, in the order they were first listed.
let dir: string, store: Store, ingest: Ingestor;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'drishya-tools-')); store = new Store(join(dir, 'store')); ingest = new Ingestor(store); });
afterEach(async () => { await ingest.close(); store.close(); if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); });

const write = (name: string, rows: unknown[]) => { const path = join(dir, name); writeFileSync(path, rows.map(row => JSON.stringify(row)).join('\n') + '\n'); return path; };

it('keeps the available tool names of a Claude Code session, withdraws what the harness withdraws, and never reads the prompt in the same row', async () => {
  const base = { sessionId: 's', cwd: dir };
  const path = write('claude.jsonl', [
    { ...base, type: 'user', uuid: 'u1', timestamp: '2026-10-30T10:00:00Z', message: { role: 'user', content: 'Hello' } },
    { ...base, type: 'attachment', uuid: 'a1', timestamp: '2026-10-30T10:00:01Z', attachment: { type: 'prompt_snapshot', systemPrompt: 'CONFIDENTIAL SYSTEM PROMPT', tools: [{ name: 'Read', description: 'secret words' }, { name: 'Bash' }, { name: 'mcp__github__search_code' }, { name: 'not a name!' }] } },
    { ...base, type: 'assistant', uuid: 'a2', timestamp: '2026-10-30T10:00:02Z', message: { id: 'm1', role: 'assistant', content: [{ type: 'text', text: 'Hi' }] } },
    { ...base, type: 'attachment', uuid: 'a3', timestamp: '2026-10-30T10:00:03Z', attachment: { type: 'deferred_tools_delta', addedNames: ['mcp__playwright__browser_click'], removedNames: ['Bash'], readdedNames: [] } },
    { ...base, type: 'attachment', uuid: 'a4', timestamp: '2026-10-30T10:00:04Z', attachment: { type: 'prompt_snapshot', systemPrompt: 'x', tools: [] } },
  ]);
  const { recordingId } = await ingest.importSource('claude-code', path);
  const projection = ingest.projection(recordingId);
  expect(projection.availableTools?.map(t => [t.name, t.server, t.until !== undefined])).toEqual([
    ['Read', undefined, false], ['Bash', undefined, true], ['mcp__github__search_code', 'github', false], ['mcp__playwright__browser_click', 'playwright', false],
  ]);
  const serialised = JSON.stringify(store.observations(recordingId));
  expect(serialised).not.toContain('CONFIDENTIAL SYSTEM PROMPT');
  expect(serialised).not.toContain('secret words');
  // At the first step only what had been listed by then is known; a later addition is not.
  const early = asOfProjection(projection, 1);
  expect(early.availableTools?.map(t => t.name)).toEqual(['Read', 'Bash', 'mcp__github__search_code']);
  expect(early.availableTools?.every(t => t.until === undefined)).toBe(true);
  expect(asOfProjection(projection, 0).availableTools).toEqual([]);
});

it('keeps the tool groups a Codex session lists, with their group, and records nothing when no list was recorded', async () => {
  const base = { timestamp: '2026-10-30T10:00:00Z' };
  const path = write('codex.jsonl', [
    { ...base, type: 'session_meta', payload: { id: 'codex-tools', cwd: dir } },
    { ...base, type: 'response_item', payload: { type: 'additional_tools', id: 'x', role: 'developer', tools: [{ type: 'namespace', name: 'functions', description: 'd', tools: [{ name: 'exec_command' }, { name: 'apply_patch' }] }, { type: 'namespace', name: 'mcp__cua_repl', tools: [{ name: 'js' }] }] } },
    { ...base, type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'hi' }] } },
  ]);
  const { recordingId } = await ingest.importSource('codex', path);
  const tools = ingest.projection(recordingId).availableTools;
  expect(tools?.map(t => [t.namespace, t.name, t.server])).toEqual([['functions', 'exec_command', undefined], ['functions', 'apply_patch', undefined], ['mcp__cua_repl', 'js', 'cua_repl']]);

  const none = write('codex-none.jsonl', [{ ...base, type: 'session_meta', payload: { id: 'codex-none', cwd: dir } }, { ...base, type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'hi' }] } }]);
  const second = await ingest.importSource('codex', none);
  expect(ingest.projection(second.recordingId).availableTools).toBeUndefined();
});
