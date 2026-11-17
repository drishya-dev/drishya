import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isUnsafeRecordedPath } from '../../apps/daemon/src/remote-path.ts';
import type { Scratch } from './lib/scratch.ts';

// SEC-4b: a folder named by a journal is a claim. On Windows, checking that a `\\host\share` or `\\.\device` path exists
// contacts another machine or opens a device, so no recorded path of that shape may reach the file system, before or at
// approval. The probe replaces the file-system calls with ones that record such a path and answer "not found".
const BS = String.fromCharCode(92);
const SPELLINGS = [
  BS + BS + 'unc-probe.invalid' + BS + 'share' + BS + 'proj',
  BS + BS + '?' + BS + 'UNC' + BS + 'unc-probe.invalid' + BS + 'share' + BS + 'proj',
  '//unc-probe.invalid/share/proj',
  BS + BS + '.' + BS + 'pipe' + BS + 'unc-probe',
];

it('names network and device spellings on Windows only', () => {
  for (const path of SPELLINGS) {
    expect(isUnsafeRecordedPath(path, 'win32')).toBe(true);
    expect(isUnsafeRecordedPath(path, 'linux')).toBe(false);
  }
  for (const path of ['C:' + BS + 'work' + BS + 'proj', '/home/me/proj', '/', 'relative/dir']) expect(isUnsafeRecordedPath(path, 'win32')).toBe(false);
});

describe.runIf(process.platform === 'win32')('recorded network paths never reach the file system', () => {
  const touched: string[] = [];
  const originals: [object, string, unknown][] = [];
  let scratch: Scratch;
  const remote = (value: unknown) => typeof value === 'string' && new RegExp('^[' + BS + '/]{2}').test(value);
  const patch = (target: any, name: string, kind: 'async' | 'sync' | 'exists') => {
    const original = target[name];
    if (typeof original !== 'function') return;
    originals.push([target, name, original]);
    target[name] = function (this: unknown, ...args: unknown[]) {
      if (remote(args[0])) {
        touched.push(`${name}(${String(args[0]).slice(0, 8)})`);
        if (kind === 'exists') return false;
        const error: NodeJS.ErrnoException = new Error('ENOENT'); error.code = 'ENOENT';
        if (kind === 'sync') throw error;
        return Promise.reject(error);
      }
      return original.apply(this, args);
    };
  };

  beforeAll(async () => {
    for (const name of ['readFile', 'stat', 'lstat', 'realpath', 'access', 'readdir', 'open', 'opendir']) patch(fsp, name, 'async');
    for (const name of ['readFileSync', 'statSync', 'lstatSync', 'readdirSync', 'openSync', 'accessSync']) patch(fs, name, 'sync');
    patch(fs, 'existsSync', 'exists');
    patch(fs.realpathSync, 'native', 'sync');
    const realpathSync = fs.realpathSync, wrapped = Object.assign(function (this: unknown, path: unknown, options: unknown) {
      if (remote(path)) { touched.push('realpathSync'); const error: NodeJS.ErrnoException = new Error('ENOENT'); error.code = 'ENOENT'; throw error; }
      return (realpathSync as any)(path, options);
    }, { native: (fs.realpathSync as any).native });
    originals.push([fs, 'realpathSync', realpathSync]); (fs as any).realpathSync = wrapped;
    syncBuiltinESMExports();
    const { startScratch } = await import('./lib/scratch.ts');
    scratch = await startScratch();
  });
  afterAll(async () => {
    await scratch?.close();
    for (const [target, name, original] of originals.reverse()) (target as any)[name] = original;
    syncBuiltinESMExports();
  });

  it('keeps the list, roots, map and approval surfaces off every network or device spelling', async () => {
    const { importHostile } = await import('./lib/seed.ts');
    const json = { ...scratch.bearer, 'content-type': 'application/json' };
    for (const [index, cwd] of SPELLINGS.entries()) {
      const id = await importHostile(scratch, 'claude-code', cwd, undefined, `net${index}`);
      const base = `/v1/recordings/${encodeURIComponent(id)}`;
      for (const path of ['', `${base}/file-roots`, `${base}/graph`, `${base}/workspace`, `${base}/workspace/setup`, `${base}/git`]) {
        const reply = await scratch.call(path === '' ? '/v1/recordings' : path, { headers: scratch.bearer });
        expect(reply.status, path).toBe(200);
      }
      for (const path of [`${base}/workspace/approve`, `${base}/graph/approve`, `${base}/git/approve`]) {
        const reply = await scratch.call(path, { method: 'POST', headers: json, body: '{}' });
        expect(reply.status, path).toBeGreaterThanOrEqual(400);
      }
    }
    expect(touched).toEqual([]);
  });
});
