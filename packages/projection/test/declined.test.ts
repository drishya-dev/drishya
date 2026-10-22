import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { operationFailed } from '@drishya/contracts';
import { Store } from '../../store/src/index.ts';
import { Ingestor } from '../../ingest/src/index.ts';
import { turnLedgers } from '../../scene/src/turns.ts';
import { declinedFrom } from '../src/declined.ts';

// The two wordings below are copied from real Claude Code journals.
const PERSON = "The user doesn't want to proceed with this tool use. The tool use was rejected (eg. if it was a file edit, the new_string was NOT written to the file). STOP what you are doing and wait for the user to tell you how to proceed.\n\nNote: The user's next message may contain a correction or preference.";
const AUTO = "Permission for this action was denied by the Claude Code auto mode classifier. Reason: [PII Data Handling]. If you have other tasks that don't depend on this action, continue working on those.";

describe('declinedFrom', () => {
  it('reads who stopped the action and the harness reason, and nothing else', () => {
    expect(declinedFrom(PERSON)).toEqual({ by: 'person' });
    expect(declinedFrom(AUTO)).toEqual({ by: 'auto-mode', reason: 'PII Data Handling' });
    expect(declinedFrom('Permission for this action was denied by the Claude Code auto mode classifier.')).toEqual({ by: 'auto-mode' });
    expect(declinedFrom('Exit code 1\nPermission denied')).toBeUndefined();
    expect(declinedFrom(`Output mentions: ${PERSON}`)).toBeUndefined();
    expect(declinedFrom(undefined)).toBeUndefined();
  });
});

let dir: string, store: Store, ingest: Ingestor;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'drishya-declined-')); store = new Store(join(dir, 'store')); ingest = new Ingestor(store); });
afterEach(async () => { await ingest.close(); store.close(); if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); });

it('marks declined actions apart from failed ones and keeps them out of the failure counts', async () => {
  const t = '2026-10-22T00:00:00Z', session = 'declined', base = { timestamp: t, cwd: dir, sessionId: session };
  const call = (n: number, name: string, input: object) => ({ ...base, type: 'assistant', uuid: `a${n}`, message: { id: `m${n}`, role: 'assistant', content: [{ type: 'tool_use', id: `t${n}`, name, input }] } });
  const result = (n: number, content: string, isError: boolean) => ({ ...base, type: 'user', uuid: `r${n}`, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: `t${n}`, content, is_error: isError }] } });
  const rows = [
    { ...base, type: 'user', uuid: 'p1', message: { role: 'user', content: 'Clean up' } },
    call(1, 'Bash', { command: 'rm -rf build' }), result(1, PERSON, true),
    call(2, 'Edit', { file_path: join(dir, 'src', 'a.ts'), old_string: 'a', new_string: 'b' }), result(2, AUTO, true),
    call(3, 'Bash', { command: 'false' }), result(3, 'Exit code 1', true),
  ];
  const source = join(dir, `${session}.jsonl`);
  writeFileSync(source, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  const p = ingest.projection((await ingest.importSource('claude-code', source)).recordingId);
  const ops = p.operations;
  expect(ops.map((o) => [o.tool, o.status, o.declined])).toEqual([
    ['Bash', 'error', { by: 'person' }],
    ['Edit', 'error', { by: 'auto-mode', reason: 'PII Data Handling' }],
    ['Bash', 'error', undefined],
  ]);
  expect(ops.map(operationFailed)).toEqual([false, false, true]);
  const [ledger] = turnLedgers(p);
  expect(ledger).toMatchObject({ failed: 1, declined: 2, operations: 3 });
  expect(ledger!.edits.files).toBe(0);
});
