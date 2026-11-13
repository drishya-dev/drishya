import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';
import { writeLongSession } from './conversation-fixture.ts';

let dir: string, app: App, server: RunningServer, id: string;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-conversation-switch-')); app = new App(join(dir, 'store')); server = await startServer({ app, port: 0 });
  id = (await app.ingest.importSource('claude-code', writeLongSession(dir, 'long'))).recordingId;
});
test.afterAll(async () => { await server?.close(); await app?.close(); if (dir) { if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); } });

// UI-41c: switching Work and Conversation keeps the reader's place. The thing at the top of the view (a prompt, a message, or a
// run's cards, which Conversation shows as the run's line) stays at the same distance from the top, in a long paged session.
const PART = '.passage-slot:not([data-folded=hidden]):not([data-unloaded=true]) :is(.turn, .prose, .ops-row, .run-line)';
const mode = (page: Page, name: 'Work' | 'Conversation') => page.getByRole('group', { name: 'Read the session as' }).getByRole('button', { name });

/** The first part of the history that reaches into the view: what it is, what it says, and how far from the top it starts. */
const topPart = (page: Page) => page.evaluate((selector) => {
  const history = document.querySelector('.history')!, box = history.getBoundingClientRect();
  const part = [...history.querySelectorAll<HTMLElement>(selector)].find((el) => el.getBoundingClientRect().bottom > box.top + 1);
  const kind = part?.matches('.turn') ? 'turn' : part?.matches('.prose') ? 'prose' : part?.matches('.ops-row') ? 'cards' : part?.matches('.run-line') ? 'line' : 'none';
  return { kind, text: (part?.textContent ?? '').slice(0, 60), offset: part ? Math.round(part.getBoundingClientRect().top - box.top) : NaN };
}, PART);

async function placeInMiddle(page: Page, kind: 'turn' | 'prose' | 'ops') {
  const history = page.locator('.history');
  await history.hover();
  await page.mouse.wheel(0, -200); // a reader's first scroll lets Follow go; a script setting scrollTop does not
  await history.evaluate((el) => { el.scrollTop = Math.floor((el.scrollHeight - el.clientHeight) * 0.5); });
  await page.waitForTimeout(1500);
  // Put the chosen kind of part a few pixels above the top edge, so it is the one the reader is "at".
  const selector = kind === 'turn' ? '.turn' : kind === 'prose' ? '.prose' : '.ops-row, .run-line';
  await history.evaluate((el, sel) => {
    const box = el.getBoundingClientRect();
    const part = [...el.querySelectorAll<HTMLElement>(`.passage-slot:not([data-folded=hidden]):not([data-unloaded=true]) :is(${sel})`)].find((p) => p.getBoundingClientRect().top > box.top + 150);
    if (part) el.scrollTop += part.getBoundingClientRect().top - box.top + 8;
  }, selector);
  await page.waitForTimeout(1200);
}

// First: a recording that has never been opened has no saved reading place for the daemon to restore, so Follow is on.
test('a reader who is following the latest stays on the latest when switching', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
  await expect(page.getByRole('region', { name: 'Session work' })).toBeVisible();
  await page.waitForTimeout(1500);
  for (const target of ['Conversation', 'Work'] as const) {
    await mode(page, target).click();
    await expect.poll(() => page.locator('.history').evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop), { timeout: 8000 }).toBeLessThan(40);
  }
});

for (const kind of ['turn', 'prose', 'ops'] as const) {
  test(`switching both ways keeps ${kind === 'ops' ? "a run's cards (or its line)" : kind === 'turn' ? 'a prompt' : 'an agent message'} where it was, in the middle of a long session`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible();
    await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
    await expect(page.getByRole('region', { name: 'Session work' })).toBeVisible();
    await expect(page.locator('.history .passage-slot').first()).toBeVisible();
    await page.waitForTimeout(1000);
    await placeInMiddle(page, kind);
    const start = await topPart(page);
    expect(start.kind, 'the setup put the wanted part at the top').toBe(kind === 'ops' ? 'cards' : kind);
    const middle = await page.locator('.history').evaluate((el) => el.scrollTop / (el.scrollHeight - el.clientHeight));
    expect(middle, 'the reader is in the middle, not at either end').toBeGreaterThan(0.2);

    for (const [target, wantKind] of [['Conversation', kind === 'ops' ? 'line' : kind], ['Work', kind === 'ops' ? 'cards' : kind], ['Conversation', kind === 'ops' ? 'line' : kind], ['Work', kind === 'ops' ? 'cards' : kind]] as const) {
      
      await mode(page, target).click();
      // The same thing, at the same distance from the top (a run's cards become its line, and back).
      let seen = '';
      await expect.poll(async () => { const now = await topPart(page); seen = JSON.stringify(now); return now.kind === wantKind && (kind === 'ops' || now.text === start.text) && Math.abs(now.offset - start.offset) <= 3; }, { timeout: 15000 }).toBe(true).catch((error) => { throw new Error(`after switching to ${target}: wanted ${wantKind} like ${JSON.stringify(start)}, last saw ${seen}
${error.message}`); });
      // And it stays there once the reflow and any page loads have finished.
      await page.waitForTimeout(800);
      const settled = await topPart(page);
      expect(settled.kind).toBe(wantKind);
      expect(Math.abs(settled.offset - start.offset), `offset after ${target}`).toBeLessThanOrEqual(3);
    }
    const end = await page.locator('.history').evaluate((el) => el.scrollTop / (el.scrollHeight - el.clientHeight));
    expect(end, 'never thrown to the latest').toBeLessThan(0.8);
  });
}

