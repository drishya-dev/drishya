import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, it } from 'vitest';
import { storageUsage, storageUsageReader } from '../src/storage.ts';

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
