// SHIP-16: found by the first real Linux run (WSL2). The data folder was 0700 but the database, its -wal and -shm files and
// the blob folder inside it were made under the process umask (0644 / 0755), so a copied, restored or re-mounted data folder
// exposed them to other local users. Everything the store creates is owner-only now, whatever the umask.
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Store } from '../../packages/store/src/index.ts';

const tempRoot = realpathSync(tmpdir());
let scratch: string;
let previousUmask: number | undefined;
beforeEach(() => { scratch = realpathSync(mkdtempSync(join(tempRoot, 'drishya-ship16-'))); });
afterEach(() => {
  if (previousUmask !== undefined) { process.umask(previousUmask); previousUmask = undefined; }
  if (dirname(scratch) !== tempRoot) throw new Error('Unexpected scratch directory');
  rmSync(scratch, { recursive: true, force: true });
});

const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? [join(dir, e.name), ...walk(join(dir, e.name))] : [join(dir, e.name)]));
const loose = (dir: string) => walk(dir).filter((f) => (statSync(f).mode & 0o077) !== 0);

describe.skipIf(process.platform === 'win32')('the store creates only owner-only files and folders (Linux and macOS)', () => {
  it('a new store under a permissive umask has no group or other bits on the database, -wal, -shm or any folder', () => {
    previousUmask = process.umask(0o022);
    const dir = join(scratch, 'store');
    const store = new Store(dir);
    // A write leaves the -wal and -shm files in place while the connection is open.
    store.db.exec("INSERT INTO meta (key, value) VALUES ('ship16', '1')");
    store.blobs.put('{"x":1}');
    const names = walk(dir).map((f) => f.slice(dir.length + 1));
    expect(names).toContain('drishya.db');
    expect(names.some((n) => n.endsWith('-wal'))).toBe(true);
    expect(loose(dir)).toEqual([]);
    store.close();
    expect(loose(dir)).toEqual([]);
  });

  it('a database that already existed with loose bits is tightened when the store opens it', () => {
    const dir = join(scratch, 'old');
    new Store(dir).close();
    chmodSync(join(dir, 'drishya.db'), 0o644);
    mkdirSync(join(dir, 'blobs', 'ab'), { recursive: true });
    chmodSync(dir, 0o755);
    const store = new Store(dir);
    store.close();
    expect(statSync(dir).mode & 0o077).toBe(0);
    expect(statSync(join(dir, 'drishya.db')).mode & 0o077).toBe(0);
  });

  it('opening a store read-only does not change anyone\'s file modes', () => {
    const dir = join(scratch, 'ro');
    new Store(dir).close();
    chmodSync(join(dir, 'drishya.db'), 0o640);
    new Store(dir, { readOnly: true }).close();
    expect(statSync(join(dir, 'drishya.db')).mode & 0o777).toBe(0o640);
  });
});
