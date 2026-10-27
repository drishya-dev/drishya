import { appendFileSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
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

interface Box { id: string; l: number; r: number; t: number; b: number }
interface Passage { cards: Box[]; gap: number; room: number }
interface Wire { key: string; pts: { x: number; y: number }[] }
interface Snapshot { passages: Passage[]; wires: Wire[] }

async function open(page: Page, recording: Recording, width: number) {
  await page.setViewportSize({ width, height: 6000 });
  await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${ids[recording]}`);
  await expect(page.locator('.history article.op[data-op-id]').first()).toBeVisible();
}

const snapshot = (page: Page): Promise<Snapshot> => page.evaluate(() => {
  const passages = [...document.querySelectorAll<HTMLElement>('.history .ops-row')].map(row => {
    const style = getComputedStyle(row); const box = row.getBoundingClientRect();
    return {
      gap: parseFloat(style.columnGap) || 0,
      room: box.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
      cards: [...row.querySelectorAll<HTMLElement>('.op[data-op-id]')].map(card => { const r = card.getBoundingClientRect(); return { id: card.dataset.opId!, l: r.left, r: r.right, t: r.top, b: r.bottom }; }),
    };
  });
  const wires = [...document.querySelectorAll<SVGPathElement>('[data-flow-link]')].map(path => ({
    key: path.dataset.flowLink!,
    pts: [...path.getAttribute('d')!.matchAll(/[ML] (\S+) (\S+)/g)].map(m => ({ x: +m[1]!, y: +m[2]! })),
  }));
  return { passages, wires };
});

const rowsOf = (cards: Box[]) => {
  const rows: Box[][] = [];
  for (const card of cards) { const last = rows.at(-1); if (last && Math.abs(last[0]!.t - card.t) < 4) last.push(card); else rows.push([card]); }
  return rows;
};
const onEdge = (p: { x: number; y: number }, c: Box) => {
  const inX = p.x >= c.l - .5 && p.x <= c.r + .5, inY = p.y >= c.t - .5 && p.y <= c.b + .5;
  return (inY && (Math.abs(p.x - c.l) < .5 || Math.abs(p.x - c.r) < .5)) || (inX && (Math.abs(p.y - c.t) < .5 || Math.abs(p.y - c.b) < .5));
};
/** Wires are orthogonal, so a segment hits a card exactly when it passes through the card's inset interior. */
const crosses = (p: { x: number; y: number }, q: { x: number; y: number }, c: Box) =>
  p.y === q.y
    ? p.y > c.t + 1 && p.y < c.b - 1 && Math.max(p.x, q.x) > c.l + 1 && Math.min(p.x, q.x) < c.r - 1
    : p.x > c.l + 1 && p.x < c.r - 1 && Math.max(p.y, q.y) > c.t + 1 && Math.min(p.y, q.y) < c.b - 1;

/** Everything the READ-4 contract requires of one frame; an empty list means it holds. */
function violations({ passages, wires }: Snapshot): string[] {
  const found: string[] = []; const all = passages.flatMap(p => p.cards);
  passages.forEach((passage, pi) => {
    const { cards, gap, room } = passage; const rows = rowsOf(cards);
    // Row order is unambiguous: reading order is row-major, so a card's successor is either to its right on the
    // same row or the leftmost card of the next row down.
    for (let i = 1; i < cards.length; i++) {
      const a = cards[i - 1]!, b = cards[i]!;
      const sameRow = Math.abs(a.t - b.t) < 4;
      if (sameRow ? b.l < a.r : b.t <= a.t) found.push(`passage ${pi}: ${b.id} is out of reading order after ${a.id}`);
    }
    // Deterministic wrap: a row only starts when its first card could not have joined the row above.
    rows.forEach((row, ri) => {
      const above = rows[ri - 1]; if (!above) return;
      const used = above.reduce((n, c) => n + c.r - c.l, 0) + gap * (above.length - 1);
      const first = row[0]!;
      if (used + gap + (first.r - first.l) <= room + .5) found.push(`passage ${pi}: ${first.id} wrapped although it fits row ${ri - 1}`);
    });
    // Wires: one per consecutive pair, edge to edge, never through a card.
    for (let i = 1; i < cards.length; i++) {
      const a = cards[i - 1]!, b = cards[i]!;
      const wire = wires.find(w => w.key === `${a.id}/${b.id}`);
      if (!wire) { found.push(`passage ${pi}: no wire ${a.id} -> ${b.id}`); continue; }
      const start = wire.pts[0]!, end = wire.pts.at(-1)!;
      if (!onEdge(start, a)) found.push(`wire ${a.id} -> ${b.id} does not leave the previous card's edge`);
      if (!onEdge(end, b)) found.push(`wire ${a.id} -> ${b.id} does not enter the next card's edge`);
      if (Math.abs(a.t - b.t) < 4 && !(wire.pts.length === 4 && start.y === end.y && Math.abs(start.x - a.r) < .5 && Math.abs(end.x - b.l) < .5)) found.push(`wire ${a.id} -> ${b.id}: neighbours on one row must join right edge to left edge`);
    }
  });
  for (const wire of wires) for (let k = 1; k < wire.pts.length; k++) for (const card of all)
    if (crosses(wire.pts[k - 1]!, wire.pts[k]!, card)) found.push(`wire ${wire.key} crosses ${card.id}`);
  return found;
}

// Cards per visual row, per passage, per recording (the 'wrap' recording ends with the checkout-fix passages).
// Pinned from the measured layout on 26 October; a change here is a layout change and needs a builder decision.
const GOLDEN: Record<Recording, Record<number, string[]>> = {
  claude: { 1024: ['1/1/1', '1/1', '1/1/1', '1/1/1/1'], 1280: ['1/2', '2', '2/1', '2/2'], 1440: ['2/1', '2', '2/1', '2/2'], 1920: ['3', '2', '3', '3/1'] },
  codex: { 1024: ['1/1', '1/1/1'], 1280: ['1/1', '2/1'], 1440: ['2', '2/1'], 1920: ['2', '3'] },
  wrap: {
    1024: ['1/1/1', '1/1', '1/1/1/1', '1/1/1/1/1/1/1/2/2/1'],
    1280: ['1/2', '2', '2/2', '1/1/2/2/2/3/1'],
    1440: ['2/1', '2', '2/2', '1/1/2/2/3/2/1'],
    1920: ['3', '2', '3/1', '3/3/4/2'],
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
});
