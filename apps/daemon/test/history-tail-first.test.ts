import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { App } from '../src/app.ts';

// PERF-4: a large recording is first answered from its latest prompts (`partial`), while the whole history folds in the
// background; the worker then tells the daemon, which announces it like any change, and the next page is the whole one.
// The size and the tail are tuned down by environment so a synthetic journal takes the same path a 300 MB one does.
let app: App | undefined;
let dir: string;
const saved = { first: process.env.DRISHYA_TAIL_FIRST, prompts: process.env.DRISHYA_TAIL_PROMPTS };
beforeAll(() => { process.env.DRISHYA_TAIL_FIRST = '1'; process.env.DRISHYA_TAIL_PROMPTS = '2'; });
afterAll(() => {
  for (const [key, value] of [['DRISHYA_TAIL_FIRST', saved.first], ['DRISHYA_TAIL_PROMPTS', saved.prompts]] as const) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
});
afterEach(async () => { await app?.close(); app = undefined; if (dir) rmSync(dir, { recursive: true, force: true }); });

/** A Claude Code journal of `turns` prompts, each with a read, its result and an answer. */
function journalText(turns: number): string {
  const base = { cwd: '/home/dev/shop', sessionId: 'c0ffee00-0000-4000-8000-0000000000aa', version: '2.1.0' };
  const rows: unknown[] = [];
  let n = 0;
  const at = () => new Date(Date.UTC(2026, 10, 14, 9, 0, n++)).toISOString();
  for (let t = 0; t < turns; t++) {
    rows.push({ ...base, uuid: `00000000-0000-4000-8000-${String(t * 10 + 1).padStart(12, '0')}`, timestamp: at(), type: 'user', message: { role: 'user', content: `prompt number ${t}` } });
    rows.push({ ...base, uuid: `00000000-0000-4000-8000-${String(t * 10 + 2).padStart(12, '0')}`, timestamp: at(), type: 'assistant', message: { id: `msg-${t}-a`, role: 'assistant', model: 'synthetic', content: [{ type: 'tool_use', id: `call-${t}`, name: 'Read', input: { file_path: `/home/dev/shop/src/file-${t}.ts` } }] } });
    rows.push({ ...base, uuid: `00000000-0000-4000-8000-${String(t * 10 + 3).padStart(12, '0')}`, timestamp: at(), type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: `call-${t}`, content: `     1${String.fromCharCode(9)}export const value${t} = ${t};` }] } });
    rows.push({ ...base, uuid: `00000000-0000-4000-8000-${String(t * 10 + 4).padStart(12, '0')}`, timestamp: at(), type: 'assistant', message: { id: `msg-${t}-b`, role: 'assistant', model: 'synthetic', content: [{ type: 'text', text: `answer ${t}` }] } });
  }
  return rows.map((row) => JSON.stringify(row)).join(String.fromCharCode(10)) + String.fromCharCode(10);
}

async function open() {
  dir = mkdtempSync(join(tmpdir(), 'drishya-tail-first-'));
  const journal = join(dir, 'session.jsonl');
  writeFileSync(journal, journalText(8));
  app = new App(join(dir, 'data'));
  const { recordingId } = await app.ingest.importSource('claude-code', journal);
  return recordingId;
}
const fullReady = (a: App, id: string) => new Promise<void>((done, fail) => {
  const timer = setTimeout(() => fail(new Error('the whole view was never announced')), 15_000);
  a.ingest.on('change', (e: { recordingId: string; added: number }) => { if (e.recordingId === id && e.added === 0) { clearTimeout(timer); done(); } });
});

describe('recent-first history pages', { timeout: 30_000 }, () => {
  it('answers from the latest prompts, announces the whole view, then answers with it', async () => {
    const id = await open();
    const ready = fullReady(app!, id);
    const first = await app!.history.page(id, { tailFirst: true, count: 64 });
    expect(first.partial?.observations).toBeGreaterThan(0);
    await ready;
    const second = await app!.history.page(id, { tailFirst: true, count: 64 });
    expect(second.partial).toBeUndefined();
    const whole = await app!.history.page(id, { count: 64 });
    expect(JSON.stringify(second)).toBe(JSON.stringify(whole));
    // The latest work is the same work: every operation, prose and passage of the first page exists in the whole one under the same id.
    expect(second.scene.total).toBeGreaterThan(first.scene.total);
    const wholeOps = new Map(whole.projection.operations.map((op) => [op.id, op]));
    expect(first.projection.operations.length).toBeGreaterThan(0);
    for (const op of first.projection.operations) {
      const other = wholeOps.get(op.id);
      expect(other, op.id).toBeDefined();
      expect(op.title).toBe(other!.title);
      expect(op.status).toBe(other!.status);
    }
    const wholeProse = new Set(whole.projection.prose.map((p) => p.id));
    for (const prose of first.projection.prose) expect(wholeProse.has(prose.id)).toBe(true);
    expect(first.scene.passages.length).toBeLessThan(second.scene.passages.length);
    expect(first.projection.workspaceRoot).toBe(whole.projection.workspaceRoot);
    expect(first.projection.title).toBe(whole.projection.title);
  });

  it('a caller that does not allow a partial page waits for the whole one', async () => {
    const id = await open();
    const partial = await app!.history.page(id, { tailFirst: true });
    expect(partial.partial).toBeDefined();
    const whole = await app!.history.page(id, { count: 1 });
    expect(whole.partial).toBeUndefined();
    expect(whole.scene.total).toBeGreaterThan(partial.scene.total);
  });

  it('keeps the earlier view small recordings had: below the size, nothing is partial', async () => {
    process.env.DRISHYA_TAIL_FIRST = '100000';
    try {
      const id = await open();
      const page = await app!.history.page(id, { tailFirst: true });
      expect(page.partial).toBeUndefined();
    } finally { process.env.DRISHYA_TAIL_FIRST = '1'; }
  });
});
