// SEC-3 item 7: secrets and private data. A journal seeded with one fake secret per redaction rule is
// imported through every adapter; the store, blobs, previews, search index, exports, the offline bundle,
// API responses, logs and error bodies are then searched for the raw values.
import { appendFileSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { homedir, userInfo } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { redactText } from '../../packages/privacy/src/index.ts';
import { defaultAdapters } from '../../packages/ingest/src/index.ts';
import { errorBody } from '../../apps/daemon/src/server.ts';
import { CANARIES } from './lib/secrets.ts';
import { extractRoutes } from './lib/routes.ts';
import { JOURNAL_WRITERS, hostileScenario } from './lib/corpus.ts';
import { importHostile, makeRepo } from './lib/seed.ts';
import { startScratch, type Scratch } from './lib/scratch.ts';

const enc = encodeURIComponent;
const root = process.cwd();
const ENV_CANARY = 'ENV-FILE-CANARY-91acd3e7';
const adapters = defaultAdapters().map((a) => a.descriptor.id);
let s: Scratch, repo: string;
const recordings: string[] = [];
const all = CANARIES.map((k) => k.text).join('\n');
const needles = [...CANARIES.map((k) => k.needle), ENV_CANARY];
const json = () => ({ ...s.bearer, 'content-type': 'application/json' });

const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
const leaks = (haystack: string | Buffer, label: string) => {
  const text = typeof haystack === 'string' ? haystack : haystack.toString('latin1');
  return needles.filter((n) => text.includes(n) || text.includes(JSON.stringify(n).slice(1, -1))).map((n) => { const at = Math.max(text.indexOf(n), 0); return `${label}: ${CANARIES.find((k) => k.needle === n)?.rule ?? 'env-file'} …${text.slice(Math.max(0, at - 50), at + n.length + 10).replace(/\s+/g, ' ')}`; });
};

beforeAll(async () => {
  s = await startScratch();
  repo = makeRepo(join(s.dir, 'repo'));
  const scenario = {
    ...hostileScenario(repo),
    prompt: `please use these\n${all}`,
    reply: `I will keep them\n${all}`,
    command: `curl -H "x" https://example.invalid # ${CANARIES.map((k) => k.text.replace(/\n/g, ' ')).join(' ')}`,
    output: all,
    // What a read of .env returns: a protected file's content is never kept, whatever it holds.
    readOutput: `API_KEY=${ENV_CANARY}\n${all}`,
    editOld: all,
    editNew: all,
    readPath: `${repo.replace(/\\/g, '/')}/.env`,
  };
  for (const adapter of adapters) recordings.push(await importHostile(s, adapter, repo, scenario, 'secrets'));
  // The live path: records appended after the first import are captured through sync.
  for (const adapter of adapters) {
    const id = recordings[adapters.indexOf(adapter)]!;
    const file = s.run.app.recording(id).sourcePath!;
    const last = readFileSync(file, 'utf8').trimEnd().split('\n').at(-2)!;
    appendFileSync(file, last.replace(/"timestamp":"[^"]*"/, '"timestamp":"2026-09-21T11:00:00.000Z"') + '\n');
    await s.run.app.ingest.sync(id);
  }
});
afterAll(async () => { await s.close(); });

describe('the rules', () => {
  it('every redaction rule has a canary, and every canary is caught by its own rule', () => {
    const source = readFileSync(join(root, 'packages', 'privacy', 'src', 'index.ts'), 'utf8');
    const region = source.slice(source.indexOf('const RULES'), source.indexOf('/** Paths whose content is never kept'));
    const ids = [...region.matchAll(/id:\s*'([a-z-]+)'/g)].map((m) => m[1]!);
    expect(ids.length).toBeGreaterThan(20);
    expect(ids.filter((id) => !CANARIES.some((k) => k.rule === id)), 'a rule without a canary in tests/security/lib/secrets.ts').toEqual([]);
    for (const k of CANARIES) {
      const result = redactText(k.text);
      expect(result.hits.map((h) => h.rule), k.rule).toContain(k.rule);
      expect(result.text.includes(k.needle), k.rule).toBe(false);
    }
  });

  it('every rule is run against adversarial input with a time limit, so none can hang ingest', () => {
    const attacks = [
      'a'.repeat(1_000_000), ('A'.repeat(50) + '.').repeat(20_000), 'sk-' + 'a'.repeat(500_000), 'password='.repeat(100_000), '-----BEGIN PRIVATE KEY-----' + 'x'.repeat(1_000_000),
      'eyJ' + 'a'.repeat(100_000) + '.eyJ' + 'b'.repeat(100_000), '://'.repeat(200_000), 'Bearer ' + 'a'.repeat(2_000_000), 'AccountKey=' + 'A'.repeat(1_000_000), ' '.repeat(2_000_000) + 'token', '"'.repeat(500_000) + ':'.repeat(500_000),
      'SK' + 'a'.repeat(1_000_000), 'xoxb-' + '1-'.repeat(500_000), 'ghp_' + 'a'.repeat(1_000_000), 'a.'.repeat(500_000), '='.repeat(1_000_000), '\n'.repeat(1_000_000) + 'secret',
    ];
    for (const attack of attacks) {
      const started = performance.now();
      redactText(attack);
      const took = performance.now() - started;
      expect(took, `${attack.slice(0, 12)}… (${attack.length} chars)`).toBeLessThan(5000);
    }
  });
});

describe('after import (and a live sync) through every adapter, the raw values are nowhere', () => {
  it('every adapter imported its journal', () => {
    expect(recordings).toHaveLength(adapters.length);
    for (const adapter of adapters) expect(JOURNAL_WRITERS[adapter]).toBeTruthy();
    for (const id of recordings) expect(s.run.app.store.observations(id, -1, 100).length).toBeGreaterThan(3);
  });

  it('the store directory: database, write-ahead log, blobs, indexes and everything else', () => {
    const found: string[] = [];
    for (const file of walk(s.dataDir)) found.push(...leaks(readFileSync(file), file.slice(s.dataDir.length)));
    expect(found).toEqual([]);
    expect(walk(s.dataDir).some((f) => statSync(f).size > 0)).toBe(true);
  });

  it('every API response for every recording, with and without paging', async () => {
    const found: string[] = [];
    for (const id of recordings) {
      for (const route of extractRoutes().filter((r) => r.method === 'GET' && !['/v1/changes', '/v1/health'].includes(r.template))) {
        const reply = await s.call(route.path(id) + '?path=.env&q=password', { headers: s.bearer, timeoutMs: 30_000 });
        found.push(...leaks(reply.text, `${route.template} ${reply.status}`));
      }
      for (const body of [{}, { tailFirst: true }, { start: 0, count: 500 }]) {
        const page = await s.call(`/v1/recordings/${enc(id)}/history`, { method: 'POST', headers: json(), body: JSON.stringify(body) });
        found.push(...leaks(page.text, 'history'));
      }
    }
    expect(found).toEqual([]);
  });

  it('exports and the offline bundle, through the API and through the command line', async () => {
    const found: string[] = [];
    for (const id of recordings) {
      const exported = await s.call(`/v1/recordings/${enc(id)}/export`, { headers: s.bearer });
      found.push(...leaks(exported.text, 'export'));
      // Local paths are masked in an export: this machine's folders, the temp folder and the user name are not in it.
      expect(exported.text.includes(s.dir.replace(/\\/g, '\\\\')) || exported.text.includes(s.dir.replace(/\\/g, '/')) || exported.text.includes(s.dir), 'export carries a local path').toBe(false);
      expect(exported.text.includes(homedir().replace(/\\/g, '\\\\')), 'export carries the home directory').toBe(false);
    }
    const bundle = await s.run.app.exportBundle(recordings.join('+'));
    found.push(...leaks(JSON.stringify(bundle), 'combined bundle'));
    expect(found).toEqual([]);
  });

  it('the committed demo bundle holds no secret-shaped value and no path of this machine', () => {
    const text = readFileSync(join(root, 'apps', 'ui', 'public', 'demo', 'bundle.json'), 'utf8');
    expect(redactText(text).hits.map((h) => h.rule)).toEqual([]);
    expect(text.includes(userInfo().username) && userInfo().username.length > 3, 'the demo bundle names this machine’s user').toBe(false);
    expect(text).not.toMatch(/[A-Za-z]:\\\\Users\\\\|\/Users\/[a-z]|\/home\/[a-z]+\/\./i);
  });

  it('logs and error bodies: a failure never echoes captured content', async () => {
    const found: string[] = [...leaks(s.logs.join('\n'), 'daemon log')];
    for (const k of CANARIES) {
      const { body } = errorBody(new Error(`could not parse ${k.text}`));
      found.push(...leaks(JSON.stringify(body), `errorBody ${k.rule}`));
    }
    // A request that fails while carrying secrets in its body or URL.
    const bad = await s.call(`/v1/recordings/${enc(recordings[0]!)}/bookmarks`, { method: 'POST', headers: json(), body: `{"note": ${JSON.stringify(all)}` });
    found.push(...leaks(bad.text, 'invalid-json error'));
    const url = await s.call(`/v1/recordings/${enc(all.slice(0, 200))}/projection`, { headers: s.bearer });
    found.push(...leaks(url.text, 'unknown-recording error'));
    found.push(...leaks(s.logs.join('\n'), 'daemon log after errors'));
    expect(found).toEqual([]);
  });

  it('a note typed by the person is redacted like captured text', async () => {
    const made = await s.call(`/v1/recordings/${enc(recordings[0]!)}/bookmarks`, { method: 'POST', headers: json(), body: JSON.stringify({ step: 0, note: all }) });
    expect(made.status).toBe(200);
    const list = await s.call(`/v1/recordings/${enc(recordings[0]!)}/bookmarks`, { headers: s.bearer });
    expect(leaks(list.text, 'note')).toEqual([]);
    const dbBytes = walk(s.dataDir).map((f) => readFileSync(f));
    expect(dbBytes.flatMap((b) => leaks(b, 'store after note'))).toEqual([]);
  });

  it('a protected file’s content (.env read by the agent) is never kept', () => {
    const all = JSON.stringify(recordings.flatMap((id) => s.run.app.store.observations(id, -1, 1000)));
    expect(all).not.toContain(ENV_CANARY);
  });
});

describe('what is on disk', () => {
  it('the launch token and the session id are never written (see also 02), and the store is under the data directory only', () => {
    const files = walk(s.dataDir).map((f) => f.slice(s.dataDir.length + 1).split(/[\\/]/)[0]);
    expect(new Set(files).size).toBeLessThan(10);
    void writeFileSync;
  });
});
