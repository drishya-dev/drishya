import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, it } from 'vitest';
import { storageUsage } from '../src/storage.ts';

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
