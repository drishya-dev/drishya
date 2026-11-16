// SEC-3 item 2: the request gate, for every route.
//
// The route list is read from apps/daemon/src/server.ts itself (lib/routes.ts), so a route added later
// is covered the day it is added, and a route the parser cannot read fails the suite.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { request } from 'node:http';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { describeRoutes, extractRoutes, type Route } from './lib/routes.ts';
import { startScratch, rawCall, type Reply, type Scratch } from './lib/scratch.ts';

const routes = extractRoutes();
const WRITES = ['POST', 'PUT', 'PATCH', 'DELETE'];
const FAKE = 'deadbeefdeadbeefdeadbeefdeadbeef';
let s: Scratch;
let cookie: string;

beforeAll(async () => {
  s = await startScratch();
  cookie = await s.signIn();
});
afterAll(async () => { await s.close(); });

const noCors = (r: Reply) => Object.keys(r.headers).filter((k) => k.startsWith('access-control-'));
const writeBody = (route: Route) => (WRITES.includes(route.method) ? { body: '{}' } : {});
const json = { 'content-type': 'application/json' };
/** The route list as the gate sees it: the gate's own two routes are checked separately below. */
const gated = routes.filter((r) => !(r.method === 'GET' && r.template === '/v1/health') && !(r.method === 'POST' && r.template === '/v1/session'));

