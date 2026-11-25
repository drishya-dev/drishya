// SEC-3 item 6: outbound traffic. With default settings nothing leaves loopback; each opt-in is listed
// with exactly what it sends; no page loads anything from another host; there is no update check.
import net from 'node:net';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { GhRun } from '../../apps/daemon/src/github-links.ts';
import { PAYLOADS } from './lib/corpus.ts';
import { extractRoutes } from './lib/routes.ts';
import { grantAccess, importHostile, makeRepo } from './lib/seed.ts';
import { startScratch, type Scratch } from './lib/scratch.ts';
import { defaultAdapters } from '../../packages/ingest/src/index.ts';

const root = process.cwd();
const enc = encodeURIComponent;
const LOOPBACK = /^(?:127\.\d+\.\d+\.\d+|localhost|::1|\[::1\])$/i;

/** Every socket this process opens as a client, by destination. */
const connections: { host: string; port: number }[] = [];
const fetches: string[] = [];
const realConnect = net.Socket.prototype.connect;
const realFetch = globalThis.fetch;
beforeAll(() => {
  net.Socket.prototype.connect = function (this: net.Socket, ...args: unknown[]) {
    const first = args[0] as unknown;
    let host = 'localhost', port = 0;
    if (first && typeof first === 'object') { const o = first as { host?: string; port?: number; path?: string }; host = o.host ?? (o.path ? 'ipc' : 'localhost'); port = Number(o.port ?? 0); }
    else if (typeof first === 'number') { port = first; host = typeof args[1] === 'string' ? args[1] : 'localhost'; }
    connections.push({ host, port });
    return (realConnect as (...a: unknown[]) => net.Socket).apply(this, args);
  } as typeof net.Socket.prototype.connect;
  globalThis.fetch = ((input: unknown, init?: unknown) => { fetches.push(String(input)); return (realFetch as (...a: unknown[]) => Promise<Response>)(input, init); }) as typeof fetch;
});
afterAll(() => { net.Socket.prototype.connect = realConnect; globalThis.fetch = realFetch; });

const outbound = () => connections.filter((c) => c.host !== 'ipc' && !LOOPBACK.test(c.host));
const toSink = () => connections.filter((c) => c.port === 9);

describe('default settings: a full walk leaves nothing outside loopback', () => {
  let s: Scratch;
  const ghCalls: string[][] = [];
  const fakeGh: GhRun = async (args) => { ghCalls.push(args); return args[0] === '--version' ? 'gh version 0.0.0' : JSON.stringify({}); };
  beforeAll(async () => { s = await startScratch({ gh: fakeGh }); });
  afterAll(async () => { await s.close(); });

  it('Home, a session, Files, Changes, the Git graph, search, Settings and an export make no outside connection', async () => {
    const repo = makeRepo(join(s.dir, 'repo'));
    const recs: string[] = [];
    for (const adapter of defaultAdapters().map((a) => a.descriptor.id)) recs.push(await importHostile(s, adapter, repo));
    await grantAccess(s, recs[0]!);
    connections.length = 0; fetches.length = 0;
    const json = { ...s.bearer, 'content-type': 'application/json' };
    for (const route of extractRoutes()) {
      if (['/v1/changes', '/v1/session', '/v1/github/optin', '/v1/import', '/v1/github/item'].includes(route.template)) continue;
      if (route.method === 'DELETE') continue;
      for (const rec of recs) {
        await s.call(route.path(rec) + (route.method === 'GET' ? '?q=hello&path=src/a.ts&url=https://github.com/o/r/pull/1' : ''), { method: route.method, headers: json, body: route.method === 'GET' ? undefined : '{}', timeoutMs: 30_000 });
      }
    }
    await s.call(`/v1/recordings/${enc(recs[0]!)}/search?q=pwned`, { headers: s.bearer });
    await s.call(`/v1/recordings/${enc(recs[0]!)}/export`, { headers: s.bearer });
    await s.call('/v1/search-library?q=hostile', { headers: s.bearer });
    await s.call('/v1/sources', { headers: s.bearer });
    expect(outbound()).toEqual([]);
    expect(toSink(), 'a remote image URL, link or payload was fetched').toEqual([]);
    expect(fetches.filter((u) => !/^https?:\/\/(?:127\.0\.0\.1|localhost)/.test(u))).toEqual([]);
    expect(ghCalls).toEqual([]); // gh is not started at all until the person opts in
  });

  it('the hostile corpus names remote hosts, and Drishya fetched none of them', () => {
    expect(PAYLOADS.filter((p) => p.text.includes('127.0.0.1:9')).length).toBeGreaterThan(5);
    expect(toSink()).toEqual([]);
  });
});

