import { appendFileSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import {snapshot,rowsOf,violations} from './passage-geometry.ts';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

// READ-4 guard. Passage layout is plain CSS wrap (flex-wrap in .ops-row) plus order wires drawn by FlowConnections.
// This pins what must stay true at every supported desktop width: reading order is row-major, a wrapped row never
// starts with a card that would have fitted on the row above, every consecutive pair has a wire that starts on the
// previous card's edge, ends on the next card's edge and never crosses a card, and the row structure of three
// recordings does not drift. A tall viewport keeps every card visible, because wires are drawn for visible cards only.
const WIDTHS = [1024, 1280, 1440, 1920] as const;
type Recording = 'claude' | 'codex' | 'wrap';

let dir: string, app: App, server: RunningServer; const ids = {} as Record<Recording, string>;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-passage-layout-'));
  app = new App(join(dir, 'data'));
  ids.claude = (await app.ingest.importSource('claude-code', resolve('fixtures/synthetic/claude/checkout-fix.jsonl'))).recordingId;
  ids.codex = (await app.ingest.importSource('codex', resolve('fixtures/synthetic/codex/rollout-checkout-review.jsonl'))).recordingId;
  // One long passage built to stress the wrap: tiny cards, two wide diffs, a long command title, a source card,
  // and a run of tiny cards that follows a full row.
  const wrap = join(dir, 'wrap.jsonl'); copyFileSync(resolve('fixtures/synthetic/claude/checkout-fix.jsonl'), wrap);
  const base = { cwd: '/home/dev/shop', sessionId: 'c0ffee00-0000-4000-8000-000000000002', version: '2.1.0' };
  let at = Date.parse('2026-10-05T12:30:00.000Z');
  const row = (r: object) => { at += 1000; appendFileSync(wrap, JSON.stringify({ ...base, timestamp: new Date(at).toISOString(), uuid: randomUUID(), ...r }) + '\n'); };
  const uses: object[] = []; const results: object[] = [];
  const tool = (n: string, name: string, input: object, out: string) => { uses.push({ type: 'tool_use', id: n, name, input }); results.push({ type: 'tool_result', tool_use_id: n, content: out }); };
  const before = Array.from({ length: 30 }, (_, i) => `  const value${i} = compute(${i}, "a fairly long argument string number ${i}");`).join('\n');
  const after = before.replace(/value/g, 'item');
  tool('p1', 'Bash', { command: 'ls' }, 'ok');
  tool('p2', 'Edit', { file_path: '/home/dev/shop/src/wide.ts', old_string: before, new_string: after }, 'edited');
  tool('p3', 'Bash', { command: 'pwd' }, '/home/dev/shop');
  tool('p4', 'Bash', { command: 'node --experimental-strip-types scripts/some-very-long-script-name-that-keeps-going.ts --flag-one --flag-two --flag-three --flag-four' }, 'done');
  tool('p5', 'Grep', { pattern: 'needle' }, 'a.ts:1:needle');
  tool('p6', 'Read', { file_path: '/home/dev/shop/src/a.ts' }, '1\texport const a = 1;');
  tool('p7', 'Edit', { file_path: '/home/dev/shop/src/b.ts', old_string: 'one', new_string: 'two' }, 'edited');
  for (const [n, command, out] of [['p8', 'git status --short', ''], ['p9', 'echo a', 'a'], ['p10', 'echo b', 'b'], ['p11', 'echo c', 'c']] as const) tool(n, 'Bash', { command }, out);
  tool('p12', 'Write', { file_path: '/home/dev/shop/src/new.ts', content: before }, 'written');
  row({ type: 'assistant', message: { id: 'wrap-a', role: 'assistant', content: uses } });
  row({ type: 'user', message: { role: 'user', content: results } });
  row({ type: 'assistant', message: { id: 'wrap-b', role: 'assistant', content: [{ type: 'text', text: 'Done with the wrap passage.' }] } });
  ids.wrap = (await app.ingest.importSource('claude-code', wrap)).recordingId;
  server = await startServer({ app, port: 0, token: 'synthetic-passage-layout' });
});
test.afterAll(async () => {
  if (server) await server.close(); if (app) await app.close();
  if (dir) { if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary directory'); rmSync(dir, { recursive: true, force: true }); }
});

async function open(page: Page, recording: Recording, width: number) {
  await page.setViewportSize({ width, height: 6000 });
  await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${ids[recording]}`);
  await expect(page.locator('.history article.op[data-op-id]').first()).toBeVisible();
  await expect(page.locator('.history .op .skeleton')).toHaveCount(0);
  await page.evaluate(()=>document.fonts.ready);
}

// Cards per visual row, per passage, per recording (the 'wrap' recording ends with the checkout-fix passages).
// Updated only for the delegated READ-4 wide-patch row contract; other row goldens are retained.
const GOLDEN: Record<Recording, Record<number, string[]>> = {
  claude: { 1024: ['1/1/1', '1/1', '1/1/1', '1/1/1/1'], 1280: ['1/2', '2', '2/1', '2/2'], 1440: ['2/1', '2', '2/1', '2/2'], 1920: ['3', '2', '3', '3/1'] },
  codex: { 1024: ['1/1', '1/1/1'], 1280: ['1/1', '2/1'], 1440: ['2', '2/1'], 1920: ['2', '3'] },
  wrap: {
    1024: ['1/1/1', '1/1', '1/1/1/1', '1/1/1/1/1/1/1/2/2/1'],
    1280: ['1/2', '2', '2/2', '1/1/2/2/2/3/1'],
    1440: ['2/1', '2', '2/2', '1/1/2/2/3/2/1'],
    1920: ['3', '2', '3/1', '1/1/4/4/1/1'],
  },
};

for (const recording of ['claude', 'codex', 'wrap'] as const) for (const width of WIDTHS) test(`${recording} @${width}: wrap, order and wires hold`, async ({ page }) => {
  await open(page, recording, width);
  // Wires are measured on a timer and after layout settles; poll until the frame is complete, then it must be clean.
  // The row structure is polled with the violations: under load the first clean-looking frame can still be a half-arrived one.
  const frame = async () => { const s = await snapshot(page); return { found: violations(s), rows: s.passages.map(p => rowsOf(p.cards).map(r => r.length).join('/')) }; };
  await expect.poll(frame, { timeout: 15_000, intervals: [250, 250, 500, 1000] }).toEqual({ found: [], rows: GOLDEN[recording][width] });
  const { passages, wires } = await snapshot(page);
  const pairs = passages.reduce((n, p) => n + Math.max(0, p.cards.length - 1), 0);
  expect(pairs).toBeGreaterThan(0);
  expect(wires).toHaveLength(pairs);
  if (recording === 'wrap' && width === 1920) await page.screenshot({path:resolve(`.local/read4-${process.env.READ4_PHASE??'after'}-1920.png`)});
});
