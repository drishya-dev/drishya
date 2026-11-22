import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, it } from 'vitest';
import { storageUsage, storageUsageReader } from '../src/storage.ts';
import { sessionStorageUsage } from '../src/storage.ts';
import { App } from '../src/app.ts';
import { DatabaseSync } from 'node:sqlite';
import { Store } from '@drishya/store';
import { statSync } from 'node:fs';
import { copyFileSync, symlinkSync, readFileSync } from 'node:fs';

it('attributes evidence separately from physical disk use and preserves the other owner on clear and reimport', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'drishya-session-usage-'));
  const first = join(dir, 'first.jsonl'), second = join(dir, 'second.jsonl');
  copyFileSync(resolve('fixtures/synthetic/claude/checkout-fix.jsonl'), first);
  copyFileSync(first, second);
  const app = new App(join(dir, 'data'));
  try {
    const a = (await app.ingest.importSource('claude-code', first)).recordingId;
    const b = (await app.ingest.importSource('claude-code', second)).recordingId;
    const before = await sessionStorageUsage(app.store);
    expect(before.complete).toBe(true);
    expect(before.sessions.map(s => s.id).sort()).toEqual([a, b].sort());
    const owned = before.sessions.find(s => s.id === b)!;
    expect(owned.rowBytes).toBeGreaterThan(0);
    await app.forget(a);
    const after = await sessionStorageUsage(app.store);
    expect(after.sessions.map(s => s.id)).toEqual([b]);
    expect(after.sessions[0]!.rowBytes).toBe(owned.rowBytes);
    expect(app.store.countObservations(b)).toBeGreaterThan(0);
    expect((await app.ingest.importSource('claude-code', first)).recordingId).toBe(a);
    expect((await sessionStorageUsage(app.store)).sessions).toHaveLength(2);
  } finally { await app.close(); rmSync(dir, { recursive: true, force: true }); }
});

it('invalidates cached and in-flight storage measurements after a clear', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'drishya-invalidate-'));
  try {
    const read = storageUsageReader(dir);
    writeFileSync(join(dir, 'one'), 'one');
    await read();
    writeFileSync(join(dir, 'two'), 'two');
    read.invalidate();
    expect((await read()).bytes).toBe(6);
    read.invalidate();
    const pending = read();
    read.invalidate();
    await pending;
    writeFileSync(join(dir, 'three'), 'three');
    expect((await read()).bytes).toBe(11);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it('counts shared captured bytes per owner, releases them only after the last clear, and bounds detail work', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'drishya-shared-usage-'));
  const app = new App(join(dir, 'data'));
  try {
    const output = 'Synthetic shared output line\n'.repeat(2000);
    const ids: string[] = [];
    for (const name of ['one', 'two']) {
      const path = join(dir, name + '.jsonl');
      writeFileSync(path, [
        { type: 'session_meta', payload: { id: name, cwd: '/synthetic' } },
        { type: 'response_item', payload: { type: 'function_call', name: 'shell_command', call_id: 'call', arguments: '{"command":"echo synthetic"}' } },
        { type: 'response_item', payload: { type: 'function_call_output', call_id: 'call', output } },
      ].map(r => JSON.stringify({ ...r, timestamp: '2026-01-01T00:00:00Z' })).join('\n') + '\n');
      ids.push((await app.ingest.importSource('codex', path)).recordingId);
    }
    const before = await sessionStorageUsage(app.store);
    expect(before.sessions.map(s => s.sharedCapturedBytes)).toEqual([58000, 58000]);
    expect((await sessionStorageUsage(app.store, 1)).complete).toBe(false);
    const journal = readFileSync(join(dir, 'one.jsonl'));
    await app.forget(ids[0]!);
    const kept = await sessionStorageUsage(app.store);
    expect(kept.sessions[0]!.capturedBytes).toBe(58000);
    expect(kept.sessions[0]!.sharedCapturedBytes).toBe(0);
    expect(app.store.search(ids[0]!, 'synthetic')).toHaveLength(0);
    expect(app.store.search(ids[1]!, 'synthetic').length).toBeGreaterThan(0);
    await app.forget(ids[1]!);
    expect((await storageUsage(app.store.dataDir)).categories.captured).toBe(0);
    await expect(app.forget(ids[1]!)).rejects.toThrow('recording not found');
    expect(readFileSync(join(dir, 'one.jsonl'))).toEqual(journal);
  } finally { await app.close(); rmSync(dir, { recursive: true, force: true }); }
});

