import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { App } from '../../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../../apps/daemon/src/server.ts';

let dir: string, app: App | undefined, server: RunningServer | undefined;
const marker = (id: string) => 'codex-turn-details-rescan-v1:' + id;
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
const journal = [
  { type: 'session_meta', payload: { id: 'synthetic-legacy', cwd: '/synthetic' } },
  { type: 'event_msg', payload: { type: 'task_started', turn_id: 'synthetic-turn', started_at: 1 } },
  { type: 'event_msg', payload: { type: 'task_complete', turn_id: 'synthetic-turn', duration_ms: 600 } },
].map(r => JSON.stringify(r)).join('\n') + '\n';
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'drishya-legacy-rescan-')); app = new App(join(dir, 'data')); });
afterEach(async () => {
  await server?.close(); server = undefined;
  await app?.close(); app = undefined; vi.restoreAllMocks();
  if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path');
  rmSync(dir, { recursive: true, force: true });
});
async function legacy(name = 'legacy', createdAt = '2026-10-20T00:00:00Z', strip = true) {
  const path = join(dir, name + '.jsonl'); writeFileSync(path, journal);
  const { recordingId: id } = await app!.ingest.importSource('codex', path);
  // Reproduce a pre-DATA-3 store: old observations/cursor remain, enrichment did not yet exist.
  if (strip) app!.store.db.prepare("DELETE FROM observations WHERE recording_id=? AND kind='turn.detail'").run(id);
  app!.store.db.prepare('UPDATE recordings SET created_at=?, observation_count=(SELECT COUNT(*) FROM observations WHERE recording_id=?), stats=NULL WHERE id=?').run(createdAt, id, id);
  return { id, path };
}
const marked = (id: string) => !!app!.store.db.prepare('SELECT 1 FROM meta WHERE key=?').get(marker(id));

it('enriches old consumed bytes once across server restarts without rewriting captured observations or native bytes', async () => {
  const { id, path } = await legacy();
  const old = app!.store.observations(id), digest = createHash('sha256').update(readFileSync(path)).digest('hex');
  server = await startServer({ app: app!, port: 0 });
  expect(await app!.ingest.rescanLegacyCodex()).toEqual({ attempted: 1, completed: 1, unavailable: 0, failed: 0 });
  expect(app!.store.getRecording(id)!.stats).toEqual({ source: 'codex-turns', durationMs: 600, lastOutcome: 'completed' });
  for (const o of old) expect(app!.store.observationById(id, o.id)).toEqual(o);
  expect(createHash('sha256').update(readFileSync(path)).digest('hex')).toBe(digest);
  expect(marked(id)).toBe(true);
  const count = app!.store.countObservations(id);
  await server.close(); server = undefined; await app!.close();
  app = new App(join(dir, 'data')); const spy = vi.spyOn(app.ingest, 'rescan');
  server = await startServer({ app, port: 0 }); await app.ingest.rescanLegacyCodex();
  expect(spy).not.toHaveBeenCalled(); expect(app.store.countObservations(id)).toBe(count);
});

it('skips Claude and newer Codex imports but still rescans an old recording with partial details', async () => {
  const old = await legacy('partial', '2026-10-20T00:00:00Z', false);
  app!.store.db.prepare("DELETE FROM observations WHERE recording_id=? AND kind='turn.detail' AND json_extract(body,'$.payload.outcome') IS NOT NULL").run(old.id);
  await legacy('new', '2026-10-28T00:00:00Z');
  app!.store.upsertRecording({ id: 'old-claude', adapterId: 'claude-code', harness: 'claude-code', sourcePath: join(dir, 'not-read') });
  app!.store.db.prepare("UPDATE recordings SET created_at='2026-10-20T00:00:00Z' WHERE id='old-claude'").run();
  const spy = vi.spyOn(app!.ingest, 'rescan');
  expect((await app!.ingest.rescanLegacyCodex()).completed).toBe(1);
  expect(spy.mock.calls.map(call => call[0])).toEqual([old.id]);
  expect(app!.store.getRecording(old.id)!.stats?.durationMs).toBe(600);
});

