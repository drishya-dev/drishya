// SEC-3, "to verify first": the five suspicions written down before the suite, each ending as a test.
import { execFileSync } from 'node:child_process';
import { copyFileSync, chmodSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { request } from 'node:http';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readGit } from '../../apps/daemon/src/git-review.ts';
import { defaultGhRun } from '../../apps/daemon/src/github-links.ts';
import { makeHostileRepo, type HostileRepo } from './lib/hostile-repo.ts';
import { git, makeRepo } from './lib/seed.ts';
import { grantAccess, importHostile } from './lib/seed.ts';
import { rawCall, removeTemp, startScratch, tempDir, type Scratch } from './lib/scratch.ts';

const root = fileURLToPath(new URL('../..', import.meta.url));
const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.name === 'node_modules' || e.name === 'dist' || e.name === '.git' ? [] : e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));

describe('1. git and gh are started by bare name with the repository as the working directory', () => {
  // Finding: not exploitable. On Windows an executable named `git.exe` in the working directory is NOT
  // preferred over PATH by Node 24's child_process (checked here with a copy of node.exe standing in for
  // an attacker's program: it would print a Node version instead of "git version"). The engine range
  // (>=24 <25) is pinned in package.json. This test fails if a future runtime starts preferring the
  // working directory, and then the remedy is to resolve the absolute path once at start.
  let dir: string, plant: string, here: string;
  beforeAll(() => {
    dir = tempDir();
    plant = join(dir, 'repo');
    makeRepo(plant);
    const ext = process.platform === 'win32' ? '.exe' : '';
    for (const name of ['git', 'gh']) { copyFileSync(process.execPath, join(plant, name + ext)); chmodSync(join(plant, name + ext), 0o755); }
    here = process.cwd();
  });
  afterAll(() => { process.chdir(here); removeTemp(dir); });

  it('the control: a planted program run by its path is what we think it is', () => {
    const out = execFileSync(join(plant, 'git' + (process.platform === 'win32' ? '.exe' : '')), ['--version'], { encoding: 'utf8' });
    expect(out.trim()).toMatch(/^v\d+\./);
  });

  it('readGit uses the installed git, with the repository as cwd and as the process cwd', async () => {
    expect(await readGit(plant, ['--version'])).toMatch(/^git version /);
    process.chdir(plant);
    expect(await readGit(plant, ['--version'])).toMatch(/^git version /);
  });

  it('the gh runner uses the installed gh (or none), never the one in the working directory', async () => {
    process.chdir(plant);
    const outcome = await defaultGhRun(['--version'], AbortSignal.timeout(10_000)).then((out) => ({ out }), (error: NodeJS.ErrnoException) => ({ error }));
    if ('out' in outcome) expect(outcome.out).toMatch(/^gh version /);
    else expect(outcome.error.code).toBe('ENOENT'); // gh is not installed on this machine
  });
});

