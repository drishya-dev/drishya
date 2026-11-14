// SEC-3 item 3: file access. Only granted checkouts are readable, nothing outside them is, protected
// files stay protected, no route writes into a project or a harness directory, journals are read-only.
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { extractRoutes } from './lib/routes.ts';
import { git, grantAccess, importHostile, makeRepo, write } from './lib/seed.ts';
import { rawCall, startScratch, type Scratch } from './lib/scratch.ts';
import { JOURNAL_WRITERS, hostileScenario } from './lib/corpus.ts';

const OUTSIDE = 'OUTSIDE-CANARY-7f3a91';
const SECRET = 'PROTECTED-CANARY-4c2e08';
let s: Scratch, repo: string, outside: string, rec: string, other: string, otherRepo: string;
let linkNotes: string[] = [];

const enc = encodeURIComponent;
const file = (id: string, path: string, route = 'file') => s.call(`/v1/recordings/${enc(id)}/workspace/${route}?path=${path}`, { headers: s.bearer });

beforeAll(async () => {
  s = await startScratch();
  repo = makeRepo(join(s.dir, 'repo'));
  outside = join(s.dir, 'outside');
  write(join(outside, 'secret.txt'), OUTSIDE + '\n');
  write(join(s.dir, 'outside.txt'), OUTSIDE + '\n');
  write(join(repo, '.env'), `TOKEN=${SECRET}\n`);
  write(join(repo, '.env.local'), `TOKEN=${SECRET}\n`);
  write(join(repo, 'id_rsa'), `-----BEGIN OPENSSH PRIVATE KEY-----\n${SECRET}\n`);
  write(join(repo, 'config', 'secrets.json'), `{"k":"${SECRET}"}\n`);
  write(join(repo, '.local', 'notes.txt'), SECRET + '\n');
  write(join(repo, 'docs', 'ok.md'), '# ok\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'files');
  // A link to a file and a link (junction on Windows) to a directory, both leaving the checkout.
  try { symlinkSync(join(s.dir, 'outside.txt'), join(repo, 'link-file.txt'), 'file'); } catch (e) { linkNotes.push(`file symlink not created: ${(e as NodeJS.ErrnoException).code}`); }
  try { symlinkSync(outside, join(repo, 'link-dir'), process.platform === 'win32' ? 'junction' : 'dir'); } catch (e) { linkNotes.push(`directory link not created: ${(e as NodeJS.ErrnoException).code}`); }
  rec = await importHostile(s, 'claude-code', repo);
  otherRepo = makeRepo(join(s.dir, 'other-repo'));
  write(join(otherRepo, 'other-only.txt'), 'OTHER-REPO-CANARY\n');
  git(otherRepo, 'add', '-A');
  git(otherRepo, 'commit', '-q', '-m', 'other');
  other = await importHostile(s, 'codex', otherRepo);
});
afterAll(async () => { await s.close(); });

describe('workspace reads need a grant, and only for the granted checkout', () => {
  it('nothing is readable before the person grants access', async () => {
    for (const path of ['src/a.ts', 'README.md', 'docs/ok.md']) {
      expect((await file(rec, path)).status, path).toBe(403);
      expect((await file(rec, path, 'document')).status, path).toBe(403);
    }
  });

  it('a grant for one session reads that checkout and nothing of another', async () => {
    await grantAccess(s, rec);
    const ok = await file(rec, 'src/a.ts');
    expect(ok.status).toBe(200);
    expect(ok.text).toContain('export const a = 2');
    expect((await file(rec, 'other-only.txt')).status).toBeGreaterThanOrEqual(400);
    expect((await file(other, 'other-only.txt')).status).toBe(403); // the second session was never granted
  });

  it('revoking ends the reading at once', async () => {
    const json = { ...s.bearer, 'content-type': 'application/json' };
    await s.call(`/v1/recordings/${enc(rec)}/workspace/revoke`, { method: 'POST', headers: json, body: '{}' });
    expect((await file(rec, 'src/a.ts')).status).toBe(403);
    await grantAccess(s, rec);
    expect((await file(rec, 'src/a.ts')).status).toBe(200);
  });
});

describe('paths that leave the checkout or name a protected file are refused', () => {
  const attacks: [string, string][] = [
    ['dot-dot', '../outside.txt'], ['dot-dot deeper', 'src/../../outside.txt'], ['dot-dot into a folder', '../outside/secret.txt'],
    ['encoded dot-dot', '..%2foutside.txt'], ['encoded dots', '%2e%2e/outside.txt'], ['double-encoded', '%252e%252e/outside.txt'], ['double-encoded slash', '..%252foutside.txt'],
    ['backslash dot-dot', '..%5coutside.txt'], ['mixed separators', '..%2f..%5coutside.txt'],
    ['absolute posix', '/etc/passwd'], ['absolute drive', 'C:/Windows/win.ini'], ['absolute drive backslash', 'C:%5cWindows%5cwin.ini'], ['drive-relative', 'C:outside.txt'],
    ['UNC', '%5c%5clocalhost%5cc$%5cWindows%5cwin.ini'], ['UNC with slashes', '//localhost/c$/Windows/win.ini'], ['file URL', 'file:///etc/passwd'],
    ['null byte', 'src/a.ts%00.png'], ['null byte before dots', '%00../outside.txt'],
    ['NTFS stream', 'src/a.ts::$DATA'], ['NTFS named stream', 'src/a.ts:secret'], ['NTFS directory stream', 'src::$INDEX_ALLOCATION'],
    ['DOS device', 'CON'], ['DOS device with extension', 'nul.txt'], ['DOS device in folder', 'src/aux'], ['device path', '%5c%5c.%5cC:%5cWindows%5cwin.ini'], ['trailing dot', 'src/a.ts.'], ['trailing space', 'src/a.ts%20'], ['8.3 short name', 'PROGRA~1'],
    ['dot segment', 'src/./a.ts'], ['empty segment', 'src//a.ts'], ['empty path', ''], ['root', '.'], ['.git config', '.git/config'], ['.git HEAD', '.git/HEAD'], ['inside .git', 'src/.git/config'],
    ['.env', '.env'], ['.env.local', '.env.local'], ['private key', 'id_rsa'], ['secrets json', 'config/secrets.json'], ['.local', '.local/notes.txt'], ['.local encoded', '.local%2fnotes.txt'],
    ['link to a file outside', 'link-file.txt'], ['link to a folder outside', 'link-dir/secret.txt'], ['link folder itself', 'link-dir'],
  ];
  it.each(attacks)('%s', async (_name, path) => {
    for (const route of ['file', 'document']) {
      const reply = await file(rec, path, route);
      expect(reply.status, `${route} ${path}`).toBeGreaterThanOrEqual(400);
      expect(reply.status, `${route} ${path}`).toBeLessThan(500);
      expect(reply.text).not.toContain(OUTSIDE);
      expect(reply.text).not.toContain(SECRET);
    }
  });

  it('the same paths in a query that repeats the parameter or hides it in the path segment', async () => {
    for (const q of [`path=src/a.ts&path=../outside.txt`, `path[]=../outside.txt`, `Path=../outside.txt`, `path=..%2f..%2foutside.txt&start=0`]) {
      const reply = await s.call(`/v1/recordings/${enc(rec)}/workspace/file?${q}`, { headers: s.bearer });
      expect(reply.text).not.toContain(OUTSIDE);
    }
    const encodedRec = await s.call(`/v1/recordings/${enc(rec)}%2f..%2f..%2fconfig`, { headers: s.bearer });
    expect(encodedRec.status).toBeGreaterThanOrEqual(400);
  });

  it('control: a permitted file in the same checkout is still readable', async () => {
    const reply = await file(rec, 'docs/ok.md');
    expect([200, 403]).toContain(reply.status);
    expect((await file(rec, 'src/a.ts')).status).toBe(200);
  });

  it('reports which link kinds this machine could create', () => {
    // Not an assertion about the product: so the PR can say which cases ran here.
    expect(Array.isArray(linkNotes)).toBe(true);
    expect(s.launches).toEqual([]); // and no native harness was started by anything above
  });
});

describe('protected files stay out of every other surface', () => {
  it('Git review never carries a protected file’s content', async () => {
    write(join(repo, '.env'), `TOKEN=${SECRET}-changed\n`);
    write(join(repo, 'config', 'secrets.json'), `{"k":"${SECRET}-changed"}\n`);
    const snapshot = await s.call(`/v1/recordings/${enc(rec)}/git/snapshot`, { headers: s.bearer });
    expect(snapshot.status).toBe(200);
    expect(snapshot.text).not.toContain(SECRET);
    expect(snapshot.text).not.toContain('.env');
  });

  it('the file map lists no protected file', async () => {
    const graph = await s.call(`/v1/recordings/${enc(rec)}/graph`, { headers: s.bearer });
    expect(graph.status).toBe(200);
    const nodes = (graph.json as { nodes: { id: string; path: string }[] }).nodes;
    const protectedNodes = nodes.filter((n) => /(^|\/)(\.env|id_rsa|secrets\.json)/.test(n.path));
    // A protected file may appear by name only, marked omitted, never with an id derived from content.
    for (const node of protectedNodes) expect(node.id, node.path).toMatch(/^\[OMITTED/);
    expect(graph.text).not.toContain(SECRET);
  });
});

describe('git routes take refs and paths from the request', () => {
  const marker = () => join(s.dir, 'created-by-option');
  const base = () => `/v1/recordings/${enc(rec)}/git`;
  const hostile = ['--output=' + 'X', '--upload-pack=x', '-h', '--help', '--all', '-1', '--exec=x', 'main;echo', 'main`id`', '$(id)', 'HEAD@{1.year.ago}', 'main..', '..', 'refs/../../x', 'main:src/a.ts', ':/x', '@{-1}', '*', 'a b', 'main%0aHEAD', '\u202Emain'];

  it('a ref that starts with a dash or holds an option never becomes one', async () => {
    for (const value of hostile) {
      const rev = value.replace('X', marker().replace(/\\/g, '/'));
      for (const path of [`/ref?rev=${enc(rev)}`, `/commit?hash=${enc(rev)}`, `/compare?base=${enc(rev)}&head=main`, `/compare?base=main&head=${enc(rev)}`, `/compare-file?base=${enc(rev)}&head=main&path=src/a.ts`, `/compare-file?base=main&head=main&path=${enc(rev)}`]) {
        const reply = await s.call(base() + path, { headers: s.bearer });
        expect(reply.status, `${path}`).toBeLessThan(500);
      }
    }
    expect(existsSync(marker())).toBe(false);
  });

  it('a path argument cannot read outside the repository through compare-file', async () => {
    for (const path of ['../outside.txt', '/etc/passwd', 'C:/Windows/win.ini', '..%5coutside.txt', '.env', '.git/config']) {
      const reply = await s.call(`${base()}/compare-file?base=main&head=main&path=${enc(path)}`, { headers: s.bearer });
      expect(reply.text).not.toContain(OUTSIDE);
      expect(reply.text).not.toContain(SECRET);
    }
  });
});

describe('the static UI route cannot leave the UI directory', () => {
  it('traversal, encoding and a sibling folder with the same prefix', async () => {
    write(join(s.dir, 'ui-secret', 'canary.txt'), OUTSIDE);
    write(join(s.dir, 'home', 'canary.txt'), OUTSIDE);
    for (const path of ['/..%2fui-secret%2fcanary.txt', '/%2e%2e/ui-secret/canary.txt', '/../ui-secret/canary.txt', '/assets/..%5c..%5cui-secret%5ccanary.txt', '/assets/../../home/canary.txt', '//ui-secret/canary.txt', '/%252e%252e/ui-secret/canary.txt', '/..%2f..%2f..%2f..%2f..%2f..%2fWindows%2fwin.ini', '/..%2f..%2f..%2fetc%2fpasswd', '/assets/%00', '/index.html%00.js', '/C:/Windows/win.ini', '/%5c%5clocalhost%5cc$%5cWindows%5cwin.ini']) {
      const reply = await s.call(path);
      expect(reply.text, path).not.toContain(OUTSIDE);
      expect(reply.text, path).not.toMatch(/\[fonts\]|root:x:0/);
      expect(reply.status, path).toBeLessThan(500);
    }
  });

  it('serves the app shell for an unknown path, never a directory listing', async () => {
    const reply = await s.call('/assets/');
    expect(reply.text).not.toMatch(/Index of|<li><a/);
  });
});

describe('no route writes into a project, a harness directory or a journal', () => {
  const digestTree = (root: string): Map<string, string> => {
    const out = new Map<string, string>();
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.name === 'node_modules') continue;
        if (entry.isSymbolicLink()) { out.set(relative(root, full), 'link'); continue; }
        if (entry.isDirectory()) { out.set(relative(root, full) + '/', 'dir'); walk(full); continue; }
        const stat = statSync(full);
        out.set(relative(root, full), `${stat.size}:${stat.mtimeMs}:${createHash('sha256').update(readFileSync(full)).digest('hex')}`);
      }
    };
    walk(root);
    return out;
  };

  it('every route, every method, with a plausible body, leaves the repository and the harness folders byte-identical', async () => {
    // A harness home with real-looking journals, as the person's own would be.
    const harnessHome = join(s.home, '.claude', 'projects', 'p');
    mkdirSync(harnessHome, { recursive: true });
    JOURNAL_WRITERS['claude-code']!.writer(join(harnessHome, 'session.jsonl'), hostileScenario(repo));
    const codexHome = join(s.home, '.codex', 'sessions');
    JOURNAL_WRITERS.codex!.writer(join(codexHome, 'rollout-x.jsonl'), hostileScenario(repo));
    const watched = [repo, otherRepo, join(s.home, '.claude'), join(s.home, '.codex')];
    const before = watched.map(digestTree);
    const json = { ...s.bearer, 'content-type': 'application/json' };
    const bodies = ['{}', '{"path":"src/a.ts","text":"x","root":"x","prompt":"x","enabled":true,"sequence":0,"operation":"x","on":false,"remember":false}'];
    for (const route of extractRoutes()) {
      if (route.template === '/v1/changes' || (route.method === 'DELETE' && route.template === '/v1/recordings/{rec}') || route.template === '/v1/session') continue;
      for (const body of bodies) {
        const reply = await rawCall(s.port, route.path(rec) + (route.method === 'GET' ? '?path=src/a.ts&q=x&root=x' : ''), { method: route.method, headers: json, body: route.method === 'GET' ? undefined : body, timeoutMs: 30_000 });
        expect(reply.status, `${route.method} ${route.template}`).toBeLessThan(600);
      }
    }
    // Deleting a recording forgets Drishya's copy and nothing else.
    expect((await rawCall(s.port, `/v1/recordings/${enc(other)}`, { method: 'DELETE', headers: json })).status).toBe(200);
    const after = watched.map(digestTree);
    for (let i = 0; i < watched.length; i++) {
      const gone = [...before[i]!.keys()].filter((k) => !after[i]!.has(k));
      const changed = [...before[i]!.entries()].filter(([k, v]) => after[i]!.has(k) && after[i]!.get(k) !== v).map(([k]) => k);
      const added = [...after[i]!.keys()].filter((k) => !before[i]!.has(k));
      expect({ dir: relative(s.dir, watched[i]!), gone, changed, added }).toEqual({ dir: relative(s.dir, watched[i]!), gone: [], changed: [], added: [] });
    }
  });

  it('a read-only journal is imported, synced and forgotten without being opened for writing', async () => {
    const journal = join(s.dir, 'journals', 'readonly', 'session.jsonl');
    JOURNAL_WRITERS['claude-code']!.writer(journal, hostileScenario(repo));
    chmodSync(journal, 0o444);
    const hashBefore = createHash('sha256').update(readFileSync(journal)).digest('hex');
    const mtimeBefore = statSync(journal).mtimeMs;
    const id = (await s.run.app.ingest.importSource('claude-code', journal)).recordingId;
    await s.run.app.ingest.sync(id).catch(() => undefined);
    await s.call(`/v1/recordings/${enc(id)}`, { method: 'DELETE', headers: { ...s.bearer, 'content-type': 'application/json' } });
    expect(createHash('sha256').update(readFileSync(journal)).digest('hex')).toBe(hashBefore);
    expect(statSync(journal).mtimeMs).toBe(mtimeBefore);
    chmodSync(journal, 0o644);
  });

  it('no source file opens a journal or a project file for writing', () => {
    // Static guard on the readers: capture and ingest code never opens anything with a write flag.
    const roots = ['packages/ingest/src', 'packages/adapter-claude/src', 'packages/adapter-codex/src', 'packages/capture-core/src'];
    const writeFlag = /\b(?:open|openSync|createWriteStream)\s*\([^)]*['"`](?:w|a|r\+|w\+|a\+|wx|ax)['"`]|\bappendFile(?:Sync)?\s*\(|\bwriteFile(?:Sync)?\s*\(|\bunlink(?:Sync)?\s*\(|\brm(?:Sync)?\s*\(|\btruncate(?:Sync)?\s*\(/;
    const offenders: string[] = [];
    const walk = (dir: string) => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isDirectory()) walk(p); else if (/\.ts$/.test(e.name) && writeFlag.test(readFileSync(p, 'utf8'))) offenders.push(p); } };
    for (const r of roots) walk(join(process.cwd(), r));
    expect(offenders.map((p) => relative(process.cwd(), p))).toEqual([]);
  });
});