describe('each opt-in, and exactly what it sends', () => {
  it('GitHub cards: off by default; when on, only the person’s own gh runs, with a fixed argument list, for a github.com pull-request or issue URL', async () => {
    const calls: string[][] = [];
    const s = await startScratch({ gh: async (args) => { calls.push(args); return args[0] === '--version' ? 'gh version 9' : JSON.stringify({ title: 't', state: 'OPEN', number: 7, url: 'https://github.com/o/r/pull/7', author: { login: 'a' } }); } });
    try {
      const json = { ...s.bearer, 'content-type': 'application/json' };
      expect((await s.call('/v1/github/status', { headers: s.bearer })).json).toMatchObject({ enabled: false });
      // Off: a card request is refused and gh is not run.
      const off = await s.call(`/v1/github/item?url=${enc('https://github.com/o/r/pull/7')}`, { headers: s.bearer });
      expect(off.json).toEqual({ status: 'disabled' });
      expect(calls).toEqual([]);
      expect((await s.call('/v1/github/optin', { method: 'POST', headers: json, body: JSON.stringify({ enabled: true }) })).status).toBe(200);
      // Only exact github.com pull/issue shapes are accepted: anything else never reaches gh.
      for (const url of ['https://evil.example/o/r/pull/7', 'http://github.com/o/r/pull/7', 'https://github.com.evil.example/o/r/pull/7', 'https://github.com/o/r/blob/main/x', 'javascript:alert(1)', 'file:///etc/passwd', 'https://github.com/--help/r/pull/1', 'https://github.com/o/--output=x/pull/1']) {
        calls.length = 0;
        const reply = await s.call(`/v1/github/item?url=${enc(url)}`, { headers: s.bearer });
        expect(reply.status < 500, url).toBe(true);
        expect(calls.filter((c) => c[0] !== '--version'), url).toEqual([]);
      }
      // A trailing path or query on a valid pull-request address is ignored: only owner, repo and number are ever sent.
      calls.length = 0;
      await s.call(`/v1/github/item?url=${enc('https://github.com/o/r/pull/8/../../x?y=1#z')}`, { headers: s.bearer });
      expect(calls.filter((c) => c[0] !== '--version').map((c) => c.slice(0, 5).join(' '))).toEqual(['pr view 8 --repo o/r']);
      calls.length = 0;
      const ok = await s.call(`/v1/github/item?url=${enc('https://github.com/o/r/pull/7')}`, { headers: s.bearer });
      expect(ok.status).toBe(200);
      const sent = calls.filter((c) => c[0] !== '--version');
      expect(sent.length).toBe(1);
      // What leaves: the owner/repo/number the person's own page already names, through their signed-in gh. No token of ours exists.
      expect(sent[0]).toEqual(expect.arrayContaining(['pr', 'view']));
      expect(sent[0]!.join(' ')).toContain('o/r');
      expect(sent[0]!.join(' ')).not.toContain(s.token);
      expect(sent[0]!.every((a) => typeof a === 'string')).toBe(true);
    } finally { await s.close(); }
  });

  it('there is no update check and no telemetry endpoint anywhere in the product source', () => {
    const hosts = new Set<string>();
    const walk = (dir: string) => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isDirectory()) { if (!['node_modules', 'dist', 'test'].includes(e.name)) walk(p); } else if (/\.(ts|tsx)$/.test(e.name)) for (const m of readFileSync(p, 'utf8').matchAll(/https?:\/\/([A-Za-z0-9.-]+)/g)) hosts.add(m[1]!); } };
    for (const dir of ['apps/daemon/src', 'apps/ui/src', 'packages/adapter-claude/src', 'packages/adapter-codex/src', 'packages/capture-core/src', 'packages/contracts/src', 'packages/indexer/src', 'packages/ingest/src', 'packages/privacy/src', 'packages/projection/src', 'packages/scene/src', 'packages/store/src']) if (existsSync(join(root, dir))) walk(join(root, dir));
    // github.com: the link shape GitHub cards accept; w3.org: the SVG namespace; the rest are this machine.
    expect([...hosts].sort()).toEqual(['127.0.0.1', 'github.com', 'localhost', 'www.w3.org']);
    const source = [...Array(1)].map(() => readFileSync(join(root, 'apps/daemon/src/server.ts'), 'utf8')).join('');
    expect(source).not.toMatch(/\b(?:fetch|https?\.request|https?\.get)\s*\(/);
    expect(source).not.toMatch(/telemetry|analytics|sentry|posthog|mixpanel|segment\.io|update-check|checkForUpdate/i);
  });

  it('no outbound client exists in the daemon or the packages: no fetch, no http(s).request, no sockets, no DNS, no WebSocket', () => {
    const offenders: string[] = [];
    const client = /(?<![.\w])fetch\s*\(|\bhttps?\.(?:request|get)\s*\(|from 'node:https'|from 'node:tls'|from 'node:dgram'|from 'node:dns|from 'node:net'|\bnew WebSocket\b|\bXMLHttpRequest\b|net\.connect|net\.createConnection/;
    const walk = (dir: string) => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isDirectory()) { if (!['node_modules', 'dist', 'test'].includes(e.name)) walk(p); } else if (/\.ts$/.test(e.name) && client.test(readFileSync(p, 'utf8'))) offenders.push(p.slice(root.length + 1).replace(/\\/g, '/')); } };
    for (const dir of ['apps/daemon/src', 'packages']) walk(join(root, dir));
    // EMBED, reviewed: the worker wraps the pipe it inherited on fd 3 in a net.Socket. It never connects anywhere.
    const embed = readFileSync(join(root, 'apps/daemon/src/embed-runtime.ts'), 'utf8');
    expect(embed.match(/new Socket\(/g)).toEqual(['new Socket(']);
    expect(embed).toContain('new Socket({fd: 3,');
    expect(embed).not.toMatch(/\.connect\(|createConnection|createServer|\blisten\(/);
    expect(offenders.filter((file) => file !== 'apps/daemon/src/embed-runtime.ts')).toEqual([]);
  });
});

