import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from './browser-server.ts';
import { writeLongSession } from './conversation-fixture.ts';

let dir: string, app: App, server: RunningServer, id: string;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-conversation-scroll-')); app = new App(join(dir, 'store')); server = await startServer({ app, port: 0 });
  id = (await app.ingest.importSource('claude-code', writeLongSession(dir, 'long'))).recordingId;
});
test.afterAll(async () => { await server?.close(); await app?.close(); if (dir) { if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); } });

// UI-41b: in Conversation mode a screen holds many short rows, so the paged history is outrun far sooner than in Work. Scrolling
// up through many pages must not flash "Loading session…", leave rows missing, or move what the reader is looking at.
const open = async (page: Page) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
  await expect(page.getByRole('region', { name: 'Session work' })).toBeVisible();
  await page.getByRole('group', { name: 'Read the session as' }).getByRole('button', { name: 'Conversation' }).click();
  await expect(page.locator('.history .run-line').first()).toBeVisible();
};

/** What is in the history's viewport: loading slots, and each prompt and message by its number. */
const inView = (page: Page) => page.evaluate(() => {
  const history = document.querySelector('.history')!, box = history.getBoundingClientRect();
  const shown = (el: Element) => { const b = el.getBoundingClientRect(); return b.height > 0 && b.bottom > box.top && b.top < box.bottom; };
  const slots = [...history.querySelectorAll<HTMLElement>('.passage-slot')].filter(shown);
  const text = slots.map((slot) => slot.textContent ?? '').join('\n');
  return {
    loading: slots.filter((slot) => slot.dataset.unloaded === 'true').length,
    empty: slots.filter((slot) => slot.dataset.folded !== 'hidden' && slot.dataset.unloaded !== 'true' && !slot.querySelector('.prose,.turn,.run-line,article,.context-evidence')).length,
    prompts: [...text.matchAll(/Prompt (\d+):/g)].map((m) => Number(m[1])),
    messages: [...text.matchAll(/Message (\d+)-([ab]):/g)].map((m) => `${m[1]}${m[2]}`),
  };
});
const settled = async (page: Page) => {
  // Settled means the rows in view are real ones: no loading slot, no empty slot, and the messages themselves are there.
  await expect.poll(async () => { const s = await inView(page); return s.loading + s.empty === 0 && s.prompts.length + s.messages.length > 0; }, { timeout: 15000 }).toBe(true);
};

test('scrolling up fast through many pages: a loading slot is brief, no row is missing, nothing moves once it settles', async ({ page }) => {
  await open(page);
  const history = page.locator('.history');
  await page.waitForTimeout(1500); // the newest page has rendered and measured, as when a reader starts scrolling
  await history.hover();
  await page.evaluate(() => {
    (window as unknown as { frames: { loading: number }[] }).frames = [];
    const sample = () => {
      const h = document.querySelector('.history')!, box = h.getBoundingClientRect();
      const loading = [...h.querySelectorAll<HTMLElement>('.passage-slot[data-unloaded=true]')].filter((s) => { const b = s.getBoundingClientRect(); return b.bottom > box.top && b.top < box.bottom; }).length;
      (window as unknown as { frames: { loading: number }[] }).frames.push({ loading });
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  let requests = 0;
  page.on('request', (request) => { if (request.url().endsWith('/history')) requests++; });
  // About 8,000 px a second, the speed of a reader dragging the wheel up, for roughly forty screens.
  for (let i = 0; i < 100; i++) { await page.mouse.wheel(0, -400); await page.waitForTimeout(50); }
  const frames = await page.evaluate(() => (window as unknown as { frames: { loading: number }[] }).frames);
  const flashed = frames.filter((frame) => frame.loading > 0).length;
  // At most a blink: under 5 % of the frames, and the loader does not thrash (pages used to take turns evicting each other).
  expect(flashed / frames.length, `${flashed} of ${frames.length} frames showed a loading slot (${requests} page requests)`).toBeLessThan(0.05);
  expect(requests, 'history page requests while scrolling').toBeLessThan(80);

  await settled(page);
  const view = await inView(page);
  expect(view.prompts.length).toBeGreaterThan(0);
  // Every prompt in view has both of its messages rendered (the last one may continue below the viewport).
  for (const turn of view.prompts.slice(0, -1)) for (const part of ['a', 'b']) expect(view.messages, `turn ${turn} message ${part}`).toContain(`${turn}${part}`);

  // The anchor holds: what the reader is looking at does not move while pages finish arriving.
  const anchor = history.locator('.run-line').nth(1);
  const before = (await anchor.boundingBox())!.y;
  await page.waitForTimeout(1500);
  expect(Math.abs((await anchor.boundingBox())!.y - before)).toBeLessThan(2);
});

test('jumping around the scrollbar always settles on loaded rows', async ({ page }) => {
  await open(page);
  const history = page.locator('.history');
  await history.hover();
  await page.mouse.wheel(0, -100); // a reader's first scroll lets Follow go; a script setting scrollTop does not
  for (const fraction of [0.9, 0.4, 0.75, 0.1, 0.55, 0.3, 0.95, 0.02]) {
    await history.evaluate((el, f) => { el.scrollTop = Math.floor((el.scrollHeight - el.clientHeight) * f); }, fraction);
    await settled(page);
    const view = await inView(page);
    expect(view.prompts.length + view.messages.length, `content at ${fraction}`).toBeGreaterThan(0);
    for (const turn of view.prompts.slice(0, -1)) for (const part of ['a', 'b']) expect(view.messages, `turn ${turn} message ${part} at ${fraction}`).toContain(`${turn}${part}`);
  }
});
