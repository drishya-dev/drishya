import { opendir, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { setImmediate } from 'node:timers/promises';
import type { Store } from '@drishya/store';

export const DISK_BUDGET_BYTES = 10 * 1024 ** 3;

/** Counts only Drishya's own files. Symlinks are never followed into a harness or workspace. */
export async function storageUsage(root: string) {
  const categories = { captured: 0, derived: 0, database: 0, other: 0 };
  let files = 0;
  async function walk(dir: string, category?: keyof typeof categories) {
    let entries;
    try { entries = await opendir(dir); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return; throw e; }
    for await (const entry of entries) {
      const path = join(dir, entry.name);
      const info = await lstat(path).catch((e) => { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw e; });
      if (!info || info.isSymbolicLink()) continue;
      const kind = category ?? (entry.name === 'blobs' ? 'captured' : entry.name === 'history' ? 'derived' : /^drishya\.db/.test(entry.name) ? 'database' : 'other');
      if (info.isDirectory()) await walk(path, kind);
      else if (info.isFile()) { categories[kind] += info.size; files++; }
    }
  }
  await walk(root);
  const bytes = Object.values(categories).reduce((sum, n) => sum + n, 0);
  return { bytes, files, categories, budgetBytes: DISK_BUDGET_BYTES, overBudget: bytes >= DISK_BUDGET_BYTES, automaticDeletion: false as const };
}

// Per-server advisory accounting: concurrent refreshes share a walk; failures
// are never cached. Filesystem calls stay asynchronous and never follow links.
export function storageUsageReader(root: string, now: () => number = Date.now) {
  let cached: { until: number; usage: Awaited<ReturnType<typeof storageUsage>> } | undefined;
  let pending: ReturnType<typeof storageUsage> | undefined;
  let generation = 0;
  let pendingGeneration = 0;
  const read = (): ReturnType<typeof storageUsage> => {
    if (pending) return pendingGeneration === generation ? pending : pending.then(() => read());
    if (cached && now() < cached.until) return Promise.resolve(cached.usage);
    const started = generation;
    pendingGeneration = started;
    const task = storageUsage(root).then(usage => {
      if (generation === started) cached = { until: now() + 2000, usage };
      return usage;
    }).finally(() => { if (pending === task) pending = undefined; });
    pending = task;
    return pending;
  };
  return Object.assign(read, { invalidate() { generation++; cached = undefined; } });
}

/** Logical evidence attribution, not allocated SQLite pages or a promise of reclaimed bytes.
 * Yield between bounded pages; cap work and disclose a partial result for exceptionally large homes.
 * Only hashes already present in stored observations/projections can name captured files.
 */
export async function sessionStorageUsage(store: Store, limit = 100_000) {
  const sessions = store.listRecordings().map(r => ({ id: r.id, title: r.title, harness: r.harness,
    rowBytes: 0, capturedBytes: 0, sharedCapturedBytes: 0 }));
  const byId = new Map(sessions.map(r => [r.id, r]));
  const revisions = JSON.stringify(store.listRecordings().map(r => [r.id, r.revision]));
  const owners = new Map<string, Set<string>>();
  let scanned = 0, complete = true;
  for (const table of ['observations', 'projections'] as const) {
    let cursor = 0;
    while (scanned < limit) {
      const rows = store.db.prepare(`SELECT rowid, recording_id, body FROM ${table} WHERE rowid > ? ORDER BY rowid LIMIT ?`).all(cursor, Math.min(64, limit - scanned));
      if (!rows.length) break;
      for (const row of rows) {
        const session = byId.get(String(row.recording_id));
        if (!session) continue;
        const body = String(row.body);
        session.rowBytes += Buffer.byteLength(body);
        for (const match of body.matchAll(/"(?:\$blob|blob)":"([0-9a-f]{64})"/g)) {
          if (!owners.has(match[1]!) && owners.size >= limit) { complete = false; continue; }
          const ids = owners.get(match[1]!) ?? new Set<string>();
          ids.add(session.id); owners.set(match[1]!, ids);
        }
        scanned++;
      }
      cursor = Number(rows.at(-1)!.rowid);
      await setImmediate();
    }
    if (scanned >= limit) { complete = false; break; }
  }
  // Refuse linked directories as well as linked files. A missing blob is not counted as present.
  const blobRoot = join(store.dataDir, 'blobs');
  const root = await lstat(blobRoot).catch(() => undefined);
  if (root?.isDirectory() && !root.isSymbolicLink()) for (const [sha, ids] of owners) {
    const parent = join(blobRoot, sha.slice(0, 2));
    const dir = await lstat(parent).catch(() => undefined);
    if (!dir?.isDirectory() || dir.isSymbolicLink()) continue;
    const file = await lstat(join(parent, sha)).catch(() => undefined);
    if (!file?.isFile() || file.isSymbolicLink()) continue;
    for (const id of ids) {
      const session = byId.get(id)!;
      session.capturedBytes += file.size;
      if (ids.size > 1) session.sharedCapturedBytes += file.size;
    }
  }
  if (revisions !== JSON.stringify(store.listRecordings().map(r => [r.id, r.revision]))) complete = false;
  return { sessions, complete };
}

/** Details are requested only by Settings, never by Home's advisory polling. */
export function sessionStorageUsageReader(store: Store) {
  let pending: Promise<Awaited<ReturnType<typeof sessionStorageUsage>>> | undefined;
  let generation = 0;
  let pendingGeneration = 0;
  let cached: { key: string; until: number; value: Awaited<ReturnType<typeof sessionStorageUsage>> } | undefined;
  const key = () => JSON.stringify(store.listRecordings().map(r => [r.id, r.revision]));
  const read = (): ReturnType<typeof sessionStorageUsage> => {
    if (pending) return pendingGeneration === generation ? pending : pending.then(() => read());
    const startedKey = key(), started = generation;
    pendingGeneration = started;
    if (cached?.key === startedKey && Date.now() < cached.until) return Promise.resolve(cached.value);
    const task = sessionStorageUsage(store).then(value => {
      if (generation === started && value.complete && key() === startedKey) cached = { key: startedKey, until: Date.now() + 2000, value };
      return value;
    }).finally(() => { if (pending === task) pending = undefined; });
    pending = task;
    return task;
  };
  return Object.assign(read, { invalidate() { generation++; cached = undefined; } });
}
