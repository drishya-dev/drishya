import { appendFileSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string, app: App, server: RunningServer, ids: Record<string, string> = {};
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-hover-fit-'));
  app = new App(join(dir, 'data'));
  for (const [harness, file] of [['claude-code', 'claude/checkout-fix.jsonl'], ['codex', 'codex/rollout-checkout-review.jsonl']] as const)
    ids[harness] = (await app.ingest.importSource(harness, resolve('fixtures/synthetic', file))).recordingId;
  // The 'short' session adds cards that hold very little, and one with a long command and a one-word result:
  // the cases where a padded hover box shows.
  const short = join(dir, 'short.jsonl'); copyFileSync(resolve('fixtures/synthetic/claude/checkout-fix.jsonl'), short);
  const base = { cwd: '/home/dev/shop', sessionId: 'c0ffee00-0000-4000-8000-000000000001', version: '2.1.0', timestamp: '2026-10-05T12:30:00.000Z' };
  const row = (r: object) => appendFileSync(short, JSON.stringify({ ...base, uuid: randomUUID(), ...r }) + '\n');
  const pair = (n: string, name: string, input: object, out: string) => { row({ type: 'assistant', message: { id: n, role: 'assistant', content: [{ type: 'tool_use', id: n, name, input }] } }); row({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: n, content: out }] } }); };
  pair('s1', 'Bash', { command: 'ls' }, 'ok'); pair('s2', 'Bash', { command: 'git status --short' }, ''); pair('s3', 'Read', { file_path: '/home/dev/shop/a.ts' }, '1	export const a = 1;'); pair('s4', 'Grep', { pattern: 'needle' }, 'a.ts:1:needle');
  const heredoc = ['cat > p.mjs <<EOF', ...Array.from({ length: 14 }, (_, i) => `const line${i} = readFileSync(path, "utf8").replace(/a/g, "b");`), 'EOF'].join('\n');
  pair('s5', 'Bash', { command: heredoc }, 'ok');
  ids.short = (await app.ingest.importSource('claude-code', short)).recordingId;
  server = await startServer({ app, port: 0, token: 'synthetic-hover-fit' });
});
test.afterAll(async () => {
  if (server) await server.close(); if (app) await app.close();
  if (dir) { if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary directory'); rmSync(dir, { recursive: true, force: true }); }
});

// Empty band between the last piece of content in a hovered card and the card's bottom edge.
const emptyBand = (card: import("@playwright/test").Locator) => card.evaluate(node => {
  const box = node.getBoundingClientRect();
  let bottom = box.top;
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  for (let text = walker.nextNode(); text; text = walker.nextNode()) {
    if (!text.textContent?.trim() || text.parentElement?.closest('.op-info')) continue;
    const range = document.createRange(); range.selectNodeContents(text);
    // Text scrolled or clipped out of an overflow container is not on screen, so it does not count as content.
    const clips: DOMRect[] = [];
    for (let el = text.parentElement; el && el !== node; el = el.parentElement) if (getComputedStyle(el).overflowY !== "visible") clips.push(el.getBoundingClientRect());
    for (const r of range.getClientRects()) {
      const top = Math.max(r.top, ...clips.map(c => c.top)), low = Math.min(r.bottom, box.bottom, ...clips.map(c => c.bottom));
      if (r.height && low > top + 1) bottom = Math.max(bottom, low);
    }
  }
  return { kind: node.className.split(" ").filter(c => c.startsWith("op-") ).join(" "), height: Math.round(box.height), band: Math.round(box.bottom - bottom) };
});

for (const harness of ['codex', 'short'] as const) test(`${harness}: a hovered card is as tall as its content, never padded`, async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${ids[harness]}`);
  const cards = page.locator('.history article.op[data-op-id]');
  await expect(cards.first()).toBeVisible();
  const opIds = await cards.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-op-id')!));
  const found: unknown[] = [];
  for (const opId of opIds) {
    const card = page.locator(`.history article.op[data-op-id="${opId}"]`);
    await card.scrollIntoViewIfNeeded();
    await page.mouse.move(5, 5);
    await card.locator('.op-head').first().hover();
    try { await expect(card).toHaveAttribute('data-hover-reading', 'focused', { timeout: 2000 }); } catch { continue; }   // under the header or too close to an edge: hover reading declines, which is fine }
    found.push(await emptyBand(card));
    await page.keyboard.press('Escape');
    await expect(page.locator('.op[data-hover-reading]')).toHaveCount(0);
  }
  // Padding and borders account for ~20 px; anything past 48 px is a visibly empty band (UI-9).
  expect(found.length).toBeGreaterThan(4);
  for (const card of found as { kind: string; height: number; band: number }[]) expect(card.band, `${card.kind} (${card.height}px)`).toBeLessThanOrEqual(48);
});
