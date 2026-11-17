import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/app.ts';
import { readCheckpointFile } from '../src/checkpoint-file.ts';

// A checkpoint is read only from sessions in the recording's verified lineage: its own session and
// the parents the capture linked by native references. A session id the journal names is a claim.
const T = '2026-10-21T00:00:00Z';
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const denied = { available: false, reason: 'removed' };

let dir: string, app: App, project: string, history: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-cp-lineage-'));
  app = new App(join(dir, 'data'));
  project = join(dir, 'projects', 'C--work'); history = join(dir, 'file-history');
  mkdirSync(project, { recursive: true });
});
afterEach(async () => { await app.close(); if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); });

function backup(session: string, name: string, text: string) {
  mkdirSync(join(history, session), { recursive: true });
  writeFileSync(join(history, session, name), text);
}
/** A journal named for `file`, whose rows claim `rowSession`, with one checkpoint of src/a.ts. */
function journal(file: string, rowSession: string, name: string, first = 1, extra: object[] = []) {
  const base = { timestamp: T, cwd: join(dir, 'work'), sessionId: rowSession };
  const rows = [
    ...extra,
    { ...base, type: 'user', uuid: uuid(first), message: { role: 'user', content: `prompt ${file}` } },
    { type: 'file-history-snapshot', messageId: uuid(first), isSnapshotUpdate: false, snapshot: { messageId: uuid(first), timestamp: T, trackedFileBackups: {
      'src/a.ts': { backupFileName: name, version: 1, backupTime: T, realParentDir: join(dir, 'work', 'src') } } } },
  ];
  const path = join(project, `${file}.jsonl`);
  writeFileSync(path, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  return path;
}
const read = (id: string, name: string) => readCheckpointFile(app.store, id, name, true);

describe('checkpoint session lineage', () => {
  it('reads the recording\'s own session', async () => {
    backup('a-session', 'aaaaaaaaaaaaaaaa@v1', 'own\n');
    const { recordingId } = await app.ingest.importSource('claude-code', journal('a-session', 'a-session', 'aaaaaaaaaaaaaaaa@v1'));
    expect(await read(recordingId, 'aaaaaaaaaaaaaaaa@v1')).toMatchObject({ available: true, text: 'own\n' });
  });

  it('does not read another session\'s backup that the journal names', async () => {
    backup('b-session', 'bbbbbbbbbbbbbbbb@v1', 'UNRELATED-B-CONTENT\n');
    const unrelated = journal('b-session', 'b-session', 'bbbbbbbbbbbbbbbb@v1', 50);
    await app.ingest.importSource('claude-code', unrelated);
    // A's rows claim B's session id.
    const { recordingId } = await app.ingest.importSource('claude-code', journal('a-session', 'b-session', 'bbbbbbbbbbbbbbbb@v1'));
    expect(await read(recordingId, 'bbbbbbbbbbbbbbbb@v1')).toEqual(denied);
  });

  it('answers a backup of an unrelated session like any unavailable file', async () => {
    backup('b-session', 'bbbbbbbbbbbbbbbb@v1', 'UNRELATED-B-CONTENT\n');
    const { recordingId } = await app.ingest.importSource('claude-code', journal('a-session', 'a-session', 'bbbbbbbbbbbbbbbb@v1'));
    const missing = await read(recordingId, 'bbbbbbbbbbbbbbbb@v1');
    rmSync(join(history, 'b-session'), { recursive: true });
    expect(missing).toEqual(denied);
    expect(await read(recordingId, 'bbbbbbbbbbbbbbbb@v1')).toEqual(missing);
  });

  it('ignores a forged or traversing session id', async () => {
    backup('b-session', 'bbbbbbbbbbbbbbbb@v1', 'UNRELATED-B-CONTENT\n');
    mkdirSync(join(dir, 'projects', 'x'), { recursive: true });
    for (const forged of ['../projects/C--work', '..', 'b-session/../b-session', 'B-SESSION']) {
      const { recordingId } = await app.ingest.importSource('claude-code', journal('a-session', forged, 'bbbbbbbbbbbbbbbb@v1'));
      expect(await read(recordingId, 'bbbbbbbbbbbbbbbb@v1'), forged).toEqual(denied);
    }
  });

  it('reads the earlier checkpoints of a verified resumed session', async () => {
    backup('p-session', 'dddddddddddddddd@v1', 'parent version\n');
    const parent = journal('p-session', 'p-session', 'dddddddddddddddd@v1', 1);
    // The child continues the parent through a native boundary that names the parent's last entry.
    const boundary = { type: 'system', subtype: 'compact_boundary', uuid: uuid(20), logicalParentUuid: uuid(1), timestamp: T, compactMetadata: { trigger: 'auto', preTokens: 20 } };
    const child = journal('c-session', 'p-session', 'dddddddddddddddd@v1', 21, [boundary]);
    const { recordingId } = await app.ingest.importSource('claude-code', child, { lineageSources: [parent, child] });
    expect(app.store.lineageView(recordingId)?.links[0]?.status).toBe('linked');
    expect(await read(recordingId, 'dddddddddddddddd@v1')).toMatchObject({ available: true, text: 'parent version\n' });
  });

  it('does not extend to a session the child only claims when no parent was verified', async () => {
    backup('p-session', 'dddddddddddddddd@v1', 'parent version\n');
    const child = journal('c-session', 'p-session', 'dddddddddddddddd@v1', 21);
    const { recordingId } = await app.ingest.importSource('claude-code', child, { lineageSources: [child] });
    expect(await read(recordingId, 'dddddddddddddddd@v1')).toEqual(denied);
  });
});
