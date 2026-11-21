import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { discoveryTitle, headAndTailRecords, headRecords, tailRecords } from '../src/discover.ts';
import {sanitize} from '@drishya/privacy';

let dir: string;
let file: string;
it('preserves discovery title truncation, redaction and exact UTF-16 units',()=>{
  for(const input of ['Short title','fixture AKIA0000000000000000','x'.repeat(159)+'😀 tail','x'.repeat(159)+'\ud800 tail','\udc00'+ 'x'.repeat(200)]) {
    expect(discoveryTitle(input)).toBe(sanitize(input.slice(0,160)).value);
  }
});
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'drishya-discovery-tail-')); file = join(dir, 'fixture.jsonl'); });
afterEach(() => {
  if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path');
  rmSync(dir, { recursive: true, force: true });
});

it('keeps complete records in journal order when the whole source fits', async () => {
  writeFileSync(file, '{"type":"custom-title","customTitle":"First"}\n{"type":"custom-title","customTitle":"Latest"}\n');
  expect(await tailRecords(file)).toEqual([{ type: 'custom-title', customTitle: 'First' }, { type: 'custom-title', customTitle: 'Latest' }]);
});

it('bounds a discovery head buffer by the small source rather than the maximum read budget',async()=>{
  const text='{"type":"session_meta","payload":{"id":"synthetic"}}\n';writeFileSync(file,text);
  const allocations=vi.spyOn(Buffer,'alloc');
  try {
    expect(await headRecords(file)).toEqual([{type:'session_meta',payload:{id:'synthetic'}}]);
    expect(allocations.mock.calls.reduce((bytes,[size])=>bytes+size,0)).toBeLessThanOrEqual(Buffer.byteLength(text));
  } finally {allocations.mockRestore();}
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

it('skips non-title lines without parsing while retaining title record order', async () => {
  const records = [
    { type: 'custom-title', customTitle: 'Earlier custom' },
    { type: 'queue-operation', padding: 'Non-title payload' },
    { type: 'summary', summary: 'Later summary' },
    { type: 'ai-title', aiTitle: 'Later AI' },
    { type: 'custom-title', customTitle: 'Latest custom' },
  ];
  const lines = records.map(record => JSON.stringify(record));
  writeFileSync(file, lines.join('\n') + '\n');
  const parse = vi.spyOn(JSON, 'parse');
  try {
    expect(await tailRecords(file)).toEqual([records[0], records[2], records[3], records[4]]);
    expect(parse).not.toHaveBeenCalledWith(lines[1]);
    expect(parse).toHaveBeenCalledTimes(4);
  } finally { parse.mockRestore(); }
});

it('preserves standalone head limits and cut-line handling', async () => {
  writeFileSync(file, ' {"n":1}\nmalformed\n{"n":2}\n{"n":3}\n{"cut":');
  expect(await headRecords(file, 1024, 2)).toEqual([{ n: 1 }, { n: 2 }]);
  expect(await headRecords(file, 25)).toEqual([{ n: 1 }]);
});

it('shares bounded head and tail results while preserving the 400-record head limit', async () => {
  const records = Array.from({ length: 401 }, (_, n) => ({ n }));
  const title = { type: 'custom-title', customTitle: 'Latest title' };
  writeFileSync(file, records.map(record => JSON.stringify(record)).join('\n') + '\n' +
    JSON.stringify({ type: 'queue-operation', padding: 'x'.repeat(300 * 1024) }) + '\n' + JSON.stringify(title) + '\n');
  const combined = await headAndTailRecords(file, statSync(file).size);
  expect(combined.head).toEqual(records.slice(0, 400));
  expect(combined.head).toEqual(await headRecords(file));
  expect(combined.tail).toEqual([title]);
  expect(combined.tail).toEqual(await tailRecords(file));
});

it('returns only the head for a fully read short journal', async () => {
  const title = { type: 'ai-title', aiTitle: 'Short journal' };
  writeFileSync(file, JSON.stringify(title) + '\n');
  expect(await headAndTailRecords(file, statSync(file).size)).toEqual({ head: [title], tail: [] });
});
