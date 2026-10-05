import { opendir, lstat } from 'node:fs/promises';
import { join } from 'node:path';

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
