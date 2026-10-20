import { appendFileSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

// TURN-1b: a finished turn folds to its prompt and ledger without moving what the reader is looking at.
let dir: string, app: App, server: RunningServer, id: string;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-turn-fold-'));
  app = new App(join(dir, 'data'));
  // Three turns: the synthetic checkout fix, then two more prompts, each with enough output to make history scroll.
  const file = join(dir, 'turns.jsonl'); copyFileSync(resolve('fixtures/synthetic/claude/checkout-fix.jsonl'), file);
  const base = { cwd: '/home/dev/shop', sessionId: 'c0ffee00-0000-4000-8000-000000000001', version: '2.1.0' };
  let second = 0;
  const row = (r: object) => appendFileSync(file, JSON.stringify({ ...base, uuid: randomUUID(), timestamp: new Date(Date.UTC(2026, 8, 21, 11, 0, second++)).toISOString(), ...r }) + '\n');
  const prompt = (text: string) => row({ type: 'user', message: { role: 'user', content: text } });
  const call = (n: string, command: string) => {
    row({ type: 'assistant', message: { id: n, role: 'assistant', content: [{ type: 'tool_use', id: n, name: 'Bash', input: { command } }] } });
    row({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: n, content: Array.from({ length: 12 }, (_, i) => `${command} · line ${i + 1}`).join('\n') }] } });
  };
  prompt('Now run the whole suite and the linter.');
  for (let i = 0; i < 6; i++) call(`second${i}`, `pnpm run check:${i}`);
  prompt('Summarise what changed.');
  for (let i = 0; i < 3; i++) call(`third${i}`, `git diff --stat part${i}`);
  id = (await app.ingest.importSource('claude-code', file)).recordingId;
  server = await startServer({ app, port: 0, token: 'synthetic-turn-fold' });
});
test.afterAll(async () => {
  if (server) await server.close(); if (app) await app.close();
  if (dir) { if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary directory'); rmSync(dir, { recursive: true, force: true }); }
});

const top = async (locator: Locator) => (await locator.boundingBox())!.y;
// A rail jump can still be settling measured heights under load; take positions only once nothing moves.
async function settled(locator: Locator) {
  let last = NaN;
  await expect.poll(async () => { const now = await top(locator), same = Math.abs(now - last) < .5; last = now; return same; }, { intervals: [150] }).toBe(true);
  return last;
}
const chapter = (page: Page, prompt: string) => page.locator('.history .passage-slot', { hasText: prompt }).locator('.turn-fold');
const turnOf = (fold: Locator) => fold.evaluate((node) => node.closest<HTMLElement>('.passage-slot')!.dataset.inTurn!);
const cardsIn = (page: Page, turn: string) => page.locator(`.passage-slot[data-in-turn="${turn}"] article.op`);

async function open(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
  await expect(page.locator('.history article.op').first()).toBeVisible();
}
// Jump with the prompt rail, then nudge so the reader holds this place, as after reading back.
async function readFrom(page: Page, prompt: RegExp) {
  await page.getByRole('button', { name: prompt }).click();
  await page.locator('.history').hover();
  await page.mouse.wheel(0, -40);
  await expect(page.getByRole('button', { name: 'Back to latest' })).toBeVisible();
}

test('folding and unfolding a turn keeps its header still and hides only that turn', async ({ page }) => {
  await open(page);
  await readFrom(page, /^Go to prompt: Now run/);
  const second = chapter(page, 'Now run the whole suite');
  const turn = await turnOf(second);
  const before = await settled(second), cards = await cardsIn(page, turn).count();
  expect(cards).toBeGreaterThan(3);

  await second.click();
  await expect(second).toHaveAttribute('aria-expanded', 'false');
  await expect(cardsIn(page, turn)).toHaveCount(0);
  expect(Math.abs(await top(second) - before)).toBeLessThanOrEqual(1);
  // The next chapter moves up to sit under the folded one.
  expect(await top(chapter(page, 'Summarise what changed')) - before).toBeLessThan(160);

  await second.click();
  await expect(second).toHaveAttribute('aria-expanded', 'true');
  await expect(cardsIn(page, turn)).toHaveCount(cards);
  expect(Math.abs(await top(second) - before)).toBeLessThanOrEqual(1);
});

test('a fold survives reopening the session, and a jump into a folded turn opens it', async ({ page }) => {
  await open(page);
  await readFrom(page, /^Go to prompt: Free orders/);
  const first = chapter(page, 'Free orders');
  const turn = await turnOf(first);
  await first.click();
  await expect(cardsIn(page, turn)).toHaveCount(0);

  await page.reload();
  await expect(page.locator('.history article.op').first()).toBeVisible();
  await page.locator('.history').hover();
  await page.mouse.wheel(0, -100_000);
  await expect(chapter(page, 'Free orders')).toHaveAttribute('aria-expanded', 'false');
  await expect(cardsIn(page, turn)).toHaveCount(0);

  await page.getByRole('button', { name: /^Go to prompt: Free orders/ }).click();
  await expect(chapter(page, 'Free orders')).toHaveAttribute('aria-expanded', 'true');
  await expect(cardsIn(page, turn).first()).toBeVisible();
});

test('retained UIs never fold', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=classic&motion=0#/r/${id}`);
  await expect(page.locator('.history article.op').first()).toBeVisible();
  await expect(page.locator('.history .turn-fold')).toHaveCount(0);
});
