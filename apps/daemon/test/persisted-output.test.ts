import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { App } from '../src/app.ts';
import { readPersistedOutput } from '../src/persisted-output.ts';

let dir: string, app: App;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'drishya-spill-')); app = new App(join(dir, 'data')); });
afterEach(async () => { await app.close(); if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); });

// DATA-4 (review125 S5): Claude extras captured as recorded, and spilled output read only on request.
it('records how commands and fetches ran, and reads saved output only from the harness folder, redacted', async () => {
  const project = join(dir, 'projects', 'C--work'), session = 'spill-session', results = join(project, session, 'tool-results');
  mkdirSync(results, { recursive: true }); mkdirSync(join(dir, 'elsewhere', 'tool-results'), { recursive: true });
  const secret = 'AKIA' + 'ABCDEFGHIJKLMNOP';
  writeFileSync(join(results, 'big.txt'), `line 1\nkey ${secret}\nline 3\n`);
  writeFileSync(join(dir, 'elsewhere', 'tool-results', 'x.txt'), 'not the harness folder');
  writeFileSync(join(results, 'env.txt'), 'SECRET=1');
  mkdirSync(join(results, 'retained-directory'));
  const t = '2026-10-21T00:00:00Z', base = { timestamp: t, cwd: dir, sessionId: session };
  const call = (id: string, name: string, input: unknown) => ({ ...base, type: 'assistant', uuid: `a-${id}`, message: { id: `m-${id}`, role: 'assistant', content: [{ type: 'tool_use', id, name, input }] } });
  const result = (id: string, toolUseResult: unknown, text = 'output') => ({ ...base, type: 'user', uuid: `r-${id}`, toolUseResult, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: text }] } });
  const shell = (extra: object) => ({ stdout: 'head of output', stderr: '', interrupted: false, isImage: false, noOutputExpected: false, ...extra });
  const rows = [
    { ...base, type: 'user', uuid: 'p1', permissionMode: 'acceptEdits', message: { role: 'user', content: 'Run the build' } },
    call('b1', 'Bash', { command: 'pnpm build' }), result('b1', shell({ persistedOutputPath: join(results, 'big.txt'), persistedOutputSize: 40 })),
    call('b2', 'Bash', { command: 'echo hi' }), result('b2', shell({ persistedOutputPath: join(dir, 'elsewhere', 'tool-results', 'x.txt') })),
    call('b3', 'Bash', { command: 'pnpm lint' }), result('b3', shell({ persistedOutputPath: join(results, 'gone.txt'), persistedOutputSize: 99 })),
    call('b4', 'Bash', { command: 'cat .env' }), result('b4', shell({ persistedOutputPath: join(results, 'env.txt') })),
    call('b5', 'Bash', { command: 'grep -r nothing .' }), result('b5', shell({ stdout: '', returnCodeInterpretation: 'No matches found', interrupted: true })),
    call('b6', 'Bash', { command: 'pnpm dev' }), result('b6', shell({ backgroundTaskId: 'task9', timedOutAfterMs: 600000 })),
    call('b7', 'Bash', { command: 'pnpm lint' }), result('b7', shell({ persistedOutputPath: join(results, 'retained-directory') })),
    call('w1', 'WebFetch', { url: 'https://example.com/docs', prompt: 'read' }), result('w1', { url: 'https://example.com/docs', code: 200, codeText: 'OK', bytes: 52465, durationMs: 1840, result: 'Docs text' }),
    { ...base, type: 'user', uuid: 'p2', permissionMode: 'acceptEdits', message: { role: 'user', content: 'Again' } },
    { ...base, type: 'user', uuid: 'p3', permissionMode: 'auto', message: { role: 'user', content: 'Now on auto' } },
  ];
  const journal = join(project, `${session}.jsonl`);
  writeFileSync(journal, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  const { recordingId } = await app.ingest.importSource('claude-code', journal);
  const p = app.projection(recordingId), op = (id: string) => p.operations.find((o) => o.id === `${recordingId}.${id}`)!;

  expect(op('b1')).toMatchObject({ detail: { kind: 'shell' } });
  expect(op('b1').run).toMatchObject({ persistedOutput: { path: join(results, 'big.txt'), bytes: 40 } });
  expect(op('b5')).toMatchObject({ detail: { kind: 'search' } });
  expect(op('b5').run).toEqual({ interrupted: true, exitNote: 'No matches found' });
  expect(op('b6').run).toEqual({ backgroundTaskId: 'task9', timedOutAfterMs: 600000 });
  expect(op('b2').run).not.toHaveProperty('interrupted');
  expect(op('w1').detail).toMatchObject({ kind: 'web', fetch: { status: 200, statusText: 'OK', bytes: 52465, durationMs: 1840 } });
  expect(p.timeline.filter((i) => i.type === 'turn').map((i) => i.type === 'turn' && i.permissionMode)).toEqual(['acceptEdits', 'acceptEdits', 'auto']);

  const full = await readPersistedOutput(app.store, recordingId, `${recordingId}.b1`);
  expect(full).toMatchObject({ available: true, bytes: 19 + secret.length, truncated: false, redacted: true });
  expect(full.available && full.text).not.toContain(secret);
  expect(await readPersistedOutput(app.store, recordingId, `${recordingId}.b2`)).toEqual({ available: false, reason: 'outside-harness-folder' });
  expect(await readPersistedOutput(app.store, recordingId, `${recordingId}.b3`)).toEqual({ available: false, reason: 'removed' });
  expect(await readPersistedOutput(app.store, recordingId, `${recordingId}.b4`)).toEqual({ available: false, reason: 'protected' });
  expect(await readPersistedOutput(app.store, recordingId, `${recordingId}.b5`)).toEqual({ available: false, reason: 'not-recorded' });
  expect(await readPersistedOutput(app.store, recordingId, `${recordingId}.b7`)).toEqual({ available: false, reason: 'removed' });
});
