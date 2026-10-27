import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { tailRecords } from '../src/discover.ts';

let dir: string;
let file: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'drishya-discovery-tail-')); file = join(dir, 'fixture.jsonl'); });
afterEach(() => {
  if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path');
  rmSync(dir, { recursive: true, force: true });
});

it('keeps complete records in journal order when the whole source fits', async () => {
  writeFileSync(file, '{"type":"custom-title","customTitle":"First"}\n{"type":"custom-title","customTitle":"Latest"}\n');
  expect(await tailRecords(file)).toEqual([{ type: 'custom-title', customTitle: 'First' }, { type: 'custom-title', customTitle: 'Latest' }]);
});

it('discards the clipped first line, malformed records and an incomplete last record', async () => {
  const title = { type: 'custom-title', customTitle: 'Latest' };
  writeFileSync(file, `${'x'.repeat(200)}\nmalformed\n${JSON.stringify(title)}\n{"type":`);
  expect(await tailRecords(file, 100)).toEqual([title]);
});

it('does not parse a record larger than the tail budget', async () => {
  writeFileSync(file, JSON.stringify({ type: 'custom-title', customTitle: 'x'.repeat(200) }));
  expect(await tailRecords(file, 64)).toEqual([]);
});

it('handles empty journals without manufacturing metadata', async () => {
  writeFileSync(file, '');
  expect(await tailRecords(file)).toEqual([]);
});