describe('the route list', () => {
  it('is read from the server and is complete enough to trust', () => {
    expect(routes.length).toBeGreaterThanOrEqual(90);
    for (const needle of ['GET /v1/changes', 'GET /v1/recordings/{rec}/images/x', 'POST /v1/recordings/{rec}/controller/prompt', 'GET /v1/recordings/{rec}/workspace/file', 'GET /v1/recordings/{rec}/export']) {
      expect(describeRoutes(routes), needle).toContain(needle);
    }
  });

  it('every route the parser found exists in the server (a wrong path would be "no such route")', async () => {
    const missing: string[] = [];
    for (const route of routes) {
      if (route.template === '/v1/changes') continue; // a stream; checked below
      const reply = await s.call(route.path(FAKE), { method: route.method, headers: { ...s.bearer, ...(WRITES.includes(route.method) ? json : {}) }, ...writeBody(route) });
      if (reply.status === 404 && /no such route/.test(reply.text)) missing.push(`${route.method} ${route.template}`);
      expect(noCors(reply), `${route.method} ${route.template}`).toEqual([]);
    }
    expect(missing).toEqual([]);
  });

  it('the dispatcher sits behind the gate: no route is reachable before the checks run', () => {
    const source = readFileSync(fileURLToPath(new URL('../../apps/daemon/src/server.ts', import.meta.url)), 'utf8');
    const handler = source.slice(source.indexOf('const handleRequest'), source.indexOf('const timings'));
    const order = ['unexpected host', 'unexpected origin', 'serveStatic', 'authed(req)', 'JSON body required', 'await route('].map((marker) => handler.indexOf(marker));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // `route(` is called from exactly one place.
    expect(source.match(/await route\(/g)).toHaveLength(1);
  });
});

describe('no token, no data', () => {
  it.each(gated.map((r) => [`${r.method} ${r.template}`, r] as const))('%s answers 401 with no credentials', async (_name, route) => {
    const reply = await s.call(route.path(FAKE), { method: route.method, headers: WRITES.includes(route.method) ? json : {}, ...writeBody(route) });
    expect(reply.status).toBe(401);
    expect(reply.headers['content-type']).not.toMatch(/event-stream/);
    expect(noCors(reply)).toEqual([]);
  });

  it('answers 401 for an unknown /v1 path too, so a route’s existence is not revealed', async () => {
    const reply = await s.call('/v1/no-such-thing/at/all');
    expect(reply.status).toBe(401);
    const signed = await s.call('/v1/no-such-thing/at/all', { headers: s.bearer });
    expect(signed.status).toBe(404);
  });

  it('the only open API routes are the version probe and the sign-in exchange', async () => {
    const health = await s.call('/v1/health');
    expect(health.status).toBe(200);
    expect(Object.keys(health.json).sort()).toEqual(['ok', 'version']);
    const exchange = await s.call('/v1/session', { method: 'POST', headers: json, body: '{}' });
    expect(exchange.status).toBe(401);
  });

  it.each([
    ['empty', ''],
    ['a prefix of the real token', 'x'],
    ['the token with a character added', 'x'],
    ['the token upper-cased', 'x'],
    ['a different length', 'x'],
  ])('rejects a launch token that is %s', async (name, _) => {
    const wrong = name === 'empty' ? '' : name.includes('prefix') ? s.token.slice(0, 20) : name.includes('added') ? s.token + 'a' : name.includes('upper') ? s.token.toUpperCase() : 'a'.repeat(7);
    for (const path of ['/v1/config', '/v1/recordings']) {
      const reply = await s.call(path, { headers: { authorization: `Bearer ${wrong}` } });
      expect(reply.status).toBe(401);
    }
    const exchange = await s.call('/v1/session', { method: 'POST', headers: { ...json, authorization: `Bearer ${wrong}` }, body: '{}' });
    expect(exchange.status).toBe(401);
  });

  it('does not accept the token in a query string, a cookie value or another scheme', async () => {
    expect((await s.call(`/v1/config?token=${s.token}`)).status).toBe(401);
    expect((await s.call(`/v1/config?access_token=${s.token}&authorization=${s.token}`)).status).toBe(401);
    expect((await s.call('/v1/config', { headers: { cookie: `drishya_session=${s.token}` } })).status).toBe(401);
    expect((await s.call('/v1/config', { headers: { authorization: `Basic ${Buffer.from(`x:${s.token}`).toString('base64')}` } })).status).toBe(401);
    expect((await s.call('/v1/config', { headers: { 'x-drishya-token': s.token } })).status).toBe(401);
  });

  it('compares the launch token only in constant time', () => {
    const source = readFileSync(fileURLToPath(new URL('../../apps/daemon/src/server.ts', import.meta.url)), 'utf8');
    expect(source).toMatch(/function safeEqual[\s\S]{0,200}timingSafeEqual\(/);
    // Every use of the token goes through safeEqual: no `===`, `!==`, `includes` or `startsWith` on it.
    expect(source).not.toMatch(/(?:===|!==|==|!=)\s*token\b|\btoken\s*(?:===|!==|==|!=)/);
    expect(source).not.toMatch(/\btoken\.(?:includes|startsWith|endsWith|localeCompare)\(|\.(?:includes|startsWith)\(token\)/);
    expect(source.match(/safeEqual\(bearer, token\)/g)?.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Host and Origin', () => {
  const HOSTS = (port: number) => ['evil.example', `evil.example:${port}`, '127.0.0.1', `127.0.0.1:${port + 1}`, `127.0.0.1.evil.example:${port}`, `localhost.evil.example:${port}`, `0.0.0.0:${port}`, `192.168.1.5:${port}`, `[::2]:${port}`, ''];

  it.each(routes.map((r) => [`${r.method} ${r.template}`, r] as const))('%s answers 421 to a foreign Host, even with a valid session', async (_name, route) => {
    for (const host of HOSTS(s.port).slice(0, 4)) {
      const reply = await s.call(route.path(FAKE), { method: route.method, host, headers: { ...s.bearer, cookie, ...(WRITES.includes(route.method) ? json : {}) }, ...writeBody(route), timeoutMs: 5000 });
      expect(reply.status, `Host ${JSON.stringify(host)}`).toBe(421);
      expect(noCors(reply)).toEqual([]);
    }
  });

  it('refuses every DNS-rebinding style Host', async () => {
    for (const host of HOSTS(s.port)) {
      const reply = await s.call('/v1/config', { host: host || 'x', headers: { ...s.bearer, cookie } });
      expect(reply.status, `Host ${JSON.stringify(host)}`).toBe(421);
    }
    // And the static UI shell, which is served without a token, is refused for a foreign Host too.
    expect((await s.call('/', { host: 'evil.example' })).status).toBe(421);
  });

  it.each(routes.map((r) => [`${r.method} ${r.template}`, r] as const))('%s answers 403 to a foreign Origin, even with a valid session', async (_name, route) => {
    const origins = ['http://evil.example', 'null', `http://127.0.0.1:${s.port + 1}`, `https://127.0.0.1:${s.port}`, `http://evil.example:${s.port}`, 'file://'];
    for (const origin of origins) {
      const reply = await s.call(route.path(FAKE), { method: route.method, headers: { ...s.bearer, cookie, origin, ...(WRITES.includes(route.method) ? json : {}) }, ...writeBody(route) });
      expect(reply.status, `Origin ${origin}`).toBe(403);
      expect(noCors(reply)).toEqual([]);
    }
  });

  it('the static UI shell refuses a foreign Origin too', async () => {
    expect((await s.call('/', { headers: { origin: 'http://evil.example' } })).status).toBe(403);
  });

  it('accepts only the exact origins of this server', async () => {
    for (const origin of [`http://127.0.0.1:${s.port}`, `http://localhost:${s.port}`]) {
      const reply = await s.call('/v1/config', { host: origin.replace('http://', ''), headers: { ...s.bearer, origin } });
      expect(reply.status).toBe(200);
      expect(noCors(reply)).toEqual([]);
    }
  });
});

describe('no cross-origin allowance, no preflight', () => {
  it.each(routes.map((r) => [`${r.method} ${r.template}`, r] as const))('%s: a preflight is refused and carries no Access-Control header', async (_name, route) => {
    for (const origin of ['http://evil.example', `http://127.0.0.1:${s.port}`]) {
      const reply = await s.call(route.path(FAKE), { method: 'OPTIONS', headers: { origin, 'access-control-request-method': route.method, 'access-control-request-headers': 'content-type, authorization' } });
      // A foreign origin is refused outright; this server's own origin gets no CORS answer either.
      if (origin.includes('evil')) expect(reply.status, `preflight from ${origin}`).toBeGreaterThanOrEqual(400);
      expect(noCors(reply)).toEqual([]);
    }
  });

  it('a successful response, an error, a stream and a static file carry no Access-Control header', async () => {
    const replies = [
      await s.call('/v1/config', { headers: s.bearer }),
      await s.call('/v1/nope', { headers: s.bearer }),
      await s.call('/v1/health'),
      await s.call('/'),
      await s.call('/assets/index-abcd1234.js'),
    ];
    for (const reply of replies) expect(noCors(reply)).toEqual([]);
  });
});

describe('writes need a JSON content type', () => {
  const writes = gated.filter((r) => WRITES.includes(r.method) && !(r.method === 'DELETE' && r.template === '/v1/session'));
  it.each(writes.map((r) => [`${r.method} ${r.template}`, r] as const))('%s refuses text/plain, a form and multipart (415) even with a valid session', async (_name, route) => {
    for (const type of ['text/plain', 'text/plain;charset=UTF-8', 'application/x-www-form-urlencoded', 'multipart/form-data; boundary=x', undefined]) {
      const reply = await s.call(route.path(FAKE), { method: route.method, headers: { ...s.bearer, cookie, 'content-type': type }, body: 'a=b' });
      expect(reply.status, String(type)).toBe(415);
    }
  });

  it('reads of the same routes need no content type', async () => {
    expect((await s.call('/v1/config', { headers: { ...s.bearer } })).status).toBe(200);
  });
});

describe('the event stream and the images need the same session', () => {
  const stream = (headers: Record<string, string> = {}) => new Promise<{ status: number; type: string }>((done, fail) => {
    const req = request({ host: '127.0.0.1', port: s.port, path: '/v1/changes', headers: { host: `127.0.0.1:${s.port}`, ...headers } }, (res) => {
      const out = { status: res.statusCode ?? 0, type: String(res.headers['content-type'] ?? '') };
      res.destroy();
      done(out);
    });
    req.on('error', fail);
    req.end();
  });

  it('GET /v1/changes: 401 without a session, 200 event-stream with one', async () => {
    expect(await stream()).toMatchObject({ status: 401 });
    expect((await stream()).type).not.toMatch(/event-stream/);
    expect(await stream({ cookie })).toMatchObject({ status: 200, type: 'text/event-stream' });
    expect(await stream({ cookie: 'drishya_session=' + '0'.repeat(48) })).toMatchObject({ status: 401 });
  });

  it('the image routes answer 401 without a session', async () => {
    for (const path of [`/v1/recordings/${FAKE}/images/${'a'.repeat(64)}`, `/v1/recordings/${FAKE}/workspace/image?operation=x`]) {
      expect((await s.call(path)).status).toBe(401);
      expect((await s.call(path, { headers: { cookie: 'drishya_session=' + '0'.repeat(48) } })).status).toBe(401);
    }
  });
});

describe('sessions', () => {
  it('sign-out ends the session, and only that one', async () => {
    const first = await s.signIn();
    const second = await s.signIn();
    expect((await s.call('/v1/config', { headers: { cookie: first } })).status).toBe(200);
    const out = await s.call('/v1/session', { method: 'DELETE', headers: { cookie: first, ...json } });
    expect(out.status).toBe(200);
    expect(String(out.headers['set-cookie'])).toMatch(/Max-Age=0/);
    expect((await s.call('/v1/config', { headers: { cookie: first } })).status).toBe(401);
    expect((await s.call('/v1/config', { headers: { cookie: second } })).status).toBe(200);
  });

  it('the cookie is HttpOnly, SameSite=Strict, host-only and never the launch token', async () => {
    const reply = await s.call('/v1/session', { method: 'POST', headers: { ...s.bearer, ...json }, body: '{}' });
    const header = String(reply.headers['set-cookie']);
    expect(header).toMatch(/;\s*HttpOnly/);
    expect(header).toMatch(/;\s*SameSite=Strict/);
    expect(header).not.toMatch(/;\s*Domain=/i);
    expect(header).toMatch(/;\s*Path=\//);
    expect(header).toMatch(/Max-Age=\d+/);
    const sid = /drishya_session=([a-f0-9]+)/.exec(header)![1]!;
    expect(sid).not.toBe(s.token);
    expect(sid).toHaveLength(48); // 192 bits
    expect(JSON.stringify(reply.json)).not.toContain(s.token);
  });

  it('a session expires when idle, when old, and the number of sessions is capped', async () => {
    let clock = 1_000_000;
    const t = await startScratch({ now: () => clock, sessionIdleMs: 1000, sessionMaxAgeMs: 10_000, maxSessions: 3 });
    try {
      const a = await t.signIn();
      expect((await t.call('/v1/config', { headers: { cookie: a } })).status).toBe(200);
      clock += 1500; // idle
      expect((await t.call('/v1/config', { headers: { cookie: a } })).status).toBe(401);
      const b = await t.signIn();
      for (let i = 0; i < 11; i++) { clock += 900; expect((await t.call('/v1/config', { headers: { cookie: b } })).status).toBe(200); }
      clock += 900; // active, but past the maximum age
      expect((await t.call('/v1/config', { headers: { cookie: b } })).status).toBe(401);
      const cookies = [];
      for (let i = 0; i < 5; i++) cookies.push(await t.signIn());
      const alive = [];
      for (const c of cookies) alive.push((await t.call('/v1/config', { headers: { cookie: c } })).status === 200);
      expect(alive.filter(Boolean).length).toBeLessThanOrEqual(3);
      expect(alive.at(-1)).toBe(true);
    } finally { await t.close(); }
  });

  it('a sign-out request from another origin cannot end a session', async () => {
    const mine = await s.signIn();
    const reply = await s.call('/v1/session', { method: 'DELETE', headers: { cookie: mine, origin: 'http://evil.example', ...json } });
    expect(reply.status).toBe(403);
    expect((await s.call('/v1/config', { headers: { cookie: mine } })).status).toBe(200);
  });
});

describe('session-bound change streams', () => {
  it.each(['sign-out', 'idle expiry', 'age expiry', 'eviction'])('ends only the affected stream on %s', async (reason) => {
    let clock = 1_000_000;
    const t = await startScratch({ now: () => clock, sessionIdleMs: 100, sessionMaxAgeMs: 200, maxSessions: 2 });
    const abort = new AbortController();
    const connect = async (headers: Record<string, string>) => {
      const signal = AbortSignal.any([abort.signal, AbortSignal.timeout(3000)]);
      const res = await fetch(t.run.url + '/v1/changes', { headers, signal });
      expect(res.status).toBe(200);
      const stream = res.body!.getReader();
      let initial = '';
      while (!initial.includes('event: sync') || !initial.endsWith('\n\n')) {
        const chunk = await stream.read();
        if (chunk.done) throw new Error('change stream ended before sync');
        initial += Buffer.from(chunk.value).toString('utf8');
      }
      return stream;
    };
    try {
      const first = await t.signIn();
      const revoked = await connect({ cookie: first });
      if (reason === 'age expiry') {
        clock += 90;
        expect((await t.call('/v1/config', { headers: { cookie: first } })).status).toBe(200);
        clock += 90;
        expect((await t.call('/v1/config', { headers: { cookie: first } })).status).toBe(200);
      }
      clock += 1;
      const second = await t.signIn();
      const active = await connect({ cookie: second });
      const bearer = await connect({ ...t.bearer, cookie: first });
      if (reason === 'sign-out') {
        expect((await t.call('/v1/session', { method: 'DELETE', headers: { cookie: first } })).status).toBe(200);
      } else if (reason === 'eviction') {
        await t.signIn();
      } else {
        clock += reason === 'idle expiry' ? 100 : 20;
      }

      t.run.app.ingest.emit('health', { recordingId: 'synthetic-session' });
      expect((await revoked.read()).done).toBe(true);
      for (const stream of [active, bearer]) {
        const next = await stream.read();
        expect(next.done).toBe(false);
        expect(Buffer.from(next.value!).toString()).toContain('event: health');
      }
    } finally {
      abort.abort();
      await t.close();
    }
  });
});

describe('the launch token and the session id stay out of every sink', () => {
  it('never appear in a response body or header, a log line, or a file the daemon wrote', async () => {
    const sid = (await s.signIn()).split('=')[1]!;
    const sample = [] as Reply[];
    for (const route of routes.filter((r) => r.method === 'GET' && r.template !== '/v1/changes')) sample.push(await s.call(route.path(FAKE), { headers: { cookie: `drishya_session=${sid}`, referer: `http://127.0.0.1:${s.port}/#token=${s.token}` } }));
    sample.push(await s.call('/v1/nope', { headers: { authorization: `Bearer ${s.token}x` } }));
    sample.push(await s.call('/?token=' + s.token));
    for (const reply of sample) {
      const everything = reply.text + JSON.stringify(reply.headers);
      expect(everything.includes(s.token)).toBe(false);
      expect(everything.includes(sid)).toBe(false);
    }
    expect(s.logs.join('\n').includes(s.token)).toBe(false);
    expect(s.logs.join('\n').includes(sid)).toBe(false);
    // Disk: the store directory, including SQLite's write-ahead log, holds neither.
    const walk = (dir: string): string[] => readdirSync(dir).flatMap((name) => { const p = join(dir, name); return statSync(p).isDirectory() ? walk(p) : [p]; });
    for (const file of walk(s.dataDir)) {
      const bytes = readFileSync(file);
      expect(bytes.includes(s.token), `token in ${file.slice(s.dataDir.length)}`).toBe(false);
      expect(bytes.includes(sid), `session id in ${file.slice(s.dataDir.length)}`).toBe(false);
    }
  });

  it('the launch link keeps the token in the fragment, which a browser never sends', () => {
    expect(s.run.launchUrl).toBe(`${s.run.url}/#token=${s.token}`);
    expect(new URL(s.run.launchUrl).search).toBe('');
  });
});

describe('response headers', () => {
  const expectHardened = (reply: Reply, label: string) => {
    expect(reply.headers['x-content-type-options'], label).toBe('nosniff');
    expect(reply.headers['referrer-policy'], label).toBe('no-referrer');
    expect(reply.headers['x-frame-options'], label).toBe('DENY');
    expect(reply.headers['cross-origin-opener-policy'], label).toBe('same-origin');
    expect(reply.headers['cross-origin-resource-policy'], label).toBe('same-origin');
    const csp = String(reply.headers['content-security-policy']);
    for (const directive of ["default-src 'self'", "script-src 'self'", "frame-ancestors 'none'", "base-uri 'none'", "form-action 'none'", "connect-src 'self'"]) expect(csp, label).toContain(directive);
    expect(csp, label).not.toMatch(/script-src[^;]*'unsafe-(?:inline|eval)'/);
    expect(csp, label).not.toMatch(/(?:default|script|connect|img|font|frame|object)-src[^;]*(?:\*|https?:)/);
  };

  it('every kind of response carries them: ok, error, refused, static, not found', async () => {
    expectHardened(await s.call('/v1/config', { headers: s.bearer }), 'ok');
    expectHardened(await s.call('/v1/config'), '401');
    expectHardened(await s.call('/v1/config', { host: 'evil.example' }), '421');
    expectHardened(await s.call('/v1/config', { headers: { ...s.bearer, origin: 'http://evil.example' } }), '403');
    expectHardened(await s.call('/v1/nope', { headers: s.bearer }), '404');
    expectHardened(await s.call('/v1/config', { method: 'POST', headers: { ...s.bearer, 'content-type': 'text/plain' }, body: 'x' }), '415');
    expectHardened(await s.call('/'), 'static shell');
    expectHardened(await s.call('/assets/index-abcd1234.js'), 'static asset');
  });

  it('API responses are JSON, never HTML, and are not cached', async () => {
    for (const path of ['/v1/config', '/v1/recordings', '/v1/nope']) {
      const reply = await s.call(path, { headers: s.bearer });
      expect(String(reply.headers['content-type'])).toMatch(/^application\/json/);
      expect(String(reply.headers['cache-control'])).toBe('no-store');
    }
  });
});
