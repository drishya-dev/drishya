// Reproducible synthetic backend/index benchmark; never reads real harness journals.
// Usage: node scripts/bench-b4.ts --observations 10000 --files 5000 --repeats 5
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { cpus, freemem, tmpdir, totalmem } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { performance } from 'node:perf_hooks';
import { App } from '../apps/daemon/src/app.ts';
import { buildGraph } from '../packages/indexer/src/index.ts';
import { compose } from '../packages/scene/src/index.ts';

function option(name: string, fallback: number): number {
  const at = process.argv.indexOf(`--${name}`);
  const value = at < 0 ? fallback : Number(process.argv[at + 1]);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`--${name} must be a positive integer`);
  return value;
}
const count = option('observations', 10_000);
const files = option('files', 5_000);
const repeats = option('repeats', 5);
const results: { importMs: number; composeMs: number; graphMs: number; rssMiB: number; heapMiB: number; observations: number; files: number }[] = [];

for (let run = 0; run < repeats; run++) {
  const dir = mkdtempSync(join(tmpdir(), 'drishya-b4-'));
  const workspace = join(dir, 'workspace');
  const source = join(dir, 'rollout-b4.jsonl');
  let app: App | undefined;
  try {
    mkdirSync(workspace);
    for (let i = 0; i < files; i++) {
      const path = join(workspace, `part-${Math.floor(i / 100)}`, `file-${i}.ts`);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, `export const value${i} = ${i};\n`);
    }
    const timestamp = '2026-09-21T10:20:00.000Z';
    const lines = [JSON.stringify({ timestamp, type: 'session_meta', payload: { id: `b4-${run}`, cwd: workspace, originator: 'codex_cli_rs', cli_version: '0.50.0' } })];
    for (let i = 0; i < count; i++) {
      const callId = `call-${Math.floor(i / 2)}`;
      const payload = i % 2 === 0
        ? { type: 'function_call', name: 'functions.exec_command', call_id: callId, arguments: JSON.stringify({ cmd: `cat part-${Math.floor(i / 100)}/file-${i % files}.ts` }) }
        : { type: 'function_call_output', call_id: callId, output: `export const value = ${i};` };
      lines.push(JSON.stringify({ timestamp, type: 'response_item', payload }));
    }
    writeFileSync(source, lines.join('\n') + '\n');
    app = new App(join(dir, 'data'));
    const t0 = performance.now();
    const imported = await app.ingest.importSource('codex', source);
    const importMs = performance.now() - t0;
    const projection = app.projection(imported.recordingId);
    const t1 = performance.now();
    const scene = compose(projection, { step: projection.timeline.length });
    const composeMs = performance.now() - t1;
    const t2 = performance.now();
    const graph = await buildGraph(workspace);
    const graphMs = performance.now() - t2;
    assert.equal(imported.added, count + 1);
    assert.equal(projection.operations.length, Math.floor(count / 2));
    assert.equal(graph.stats.files, files);
    assert.ok(scene.passages.length > 0);
    const memory = process.memoryUsage();
    results.push({ importMs, composeMs, graphMs, rssMiB: memory.rss / 1048576, heapMiB: memory.heapUsed / 1048576, observations: imported.added, files: graph.stats.files });
    console.log(JSON.stringify({ run: run + 1, ...results.at(-1) }));
  } finally {
    if (app) await app.close();
    if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('benchmark directory escaped system temp');
    rmSync(dir, { recursive: true, force: true });
  }
}

const percentile = (values: number[], p: number) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.ceil(p * values.length) - 1)];
const metrics = ['importMs', 'composeMs', 'graphMs', 'rssMiB', 'heapMiB'] as const;
console.log(JSON.stringify({
  reference: { platform: process.platform, arch: process.arch, node: process.version, cpu: cpus()[0]?.model, logicalCpus: cpus().length, totalRamGiB: +(totalmem() / 1073741824).toFixed(1), freeRamGiBAtEnd: +(freemem() / 1073741824).toFixed(1), browser: 'not measured', powerMode: 'not recorded' },
  workload: { observations: count, eligibleFiles: files, repeats, source: 'synthetic skinny call/result journal; backend/index only' },
  summary: Object.fromEntries(metrics.map((m) => [m, { p50: percentile(results.map((r) => r[m]), 0.5), p95: percentile(results.map((r) => r[m]), 0.95) }])),
}));
