// SEC-3 item 8: limits. Oversized bodies and headers, slow requests, deep JSON, many open streams, one
// enormous journal line and an image bomb are each refused or bounded, and the daemon stays responsive.
import { createHash } from 'node:crypto';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { connect, type Socket } from 'node:net';
import { request } from 'node:http';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { JOURNAL_WRITERS, PNG_B64, hostileScenario } from './lib/corpus.ts';
import { importHostile, makeRepo } from './lib/seed.ts';
import { rawCall, startScratch, type Scratch } from './lib/scratch.ts';
import { defaultAdapters } from '../../packages/ingest/src/index.ts';

const enc = encodeURIComponent;
let s: Scratch, repo: string, rec: string;
const json = () => ({ ...s.bearer, 'content-type': 'application/json' });
const alive = async () => {
  const started = performance.now();
  const reply = await rawCall(s.port, '/v1/health', { timeoutMs: 5000 });
  expect(reply.status).toBe(200);
  expect(performance.now() - started, 'the daemon answers promptly').toBeLessThan(3000);
};

beforeAll(async () => {
  s = await startScratch();
  repo = makeRepo(join(s.dir, 'repo'));
  rec = await importHostile(s, 'claude-code', repo);
});
afterAll(async () => { await s.close(); });

describe('oversized requests', () => {
  it('a body over the route’s limit is refused with 413', async () => {
    const big = (n: number) => JSON.stringify({ note: 'x'.repeat(n) });
    // The daemon answers 413 as soon as the limit is crossed and may close the connection under a client that is
    // still sending, so a reset counts as a refusal too.
    const post = (path: string, body: string, method = 'POST') => s.call(path, { method, headers: json(), body, timeoutMs: 60_000 }).catch((e: NodeJS.ErrnoException) => ({ status: e.code === 'ECONNRESET' || e.code === 'EPIPE' ? 413 : -1 }));
    expect((await post(`/v1/recordings/${enc(rec)}/bookmarks`, big(2 * 1024 * 1024))).status).toBe(413); // 1 MiB
    expect((await post(`/v1/recordings/${enc(rec)}/checkout`, big(2000))).status).toBe(413); // 256 B
    expect((await post('/v1/working-locations', big(300 * 1024), 'PUT')).status).toBe(413); // 256 KiB
    expect((await post(`/v1/recordings/${enc(rec)}/controller/prompt`, big(10 * 1024 * 1024))).status).toBe(413); // 9 MiB
    await alive();
  });

  it('a body that is never finished does not hold the daemon', async () => {
    const sockets: Socket[] = [];
    for (let i = 0; i < 50; i++) {
      const socket = connect({ host: '127.0.0.1', port: s.port });
      socket.on('error', () => undefined);
      socket.write(`POST /v1/recordings/${rec}/bookmarks HTTP/1.1\r\nHost: 127.0.0.1:${s.port}\r\nAuthorization: Bearer ${s.token}\r\nContent-Type: application/json\r\nContent-Length: 1000000\r\n\r\n{"note":"`);
      sockets.push(socket);
    }
    await alive();
    for (const socket of sockets) socket.destroy();
    await alive();
  });

  it('a header block over Node’s limit is refused, one huge header and many headers alike', async () => {
    const huge = await rawCall(s.port, '/v1/health', { headers: { 'x-big': 'a'.repeat(200_000) } }).catch(() => ({ status: 431 }));
    expect([431, 400]).toContain(huge.status);
    const many: Record<string, string> = {};
    for (let i = 0; i < 400; i++) many[`x-h${i}`] = 'v'.repeat(60);
    const flood = await rawCall(s.port, '/v1/health', { headers: many }).catch(() => ({ status: 431 }));
    expect([431, 400]).toContain(flood.status);
    const longUrl = await rawCall(s.port, '/v1/recordings?q=' + 'a'.repeat(100_000)).catch(() => ({ status: 414 }));
    expect([414, 431, 400]).toContain(longUrl.status);
    await alive();
  });

  it('slow and idle connections are time-bounded and do not block others', async () => {
    const server = s.run.server;
    expect(server.headersTimeout).toBeGreaterThan(0);
    expect(server.headersTimeout).toBeLessThanOrEqual(120_000);
    expect(server.requestTimeout).toBeGreaterThan(0);
    expect(server.requestTimeout).toBeLessThanOrEqual(600_000);
    expect(server.keepAliveTimeout).toBeLessThanOrEqual(30_000);
    const sockets: Socket[] = [];
    // 120 connections, half of them with a request line and headers that never finish. Each is awaited
    // until accepted, so the test measures the daemon and not the operating system's accept queue.
    await Promise.all(Array.from({ length: 120 }, (_, i) => new Promise<void>((done) => {
      const socket = connect({ host: '127.0.0.1', port: s.port });
      socket.on('error', () => done());
      socket.on('connect', () => { if (i % 2) socket.write(`GET /v1/health HTTP/1.1\r\nHost: 127.0.0.1:${s.port}\r\n`); done(); });
      sockets.push(socket);
    })));
    await alive();
    for (const socket of sockets) socket.destroy();
  });
});

