import { mkdtempSync, rmSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { App } from '../src/app.ts';
import { errorBody, startServer, writeEvent, type RunningServer } from '../src/server.ts';

const fixtures = fileURLToPath(new URL('../../../fixtures/synthetic', import.meta.url));
let dir: string;
let s: RunningServer;
let recId: string;
/** What the fake model received, so tests can compare it with the consent preview. */
const sent: { model: string; messages: unknown }[] = [];
const MODEL_REPLY = '{"summary":"s [E1]","claims":[{"text":"t","evidence":["E1"]}],"unknowns":[]}';

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-server-'));
  const app = new App(join(dir, 'data'));
  const r = await app.ingest.importSource('claude-code', join(fixtures, 'claude/checkout-fix.jsonl'));
  app.store.updateRecordingMeta(r.recordingId, { graphRoot: join(fixtures, 'workspace/shop') });
  recId = r.recordingId;
  s = await startServer({ app, port: 0, uiDir: join(dir, 'no-ui'), model: { baseUrl: 'http://model.invalid', nanoModel: 'n', superModel: 's', ultraModel: 'u' },
    complete: async (model, messages) => {
      sent.push({ model, messages });
      return MODEL_REPLY;
    },
  });
});
afterAll(async () => {
  await s.close();
  await s.app.close();
  rmSync(dir, { recursive: true, force: true });
});

/** Raw request so Host and Origin can be set exactly (fetch forbids both). */
function call(path: string, opts: { method?: string; headers?: Record<string, string>; body?: unknown } = {}): Promise<{ status: number; body: any; headers: Record<string, unknown> }> {
  const u = new URL(s.url);
  return new Promise((ok, fail) => {
    const req = request({ host: '127.0.0.1', port: u.port, path, method: opts.method ?? 'GET', headers: { host: u.host, ...opts.headers } }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        let body: unknown = data;
        try {
          body = JSON.parse(data);
        } catch {
          // not JSON
        }
        ok({ status: res.statusCode ?? 0, body, headers: res.headers });
      });
    });
    req.on('error', fail);
    if (opts.body !== undefined) req.write(JSON.stringify(opts.body));
    req.end();
  });
}
const auth = () => ({ authorization: `Bearer ${s.token}` });

it('bounds and validates paged history requests before reduction', async () => {
  for (const body of [{ count: -1 }, { step: 'ten' }, { start: 0.5 }, { pinnedPassageIds: [1] }, { filter: { tool: {} } }]) {
    expect((await call(`/v1/recordings/${recId}/history`, { method: 'POST', headers: { ...auth(), 'content-type': 'application/json' }, body })).status).toBe(400);
  }
  const result = await call(`/v1/recordings/${recId}/history`, { method: 'POST', headers: { ...auth(), 'content-type': 'application/json' }, body: { count: 1, start: 0 } });
  expect(result.status).toBe(200);
  expect(result.body.loadedPassageIds).toHaveLength(1);
  const usage = await call('/v1/storage', { headers: auth() });
  expect(usage.body.bytes).toBeGreaterThan(0);
  expect(usage.body.automaticDeletion).toBe(false);
});

it('waits for an in-flight handler before its caller closes SQLite', async () => {
  const isolated = mkdtempSync(join(tmpdir(), 'drishya-close-'));
  const app = new App(join(isolated, 'data'));
  let entered!: () => void;
  let release!: () => void;
  const started = new Promise<void>((done) => { entered = done; });
  const gate = new Promise<void>((done) => { release = done; });
  app.ingest.discoverReport = async () => {
    entered();
    await gate;
    app.store.listRecordings(); // would fail if the store had already been closed
    return { sources: [], errors: [] };
  };
  const running = await startServer({ app, port: 0 });
  try {
    const request = fetch(`${running.url}/v1/sources`, { headers: { authorization: `Bearer ${running.token}` } }).catch(() => undefined);
    await started;
    let finished = false;
    const closing = running.close().then(() => { finished = true; });
    await new Promise((done) => setTimeout(done, 20));
    expect(finished).toBe(false);
    release();
    await closing;
    await app.close();
    await request;
  } finally {
    release();
    const target = resolve(isolated);
    if (!target.startsWith(resolve(tmpdir()) + sep)) throw new Error('test directory escaped system temp');
    rmSync(target, { recursive: true, force: true });
  }
});

