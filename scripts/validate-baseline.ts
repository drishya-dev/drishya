// Opt-in local audit. Real journals are read only and never written to a Drishya store.
// Only aggregate counts leave this process; synthetic fixtures exercise persistence/API.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appendFile, chmod, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initialCursor, readJsonl, seal } from '../packages/capture-core/src/index.ts';
import type { Observation } from '../packages/contracts/src/index.ts';
import { defaultAdapters } from '../packages/ingest/src/index.ts';
import { sanitize } from '../packages/privacy/src/index.ts';
import { reduce } from '../packages/projection/src/index.ts';
import { compose } from '../packages/scene/src/index.ts';
import { App } from '../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../apps/daemon/src/server.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = join(root, 'fixtures/synthetic');
const report: Record<string, unknown> = { format: 'drishya-baseline-audit-v1', node: process.version, platform: process.platform };
const hash = (text: string | Buffer) => createHash('sha256').update(text).digest('hex');
const ms = (start: number) => Math.round(performance.now() - start);

// Known failures are diagnostics, not assertions that bless the privacy gate.
const marker = 'gh' + 'p_' + 'Ab3Def7Hij9Klm2Nop4Qrs6Tuv8Wxy0Zab1Cd2';
report.privacyProbes = {
  ordinaryValueRedacted: !JSON.stringify(sanitize({ text: marker }).value).includes(marker),
  base64SiblingRedacted: !JSON.stringify(sanitize({ base64: 'AA==', text: marker }).value).includes(marker),
  objectKeyRedacted: !JSON.stringify(sanitize({ [marker]: 'value' }).value).includes(marker),
};

async function synthetic() {
  const dir = await mkdtemp(join(tmpdir(), 'drishya-audit-'));
  await chmod(dir, 0o700);
  let app: App | undefined;
  let server: RunningServer | undefined;
  try {
    app = new App(join(dir, 'data'));
    const imports = [];
    for (const [adapter, path] of [['claude-code', 'claude/checkout-fix.jsonl'], ['codex', 'codex/rollout-checkout-review.jsonl']]) {
      const result = await app.ingest.importSource(adapter!, join(fixtures, path!));
      const p = app.projection(result.recordingId);
      assert(p.operations.length > 0);
      assert.deepEqual(compose(p, { step: p.timeline.length }), compose(p, { step: p.timeline.length }));
      assert.equal((await app.ingest.importSource(adapter!, join(fixtures, path!))).added, 0);
      imports.push({ adapter, ...result, operations: p.operations.length, artifacts: p.artifacts.length });
    }
    const id = imports[0]!.recordingId;
    app.store.updateRecordingMeta(id, { graphRoot: join(fixtures, 'workspace/shop') });
    server = await startServer({ app, port: 0 });
    const headers = { authorization: `Bearer ${server.token}` };
    assert.equal((await fetch(`${server.url}/v1/recordings`)).status, 401);
    for (const suffix of ['projection', 'graph', 'search?q=falsy']) {
      assert.equal((await fetch(`${server.url}/v1/recordings/${id}/${suffix}`, { headers })).status, 200);
    }
    let missingArtifacts = 0;
    for (const a of app.projection(id).artifacts) {
      if (a.blob && app.store.blobs.get(a.blob) === undefined) missingArtifacts++;
    }
    assert.equal(missingArtifacts, 0);
    await server.close(); server = undefined;
    await app.close(); app = new App(join(dir, 'data'));
    const restart = await app.ingest.importSource('claude-code', join(fixtures, 'claude/checkout-fix.jsonl'));
    assert.equal(restart.added, 0);

    // Only this scratch journal is mutated. No viewer or HTTP client is needed to capture.
    const journal = join(dir, 'live.jsonl');
    const line = (uuid: string, type: string, content: unknown) => JSON.stringify({ uuid, type, sessionId: 'audit', cwd: '/synthetic', timestamp: '2026-09-30T00:00:00Z', message: { role: type, content } }) + '\n';
    await writeFile(journal, line('u1', 'user', 'Synthetic audit'));
    const live = await app.ingest.importSource('claude-code', journal);
    app.ingest.startLive(live.recordingId, 30);
    const next = line('a1', 'assistant', [{ type: 'text', text: 'Synthetic response' }]);
    await appendFile(journal, next.slice(0, 20));
    await new Promise(r => setTimeout(r, 100));
    assert.equal(app.projection(live.recordingId).prose.length, 0);
    await appendFile(journal, next.slice(20));
    const until = performance.now() + 3000;
    while (app.projection(live.recordingId).prose.length === 0 && performance.now() < until) await new Promise(r => setTimeout(r, 40));
    assert.equal(app.projection(live.recordingId).prose.length, 1);
    await app.ingest.stopLive(live.recordingId);
    report.synthetic = { imports: imports.map(({ recordingId: _, ...rest }) => rest), unauthorized: 401, apiReads: 'pass', missingArtifacts, restartAdded: restart.added, partialLineAndViewerlessLive: 'pass' };
  } finally {
    await server?.close();
    await app?.close();
    // This exact mkdtemp directory is the only recursive deletion target.
    assert.equal(dirname(resolve(dir)), resolve(tmpdir()));
    assert(dir.startsWith(join(tmpdir(), 'drishya-audit-')));
    await rm(dir, { recursive: true, force: true });
  }
}

