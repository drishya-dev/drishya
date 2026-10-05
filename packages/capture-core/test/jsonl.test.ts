import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initialCursor, readJsonl } from '../src/jsonl.ts';
import { observationId, seal } from '../src/index.ts';

let dir: string;
let file: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-jsonl-'));
  file = join(dir, 's.jsonl');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('readJsonl', () => {
  it('holds back a partial trailing line until it is complete', async () => {
    writeFileSync(file, '{"a":1}\n{"b":');
    const r1 = await readJsonl(file, initialCursor());
    expect(r1.records.map((r) => r.type === 'record' && r.value)).toEqual([{ a: 1 }]);
    appendFileSync(file, '2}\n');
    const r2 = await readJsonl(file, r1.cursor);
    expect(r2.records.map((r) => r.type === 'record' && r.value)).toEqual([{ b: 2 }]);
  });

  it('reports malformed lines as records, never throws', async () => {
    writeFileSync(file, '{"a":1}\nnot json\n{"c":3}\n');
    const r = await readJsonl(file, initialCursor());
    expect(r.records.map((x) => x.type)).toEqual(['record', 'malformed', 'record']);
  });

  it('skips oversized lines without holding them in memory', async () => {
    writeFileSync(file, `{"a":1}\n{"big":"${'x'.repeat(5000)}"}\n{"c":3}\n`);
    const r = await readJsonl(file, initialCursor(), { maxRecordBytes: 1000 });
    expect(r.records.map((x) => x.type)).toEqual(['record', 'oversized', 'record']);
  });

  it('keeps making progress through an oversized line longer than one read', async () => {
    writeFileSync(file, `{"big":"${'x'.repeat(5000)}"}\n{"c":3}\n`);
    let cursor = initialCursor();
    const types: string[] = [];
    for (let i = 0; i < 20; i++) {
      const r = await readJsonl(file, cursor, { maxRecordBytes: 1000, maxReadBytes: 1500 });
      types.push(...r.records.map((x) => x.type));
      if (r.cursor.offset === cursor.offset) break;
      cursor = r.cursor;
    }
    expect(types.filter((t) => t === 'record')).toHaveLength(1);
    expect(types.filter((t) => t === 'oversized')).toHaveLength(1);
  });

  it('reports one gap for each oversized line across bounded turns', async () => {
    writeFileSync(file, `{"big":"${'x'.repeat(5000)}"}\n{"big":"${'y'.repeat(5000)}"}\n`);
    let cursor = initialCursor();
    let gaps = 0;
    for (let i = 0; i < 20; i++) {
      const r = await readJsonl(file, cursor, { maxRecordBytes: 1000, maxReadBytes: 1500 });
      gaps += r.records.filter((x) => x.type === 'oversized').length;
      if (r.cursor.offset === cursor.offset) break;
      cursor = r.cursor;
    }
    expect(gaps).toBe(2);
  });

  it('starts a new generation when the file is truncated', async () => {
    writeFileSync(file, '{"a":1}\n{"b":2}\n');
    const r1 = await readJsonl(file, initialCursor());
    writeFileSync(file, '{"z":9}\n');
    const r2 = await readJsonl(file, r1.cursor);
    expect(r2.reset).toBe('truncated');
    expect(r2.cursor.generation).toBe(1);
    expect(r2.records.map((r) => r.type === 'record' && r.value)).toEqual([{ z: 9 }]);
  });

  it('accepts an unterminated last line only for a finished file', async () => {
    writeFileSync(file, '{"a":1}\n{"b":2}');
    expect((await readJsonl(file, initialCursor())).records).toHaveLength(1);
    expect((await readJsonl(file, initialCursor(), { acceptUnterminated: true })).records).toHaveLength(2);
  });
});

describe('identity and sealing', () => {
  it('gives the same record the same id on every import', () => {
    const a = observationId('claude-code', 'src_1', 0, 100, { recordId: 'u1', part: 0 });
    expect(a).toBe(observationId('claude-code', 'src_1', 0, 999, { recordId: 'u1', part: 0 }));
    expect(a).not.toBe(observationId('claude-code', 'src_1', 0, 100, { recordId: 'u1', part: 1 }));
  });

  it('seal() redacts payloads and keeps only metadata for protected content', () => {
    const token = 'gh' + 'p_' + 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8';
    const adapter = { id: 't', harness: 't', version: '0', label: 't', testedHarnessVersions: [], capabilities: {} as never };
    const o = seal({
      raw: { part: 0, kind: 'tool.result', agentId: 'agent:main', payload: { tool: 'Read', text: `TOKEN=${token}` }, denyContent: true, contentKeys: ['text'] },
      recordingId: 'r', adapter, sourceId: 's', generation: 0, byteOffset: 0, observedAt: '2026-01-01T00:00:00Z',
    });
    expect(JSON.stringify(o)).not.toContain(token);
    expect((o.payload as { text: string }).text).toMatch(/OMITTED/);
    expect((o.payload as { tool: string }).tool).toBe('Read');
    expect(o.availability).toBe('partial');
  });
});