describe('local API security', () => {
  it('refuses unexpected Host headers (DNS rebinding)', async () => {
    expect((await call('/v1/recordings', { headers: { host: 'evil.example:80', ...auth() } })).status).toBe(421);
  });

  it('refuses cross-site origins', async () => {
    expect((await call('/v1/recordings', { headers: { origin: 'https://evil.example', ...auth() } })).status).toBe(403);
  });

  it('requires the launch token or a session', async () => {
    expect((await call('/v1/recordings')).status).toBe(401);
    expect((await call('/v1/recordings', { headers: { authorization: 'Bearer wrong' } })).status).toBe(401);
    expect((await call('/v1/recordings', { headers: auth() })).status).toBe(200);
  });

  it('exchanges the token for an HttpOnly, SameSite=Strict session cookie', async () => {
    const r = await call('/v1/session', { method: 'POST', headers: auth() });
    const cookie = String((r.headers['set-cookie'] as string[])[0]);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect((await call('/v1/recordings', { headers: { cookie: cookie.split(';')[0]! } })).status).toBe(200);
  });

  it('requires a JSON content type for state changes (no form CSRF)', async () => {
    expect((await call(`/v1/recordings/${recId}/live`, { method: 'POST', headers: auth(), body: { on: false } })).status).toBe(415);
  });

  it('only imports sources that discovery found — no arbitrary file reads', async () => {
    const r = await call('/v1/import', { method: 'POST', headers: { ...auth(), 'content-type': 'application/json' }, body: { path: join(fixtures, '../../package.json') } });
    expect(r.status).toBe(400);
  });

  it('serves security headers', async () => {
    const r = await call('/v1/health');
    expect(r.headers['content-security-policy']).toMatch(/default-src 'self'/);
    expect(r.headers['x-frame-options']).toBe('DENY');
  });
});

describe('local API', () => {
  it('serves the projection, artifacts, graph and search', async () => {
    const p = (await call(`/v1/recordings/${recId}/projection`, { headers: auth() })).body;
    expect(p.operations.length).toBeGreaterThan(5);
    const art = p.artifacts[0];
    const a = (await call(`/v1/recordings/${recId}/artifacts/${art.id}`, { headers: auth() })).body;
    expect(a.text.length).toBeGreaterThan(0);
    const g = (await call(`/v1/recordings/${recId}/graph`, { headers: auth() })).body;
    expect(g.temporal).toBe('current');
    expect(g.nodes.length).toBe(14);
    const hits = (await call(`/v1/recordings/${recId}/search?q=falsy`, { headers: auth() })).body.hits;
    expect(hits.length).toBeGreaterThan(0);
  });

  it('previews exactly what a model call would send, without sending it', async () => {
    const p = (await call(`/v1/recordings/${recId}/projection`, { headers: auth() })).body;
    const edit = p.operations.find((o: { kind: string }) => o.kind === 'edit');
    const r = await call(`/v1/recordings/${recId}/explain`, { method: 'POST', headers: { ...auth(), 'content-type': 'application/json' }, body: { operationId: edit.id } });
    expect(r.status).toBe(200);
    expect(r.body.preview.model).toBe('u');
    expect(r.body.preview.messages[1].content).toContain('FOCUS');
  });

  it('exports a bundle with no local paths and no path-derived ids', async () => {
    const r = await call(`/v1/recordings/${recId}/export`, { headers: auth() });
    expect(r.body.format).toBe('drishya-replay');
    expect(JSON.stringify(r.body)).not.toMatch(/(rec|obs|src)_[0-9a-f]{16}/);
    expect(r.body.recording.id).toMatch(/^rec_x\d{4}$/);
    expect(JSON.stringify(r.body)).not.toContain(fixtures.replace(/\\/g, '/'));
    expect(JSON.stringify(r.body)).not.toContain(JSON.stringify(fixtures).slice(1, -1));
  });
});

const post = (path: string, body: unknown) => call(path, { method: 'POST', headers: { ...auth(), 'content-type': 'application/json' }, body });
const GH = 'gh' + 'p_' + 'Zz9Yy8Xx7Ww6Vv5Uu4Tt3Ss2Rr1Qq0Pp9Oo8';

