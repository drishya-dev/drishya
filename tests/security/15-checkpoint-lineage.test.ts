// SEC-4b: a checkpoint is read only from the recording's verified sessions. Under one recording's workspace
// approval, a session id the journal (or the request) names must never reach another session's backups.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeRepo } from './lib/seed.ts';
import { startScratch, type Scratch } from './lib/scratch.ts';

const CANARY = 'UNRELATED-SESSION-CANARY-91d2';
const T = '2026-10-21T00:00:00Z';
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let s: Scratch, repo: string, claude: string;

function backup(session: string, name: string, text: string) {
  mkdirSync(join(claude, 'file-history', session), { recursive: true });
  writeFileSync(join(claude, 'file-history', session, name), text);
}
async function recording(file: string, rowSession: string, name: string, first: number, extra: object[] = []) {
  const base = { timestamp: T, cwd: repo, sessionId: rowSession };
  const rows = [
    ...extra,
    { ...base, type: 'user', uuid: uuid(first), message: { role: 'user', content: `synthetic prompt ${file}` } },
    { type: 'file-history-snapshot', messageId: uuid(first), isSnapshotUpdate: false, snapshot: { messageId: uuid(first), timestamp: T, trackedFileBackups: {
      'src/a.ts': { backupFileName: name, version: 1, backupTime: T, realParentDir: join(repo, 'src') } } } },
  ];
  mkdirSync(join(claude, 'projects', 'C--work'), { recursive: true });
  const path = join(claude, 'projects', 'C--work', `${file}.jsonl`);
  writeFileSync(path, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  return { path, id: (await s.run.app.ingest.importSource('claude-code', path, { lineageSources: [path] })).recordingId };
}
const enc = encodeURIComponent;
const approve = (id: string) => s.call(`/v1/recordings/${enc(id)}/workspace/approve`, { method: 'POST', headers: { ...s.bearer, 'content-type': 'application/json' }, body: '{}' });
const checkpoint = (id: string, name: string) => s.call(`/v1/recordings/${enc(id)}/checkpoint/${enc(name)}`, { headers: s.bearer });

beforeAll(async () => {
  s = await startScratch();
  repo = makeRepo(join(s.dir, 'repo'));
  claude = process.env.DRISHYA_CLAUDE_HOME!;
});
afterAll(async () => { await s.close(); });

describe('checkpoint reads stay inside the recording\'s verified lineage', () => {
  it('reads its own session, and denies an unrelated one however it is named', async () => {
    backup('own-session', 'aaaaaaaaaaaaaaaa@v1', 'own backup\n');
    backup('other-session', 'bbbbbbbbbbbbbbbb@v1', CANARY + '\n');
    await recording('other-session', 'other-session', 'bbbbbbbbbbbbbbbb@v1', 50);
    const own = await recording('own-session', 'own-session', 'aaaaaaaaaaaaaaaa@v1', 1);
    // The journal claims the unrelated session; a forged id and a traversing id are claims too.
    const claimed = await recording('claims-other', 'other-session', 'bbbbbbbbbbbbbbbb@v1', 70);
    const forged = await recording('claims-forged', '../other-session', 'bbbbbbbbbbbbbbbb@v1', 80);
    for (const r of [own, claimed, forged]) expect((await approve(r.id)).status, r.path).toBe(200);

    const ok = await checkpoint(own.id, 'aaaaaaaaaaaaaaaa@v1');
    expect(ok.json).toMatchObject({ available: true, text: 'own backup\n' });
    const unavailable = { available: false, reason: 'removed' };
    for (const r of [claimed, forged]) {
      const reply = await checkpoint(r.id, 'bbbbbbbbbbbbbbbb@v1');
      expect(reply.json, r.path).toEqual(unavailable);
      expect(reply.text).not.toContain(CANARY);
    }
    // A request naming the other session's backup, or a path, under the first recording's approval.
    for (const name of ['bbbbbbbbbbbbbbbb@v1', '../other-session/bbbbbbbbbbbbbbbb@v1', '..%2Fother-session%2Fbbbbbbbbbbbbbbbb@v1']) {
      const reply = await s.call(`/v1/recordings/${enc(own.id)}/checkpoint/${name.startsWith('..%') ? name : enc(name)}`, { headers: s.bearer });
      expect(reply.text, name).not.toContain(CANARY);
      expect(reply.json?.available ?? false, name).toBe(false);
    }
  });
});