describe('2. the session cookie is not scoped to a port', () => {
  // Finding (real, accepted for release 1, tracked as SEC-6): RFC 6265 cookies ignore the port, so the
  // browser sends `drishya_session` to every server on 127.0.0.1 (and `localhost`) that the same browser
  // visits. A server that logs or keeps request headers could replay it. What stops that today is that
  // the replayer must itself be a program on this machine (the port is loopback-only and the Host check
  // refuses everything else), and such a program running as the same account can already read the
  // store directly. A page-held second secret would close it, but it cannot protect the <img> and
  // EventSource requests that carry no script-set header, and it breaks every Playwright spec that
  // calls the API with the page's cookie jar. This test pins the facts the decision rests on.
  let s: Scratch;
  beforeAll(async () => { s = await startScratch(); });
  afterAll(async () => { await s.close(); });

  it('the cookie carries no port and no Domain, so a browser offers it to any port on the host', async () => {
    const reply = await s.call('/v1/session', { method: 'POST', headers: { ...s.bearer, 'content-type': 'application/json' }, body: '{}' });
    const header = String(reply.headers['set-cookie']);
    expect(header).not.toMatch(/Domain=/i);
    expect(header).toMatch(/Path=\//);
    expect(header).toMatch(/HttpOnly/);
    expect(header).toMatch(/SameSite=Strict/);
  });

  it('a different local peer that holds the cookie can replay it (the recorded risk), but only with the right Host and no foreign Origin', async () => {
    const cookie = await s.signIn();
    // What another server on 127.0.0.1:<other port> would do with the header it was sent.
    expect((await rawCall(s.port, '/v1/recordings', { headers: { cookie } })).status).toBe(200);
    // It cannot do it from a browser page on its own origin: the foreign Origin is refused.
    expect((await rawCall(s.port, '/v1/recordings', { headers: { cookie, origin: 'http://127.0.0.1:1' } })).status).toBe(403);
    // Nor with the Host of the page it served.
    expect((await rawCall(s.port, '/v1/recordings', { host: '127.0.0.1:1', headers: { cookie } })).status).toBe(421);
  });
});

describe('3. style-src allows inline styles', () => {
  // Finding: not exploitable. (a) Captured content is rendered as React text nodes: there is no
  // `dangerouslySetInnerHTML`, `innerHTML` or `insertAdjacentHTML` in apps/ui, so a style attribute or a
  // <style> element cannot be injected from captured data. (b) Even if one were, the policy has no remote
  // source for styles, images, fonts or connections, so an injected style could restyle the page but
  // load or send nothing. Removing 'unsafe-inline' is not free: CodeMirror and other libraries insert
  // <style> elements. The browser spec tests/browser/security-injected.spec.ts checks the rendered page.
  it('no raw HTML sink exists in the application source', () => {
    const sinks = /dangerouslySetInnerHTML|\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML|document\.write\s*\(|\beval\s*\(|new Function\s*\(|\.srcdoc\s*=|createContextualFragment/;
    const offenders = walk(join(root, 'apps', 'ui', 'src')).filter((f) => /\.(tsx?|jsx?)$/.test(f) && !/\.test\./.test(f) && sinks.test(readFileSync(f, 'utf8')));
    expect(offenders.map((f) => relative(root, f))).toEqual([]);
  });

  it('the policy has no remote source for styles, images, fonts, scripts or connections', async () => {
    const s = await startScratch();
    try {
      const csp = String((await s.call('/')).headers['content-security-policy']);
      const directives = Object.fromEntries(csp.split(';').map((d) => d.trim().split(/\s+/)).filter((d) => d[0]).map(([name, ...values]) => [name!, values]));
      for (const name of ['default-src', 'script-src', 'style-src', 'img-src', 'font-src', 'connect-src']) {
        for (const value of directives[name] ?? []) expect(value, `${name} ${value}`).toMatch(/^('self'|'unsafe-inline'|data:)$/);
      }
      expect(directives['script-src']).toEqual(["'self'"]);
      expect(directives['style-src']).toContain("'unsafe-inline'"); // the recorded exception
      expect(directives['frame-ancestors']).toEqual(["'none'"]);
    } finally { await s.close(); }
  });
});

describe('4. packages/explain makes outbound requests when a key is set', () => {
  // Finding: gone. CLEAN-2 removed the package, its key and its endpoint.
  it('no explain package, no model endpoint and no API key variable remain in the product', () => {
    const packages = readdirSync(join(root, 'packages'));
    expect(packages).not.toContain('explain');
    const offenders = [...walk(join(root, 'apps', 'daemon', 'src')), ...walk(join(root, 'packages')), ...walk(join(root, 'apps', 'ui', 'src'))]
      .filter((f) => /\.(tsx?|json)$/.test(f) && /NEBIUS|nemotron|api\.studio\.nebius|explain-model/i.test(readFileSync(f, 'utf8')));
    expect(offenders.map((f) => relative(root, f))).toEqual([]);
  });
});

describe('5. a repository’s own Git configuration can make git run programs', () => {
  // Finding: real, fixed. Git's own `status` (run for history, and for a submodule through the default
  // `--ignore-submodules=none`) evaluated `filter.process` and clean/smudge drivers; `readGit` is now
  // default-deny and the snapshot calls use `--ignore-submodules=dirty`. The repository below names a marker program for every Git extension point
  // (fsmonitor, pager, editor, ssh, hooks, external diff, textconv, clean/smudge/process filters, merge
  // driver, credential helper, gpg, aliases, an ext:: remote) and every Git surface of the product reads
  // it. The control proves the markers fire when Git itself reads the repository without our flags.
  let dir: string, repo: HostileRepo, s: Scratch, rec: string, head: string;
  beforeAll(async () => {
    s = await startScratch();
    dir = s.dir;
    repo = makeHostileRepo(dir);
    head = execFileSync('git', ['-c', 'core.fsmonitor=false', 'rev-parse', 'HEAD'], { cwd: repo.root, encoding: 'utf8' }).trim();
    rec = await importHostile(s, 'claude-code', repo.root);
    await grantAccess(s, rec);
  });
  afterAll(async () => { await s.close(); });

  it('control: plain git status in the repository does run the planted programs', () => {
    try { execFileSync('git', ['status'], { cwd: repo.root, stdio: 'ignore', timeout: 20_000 }); } catch { /* a helper that prints nothing may upset git */ }
    expect(repo.ran()).toContain('core.fsmonitor');
    for (const name of repo.ran()) rmSync(join(repo.marks, name));
    expect(repo.ran()).toEqual([]);
  });

  it('none of the product’s Git surfaces starts one', async () => {
    const base = `/v1/recordings/${encodeURIComponent(rec)}`;
    const get = (path: string) => s.call(base + path, { headers: s.bearer });
    const branches = (await get('/git/compare-refs')).json;
    const calls = [
      get('/git'), get('/git/snapshot'), get('/git/generation'), get('/git/history'), get('/git/history?q=second&reference=all'),
      get('/git/compare-refs'), get(`/git/compare?base=main&head=${head}`), get(`/git/compare-file?base=main&head=${head}&path=src/b.ts&side=head`),
      get('/git/compare-pulls'), get('/git/compare-remote?pr=1'), get('/git/ref?rev=main'), get(`/git/commit?hash=${head}`),
      get('/workspace/file?path=src/a.ts'), get('/graph'), get('/compare-evidence?path=src/a.ts'),
    ];
    const replies = [];
    for (const call of calls) replies.push(await call);
    // The surfaces actually answered (a refusal for another reason would prove nothing).
    expect(replies[0]!.status).toBe(200);
    expect(replies[1]!.status).toBe(200);
    expect(replies[1]!.text).toContain('src/a.ts');
    expect(replies[2]!.status).toBe(200);
    expect(branches).toBeTruthy();
    expect(repo.ran()).toEqual([]);
  });

  it('refuses a repository whose configuration moves the work tree elsewhere', async () => {
    git(repo.root, 'config', '--local', 'core.worktree', dir.replace(/\\/g, '/'));
    try {
      const reply = await s.call(`/v1/recordings/${encodeURIComponent(rec)}/git/snapshot`, { headers: s.bearer });
      expect(reply.status).toBeGreaterThanOrEqual(400);
      expect(reply.text).not.toContain('mark.cjs');
    } finally { git(repo.root, 'config', '--local', '--unset', 'core.worktree'); }
    expect(repo.ran()).toEqual([]);
  });

  it('and every git invocation in the daemon carries the neutralising flags', () => {
    const source = readFileSync(join(root, 'apps', 'daemon', 'src', 'git-review.ts'), 'utf8');
    for (const flag of ["'--no-pager'", "'--no-replace-objects'", "'--no-optional-locks'", "'--literal-pathspecs'", "'core.fsmonitor=false'", "'diff.external='", 'GIT_TERMINAL_PROMPT', 'GIT_NO_LAZY_FETCH']) expect(source, flag).toContain(flag);
    expect(readFileSync(join(root, 'apps', 'daemon', 'src', 'git-paths.ts'), 'utf8')).toMatch(/--no-ext-diff[\s\S]*--no-textconv/);
    void statSync; void request;
  });
});
