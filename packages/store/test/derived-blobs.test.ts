import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { BlobStore, SqliteBlobStore } from '../src/index.ts';

// PERF-2: the history worker keeps derived blobs as rows of its own database instead of one file
// each. Reads must match the file store exactly, including bounded line slices and resumed search.
let dir: string;
let db: DatabaseSync;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-derived-'));
  db = new DatabaseSync(join(dir, 'index.db'));
});
afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

const text = Array.from({ length: 1200 }, (_, i) => (i % 97 === 0 ? `line ${i} needle ` : `line ${i} `) + 'x'.repeat(i % 300)).join('\n');

it('stores, reads, slices and searches exactly like the file store', () => {
  const files = new BlobStore(join(dir, 'files'));
  const rows = new SqliteBlobStore(db, join(dir, 'unused'));
  const a = files.put(text), b = rows.put(text);
  expect(b).toEqual(a);
  expect(rows.get(b.sha)).toBe(text);
  expect(rows.has(b.sha)).toBe(true);
  for (const [start, count, cap] of [[0, 10, undefined], [300, 50, undefined], [1150, 100, undefined], [10, 500, 4096]] as const) {
    expect(rows.readLines(b.sha, start, count, cap)).toEqual(files.readLines(a.sha, start, count, cap));
  }
  const fromFiles = files.findLines(a.sha, 'NEEDLE')!, fromRows = rows.findLines(b.sha, 'NEEDLE')!;
  expect(fromRows.matches).toEqual(fromFiles.matches);
  expect(fromRows.totalLines).toBe(fromFiles.totalLines);
});

it('writes each content once, lists what it holds and deletes on request', () => {
  const rows = new SqliteBlobStore(db, join(dir, 'unused'));
  const one = rows.put('first'), again = rows.put('first'), two = rows.put('second');
  expect(again.sha).toBe(one.sha);
  expect([...rows.shas()].sort()).toEqual([one.sha, two.sha].sort());
  rows.delete(one.sha);
  expect(rows.has(one.sha)).toBe(false);
  expect(rows.get(one.sha)).toBeUndefined();
  expect(rows.readLines(one.sha, 0, 1)).toBeUndefined();
  expect(rows.get('not-a-sha')).toBeUndefined();
});