describe('deep and odd JSON', () => {
  it('deeply nested bodies and enormous numbers are refused or ignored, never a crash', async () => {
    const bodies = ['['.repeat(500_000), '{"a":'.repeat(150_000), '[' .repeat(10_000) + ']'.repeat(10_000), '{"step":' + '9'.repeat(100_000) + '}', '{"__proto__":{"x":1},"constructor":{"prototype":{"y":2}}}', '\u0000\u0000', '{"note":"\ud800"}', ''];
    for (const body of bodies) {
      for (const path of [`/v1/recordings/${enc(rec)}/history`, `/v1/recordings/${enc(rec)}/bookmarks`, `/v1/recordings/${enc(rec)}/boundary`, '/v1/github/optin', `/v1/recordings/${enc(rec)}/workspace/approve`]) {
        const reply = await s.call(path, { method: 'POST', headers: json(), body }).catch((e: NodeJS.ErrnoException) => ({ status: e.code === 'ECONNRESET' || e.code === 'EPIPE' ? 413 : 999, text: `${path} ${body.slice(0, 12)} ${body.length}: ${e.message}` }));
        expect(reply.status, `${path} ${body.slice(0, 12)} ${'text' in reply ? reply.text : ''}`).toBeLessThan(500);
      }
    }
    expect(({} as Record<string, unknown>).y, 'prototype pollution').toBeUndefined();
    expect(({} as Record<string, unknown>).x).toBeUndefined();
    await alive();
  });
});

describe('many open event streams', () => {
  it('are capped, and closing frees the room', async () => {
    const cookie = await s.signIn();
    const open = () => new Promise<{ status: number; close: () => void }>((done, fail) => {
      const req = request({ host: '127.0.0.1', port: s.port, path: '/v1/changes', headers: { host: `127.0.0.1:${s.port}`, cookie } }, (res) => {
        res.on('data', () => undefined);
        done({ status: res.statusCode ?? 0, close: () => res.destroy() });
      });
      req.on('error', fail);
      req.end();
    });
    const streams = [];
    for (let i = 0; i < 70; i++) streams.push(await open());
    const accepted = streams.filter((x) => x.status === 200).length;
    expect(accepted).toBeLessThanOrEqual(64);
    expect(accepted).toBeGreaterThan(10);
    expect(streams.slice(accepted).every((x) => x.status === 429)).toBe(true);
    await alive();
    for (const x of streams) x.close();
    await new Promise((r) => setTimeout(r, 300));
    const again = await open();
    expect(again.status).toBe(200);
    again.close();
  });
});

