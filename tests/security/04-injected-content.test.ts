// SEC-3 item 4 (daemon side): hostile content goes through every harness adapter's real ingest path and
// out of every API route as data. The rendering side (nothing executes in the page) is
// tests/browser/security-injected.spec.ts, which uses the same corpus.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { defaultAdapters } from '../../packages/ingest/src/index.ts';
import { JOURNAL_WRITERS, PAYLOADS, SVG_B64 } from './lib/corpus.ts';
import { extractRoutes } from './lib/routes.ts';
import { importHostile, makeRepo } from './lib/seed.ts';
import { startScratch, type Reply, type Scratch } from './lib/scratch.ts';

const enc = encodeURIComponent;
const adapters = defaultAdapters().map((a) => a.descriptor.id);
let s: Scratch, repo: string;
const recordings = new Map<string, string>();
const json = () => ({ ...s.bearer, 'content-type': 'application/json' });

beforeAll(async () => {
  s = await startScratch();
  repo = makeRepo(join(s.dir, 'repo'));
  for (const adapter of adapters) if (JOURNAL_WRITERS[adapter]) recordings.set(adapter, await importHostile(s, adapter, repo));
});
afterAll(async () => { await s.close(); });

describe('every harness has a hostile journal', () => {
  it('lists an entry in the corpus for each adapter the ingest package registers', () => {
    // Adding a harness adds an adapter; this fails until its journal writer exists in lib/corpus.ts.
    expect(adapters.filter((id) => !JOURNAL_WRITERS[id])).toEqual([]);
    expect(Object.keys(JOURNAL_WRITERS).filter((id) => !adapters.includes(id))).toEqual([]);
    expect(adapters.length).toBeGreaterThanOrEqual(2);
  });
});