// Audit A04: a model call sends only what the person reviewed, to the model and endpoint shown.
describe('model consent', () => {
  const editId = async () => (await call(`/v1/recordings/${recId}/projection`, { headers: auth() })).body.operations.find((o: { kind: string }) => o.kind === 'edit').id;

  it('refuses a send whose consent does not match the current payload, and shows the new preview', async () => {
    const before = sent.length;
    const r = await post(`/v1/recordings/${recId}/explain`, { operationId: await editId(), consent: 'stale-digest' });
    expect(r.status).toBe(409);
    expect(r.body.preview.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(sent.length).toBe(before);
  });

  it('a bare confirm without a reviewed digest sends nothing', async () => {
    const before = sent.length;
    const r = await post(`/v1/recordings/${recId}/explain`, { operationId: await editId(), confirm: true });
    expect(r.body.preview).toBeDefined();
    expect(r.body.result).toBeUndefined();
    expect(sent.length).toBe(before);
  });

  it('sends exactly the previewed messages to the previewed model, then serves the cache', async () => {
    const opId = await editId();
    const { preview } = (await post(`/v1/recordings/${recId}/explain`, { operationId: opId })).body;
    const r = await post(`/v1/recordings/${recId}/explain`, { operationId: opId, consent: preview.digest });
    expect(r.status).toBe(200);
    expect(sent.at(-1)).toEqual({ model: preview.model, messages: preview.messages });
    const again = (await post(`/v1/recordings/${recId}/explain`, { operationId: opId })).body;
    expect(again.cached.summary).toBe(r.body.result.summary);
  });

  it('never serves a cached answer made from a different payload', async () => {
    const opId = await editId();
    s.app.store.putGenerated(recId, `explain:${opId}`, { identity: { digest: 'f'.repeat(64) }, result: { summary: 'old' } });
    expect((await post(`/v1/recordings/${recId}/explain`, { operationId: opId })).body.cached).toBeUndefined();
  });

  it('previews the exact labels payload too', async () => {
    const { preview } = (await post(`/v1/recordings/${recId}/labels`, {})).body;
    expect(preview.messages.length).toBe(2);
    await post(`/v1/recordings/${recId}/labels`, { consent: preview.digest });
    expect(sent.at(-1)).toEqual({ model: preview.model, messages: preview.messages });
  });
});

// Audit A02: user notes and error text are sinks too.
describe('other sinks', () => {
  it('redacts bookmark notes before storing them', async () => {
    await post(`/v1/recordings/${recId}/bookmarks`, { step: 1, note: `remember ${GH}` });
    const marks = (await call(`/v1/recordings/${recId}/bookmarks`, { headers: auth() })).body.bookmarks;
    expect(JSON.stringify(marks)).not.toContain(GH);
    expect(JSON.stringify(marks)).toContain('[REDACTED:github-token]');
  });

  it('redacts error messages before they reach a response', () => {
    const r = errorBody(new Error(`upstream said ${GH}`));
    expect(r.status).toBe(500);
    expect(JSON.stringify(r.body)).not.toContain(GH);
  });
});

// B1 (audit A05): capture health and discovery errors are part of the API, not silent.
describe('capture health over the API', () => {
  it('lists sources with a per-adapter error list', async () => {
    const r = await call('/v1/sources', { headers: auth() });
    expect(Array.isArray(r.body.sources)).toBe(true);
    expect(Array.isArray(r.body.errors)).toBe(true);
  });

  it("reports each recording's capture state", async () => {
    const list = (await call('/v1/recordings', { headers: auth() })).body.recordings;
    expect(list.find((x: { id: string }) => x.id === recId).health).toMatchObject({ state: 'stopped', live: false });
    expect((await call(`/v1/recordings/${recId}`, { headers: auth() })).body.recording.health.state).toBe('stopped');
  });

  it('streams health changes as their own SSE event', async () => {
    const u = new URL(s.url);
    const got = await new Promise<string>((ok, fail) => {
      const req = request({ host: '127.0.0.1', port: u.port, path: '/v1/changes', headers: { host: u.host, ...auth() } }, (res) => {
        let data = '';
        res.on('data', (c) => {
          data += c;
          if (data.includes('event: health')) {
            req.destroy();
            ok(data);
          }
        });
      });
      req.on('error', (e) => (e.message.includes('socket hang up') ? undefined : fail(e)));
      req.end();
      setTimeout(() => void post(`/v1/recordings/${recId}/live`, { on: true }), 100);
      setTimeout(() => fail(new Error('no health event')), 4000);
    });
    await post(`/v1/recordings/${recId}/live`, { on: false });
    expect(got).toMatch(/event: health\ndata: \{"type":"health","recordingId":"rec_[0-9a-f]+","health":\{"state":"following"/);
  });
});

/** Reads SSE text until `until` matches, then disconnects. */
function readEvents(until: RegExp, after?: () => void, ms = 4000): Promise<string> {
  const u = new URL(s.url);
  return new Promise<string>((ok, fail) => {
    const req = request({ host: '127.0.0.1', port: u.port, path: '/v1/changes', headers: { host: u.host, ...auth() } }, (res) => {
      let data = '';
      res.on('data', (c) => {
        data += c;
        if (until.test(data)) {
          req.destroy();
          ok(data);
        }
      });
    });
    req.on('error', (e) => (e.message.includes('socket hang up') ? undefined : fail(e)));
    req.end();
    if (after) setTimeout(after, 100);
    setTimeout(() => fail(new Error(`timed out waiting for ${until}`)), ms);
  });
}

// B1b (audit A07): every (re)connect starts with the current revisions, so a viewer converges
// even when nothing new is written after it reconnects.
describe('revisions and reconnect', () => {
  it('opens every SSE stream with the current revision of each recording', async () => {
    const data = await readEvents(/event: sync\ndata: .*\n\n/);
    const sync = JSON.parse(/event: sync\ndata: (.*)\n/.exec(data)![1]!);
    expect(sync.revisions[recId]).toBe(s.app.store.getRecording(recId)!.revision);
    expect(sync.revisions[recId]).toBeGreaterThan(0);
  });

  it('serves revisions on their own and on each recording', async () => {
    const r = await call('/v1/revisions', { headers: auth() });
    expect(r.body.revisions[recId]).toBeGreaterThan(0);
    const list = (await call('/v1/recordings', { headers: auth() })).body.recordings;
    expect(list.find((x: { id: string }) => x.id === recId).revision).toBe(r.body.revisions[recId]);
  });

  it('drops a subscriber that stops reading instead of buffering for it', () => {
    let ended = false;
    const slow = { writableLength: 2 * 1024 * 1024, destroyed: false, write: () => false, end: () => (ended = true) };
    expect(writeEvent(slow as never, 'event: change\ndata: {}\n\n', 1024 * 1024)).toBe(false);
    expect(ended).toBe(true);
    const fine = { writableLength: 0, destroyed: false, write: () => true, end: () => (ended = true) };
    expect(writeEvent(fine as never, 'x', 1024 * 1024)).toBe(true);
    expect(writeEvent(fine as never, 'long event', 5)).toBe(false);
  });
});

// B1b: query parameters are validated and bounded, never passed through as NaN.
describe('request bounds', () => {
  it('rejects non-numeric paging parameters', async () => {
    expect((await call(`/v1/recordings/${recId}/observations?limit=abc`, { headers: auth() })).status).toBe(400);
    expect((await call(`/v1/recordings/${recId}/observations?after=-1&limit=5`, { headers: auth() })).body.observations).toHaveLength(5);
  });
});

// B1b (audit A10): sessions expire, are capped, and can be revoked. The launch token itself stays
// valid for the launch: it is the credential printed to the person who started the server.
describe('sessions', () => {
  let clock = 0;
  let t: RunningServer;
  beforeAll(async () => {
    t = await startServer({ app: s.app, port: 0, uiDir: join(dir, 'no-ui'), now: () => clock, sessionIdleMs: 1000, sessionMaxAgeMs: 10_000, maxSessions: 3 });
  });
  afterAll(() => t.close());
  const req = (path: string, opts: { method?: string; headers?: Record<string, string> } = {}) =>
    new Promise<{ status: number; headers: Record<string, unknown> }>((ok, fail) => {
      const u = new URL(t.url);
      const r = request({ host: '127.0.0.1', port: u.port, path, method: opts.method ?? 'GET', headers: { host: u.host, ...opts.headers } }, (res) => {
        res.resume();
        res.on('end', () => ok({ status: res.statusCode ?? 0, headers: res.headers }));
      });
      r.on('error', fail);
      r.end();
    });
  const signIn = async () => {
    const r = await req('/v1/session', { method: 'POST', headers: { authorization: `Bearer ${t.token}` } });
    return String((r.headers['set-cookie'] as string[])[0]);
  };
  const cookie = (c: string) => ({ cookie: c.split(';')[0]! });

  it('sets a bounded cookie lifetime', async () => {
    expect(await signIn()).toMatch(/Max-Age=10;/);
  });

  it('expires a session left idle, and an old one regardless of use', async () => {
    clock = 0;
    const c = await signIn();
    clock = 900;
    expect((await req('/v1/recordings', { headers: cookie(c) })).status).toBe(200);
    clock = 1800; // 900 ms since last use: still within the idle window
    expect((await req('/v1/recordings', { headers: cookie(c) })).status).toBe(200);
    clock = 3000; // idle for 1.2 s
    expect((await req('/v1/recordings', { headers: cookie(c) })).status).toBe(401);
    const d = await signIn();
    for (clock = 3000; clock <= 12_600; clock += 800) expect((await req('/v1/recordings', { headers: cookie(d) })).status).toBe(200);
    clock = 13_100; // used constantly (never idle), but past the 10 s maximum age
    expect((await req('/v1/recordings', { headers: cookie(d) })).status).toBe(401);
  });

  it('caps the number of sessions, dropping the least recently used', async () => {
    clock = 50_000;
    const first = await signIn();
    for (let i = 0; i < 3; i++) await signIn();
    expect((await req('/v1/recordings', { headers: cookie(first) })).status).toBe(401);
  });

  it('revokes a session on sign-out', async () => {
    clock = 60_000;
    const c = await signIn();
    expect((await req('/v1/session', { method: 'DELETE', headers: cookie(c) })).status).toBe(200);
    expect((await req('/v1/recordings', { headers: cookie(c) })).status).toBe(401);
  });
});

// B2 (audit A15): an artifact response says what range it returned, how much exists, whether it
// was cut, and when content is unavailable, instead of an empty string that reads as "protected".
describe('artifact slices', () => {
  it('describes the returned range and the whole', async () => {
    const p = (await call(`/v1/recordings/${recId}/projection`, { headers: auth() })).body;
    const art = p.artifacts.find((a: { blob?: string; lineCount: number }) => a.blob && a.lineCount > 3);
    const r = (await call(`/v1/recordings/${recId}/artifacts/${art.id}?start=1&count=2`, { headers: auth() })).body;
    expect(r).toMatchObject({ available: true, start: 1, returnedLines: 2, hasMore: true, truncated: false });
    expect(r.totalLines).toBeGreaterThan(3);
    expect(r.text.split('\n')).toHaveLength(2);
  });

  it('reports content that was never captured, or is no longer stored, as unavailable', async () => {
    const p = structuredClone(s.app.projection(recId));
    const a = p.artifacts.find((x) => x.blob)!;
    expect(s.app.artifactSlice(p, a.id, 0, 10)).toMatchObject({ available: true });
    a.blob = undefined;
    expect(s.app.artifactSlice(p, a.id, 0, 10)).toMatchObject({ available: false, reason: 'not-captured', text: '' });
    a.blob = '0'.repeat(64);
    expect(s.app.artifactSlice(p, a.id, 0, 10)).toMatchObject({ available: false, reason: 'no-longer-stored' });
  });
});

// P2-A: the reading boundary over the API. It never moves on its own; only an explicit mark does.
describe('reading boundary', () => {
  it('starts unmarked, accepts a mark within the recording, and rejects anything else', async () => {
    const id = recId;
    expect((await call(`/v1/recordings/${id}/boundary`, { headers: auth() })).body.boundary).toBeNull();
    const last = s.app.projection(id).lastSequence;
    const r = await post(`/v1/recordings/${id}/boundary`, { sequence: last - 3 });
    expect(r.status).toBe(200);
    expect(r.body.boundary).toMatchObject({ sequence: last - 3 });
    expect((await post(`/v1/recordings/${id}/boundary`, { sequence: last })).body.boundary).toMatchObject({ sequence: last, previousSequence: last - 3 });
    expect((await post(`/v1/recordings/${id}/boundary`, { sequence: last + 1 })).status).toBe(400);
    expect((await post(`/v1/recordings/${id}/boundary`, { sequence: 'x' })).status).toBe(400);
    expect((await call(`/v1/recordings/${id}/boundary`, { headers: auth() })).body.boundary.sequence).toBe(last);
  });
});

// P2-C: verification freshness over the API, computed by the history worker on the whole session.
describe('verification freshness', () => {
  it('reports the test runs recorded after a change, and 404s for anything that is not a change', async () => {
    const p = (await call(`/v1/recordings/${recId}/projection`, { headers: auth() })).body;
    const edit = p.operations.find((o: { kind: string }) => o.kind === 'edit');
    const r = await call(`/v1/recordings/${recId}/verification/${encodeURIComponent(edit.id)}`, { headers: auth() });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ operationId: edit.id, verdict: 'checked-after' });
    expect(r.body.lastCheck.status).toBe('ok');
    const test = p.operations.find((o: { kind: string }) => o.kind === 'test');
    expect((await call(`/v1/recordings/${recId}/verification/${encodeURIComponent(test.id)}`, { headers: auth() })).status).toBe(404);
  });
});