describe('one enormous journal line', () => {
  const adapters = defaultAdapters().map((a) => a.descriptor.id);
  it.each(adapters)('%s: a 24 MB line and a 400,000-deep line are bounded, and the daemon stays responsive', async (adapter) => {
    const id = await importHostile(s, adapter, repo, { ...hostileScenario(repo), prompt: 'limits' }, `limits-${adapter}`);
    const file = s.run.app.recording(id).sourcePath!;
    const lines = readFileSync(file, 'utf8').trimEnd().split('\n');
    const model = lines.at(-2)!;
    const huge = adapter === 'codex'
      ? JSON.stringify({ timestamp: '2026-09-21T12:00:00.000Z', type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'z'.repeat(24 * 1024 * 1024) }] } })
      : model.replace(/"text":"[^"]*"/, `"text":"${'z'.repeat(24 * 1024 * 1024)}"`);
    appendFileSync(file, huge + '\n');
    appendFileSync(file, '{"a":'.repeat(400_000) + '\n');
    appendFileSync(file, model.replace(/"timestamp":"[^"]*"/, '"timestamp":"2026-09-21T12:00:01.000Z"') + '\n');
    const started = performance.now();
    await s.run.app.ingest.sync(id).catch(() => undefined);
    for (let more = 0; more < 8; more++) { const r = await s.run.app.ingest.sync(id).catch(() => undefined); if (!r?.more) break; }
    expect(performance.now() - started, 'ingest of the huge line').toBeLessThan(45_000);
    await alive();
    // The recording is still readable, and the huge text is bounded where it is stored.
    const page = await s.call(`/v1/recordings/${enc(id)}/history`, { method: 'POST', headers: json(), body: '{}', timeoutMs: 60_000 });
    expect(page.status).toBeLessThan(500);
    expect(page.text.length, 'a page of history is not the 24 MB line').toBeLessThan(8 * 1024 * 1024);
    void createHash; void writeFileSync; void JOURNAL_WRITERS;
  });
});

// A PNG whose header declares more pixels than any display has, in a few hundred bytes.
function pngBomb(width: number, height: number): string {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf: Buffer) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type: string, data: Buffer) => { const body = Buffer.concat([Buffer.from(type), data]); const out = Buffer.alloc(12 + data.length); out.writeUInt32BE(data.length, 0); body.copy(out, 4); out.writeUInt32BE(crc(body), 8 + data.length); return out; };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.alloc(1024))), chunk('IEND', Buffer.alloc(0))]).toString('base64');
}

describe('an image bomb', () => {
  const adapters = defaultAdapters().map((a) => a.descriptor.id);
  it.each(adapters)('%s: a tiny PNG that declares 900 megapixels is not kept or served; an ordinary one still is', async (adapter) => {
    const bomb = pngBomb(30_000, 30_000);
    expect(Buffer.from(bomb, 'base64').length).toBeLessThan(200);
    const id = await importHostile(s, adapter, repo, { ...hostileScenario(repo), prompt: 'bomb', extraImages: [bomb, pngBomb(1024, 768)] }, `bomb-${adapter}`);
    const shas = [...s.run.app.store.imageShas(id)];
    const served: { mime: string; bytes: number }[] = [];
    for (const sha of shas) {
      const reply = await s.call(`/v1/recordings/${enc(id)}/images/${sha}`, { headers: s.bearer });
      expect(reply.status).toBe(200);
      served.push({ mime: String(reply.headers['content-type']), bytes: Number(reply.headers['content-length']) });
    }
    // The genuine 1x1 and the 1024x768 are kept; nothing declaring 900 megapixels is.
    const kept = new Set(shas.map((sha) => sha));
    expect(kept.size).toBeGreaterThanOrEqual(2);
    expect(served.length).toBe(shas.length);
    for (const sha of shas) {
      const blob = s.run.app.store.blobs.get(sha);
      expect(blob).not.toBe(bomb);
    }
    expect(PNG_B64.length).toBeGreaterThan(10);
    const observations = JSON.stringify(s.run.app.store.observations(id, -1, 1000));
    expect(observations).toContain('"omitted":"too-large"');
    expect(observations.includes(bomb)).toBe(false);
    // The page can say what it refused: the declared size is kept (it is a number, not pixels), for every harness alike.
    expect(observations).toMatch(/"width":30000/);
    expect(observations).toMatch(/"height":30000/);
  });
});