async function realReadOnly() {
  const results = [];
  const discovery: Record<string, number> = {};
  for (const adapter of defaultAdapters()) {
    const sources = await adapter.discover();
    discovery[adapter.descriptor.id] = sources.length;
    // Bounded, inactive samples: most recently changed plus largest under 32 MiB.
    const eligible = sources.filter(s => s.bytes >= 5000 && s.bytes <= 32 * 1024 * 1024 && Date.parse(s.modifiedAt) < Date.now() - 600_000);
    const recent = [...eligible].sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))[0];
    const largest = [...eligible].sort((a, b) => b.bytes - a.bytes)[0];
    for (const source of [...new Set([recent, largest])].filter(s => s !== undefined)) {
      const start = performance.now();
      const set = await adapter.sourceSet(source.path);
      const observations: Observation[] = [];
      let bytes = 0, malformed = 0, oversized = 0, parserErrors = 0, sourceChanged = false, companionsSkipped = 0;
      let index = 0;
      for (const item of [{ path: set.main, agentId: undefined }, ...set.companions]) {
        const info = await stat(item.path);
        if (bytes + info.size > 64 * 1024 * 1024) { companionsSkipped++; continue; }
        const before = hash(await readFile(item.path));
        bytes += info.size;
        const sourceId = `audit-source-${index++}`;
        const parser = adapter.createParser({ recordingId: 'audit', sourceId, sourcePath: item.path, agentId: item.agentId });
        let cursor = initialCursor();
        for (;;) {
          const batch = await readJsonl(item.path, cursor, { maxReadBytes: 4 * 1024 * 1024, acceptUnterminated: true });
          for (const rec of batch.records) {
            if (rec.type === 'malformed') { malformed++; continue; }
            if (rec.type === 'oversized') { oversized++; continue; }
            try {
              for (const raw of parser.parse(rec.value)) observations.push({ ...seal({ raw, recordingId: 'audit', adapter: adapter.descriptor, sourceId, generation: batch.cursor.generation, byteOffset: rec.offset, observedAt: '2026-09-30T00:00:00Z' }), receivedSequence: observations.length + 1 });
            } catch { parserErrors++; }
          }
          if (batch.cursor.offset <= cursor.offset || batch.cursor.offset >= batch.size) break;
          cursor = batch.cursor;
        }
        sourceChanged ||= before !== hash(await readFile(item.path));
      }
      const blobs = new Map<string, string>();
      const p = reduce('audit', observations, { get: sha => blobs.get(sha), put: text => { const sha = hash(text); blobs.set(sha, text); return { sha, bytes: Buffer.byteLength(text) }; } }, { adapters: { [adapter.descriptor.id]: adapter.descriptor } });
      const at = performance.now();
      compose(p, { step: p.timeline.length });
      const gapReasons: Record<string, number> = {};
      for (const gap of p.gaps) gapReasons[gap.reason] = (gapReasons[gap.reason] ?? 0) + 1;
      results.push({ adapter: adapter.descriptor.id, sample: source === recent ? 'recent-inactive' : 'largest-eligible', bytes, sources: index, companionsSkipped, observations: observations.length, operations: p.operations.length, artifacts: p.artifacts.length, prose: p.prose.length, gaps: p.gaps.length, gapReasons, malformed, oversized, parserErrors, sourceChanged, composeMs: ms(at), totalMs: ms(start) });
    }
  }
  report.realReadOnly = { discovery, samples: results, persistence: 'none; parser, seal, reducer and composer in memory only' };
}

try {
  await synthetic();
  if (process.argv.includes('--real-read-only')) await realReadOnly();
  console.log(JSON.stringify(report, null, 2));
} catch (e) {
  // Never print arbitrary parser/server messages that might contain journal contents.
  console.error(JSON.stringify({ auditFailed: true, errorType: e instanceof Error ? e.name : 'unknown' }));
  process.exitCode = 1;
}