it('does not count files behind a linked directory', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'drishya-storage-links-'));
  try {
    mkdirSync(join(dir, 'data')); mkdirSync(join(dir, 'native'));
    writeFileSync(join(dir, 'native', 'recording'), 'native recording');
    symlinkSync(join(dir, 'native'), join(dir, 'data', 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    expect((await storageUsage(join(dir, 'data'))).bytes).toBe(0);
    expect(readFileSync(join(dir, 'native', 'recording'), 'utf8')).toBe('native recording');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it('reuses WAL space after a reader releases its snapshot without forcing it to stop', () => {
  const dir = mkdtempSync(join(tmpdir(), 'drishya-wal-budget-'));
  const store = new Store(dir), writer = store.db;
  let reader: DatabaseSync | undefined;
  try {
    writer.exec('CREATE TABLE storage_probe(body BLOB); INSERT INTO storage_probe VALUES(zeroblob(1));');
    reader = new DatabaseSync(join(dir, 'drishya.db'), { readOnly: true });
    reader.exec('BEGIN; SELECT * FROM storage_probe;');
    writer.exec('INSERT INTO storage_probe VALUES(zeroblob(25165824));');
    const wal = join(dir, 'drishya.db-wal');
    expect(statSync(wal).size).toBeGreaterThan(16 * 1024 ** 2);
    const held = writer.prepare('PRAGMA wal_checkpoint(PASSIVE)').get()!;
    expect(Number(held.checkpointed)).toBeLessThan(Number(held.log));
    reader.exec('ROLLBACK'); reader.close(); reader = undefined;
    writer.exec('PRAGMA wal_checkpoint(PASSIVE); INSERT INTO storage_probe VALUES(zeroblob(1));');
    expect(statSync(wal).size).toBeLessThanOrEqual(16 * 1024 ** 2);
    expect(writer.prepare('SELECT count(*) AS n FROM storage_probe').get()!.n).toBe(3);
  } finally { reader?.close(); store.close(); rmSync(dir, { recursive: true, force: true }); }
});

it('does not resurrect a cleared session when an earlier import finishes source validation late', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'drishya-clear-import-'));
  const journal = join(dir, 'session.jsonl');
  copyFileSync(resolve('fixtures/synthetic/codex/rollout-checkout-review.jsonl'), journal);
  const app = new App(join(dir, 'data'));
  let release!: () => void;
  const held = new Promise<void>(r => { release = r; });
  let entered!: () => void;
  const ready = new Promise<void>(r => { entered = r; });
  try {
    const id = (await app.ingest.importSource('codex', journal)).recordingId;
    const adapter = app.ingest.adapter('codex'), original = adapter.readPath;
    let once = true;
    adapter.readPath = async path => { if (once) { once = false; entered(); await held; } return original ? original(path) : path; };
    const pending = app.ingest.importSource('codex', journal);
    const result = pending.then(() => 'imported', () => 'cancelled');
    await ready;
    await app.forget(id);
    release();
    expect(await result).toBe('cancelled');
    expect(app.store.getRecording(id)).toBeUndefined();
    expect(app.store.countObservations(id)).toBe(0);
    expect(app.ingest.isLive(id)).toBe(false);
    expect((await app.ingest.importSource('codex', journal)).recordingId).toBe(id);
  } finally { release(); await app.close(); rmSync(dir, { recursive: true, force: true }); }
});

it('reports separate disk costs without deleting anything', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'drishya-usage-'));
  try {
    mkdirSync(join(dir, 'blobs'));
    mkdirSync(join(dir, 'history'));
    writeFileSync(join(dir, 'drishya.db'), 'database');
    writeFileSync(join(dir, 'blobs/captured'), 'captured');
    writeFileSync(join(dir, 'history/index.db'), 'index');
    const usage = await storageUsage(dir);
    expect(usage.categories).toEqual({ captured: 8, derived: 5, database: 8, other: 0 });
    expect(usage.bytes).toBe(21);
    expect(usage.automaticDeletion).toBe(false);
  } finally {
    if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('temp path escaped');
    rmSync(dir, { recursive: true, force: true });
  }
});

it('shares simultaneous walks, expires advisory values and never caches failures', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'drishya-usage-cache-'));
  try {
    let now = 100;
    const read = storageUsageReader(join(dir, 'store'), () => now);
    writeFileSync(join(dir, 'store'), 'not a directory');
    const failed = read();
    expect(read()).toBe(failed);
    await expect(failed).rejects.toThrow();
    rmSync(join(dir, 'store')); mkdirSync(join(dir, 'store'));
    writeFileSync(join(dir, 'store', 'first'), 'one');
    const first = read();
    expect(read()).toBe(first);
    expect((await first).bytes).toBe(3);
    writeFileSync(join(dir, 'store', 'second'), 'two');
    expect((await read()).bytes).toBe(3);
    now += 2000;
    expect((await read()).bytes).toBe(6);
  } finally {
    if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('temp path escaped');
    rmSync(dir, { recursive: true, force: true });
  }
});
