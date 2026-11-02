import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { Store } from '../../store/src/index.ts';
import { Ingestor } from '../../ingest/src/index.ts';
import { sinceSnapshot } from '../../scene/src/since.ts';

let dir: string, store: Store, ingest: Ingestor;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'drishya-failure-')); store = new Store(join(dir, 'store')); ingest = new Ingestor(store); });
afterEach(async () => { await ingest.close(); store.close(); if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); });

const project = async (adapter: string, rows: unknown[]) => {
  const journal = join(dir, `${adapter}.jsonl`);
  writeFileSync(journal, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
  return ingest.projection((await ingest.importSource(adapter, journal)).recordingId);
};

it('keeps a Claude Code action\'s own first error line, not the harness wrapper and not a bare exit code', async () => {
  const base = { sessionId: 'failure', timestamp: '2026-10-21T00:00:00Z', cwd: dir };
  const call = (n: number, name: string, input: object) => ({ ...base, type: 'assistant', uuid: `a${n}`, message: { id: `m${n}`, role: 'assistant', content: [{ type: 'tool_use', id: `t${n}`, name, input }] } });
  const result = (n: number, content: string, isError: boolean) => ({ ...base, type: 'user', uuid: `r${n}`, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: `t${n}`, content, is_error: isError }] } });
  const projection = await project('claude-code', [
    { ...base, type: 'user', uuid: 'p1', message: { role: 'user', content: 'Start' } },
    call(1, 'Edit', { file_path: join(dir, 'a.ts'), old_string: 'a', new_string: 'b' }),
    result(1, '<tool_use_error>String to replace not found in file.</tool_use_error>', true),
    call(2, 'Bash', { command: 'false' }), result(2, 'Exit code 1', true),
    call(3, 'Bash', { command: 'npm test' }), result(3, 'Exit code 1\n> vitest\n\nsome context\nError: boom\nmore', true),
    call(4, 'Read', { file_path: join(dir, 'b.ts') }), result(4, 'File does not exist.', true),
    call(5, 'Bash', { command: 'true' }), result(5, 'all good', false),
    call(7, 'Bash', { command: 'python a.py' }), result(7, 'Exit code 1\nTraceback (most recent call last):\n  File "a.py", line 1\nValueError: bad value', true),
    call(8, 'Bash', { command: 'git log -1' }), result(8, 'Exit code 128\nabc123 a commit subject', true),
    call(6, 'Bash', { command: 'rm x' }), result(6, "The user doesn't want to proceed with this tool use. The tool use was rejected (eg. if it was a file edit, the new_string was NOT written to the file). STOP what you are doing and wait for the user to tell you how to proceed.", true),
  ]);
  expect(projection.operations.map(op => op.failure)).toEqual(['String to replace not found in file.', undefined, 'Error: boom', 'File does not exist.', undefined, 'ValueError: bad value', undefined, undefined]);
});

it('keeps a Codex command\'s failing line and puts it on the failure row beside the exit code', async () => {
  const timestamp = '2026-10-21T00:00:00Z';
  const projection = await project('codex', [
    { timestamp, type: 'session_meta', payload: { id: 'failure', cwd: dir } },
    { timestamp, type: 'event_msg', payload: { type: 'user_message', message: 'Start' } },
    { timestamp, type: 'response_item', payload: { type: 'function_call', call_id: 'c1', name: 'exec_command', arguments: JSON.stringify({ cmd: 'pnpm test' }) } },
    { timestamp, type: 'response_item', payload: { type: 'function_call_output', call_id: 'c1', output: 'Exit code: 1\nWall time: 1 seconds\nOutput:\nrunning\nFAIL src/a.test.ts\nnext' } },
  ]);
  const [op] = projection.operations;
  expect(op).toMatchObject({ status: 'error', failure: 'FAIL src/a.test.ts' });
  expect(sinceSnapshot(projection, -1).failures[0]?.detail).toBe('exit 1 · FAIL src/a.test.ts');
});