it('keeps missing journals nonfatal and retryable on a later startup, preserving captured history', async () => {
  const { id, path } = await legacy(); const old = app!.store.observations(id); rmSync(path);
  server = await startServer({ app: app!, port: 0 });
  expect(await app!.ingest.rescanLegacyCodex()).toEqual({ attempted: 1, completed: 0, unavailable: 1, failed: 0 });
  expect(marked(id)).toBe(false); expect(app!.store.observations(id)).toEqual(old);
  expect(app!.ingest.health(id).state).toBe('missing-source');
  expect(app!.store.getRecording(id)!.stats).toBeUndefined();
  await server.close(); server = undefined; await app!.close();
  writeFileSync(path, journal); app = new App(join(dir, 'data'));
  server = await startServer({ app, port: 0 });
  expect((await app.ingest.rescanLegacyCodex()).completed).toBe(1); expect(marked(id)).toBe(true);
});

it('starts serving before enrichment finishes, and close awaits its owned background task', async () => {
  await legacy(); const real = app!.ingest.rescan.bind(app!.ingest); let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  vi.spyOn(app!.ingest, 'rescan').mockImplementation(async id => { await gate; return real(id); });
  server = await startServer({ app: app!, port: 0 });
  const response = await fetch(server.url + '/v1/recordings', { headers: { authorization: 'Bearer ' + server.token } });
  expect(response.status).toBe(200); await response.arrayBuffer();
  await server.close(); server = undefined;
  let closed = false; const closing = app!.close().then(() => { closed = true; });
  await tick(); expect(closed).toBe(false); release(); await closing; app = undefined;
  expect(closed).toBe(true);
});

it('does not mark completion if a journal disappears after its initial availability check', async () => {
  const { id, path } = await legacy(), old = app!.store.observations(id);
  const rewind = app!.store.rewindSource.bind(app!.store);
  vi.spyOn(app!.store, 'rewindSource').mockImplementation(source => { rewind(source); rmSync(path); });
  expect(await app!.ingest.rescanLegacyCodex()).toEqual({ attempted: 1, completed: 0, unavailable: 1, failed: 0 });
  expect(marked(id)).toBe(false); expect(app!.store.observations(id)).toEqual(old);
  expect(app!.ingest.health(id).state).toBe('missing-source');
});

it('continues a bounded pass with sync rather than rewinding again', async () => {
  const { id } = await legacy(); const real = app!.ingest.rescan.bind(app!.ingest);
  const rescan = vi.spyOn(app!.ingest, 'rescan').mockImplementation(async value => ({ ...await real(value), more: true }));
  const sync = vi.spyOn(app!.ingest, 'sync');
  expect((await app!.ingest.rescanLegacyCodex()).completed).toBe(1);
  expect(rescan).toHaveBeenCalledTimes(1); expect(sync).toHaveBeenCalledTimes(1);
  expect(marked(id)).toBe(true);
});

it('processes candidates serially, does not mark failed reads, and handles removal before a queued candidate', async () => {
  const first = await legacy('first'), second = await legacy('second');
  const ordered = app!.store.listRecordings().filter(r => r.harness === 'codex');
  const real = app!.ingest.rescan.bind(app!.ingest); let active = 0, peak = 0, calls = 0;
  vi.spyOn(app!.ingest, 'rescan').mockImplementation(async id => {
    active++; peak = Math.max(peak, active); calls++;
    try {
      await tick();
      if (id === ordered[0]!.id) { app!.store.deleteRecording(ordered[1]!.id); throw Object.assign(new Error('synthetic denied read'), { code: 'EACCES' }); }
      return await real(id);
    } finally { active--; }
  });
  expect(await app!.ingest.rescanLegacyCodex()).toEqual({ attempted: 1, completed: 0, unavailable: 0, failed: 1 });
  expect(peak).toBe(1); expect(calls).toBe(1);
  expect(marked(first.id)).toBe(false); expect(marked(second.id)).toBe(false);
  expect(app!.ingest.health(ordered[0]!.id).error?.code).toBe('permission-denied');
});
