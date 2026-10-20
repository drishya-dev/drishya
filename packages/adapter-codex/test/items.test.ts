import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { seal } from '@drishya/capture-core';
import type { Observation } from '@drishya/contracts';
import { createParser, descriptor } from '../src/index.ts';

const ctx = { recordingId: 'r', sourceId: 's', sourcePath: 'synthetic' };
const fixture = (name: string) => readFileSync(new URL(`../../../fixtures/synthetic/codex-items/${name}.jsonl`, import.meta.url), 'utf8').trim().split('\n').map(line => JSON.parse(line));
const capture = (record: unknown, parser = createParser(ctx)) => parser.parse(record).map(raw => seal({ raw, ...ctx, adapter: descriptor, generation: 0, byteOffset: 0, observedAt: '2026-10-20T10:00:00Z' }));
it('maps every supported typed shape, using IDs first and only a unique open exec as fallback', () => {
  for (const name of ['one-command', 'three-commands', 'file-change', 'mcp-call', 'image-view', 'web-search', 'image-generation', 'subagent', 'standalone', 'ambiguous']) {
    const parser = createParser(ctx), observations = fixture(name).flatMap(row => capture(row, parser));
    const items = observations.filter(o => o.kind === 'item.completed');
    expect(items.length).toBeGreaterThan(0);
    if (name === 'mcp-call') expect(items[0]!.correlation).toEqual({ operationId: 'mcp-id', basis: 'source-id' });
    if (name === 'one-command') expect(items[0]).toMatchObject({ correlation: { operationId: 'one', basis: 'enclosing-call' }, payload: { command: 'pnpm test', exitCode: 0, durationMs: 1250 } });
    if (name === 'standalone' || name === 'ambiguous') expect(items.every(item => !item.correlation)).toBe(true);
  }
});
it('primes closed windows honestly after restart and keeps old metadata payloads unchanged', () => {
  const rows = fixture('one-command'), original = createParser(ctx);
  const previous = [rows[0], rows[1], rows[3]].flatMap(row => capture(row, original)).map((o, index) => ({ ...o, receivedSequence: index })) as Observation[];
  const restarted = createParser(ctx); restarted.prime(previous);
  expect(capture(rows[2], restarted)[0]!.correlation).toBeUndefined();
  const [old, added] = capture({ type: 'session_meta', payload: { cwd: '/w', cli_version: 'synthetic', agent_nickname: 'Builder', agent_path: '/root', forked_from_id: 'source-thread' } });
  expect(old!.source.part).toBe(0); expect(old!.payload).not.toHaveProperty('agentNickname');
  expect(added!.source.part).toBe(1); expect(added!.payload).toMatchObject({ agentNickname: 'Builder', agentPath: '/root', forkedFromId: 'source-thread' });
});
it('redacts new content surfaces and omits protected-file contents before storage', () => {
  const token = `gh${'p_'}${'A'.repeat(36)}`;
  const row = (item: unknown) => ({ type: 'event_msg', payload: { type: 'item_completed', item } });
  const file = capture(row({ type: 'FileChange', id: 'protected', status: 'completed', changes: { '.env.local': { type: 'add', content: 'PRIVATE BYTES MUST DISAPPEAR' }, 'src/a.ts': { type: 'add', content: `const token = '${token}'` } }, stdout: 'PRIVATE OUTPUT MUST DISAPPEAR' }))[0]!;
  expect((file.payload as any).changes[0]).not.toHaveProperty('content');
  expect(JSON.stringify(file)).not.toContain('PRIVATE'); expect(JSON.stringify(file)).not.toContain(token);
  const mcp = capture(row({ type: 'McpToolCall', id: 'mcp', server: 'docs', tool: 'search', pluginId: 'ACCOUNT MUST NOT PERSIST', result: { content: [{ type: 'text', text: token }] } }))[0]!;
  expect(JSON.stringify(mcp)).not.toContain(token); expect(JSON.stringify(mcp)).not.toContain('ACCOUNT');
  const unknown = capture(row({ type: 'FutureShape', id: 'future', text: 'PRIVATE FUTURE CONTENT' }))[0]!;
  expect(unknown.availability).toBe('metadata-only'); expect(JSON.stringify(unknown)).not.toContain('PRIVATE');
});