const GETS = extractRoutes().filter((r) => r.method === 'GET' && !['/v1/changes', '/v1/health'].includes(r.template));
const FIELDS = [...new Set([...readFileSync(fileURLToPath(new URL('../../apps/daemon/src/server.ts', import.meta.url)), 'utf8').matchAll(/(?:searchParams\.(?:get|getAll|has)\(|intParam\(url,\s*)'(\w+)'/g)].map((m) => m[1]!))];

const assertData = (reply: Reply, label: string) => {
  expect(reply.status, label).toBeLessThan(500);
  const type = String(reply.headers['content-type'] ?? '');
  expect(type, label).not.toMatch(/html|xml|javascript|svg/i);
  expect(reply.headers['x-content-type-options'], label).toBe('nosniff');
  expect(Object.keys(reply.headers).filter((k) => k.startsWith('access-control-')), label).toEqual([]);
  // An error never leaks a stack frame or a local path.
  if (reply.status >= 400) {
    expect(reply.text, label).not.toMatch(/\bat [\w.<>$ ]+\(?[^)\n]*\.(?:ts|js|mjs):\d+/);
    expect(reply.text.includes(s.dir), label).toBe(false);
  }
};

describe.each(adapters)('%s: hostile journal through the real ingest path', (adapter) => {
  it('is imported, with the hostile text kept as data', () => {
    const rec = recordings.get(adapter)!;
    expect(rec).toBeTruthy();
    const observations = s.run.app.store.observations(rec, -1, 1000);
    const all = JSON.stringify(observations);
    // The payloads are in the evidence (stored faithfully), not silently dropped or "cleaned".
    expect(all).toContain('window.__pwned');
    expect(observations.length).toBeGreaterThan(5);
  });

  it('every read route returns the hostile content as JSON data only', async () => {
    const rec = recordings.get(adapter)!;
    let hostileRoutes = 0;
    for (const route of GETS) {
      const reply = await s.call(route.path(rec), { headers: s.bearer });
      assertData(reply, `${route.method} ${route.template}`);
      if (reply.text.includes('window.__pwned') && reply.status === 200) {
        hostileRoutes++;
        expect(() => JSON.parse(reply.text), route.template).not.toThrow();
        expect(String(reply.headers['content-type'])).toMatch(/^application\/json/);
      }
    }
    expect(hostileRoutes).toBeGreaterThan(3);
  });

  it('history pages, projection, search, export and notes carry it as strings', async () => {
    const rec = recordings.get(adapter)!;
    const history = await s.call(`/v1/recordings/${enc(rec)}/history`, { method: 'POST', headers: json(), body: '{}' });
    assertData(history, 'history');
    expect(history.status).toBe(200);
    const search = await s.call(`/v1/recordings/${enc(rec)}/search?q=pwned`, { headers: s.bearer });
    assertData(search, 'search');
    const note = await s.call(`/v1/recordings/${enc(rec)}/bookmarks`, { method: 'POST', headers: json(), body: JSON.stringify({ step: 0, note: PAYLOADS.map((p) => p.text).join(' ').slice(0, 3000) }) });
    assertData(note, 'note');
    const notes = await s.call(`/v1/recordings/${enc(rec)}/bookmarks`, { headers: s.bearer });
    assertData(notes, 'notes');
    const exported = await s.call(`/v1/recordings/${enc(rec)}/export`, { headers: s.bearer });
    assertData(exported, 'export');
    expect(String(exported.headers['content-disposition'])).toMatch(/^attachment; filename="drishya-[\w.+~-]+\.json"$/);
  });

  it('fuzzed query values on every read route never break a response', async () => {
    const rec = recordings.get(adapter)!;
    const values = ['<script>window.__pwned=1</script>', "'; DROP TABLE observations; --", '" OR 1=1 --', 'NEAR(a b, 1) OR "x" NOT *', '../../etc/passwd', '%00', '‮', '-1', '9'.repeat(30), '[]', '{"a":1}'];
    const broken: string[] = [];
    for (const route of GETS) {
      for (const value of values) {
        const query = FIELDS.map((f) => `${f}=${enc(value)}`).join('&');
        const reply = await s.call(`${route.path(rec)}?${query}`, { headers: s.bearer, timeoutMs: 30_000 }).catch((error: Error) => { broken.push(`${route.template} ?*=${value.slice(0, 12)}: ${error.message}`); return undefined; });
        if (reply) assertData(reply, `${route.template} ?*=${value.slice(0, 12)}`);
      }
    }
    // One long value at a time (many long values together exceed what Node accepts in a URL, which is its own refusal).
    for (const route of GETS) {
      for (const field of ['q', 'path', 'find', 'key', 'cursor']) {
        const reply = await s.call(`${route.path(rec)}?${field}=${'a'.repeat(5000)}`, { headers: s.bearer, timeoutMs: 30_000 }).catch((error: Error) => { broken.push(`${route.template} ?${field}=long: ${error.message}`); return undefined; });
        if (reply) assertData(reply, `${route.template} ?${field}=long`);
      }
    }
    expect(broken).toEqual([]);
    // The store survived every one of them.
    const list = await s.call('/v1/recordings', { headers: s.bearer });
    expect(list.status).toBe(200);
    expect(list.json.recordings.length).toBeGreaterThanOrEqual(adapters.length);
  });
});

describe('images', () => {
  it.each(adapters)('%s: only real raster images are served, with their real type', async (adapter) => {
    const rec = recordings.get(adapter)!;
    const shas = [...s.run.app.store.imageShas(rec)];
    expect(shas.length).toBeGreaterThanOrEqual(1); // the genuine 1x1 PNG
    for (const sha of shas) {
      const reply = await s.call(`/v1/recordings/${enc(rec)}/images/${sha}`, { headers: s.bearer });
      expect(reply.status).toBe(200);
      expect(String(reply.headers['content-type'])).toMatch(/^image\/(png|jpeg|gif|webp)$/);
      expect(reply.headers['x-content-type-options']).toBe('nosniff');
      expect(String(reply.headers['content-security-policy'])).toContain("default-src 'self'");
    }
    // Nothing that is not a raster image is served as one, whatever the journal claimed.
    expect(await s.call(`/v1/recordings/${enc(rec)}/images/${'0'.repeat(64)}`, { headers: s.bearer })).toMatchObject({ status: 404 });
    expect((await s.call(`/v1/recordings/${enc(rec)}/images/${'0'.repeat(63)}x`, { headers: s.bearer })).status).toBe(404);
  });

  it.each(adapters)('%s: an SVG with script that a journal calls a PNG is not stored as an image, and a remote image URL is never fetched', async (adapter) => {
    const rec = recordings.get(adapter)!;
    const observations = JSON.stringify(s.run.app.store.observations(rec, -1, 2000));
    expect(observations).not.toContain('svg-image-script');
    expect(observations).not.toContain(SVG_B64);
    // The remote URL is recorded as a reference at most; nothing connected to the sink port (see 06-outbound).
    expect(s.logs.join('\n')).not.toMatch(/ECONNREFUSED.*:9\b/);
  });
});

describe('search and notes', () => {
  it('a note keeps hostile text as text and is redacted like captured text', async () => {
    const rec = recordings.get(adapters[0]!)!;
    const note = 'key sk-proj-abcdefghijklmnopqrstuvw0123456789 <img src=x onerror=window.__pwned=1>';
    const made = await s.call(`/v1/recordings/${enc(rec)}/bookmarks`, { method: 'POST', headers: json(), body: JSON.stringify({ step: 0, note }) });
    expect(made.status).toBe(200);
    const list = await s.call(`/v1/recordings/${enc(rec)}/bookmarks`, { headers: s.bearer });
    expect(list.text).not.toContain('abcdefghijklmnopqrstuvw');
    expect(list.text).toContain('onerror'); // kept as data
  });
});
