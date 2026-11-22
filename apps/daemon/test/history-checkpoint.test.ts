import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { App } from '../src/app.ts';

// PERF-4 step 4: the whole fold of a large recording is remembered in the history index. After a daemon restart the next
// open resumes it and appends only what is new (no recent-first detour, no full fold), and gives exactly what a fresh
// rebuild gives. Every input the key or the stored state depends on stops it being used.
let dirs: string[] = [];
const apps: App[] = [];
const saved = { first: process.env.DRISHYA_TAIL_FIRST, prompts: process.env.DRISHYA_TAIL_PROMPTS, quiet: process.env.DRISHYA_CHECKPOINT_QUIET_MS };
beforeAll(() => { process.env.DRISHYA_TAIL_FIRST = '1'; process.env.DRISHYA_TAIL_PROMPTS = '2'; process.env.DRISHYA_CHECKPOINT_QUIET_MS = '50'; });
afterAll(() => {
  for (const [key, value] of [['DRISHYA_TAIL_FIRST', saved.first], ['DRISHYA_TAIL_PROMPTS', saved.prompts], ['DRISHYA_CHECKPOINT_QUIET_MS', saved.quiet]] as const) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
});
afterEach(async () => { for (const app of apps.splice(0)) await app.close(); for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

const nl = String.fromCharCode(10);
const base = { cwd: '/home/dev/shop', sessionId: 'c0ffee00-0000-4000-8000-0000000000cc', version: '2.1.0' };
function turns(from: number, to: number): string {
  const rows: unknown[] = [];
  const at = (n: number) => new Date(Date.UTC(2026, 10, 14, 9, 0, 0) + n * 1000).toISOString();
  for (let t = from; t < to; t++) {
    const id = (k: number) => `00000000-0000-4000-8000-${String(t * 10 + k).padStart(12, '0')}`;
    rows.push({ ...base, uuid: id(1), timestamp: at(t * 4), type: 'user', message: { role: 'user', content: `prompt number ${t}` } });
    rows.push({ ...base, uuid: id(2), timestamp: at(t * 4 + 1), type: 'assistant', message: { id: `msg-${t}-a`, role: 'assistant', model: 'synthetic', content: [{ type: 'tool_use', id: `call-${t}`, name: 'Read', input: { file_path: `/home/dev/shop/src/file-${t}.ts` } }] } });
    rows.push({ ...base, uuid: id(3), timestamp: at(t * 4 + 2), type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: `call-${t}`, content: `     1${String.fromCharCode(9)}export const value${t} = ${t};` }] } });
    rows.push({ ...base, uuid: id(4), timestamp: at(t * 4 + 3), type: 'assistant', message: { id: `msg-${t}-b`, role: 'assistant', model: 'synthetic', content: [{ type: 'text', text: `answer ${t}` }] } });
  }
  return rows.map((row) => JSON.stringify(row)).join(nl) + nl;
}

const wholeReady = (a: App, id: string) => new Promise<void>((done, fail) => {
  const timer = setTimeout(() => fail(new Error('the whole view was never announced')), 15_000);
  a.ingest.on('change', (e: { recordingId: string; added: number }) => { if (e.recordingId === id && e.added === 0) { clearTimeout(timer); done(); } });
});

/** A recording whose whole fold has been written, then the daemon stopped. */
async function remembered(turnCount=8) {
  const dir = mkdtempSync(join(tmpdir(), 'drishya-fold-restart-')); dirs.push(dir);
  const journal = join(dir, 'session.jsonl');
  writeFileSync(journal, turns(0, turnCount));
  const home = join(dir, 'data');
  const first = new App(home);
  const { recordingId } = await first.ingest.importSource('claude-code', journal);
  const ready = wholeReady(first, recordingId);
  expect((await first.history.page(recordingId, { tailFirst: true, count: 64 })).partial).toBeDefined();
  await ready;
  await first.close();
  return { dir, journal, home, recordingId };
}
const folds = (home: string) => {
  const db = new DatabaseSync(join(home, 'history', 'index.db'));
  try { return db.prepare('SELECT id, key FROM folds').all() as { id: string; key: string }[]; } finally { db.close(); }
};
const reopen = (home: string) => { const app = new App(home); apps.push(app); return app; };

