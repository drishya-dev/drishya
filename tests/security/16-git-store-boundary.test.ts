import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, watch, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { verifyOwnGitDir } from '../../apps/daemon/src/workspace.ts';

// SEC-4b: the approved checkout may use only its own history and object store. Synthetic repositories only.
const tempRoot = realpathSync(tmpdir());
let base: string, other: string;
const fwd = (path: string) => path.split(String.fromCharCode(92)).join('/');
const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.test', ...args], { cwd, encoding: 'utf8' }).trim();
const repo = (name: string) => { const dir = join(base, name); mkdirSync(dir); git(dir, 'init', '-q', '-b', 'main'); writeFileSync(join(dir, 'f.txt'), name); git(dir, 'add', '.'); git(dir, 'commit', '-q', '-m', name); return dir; };
const refused = (root: string) => expect(verifyOwnGitDir(root)).rejects.toMatchObject({ status: 403 });

beforeAll(() => { base = realpathSync(mkdtempSync(join(tempRoot, 'drishya-sec4b-git-'))); other = repo('other'); });
afterAll(() => { if (dirname(base) !== tempRoot) throw new Error('Unexpected scratch directory'); rmSync(base, { recursive: true, force: true }); });

describe('Git common directory', () => {
  it('keeps a plain repository and a genuine linked worktree working', async () => {
    const main = repo('plain');
    await expect(verifyOwnGitDir(main)).resolves.toBeUndefined();
    const linked = join(base, 'plain-linked');
    git(main, 'worktree', 'add', '-q', linked, '-b', 'feature');
    await expect(verifyOwnGitDir(linked)).resolves.toBeUndefined();
  });
  it('refuses a plain .git folder whose commondir names another repository', async () => {
    const root = repo('commondir-plain');
    writeFileSync(join(root, '.git', 'commondir'), fwd(join(other, '.git')) + '\n');
    await refused(root);
  });
  it('refuses a worktree admin folder whose commondir names another repository, even with a valid backlink', async () => {
    const host = repo('commondir-host'), work = join(base, 'commondir-work'), admin = join(host, '.git', 'worktrees', 'w');
    const events: object[] = [], states: object[] = [];
    const snapshot = (stage: string) => states.push({ stage,
      hostGit: existsSync(join(host, '.git')), work: existsSync(work), admin: existsSync(admin),
      gitdir: existsSync(join(admin, 'gitdir')), commondir: existsSync(join(admin, 'commondir')),
    });
    const watcher = watch(join(host, '.git'), { recursive: true }, (event, file) => {
      if (events.length < 40 && file?.toString().startsWith('worktrees')) events.push({ event, file: file.toString() });
    });
    watcher.on('error', error => { if (events.length < 40) events.push({ event: 'watch-error', code: (error as NodeJS.ErrnoException).code }); });
    try {
      snapshot('before-create');
      mkdirSync(work); mkdirSync(admin, { recursive: true });
      snapshot('admin-created');
      writeFileSync(join(work, '.git'), `gitdir: ${fwd(admin)}\n`);
      snapshot('forward-pointer-created');
      writeFileSync(join(admin, 'gitdir'), fwd(join(work, '.git')) + '\n');
      snapshot('backlink-created');
      writeFileSync(join(admin, 'commondir'), fwd(join(other, '.git')) + '\n');
      await refused(work);
      writeFileSync(join(admin, 'commondir'), '../..\n');
      await expect(verifyOwnGitDir(work)).resolves.toBeUndefined();
    } catch (error) {
      await new Promise<void>(done => setImmediate(done));
      snapshot('failed');
      console.error('Synthetic worktree setup diagnostics', JSON.stringify({ platform: process.platform, node: process.version, git: git(host, '--version'), states, events }));
      throw error;
    } finally {
      watcher.close();
    }
  });
});

describe('Git object alternates', () => {
  it('refuses alternates that point outside the repository, and an absent file is fine', async () => {
    const root = repo('alt-out');
    await expect(verifyOwnGitDir(root)).resolves.toBeUndefined();
    mkdirSync(join(root, '.git', 'objects', 'info'), { recursive: true });
    writeFileSync(join(root, '.git', 'objects', 'info', 'alternates'), fwd(join(other, '.git', 'objects')) + '\n');
    await refused(root);
  });
  it('refuses relative, commented-in and http alternates that leave the store, and a linked worktree inherits the check', async () => {
    const root = repo('alt-rel');
    const file = join(root, '.git', 'objects', 'info', 'alternates');
    mkdirSync(join(root, '.git', 'objects', 'info'), { recursive: true });
    writeFileSync(file, '# comment\n../../../other/.git/objects\n');
    await refused(root);
    writeFileSync(file, '# only a comment\n');
    await expect(verifyOwnGitDir(root)).resolves.toBeUndefined();
    writeFileSync(join(root, '.git', 'objects', 'info', 'http-alternates'), 'http://example.invalid/objects\n');
    await refused(root);
    rmSync(join(root, '.git', 'objects', 'info', 'http-alternates'));
    const linked = join(base, 'alt-linked');
    git(root, 'worktree', 'add', '-q', linked, '-b', 'wt');
    writeFileSync(file, fwd(join(other, '.git', 'objects')) + '\n');
    await refused(linked);
  });
});