describe('the built page loads nothing from another host', () => {
  const dist = join(root, 'apps', 'ui', 'dist');
  const built = existsSync(join(dist, 'index.html'));
  it.skipIf(!built)('index.html, the stylesheets and the scripts name only this origin', () => {
    const index = readFileSync(join(dist, 'index.html'), 'utf8');
    expect(index).not.toMatch(/(?:src|href)\s*=\s*["']?(?:https?:)?\/\//i);
    expect(index).not.toMatch(/<link[^>]+rel=["']?(?:preconnect|dns-prefetch|prefetch|preload)[^>]+(?:https?:)?\/\//i);
    const files: string[] = [];
    const walk = (dir: string) => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isDirectory()) walk(p); else files.push(p); } };
    walk(dist);
    const css = files.filter((f) => f.endsWith('.css'));
    expect(css.length).toBeGreaterThan(0);
    for (const file of css) {
      const text = readFileSync(file, 'utf8');
      expect(text, file).not.toMatch(/@import\s+(?:url\()?["']?(?:https?:)?\/\//i);
      expect(text, file).not.toMatch(/url\(\s*["']?(?:https?:)?\/\//i);
    }
    // The scripts may mention hosts as link targets or XML namespaces; each distinct one is reviewed here.
    const hosts = new Set<string>();
    for (const file of files.filter((f) => /\.(?:js|mjs|html)$/.test(f))) for (const m of readFileSync(file, 'utf8').matchAll(/https?:\/\/([A-Za-z0-9.-]+)/g)) hosts.add(m[1]!.replace(/\.$/, ''));
    const allowed = new Set(['127.0.0.1', 'localhost', 'github.com', 'www.w3.org', 'w3.org', 'react.dev', 'reactjs.org', 'drishya.dev', 'example.com', 'example.invalid']);
    expect([...hosts].filter((h) => !allowed.has(h) && !h.endsWith('.invalid') && !h.endsWith('.example')).sort()).toEqual([]);
  });
});
