import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { App } from '../src/app.ts';
import { readCheckpointFile } from '../src/checkpoint-file.ts';

let dir: string, app: App;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'drishya-checkpoint-')); app = new App(join(dir, 'data')); });
afterEach(async () => { await app.close(); if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); });

// DATA-5 (review125 S5): checkpoint references per turn; backups read only on request, with approval.
it('links each edit to its turn checkpoint and reads the backup only with approval, redacted', async () => {
  const session = 'cp-session', work = join(dir, 'work'), project = join(dir, 'projects', 'C--work'), history = join(dir, 'file-history', session);
  mkdirSync(join(work, 'src'), { recursive: true }); mkdirSync(project, { recursive: true }); mkdirSync(history, { recursive: true });
  const secret = 'AKIA' + 'ABCDEFGHIJKLMNOP';
  writeFileSync(join(history, 'aaaaaaaaaaaaaaaa@v2'), `export const key = '${secret}';\nexport const total = 1;\n`);
  writeFileSync(join(history, 'cccccccccccccccc@v1'), 'SECRET=1\n');
  const t = '2026-10-21T00:00:00Z', base = { timestamp: t, cwd: work, sessionId: session };
  const rows = [
    { type: 'file-history-snapshot', messageId: 'p1', isSnapshotUpdate: false, snapshot: { messageId: 'p1', timestamp: t, trackedFileBackups: {
      'src\\cart.ts': { backupFileName: 'aaaaaaaaaaaaaaaa@v2', version: 2, backupTime: t, realParentDir: join(work, 'src') },
      '.env': { backupFileName: 'cccccccccccccccc@v1', version: 1, backupTime: t, realParentDir: work },
    } } },
    { ...base, type: 'user', uuid: 'p1', message: { role: 'user', content: 'Fix the cart total' } },
    { ...base, type: 'assistant', uuid: 'a1', message: { id: 'm1', role: 'assistant', content: [
      { type: 'tool_use', id: 'e1', name: 'Edit', input: { file_path: join(work, 'src', 'cart.ts'), old_string: 'total = 1', new_string: 'total = 2' } },
      { type: 'tool_use', id: 'w1', name: 'Write', input: { file_path: join(work, 'src', 'new.ts'), content: 'export {};\n' } },
    ] } },
    { type: 'file-history-delta', messageId: 'd1', snapshotMessageId: 'p1', trackingPath: 'src\\new.ts', backup: { backupFileName: null, version: 1, backupTime: t, realParentDir: join(work, 'src') }, timestamp: t },
    { ...base, type: 'user', uuid: 'r1', toolUseResult: { filePath: join(work, 'src', 'cart.ts'), oldString: 'total = 1', newString: 'total = 2', originalFile: '', structuredPatch: [], userModified: false, replaceAll: false }, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'e1', content: 'ok' }] } },
    { ...base, type: 'user', uuid: 'r2', toolUseResult: { type: 'create', filePath: join(work, 'src', 'new.ts'), content: 'export {};\n', structuredPatch: [], originalFile: null }, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'w1', content: 'ok' }] } },
  ];
  const journal = join(project, `${session}.jsonl`);
  writeFileSync(journal, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  const { recordingId } = await app.ingest.importSource('claude-code', journal);
  const p = app.projection(recordingId), detail = (id: string) => p.operations.find((o) => o.id === `${recordingId}.${id}`)!.detail;

  expect(detail('e1')).toMatchObject({ kind: 'edit', path: 'src/cart.ts', beforeTurn: { backup: 'aaaaaaaaaaaaaaaa@v2', version: 2 } });
  expect(detail('w1')).toMatchObject({ kind: 'edit', path: 'src/new.ts', beforeTurn: { absent: true } });
  expect(app.store.observationsOfKind(recordingId, 'checkpoint')).toHaveLength(2);

  expect(await readCheckpointFile(app.store, recordingId, 'aaaaaaaaaaaaaaaa@v2', false)).toEqual({ available: false, reason: 'needs-workspace-approval' });
  const file = await readCheckpointFile(app.store, recordingId, 'aaaaaaaaaaaaaaaa@v2', true);
  expect(file).toMatchObject({ available: true, truncated: false, redacted: true });
  expect(file.available && file.text).toContain('export const total = 1;');
  expect(file.available && file.text).not.toContain(secret);
  // Ingest omits the backup name of a protected file (.env), so it can never be referenced.
  expect(JSON.stringify(app.store.observationsOfKind(recordingId, 'checkpoint'))).not.toContain('cccccccccccccccc');
  expect(await readCheckpointFile(app.store, recordingId, 'cccccccccccccccc@v1', true)).toEqual({ available: false, reason: 'not-recorded' });
  expect(await readCheckpointFile(app.store, recordingId, 'bbbbbbbbbbbbbbbb@v1', true)).toEqual({ available: false, reason: 'not-recorded' });
  expect(await readCheckpointFile(app.store, recordingId, '../../projects/C--work/cp-session.jsonl', true)).toEqual({ available: false, reason: 'not-recorded' });
  rmSync(join(history, 'aaaaaaaaaaaaaaaa@v2'));
  expect(await readCheckpointFile(app.store, recordingId, 'aaaaaaaaaaaaaaaa@v2', true)).toEqual({ available: false, reason: 'removed' });
});
