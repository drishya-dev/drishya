// SEC-3 item 5: command execution. Every place a program is started uses an argument list and no shell;
// captured values cannot become options; the executable cannot come from the repository; Git runs with
// its extension points off and never touches the network.
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchToken } from '../../apps/daemon/src/commands.ts';
import { executable } from '../../apps/daemon/src/native-executable.ts';
import { git, grantAccess, importHostile, makeRepo, write } from './lib/seed.ts';
import { startScratch, tempDir, removeTemp, type Scratch } from './lib/scratch.ts';

const root = process.cwd();
const sources = (dir: string): string[] => readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === 'node_modules' || e.name === 'dist' || e.name === 'test' ? [] : sources(join(dir, e.name))) : /\.(ts|tsx)$/.test(e.name) ? [join(dir, e.name).replace(/\\/g, '/')] : []));

describe('every place a program is started', () => {
  const daemon = [...sources('apps/daemon/src'), ...sources('packages')].filter((f) => !f.includes('/test/'));
  const importers = daemon.filter((f) => /from 'node:child_process'|require\('child_process'\)|from 'child_process'/.test(readFileSync(join(root, f), 'utf8')));

  it('is a short, reviewed list: a new importer of child_process fails here until a person has read it', () => {
    expect(importers).toEqual([
      'apps/daemon/src/commands.ts', //            opens the launch link in the default browser
      'apps/daemon/src/controller.ts', //          the native harness the person chose to continue, behind consent
      'apps/daemon/src/embed-runtime.ts', //       EMBED: this same CLI as a worker on a private fd-3 pipe; the system PowerShell's ACL API on Windows
      'apps/daemon/src/git-history.ts', //         `git patch-id` on a diff Git itself produced (stdin)
      'apps/daemon/src/git-review.ts', //          the read-only Git reader
      'apps/daemon/src/github-links.ts', //        the person's own `gh`, only after opt-in
      'apps/daemon/src/native-readiness.ts', //    `claude --version` style probes
      'apps/daemon/src/native-settings.ts', //     the explicit settings probe
    ]);
  });

  it('none uses a shell: no shell option, no exec/execSync, no command built as a string', () => {
    for (const file of importers) {
      const source = readFileSync(join(root, file), 'utf8');
      expect(source, file).not.toMatch(/shell\s*:\s*true/);
      expect(source, file).not.toMatch(/(?<![.\w])(?:exec|execSync|spawnSync|execFileSync)\s*\(/);
      // The first argument of execFile/spawn is a literal or a resolved path, never a template with data in it.
      expect(source, file).not.toMatch(/(?:execFile|spawn)\s*\(\s*`/);
    }
  });

  it('the page and the demo bundle have no way to start a program', () => {
    for (const file of sources('apps/ui/src')) expect(readFileSync(join(root, file), 'utf8'), file).not.toMatch(/child_process/);
  });

  it('the browser opener runs only the one-time launch link (SEC-4), whose characters are URL-safe', () => {
    const source = readFileSync(join(root, 'apps/daemon/src/commands.ts'), 'utf8');
    expect(source).toContain('openBrowser(running.openUrl())');
    // EMBED: `drishya embed --open` opens its pane link, which carries a one-use 60-second code, never the token.
    expect(source).toContain('openBrowser(launched.url)');
    expect(source.match(/openBrowser\(/g)).toHaveLength(3); // the two calls and the definition
    expect(launchToken(undefined)).toBeUndefined();
    expect(launchToken('abcdefghijklmnopqrstuvwxyz0123456789_-ABCD')).toBeTruthy();
    for (const bad of ['short', 'a&calc.exe a&calc.exe', 'x'.repeat(16) + '&calc', 'x'.repeat(16) + '|dir', 'x'.repeat(16) + '%PATH%', 'x'.repeat(16) + '"', 'x'.repeat(16) + '^', 'x'.repeat(16) + ' ', 'x'.repeat(16) + '\n', 'x'.repeat(200), 'x'.repeat(16) + '$(id)', 'x'.repeat(16) + '`id`']) {
      expect(() => launchToken(bad), JSON.stringify(bad)).toThrow(/DRISHYA_TOKEN/);
    }
  });
});

describe('the executable cannot come from the repository', () => {
  let dir: string;
  beforeAll(() => { dir = tempDir(); });
  afterAll(() => removeTemp(dir));

  it('a relative PATH entry is ignored, so a claude or codex in the working directory is never chosen', () => {
    const repo = join(dir, 'repo');
    mkdirSync(repo, { recursive: true });
    const name = process.platform === 'win32' ? 'claude.exe' : 'claude';
    writeFileSync(join(repo, name), 'planted');
    chmodSync(join(repo, name), 0o755);
    const here = process.cwd();
    process.chdir(repo);
    try {
      for (const PATH of ['.', '', './', '..', 'bin', `${process.platform === 'win32' ? ';' : ':'}.`]) {
        expect(executable('claude', { env: { PATH } }), JSON.stringify(PATH)).toBeUndefined();
      }
      // The control: the same file is found through an absolute entry, which the person put there.
      expect(executable('claude', { env: { PATH: repo } })).toBeTruthy();
    } finally { process.chdir(here); }
  });
});

describe('captured values cannot become options', () => {
  let s: Scratch, repo: string, rec: string;
  beforeAll(async () => {
    s = await startScratch();
    repo = makeRepo(join(s.dir, 'repo'));
    // Files whose names are command-line options, tracked and then changed.
    for (const name of ['--output=pwned-file', '-p', '--stat', '-O', '--help']) write(join(repo, name), 'one\n');
    git(repo, 'add', '--', '.');
    git(repo, 'commit', '-q', '-m', 'option-named files');
    for (const name of ['--output=pwned-file', '-p', '--stat', '-O', '--help']) write(join(repo, name), 'two\n');
    rec = await importHostile(s, 'claude-code', repo);
    await grantAccess(s, rec);
  });
  afterAll(async () => { await s.close(); });

  it('files named like options are shown as files, and nothing is created, run or printed as an option', async () => {
    const snapshot = await s.call(`/v1/recordings/${encodeURIComponent(rec)}/git/snapshot`, { headers: s.bearer });
    expect(snapshot.status).toBe(200);
    const names = (snapshot.json.files as { path: string }[]).map((f) => f.path);
    expect(names).toEqual(expect.arrayContaining(['--output=pwned-file', '-p', '--stat']));
    expect(existsSync(join(repo, 'pwned-file'))).toBe(false);
    const read = await s.call(`/v1/recordings/${encodeURIComponent(rec)}/workspace/file?path=${encodeURIComponent('--output=pwned-file')}`, { headers: s.bearer });
    expect(read.status).toBeLessThan(500);
    expect(existsSync(join(repo, 'pwned-file'))).toBe(false);
  });
});

describe('Git never touches the network', () => {
  let s: Scratch, repo: string, rec: string;
  beforeAll(async () => {
    s = await startScratch();
    repo = makeRepo(join(s.dir, 'repo'));
    // A remote that would be reached by any fetch, ls-remote, push or submodule update.
    git(repo, 'remote', 'add', 'origin', 'http://127.0.0.1:9/never.git');
    git(repo, 'config', 'remote.origin.fetch', '+refs/heads/*:refs/remotes/origin/*');
    rec = await importHostile(s, 'claude-code', repo);
    await grantAccess(s, rec);
  });
  afterAll(async () => { await s.close(); });

  it('every Git surface runs only local, read-only subcommands', async () => {
    const trace = join(s.dir, 'git-trace.txt');
    process.env.GIT_TRACE = trace;
    try {
      const base = `/v1/recordings/${encodeURIComponent(rec)}`;
      const head = git(repo, 'rev-parse', 'HEAD').trim();
      for (const path of ['/git', '/git/snapshot', '/git/generation', '/git/history', '/git/compare-refs', `/git/compare?base=main&head=${head}`, '/git/compare-pulls', '/git/compare-remote?pr=1', '/git/ref?rev=main', `/git/commit?hash=${head}`, '/graph', '/workspace/file?path=src/a.ts']) {
        await s.call(base + path, { headers: s.bearer });
      }
    } finally { delete process.env.GIT_TRACE; }
    const trace2 = readFileSync(trace, 'utf8');
    const used = new Set([...trace2.matchAll(/(?:built-in|run_command|exec): git (?:(?:-c \S+|--[\w-]+(?:=\S+)?) )*([a-z][\w-]*)/g)].map((m) => m[1]!));
    const allowed = new Set(['rev-parse', 'for-each-ref', 'symbolic-ref', 'log', 'show', 'cat-file', 'merge-base', 'status', 'diff', 'config', 'ls-files', 'patch-id', 'rev-list', 'show-ref', 'ls-tree', 'remote', 'diff-tree']);
    const odd = [...used].filter((c) => !allowed.has(c));
    expect(odd.map((c) => trace2.split(/\r?\n/).filter((l) => l.includes(` ${c}`)).slice(0, 2).join(' | ').slice(0, 300))).toEqual([]);
    expect(used.size).toBeGreaterThan(3);
    // `git remote` and `diff-tree` are local reads; the writing forms of `remote` are never used.
    expect(trace2).not.toMatch(/git remote (?:add|update|prune|set-url|set-head|remove|rm|rename)/);
    expect(trace2).not.toMatch(/git-remote-|remote-http|ls-remote|upload-pack|receive-pack|run_command: ssh|credential/i);
    // Outside the checkout: `..` on one drive, an absolute path when the temp directory is on another (Windows runners).
    const fromRoot = relative(root, repo);
    expect(fromRoot.startsWith('..') || isAbsolute(fromRoot)).toBe(true);
  });

  it('turns prompting and lazy fetching off for every call', () => {
    const source = readFileSync(join(root, 'apps/daemon/src/git-review.ts'), 'utf8');
    expect(source).toMatch(/GIT_TERMINAL_PROMPT:\s*'0'/);
    expect(source).toMatch(/GIT_NO_LAZY_FETCH:\s*'1'/);
    expect(source).toMatch(/GIT_OPTIONAL_LOCKS:\s*'0'/);
  });
});
