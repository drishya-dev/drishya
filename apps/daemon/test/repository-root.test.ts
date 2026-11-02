import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { repositoryRoots } from '../src/repository-root.ts';

let dir: string, repo: string;
const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, windowsHide: true, stdio: 'ignore' });
beforeAll(() => {
  dir = realpathSync.native(mkdtempSync(join(tmpdir(), 'drishya-repository-root-')));
  repo = join(dir, 'shop'); mkdirSync(repo);
  git(repo, 'init'); git(repo, 'config', 'user.name', 'Synthetic'); git(repo, 'config', 'user.email', 'fixture@example.invalid');
  writeFileSync(join(repo, 'a.ts'), 'export const a = 1;\n'); git(repo, 'add', '.'); git(repo, 'commit', '-m', 'fixture');
});
afterAll(() => { if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('unsafe fixture'); rmSync(dir, { recursive: true, force: true }); });

it('a linked worktree anywhere on disk belongs to its repository', async () => {
  const linked = join(dir, 'elsewhere', 'shop-feature');
  git(repo, 'worktree', 'add', '-q', linked);
  expect(await repositoryRoots()(linked)).toBe(repo);
});

it('an agent worktree belongs to its repository even after it was deleted', async () => {
  const path = [repo, '.claude', 'worktrees', 'gone-1a2b3c'].join(sep);
  expect(await repositoryRoots()(path)).toBe(repo);
  expect(await repositoryRoots()(path + sep + 'apps')).toBe(repo);
});

it('a repository, a plain folder, a missing folder and a submodule pointer have no parent', async () => {
  const roots = repositoryRoots();
  expect(await roots(repo)).toBeUndefined();
  expect(await roots(dir)).toBeUndefined();
  expect(await roots(join(dir, 'missing'))).toBeUndefined();
  expect(await roots(undefined)).toBeUndefined();
  const submodule = join(dir, 'submodule'); mkdirSync(submodule);
  writeFileSync(join(submodule, '.git'), `gitdir: ${join(repo, '.git', 'modules', 'submodule')}\n`);
  expect(await roots(submodule)).toBeUndefined();
});
