// Sparse oversized-record probe: exercise bounded reads of a logical 1–2 GiB source without
// storing real content or allocating that source in memory. This is not a normal import test.
import assert from 'node:assert/strict';
import { closeSync, ftruncateSync, mkdtempSync, openSync, rmSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { performance } from 'node:perf_hooks';
import { initialCursor, readJsonl } from '../packages/capture-core/src/jsonl.ts';

const gib = Number(process.argv[2] ?? 2);
if (!Number.isInteger(gib) || gib < 1 || gib > 2) throw new Error('usage: node scripts/bench-adversarial.ts [1|2]');
const bytes = gib * 1024 * 1024 * 1024;
const dir = mkdtempSync(join(tmpdir(), 'drishya-sparse-'));
const path = join(dir, 'oversized.jsonl');
try {
  const fd = openSync(path, 'w+');
  try {
    ftruncateSync(fd, bytes);
    const newline = Buffer.from('\n');
    writeSync(fd, newline, 0, newline.length, bytes - 1);
  } finally {
    closeSync(fd);
  }
  let cursor = initialCursor();
  let turns = 0;
  let gaps = 0;
  let maxRss = 0;
  const t0 = performance.now();
  while (cursor.offset < bytes) {
    const next = await readJsonl(path, cursor, { maxReadBytes: 64 * 1024 * 1024, maxRecordBytes: 16 * 1024 * 1024 });
    assert.ok(next.cursor.offset > cursor.offset, 'bounded reader must make progress');
    assert.ok(next.records.every((record) => record.type === 'oversized'));
    gaps += next.records.length;
    cursor = next.cursor;
    turns++;
    maxRss = Math.max(maxRss, process.memoryUsage().rss);
  }
  assert.equal(gaps, 1, 'one oversized source line must create one capture gap');
  console.log(JSON.stringify({ logicalSourceGiB: gib, turns, captureGaps: gaps, scanMs: performance.now() - t0, peakSampledRssMiB: maxRss / 1048576, note: 'sparse oversized-line probe; no valid observations or projection' }));
} finally {
  if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('probe directory escaped system temp');
  rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
