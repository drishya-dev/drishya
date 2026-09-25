import { mkdtempSync, rmSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { App } from '../src/app.ts';
import { startServer, type RunningServer } from '../src/server.ts';

const fixtures = fileURLToPath(new URL('../../../fixtures/synthetic', import.meta.url));
let dir: string;
let s: RunningServer;
let recId: string;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-server-'));
  const app = new App(join(dir, 'data'));
  const r = await app.ingest.importSource('claude-code', join(fixtures, 'claude/checkout-fix.jsonl'));
  app.store.updateRecordingMeta(r.recordingId, { graphRoot: join(fixtures, 'workspace/shop') });
  recId = r.recordingId;
  s = await startServer({ app, port: 0, uiDir: join(dir, 'no-ui'), model: { baseUrl: 'http://model.invalid', nanoModel: 'n', superModel: 's', ultraModel: 'u' } });
});
afterAll(async () => {
  await s.close();
  s.app.close();
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