describe('the remembered fold', { timeout: 60_000 }, () => {
  it('is written once the whole view is ready', async () => {
    const f = await remembered();
    const rows = folds(f.home);
    expect(rows.map((r) => r.id)).toEqual([f.recordingId]);
  });

  it('after a restart: resumes, appends only the new tail, and equals a fresh rebuild', async () => {
    const f = await remembered();
    appendFileSync(f.journal, turns(8, 11));
    const again = reopen(f.home);
    await again.ingest.sync(f.recordingId);
    // Resumed: the whole view at once, not the recent-first page followed by a fold.
    const resumed = await again.history.page(f.recordingId, { tailFirst: true, count: 64 });
    expect(resumed.partial).toBeUndefined();
    expect(resumed.projection.prose.some((p) => p.text === 'answer 10')).toBe(true);

    // A rebuild from the same stored observations: the history cache (views and remembered fold) forgotten, folded from nothing.
    const wholeNow = JSON.stringify(resumed.projection);
    const wholeScene = JSON.stringify(resumed.scene);
    await again.history.forget(f.recordingId);
    const rebuilt = await again.history.page(f.recordingId, { count: 64 });
    expect(rebuilt.partial).toBeUndefined();
    expect(wholeNow).toBe(JSON.stringify(rebuilt.projection));
    expect(wholeScene).toBe(JSON.stringify(rebuilt.scene));
  });

  it('with nothing new, the stored view is served and the next append still resumes', async () => {
    const f = await remembered();
    const again = reopen(f.home);
    const same = await again.history.page(f.recordingId, { tailFirst: true, count: 64 });
    expect(same.partial).toBeUndefined();
    appendFileSync(f.journal, turns(8, 9));
    await again.ingest.sync(f.recordingId);
    const grown = await again.history.page(f.recordingId, { tailFirst: true, count: 64 });
    expect(grown.partial).toBeUndefined();
    expect(grown.projection.prose.some((p) => p.text === 'answer 8')).toBe(true);
  });

  it('resumes a compressed fold, appends and equals a fresh rebuild',async()=>{
    const f=await remembered(64);
    const db=new DatabaseSync(join(f.home,'history','index.db'));
    try{
      const row=db.prepare('SELECT state FROM folds WHERE id=?').get(f.recordingId) as {state:Uint8Array};
      expect(Buffer.from(row.state.subarray(0,4)).toString()).toBe('DRF1');
    }finally{db.close();}
    appendFileSync(f.journal,turns(64,65));
    const again=reopen(f.home);
    await again.ingest.sync(f.recordingId);
    const resumed=await again.history.page(f.recordingId,{tailFirst:true,count:64});
    expect(resumed.partial).toBeUndefined();
    expect(resumed.projection.prose.some(p=>p.text==='answer 64')).toBe(true);
    await again.history.forget(f.recordingId);
    const rebuilt=await again.history.page(f.recordingId,{count:64});
    expect(JSON.stringify(resumed.projection)).toBe(JSON.stringify(rebuilt.projection));
    expect(JSON.stringify(resumed.scene)).toBe(JSON.stringify(rebuilt.scene));
  });

  const stale = (what: string, change: (db: DatabaseSync, f: Awaited<ReturnType<typeof remembered>>) => void) => it(`is not used when ${what}: the view is folded again`, async () => {
    const f = await remembered();
    const goodKey = folds(f.home)[0]!.key;
    const db = new DatabaseSync(join(f.home, 'history', 'index.db'));
    try { change(db, f); } finally { db.close(); }
    const again = reopen(f.home);
    appendFileSync(f.journal, turns(8, 9));
    await again.ingest.sync(f.recordingId);
    const page = await again.history.page(f.recordingId, { tailFirst: true, count: 64 });
    expect(page.partial, 'recent-first again').toBeDefined();
    const whole = new Promise<void>((done) => again.ingest.on('change', (e: { recordingId: string; added: number }) => { if (e.recordingId === f.recordingId && e.added === 0) done(); }));
    await whole;
    const after = await again.history.page(f.recordingId, { count: 64 });
    expect(after.projection.prose.some((p) => p.text === 'answer 8')).toBe(true);
    // The unusable checkpoint was replaced by a good one once the new fold finished.
    const rewritten = async () => { for (let i = 0; i < 100; i++) { const rows = folds(f.home); if (rows.length === 1 && rows[0]!.key === goodKey) return true; await new Promise((r) => setTimeout(r, 50)); } return false; };
    expect(await rewritten()).toBe(true);
  });

  const keyPart = (index: number, value: unknown) => (db: DatabaseSync) => {
    const row = db.prepare('SELECT id, key FROM folds').get() as { id: string; key: string };
    const key = JSON.parse(row.key) as unknown[]; key[index] = value;
    db.prepare('UPDATE folds SET key=? WHERE id=?').run(JSON.stringify(key), row.id);
  };
  stale('the fold format differs', keyPart(0, 999));
  stale('the reducer version differs', keyPart(1, 'r-other'));
  stale('the history version differs', keyPart(2, 'h-other'));
  stale('the prose limit differs', keyPart(3, 17));
  stale('the input limit differs', keyPart(4, 17));
  stale('the adapters differ', keyPart(5, 'another'));
  stale('the recordings read differ', keyPart(6, ['rec_other']));
  stale('its bytes are damaged', (db) => { db.prepare('UPDATE folds SET state=?').run(new Uint8Array([1, 2, 3])); });
  stale('its compressed bytes are damaged', (db) => { db.prepare('UPDATE folds SET state=?').run(Buffer.from('DRF1')); });
  stale('its head is damaged', (db) => { db.prepare("UPDATE folds SET meta='not json'").run(); });
  stale('the recording has fewer rows than were folded', (db) => {
    const row = db.prepare('SELECT meta FROM folds').get() as { meta: string };
    const meta = JSON.parse(row.meta) as { rows: number }; meta.rows += 1000;
    db.prepare('UPDATE folds SET meta=?').run(JSON.stringify(meta));
  });
  stale('its bases name a blob the store no longer holds', (db) => {
    const row = db.prepare('SELECT meta FROM folds').get() as { meta: string };
    const meta = JSON.parse(row.meta) as { blobs: string[] }; meta.blobs = ['0'.repeat(64)];
    db.prepare('UPDATE folds SET meta=?').run(JSON.stringify(meta));
  });

  it('is dropped with the recording', async () => {
    const f = await remembered();
    const again = reopen(f.home);
    await again.history.forget?.(f.recordingId);
    expect(folds(f.home)).toHaveLength(0);
  });
});
