// Opt-in synthetic large-source import. Writes a real, valid Codex-format journal with repeated
// invented output content, then imports it through the same privacy/store/projection path.
import assert from 'node:assert/strict';
import { closeSync, fstatSync, mkdtempSync, openSync, rmSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { performance } from 'node:perf_hooks';
import { App } from '../apps/daemon/src/app.ts';

const mib = Number(process.argv[2] ?? 128);
if (!Number.isInteger(mib) || mib < 1 || mib > 1024) throw new Error('usage: node scripts/bench-valid-source.ts <MiB: 1..1024>');
const targetBytes = mib * 1048576;
const dir = mkdtempSync(join(tmpdir(), 'drishya-valid-source-'));
const journal = join(dir, 'rollout-valid.jsonl');
const timestamp = '2026-09-21T10:20:00.000Z';
const padding = '// invented captured output\n' + 'x'.repeat(40 * 1024);
let app: App | undefined;
try {
  const fd = openSync(journal, 'w');
  let pairs = 0;
  let bytes = 0;
  try {
    const meta = JSON.stringify({ timestamp, type: 'session_meta', payload: { id: 'b4-valid', cwd: '/home/dev/shop', originator: 'codex_cli_rs', cli_version: '0.50.0' } }) + '\n';
    bytes += writeSync(fd, meta);
    while (bytes < targetBytes) {
      const id = `b4-${pairs++}`;
      const lines = [
        JSON.stringify({ timestamp, type: 'response_item', payload: { type: 'function_call', name: 'functions.exec_command', call_id: id, arguments: JSON.stringify({ cmd: 'echo synthetic' }) } }),
        JSON.stringify({ timestamp, type: 'response_item', payload: { type: 'function_call_output', call_id: id, output: padding } }),
      ].join('\n') + '\n';
      bytes += writeSync(fd, lines);
    }
    assert.equal(fstatSync(fd).size, bytes);
  } finally {
    closeSync(fd);
  }
  app = new App(join(dir, 'data'));
  const start = performance.now();
  const imported = await app.ingest.importSource('codex', journal);
  const elapsed = performance.now() - start;
  const projection = app.projection(imported.recordingId);
  assert.equal(imported.added, pairs * 2 + 1);
  assert.equal(projection.operations.length, pairs);
  const beforeGc = process.memoryUsage();
  globalThis.gc?.();
  const afterGc = process.memoryUsage();
  console.log(JSON.stringify({ sourceMiB: bytes / 1048576, observations: imported.added, operations: pairs, importAndProjectMs: elapsed, rssMiB: beforeGc.rss / 1048576, heapMiB: beforeGc.heapUsed / 1048576, postGcRssMiB: afterGc.rss / 1048576, postGcHeapMiB: afterGc.heapUsed / 1048576, captureGaps: imported.gaps }));
} finally {
  if (app) await app.close();
  if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('source probe directory escaped system temp');
  rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
