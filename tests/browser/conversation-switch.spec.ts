import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from './browser-server.ts';
import { writeLongSession } from './conversation-fixture.ts';
import { attachBrowserDiagnostics, installBrowserDiagnostics, sampleBrowserState } from './ci-diagnostics.ts';

let dir: string, app: App, server: RunningServer, id: string;
test.beforeEach(async ({ page }) => { await installBrowserDiagnostics(page); });
test.afterEach(async ({ page }, info) => { await attachBrowserDiagnostics(page, info); });
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
  const slot = part?.closest<HTMLElement>('.passage-slot[data-passage-id]');
  const kind = part?.matches('.turn') ? 'turn' : part?.matches('.prose') ? 'prose' : part?.matches('.ops-row') ? 'cards' : part?.matches('.run-line') ? 'line' : 'none';
  return { passageId: slot?.dataset.passageId, kind, text: (part?.textContent ?? '').slice(0, 60), offset: part ? Math.round(part.getBoundingClientRect().top - box.top) : NaN };
}, PART);

async function placeNear(page: Page, fraction: number, kind: 'turn' | 'prose' | 'ops' = 'ops') {
  const history = page.locator('.history');
  await sampleBrowserState(page, 'before-place-near');
  await history.hover();
  await page.mouse.wheel(0, -200); // disable follow
  await sampleBrowserState(page, 'after-wheel');
  await history.evaluate((el, f) => { el.scrollTop = Math.floor((el.scrollHeight - el.clientHeight) * f); }, fraction);
  await sampleBrowserState(page, 'after-proportional-scroll');
  await page.waitForTimeout(1500);
  await sampleBrowserState(page, 'before-part-alignment');
  const selector = kind === 'turn' ? '.turn' : kind === 'prose' ? '.prose' : '.ops-row, .run-line';
  await history.evaluate((el, sel) => {
    const box = el.getBoundingClientRect();
    const part = [...el.querySelectorAll<HTMLElement>(`.passage-slot:not([data-folded=hidden]):not([data-unloaded=true]) :is(${sel})`)].find((p) => p.getBoundingClientRect().top > box.top + 80);
    if (part) el.scrollTop += part.getBoundingClientRect().top - box.top + 8;
  }, selector);
  await page.waitForTimeout(1200);
  await sampleBrowserState(page, 'after-part-alignment');
}

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

// UI-41d: Switching Work to Conversation near the top, near the bottom, and at narrow 600 px window width.
test('switching Work to Conversation near the top keeps the reading place at 1440 and 600', async ({ page }) => {
  for (const width of [1440, 600]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible();
    await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
    await expect(page.getByRole('region', { name: 'Session work' })).toBeVisible();
    await expect(page.locator('.history .passage-slot').first()).toBeVisible();
    await page.waitForTimeout(1000);
    await placeNear(page, 0.05, 'turn');
    const start = await topPart(page);
    expect(start.kind).toBe('turn');

    await mode(page, 'Conversation').click();
    await expect.poll(async () => {
      const now = await topPart(page);
      return now.kind === 'turn' && now.passageId === start.passageId && Math.abs(now.offset - start.offset) <= 6;
    }, { timeout: 15000 }).toBe(true);

    await mode(page, 'Work').click();
    await expect.poll(async () => {
      const now = await topPart(page);
      return now.kind === 'turn' && now.passageId === start.passageId && Math.abs(now.offset - start.offset) <= 6;
    }, { timeout: 15000 }).toBe(true);
  }
});

test('switching Work to Conversation near the bottom keeps the same passage and never falls back to the bottom', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
  await expect(page.getByRole('region', { name: 'Session work' })).toBeVisible();
  await expect(page.locator('.history .passage-slot').first()).toBeVisible();
  await page.waitForTimeout(1000);
  await placeNear(page, 0.82, 'ops');
  const start = await topPart(page);
  expect(start.kind).toBe('cards');
  const middle = await page.locator('.history').evaluate((el) => el.scrollTop / (el.scrollHeight - el.clientHeight));
  expect(middle).toBeGreaterThan(0.7);

  await mode(page, 'Conversation').click();
  await expect.poll(async () => {
    const now = await topPart(page);
    return now.kind === 'line' && now.passageId === start.passageId && Math.abs(now.offset - start.offset) <= 6;
  }, { timeout: 15000 }).toBe(true);

  const convEnd = await page.locator('.history').evaluate((el) => el.scrollTop / (el.scrollHeight - el.clientHeight));
  expect(convEnd, 'never thrown to the bottom').toBeLessThan(0.95);

  await mode(page, 'Work').click();
  await expect.poll(async () => {
    const now = await topPart(page);
    return now.kind === 'cards' && now.passageId === start.passageId && Math.abs(now.offset - start.offset) <= 6;
  }, { timeout: 15000 }).toBe(true);

  const workEnd = await page.locator('.history').evaluate((el) => el.scrollTop / (el.scrollHeight - el.clientHeight));
  expect(workEnd, 'never thrown to the bottom').toBeLessThan(0.95);
});

test('switching both ways at 600 px keeps a run cards (or line) where it was', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 900 });
  await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
  await expect(page.getByRole('region', { name: 'Session work' })).toBeVisible();
  await expect(page.locator('.history .passage-slot').first()).toBeVisible();
  await page.waitForTimeout(1000);
  await placeInMiddle(page, 'ops');
  const start = await topPart(page);
  expect(start.kind).toBe('cards');

  for (const [target, wantKind] of [['Conversation', 'line'], ['Work', 'cards'], ['Conversation', 'line'], ['Work', 'cards']] as const) {
    await mode(page, target).click();
    await expect.poll(async () => {
      const now = await topPart(page);
      return now.kind === wantKind && Math.abs(now.offset - start.offset) <= 6;
    }, { timeout: 15000 }).toBe(true);
  }
});



// UI-41e: the real path. A reader scrolls with the wheel or the scrollbar to wherever the view happens to be (usually the middle
// of a tall run's cards, not at the top edge of anything), then clicks Conversation and Work. The place that comes back is the
// same turn, never the end of the page, however far into a tall card the view was. The first fixture's runs are short, so this
// one has long runs (30 reads each), which is what a real session looks like.
let tallId: string;
test.describe('the place survives a reader at any scroll position', () => {
  test.beforeAll(async () => { tallId = (await app.ingest.importSource('claude-code', writeLongSession(dir, 'tall', 170, 30))).recordingId; });

  /** Which turn the view is in: the passage slot's own turn (its prompt's step), for whatever part is at the top. */
  const turnAtTop = (page: Page) => page.evaluate((selector) => {
    const history = document.querySelector('.history')!, box = history.getBoundingClientRect();
    const parts = [...history.querySelectorAll<HTMLElement>(selector)];
    const part = parts.find((el) => el.getBoundingClientRect().bottom > box.top + 1);
    const slot = part?.closest<HTMLElement>('.passage-slot');
    const turn = slot?.dataset.inTurn;
    return { turn, kind: part?.matches('.ops-row') ? 'cards' : part?.matches('.run-line') ? 'line' : part?.matches('.turn') ? 'turn' : part?.matches('.prose') ? 'prose' : 'none', offset: part ? Math.round(part.getBoundingClientRect().top - box.top) : NaN, scroll: history.scrollTop / Math.max(1, history.scrollHeight - history.clientHeight) };
  }, PART);

  /** Is that turn's work anywhere in the view? */
  const turnInView = (page: Page, turn: string) => page.evaluate((wanted) => {
    const history = document.querySelector('.history')!, box = history.getBoundingClientRect();
    return [...history.querySelectorAll<HTMLElement>('.passage-slot:not([data-folded=hidden]):not([data-unloaded=true])')].some((el) => el.dataset.inTurn === wanted && el.getBoundingClientRect().bottom > box.top && el.getBoundingClientRect().top < box.bottom);
  }, turn);

  for (const width of [1440, 600]) for (const fraction of [0.25, 0.5, 0.8]) {
    test(`Work to Conversation and back from ${Math.round(fraction * 100)}% keeps the turn at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible();
      await page.goto(`${server.url}/?experience=modern#/r/${tallId}`);
      await expect(page.getByRole('region', { name: 'Session work' })).toBeVisible();
      await expect(page.locator('.history .passage-slot').first()).toBeVisible();
      await page.waitForTimeout(1500);
      const history = page.locator('.history');
      await history.hover(); await page.mouse.wheel(0, -200); // the reader's first scroll lets Follow go
      await history.evaluate((el, f) => { el.scrollTop = Math.floor((el.scrollHeight - el.clientHeight) * f); }, fraction);
      await page.waitForTimeout(1500);
      // Go on to a place deep inside a tall run's cards: what a wheel leaves behind as often as not.
      await history.evaluate((el, [selector, depth]) => {
        const box = el.getBoundingClientRect();
        const card = [...el.querySelectorAll<HTMLElement>(selector)].find((p) => p.getBoundingClientRect().height > 700 && p.getBoundingClientRect().bottom > box.top + 900);
        if (card) el.scrollTop += card.getBoundingClientRect().top - box.top + depth;
      }, [".passage-slot:not([data-folded=hidden]):not([data-unloaded=true]) .ops-row", Math.round(fraction * 2400)] as const);
      await page.waitForTimeout(1500);
      const start = await turnAtTop(page);
      expect(start.turn, 'the setup found a turn').toBeDefined();
      expect(start.scroll, 'the reader is not at the end').toBeLessThan(0.95);

      for (const [target, round] of [['Conversation', 1], ['Work', 1], ['Conversation', 2], ['Work', 2]] as const) {
        await mode(page, target).click();
        await page.waitForTimeout(2500);
        const now = await turnAtTop(page);
        const label = `${target} #${round}`;
        if (target === 'Conversation' && now.scroll > 0.95) {
          // A place within the last screen of a short page cannot sit at the top of it: the page ends, and the place is in view.
          expect(await turnInView(page, start.turn!), `${label}: at the end of the page, the turn is still in view`).toBe(true);
        } else {
          expect(now.turn, `${label}: the turn at the top (was ${start.turn})`).toBe(start.turn);
          if (target === 'Conversation') expect(now.scroll, `${label}: not thrown to the end`).toBeLessThan(0.95);
        }
        // Back in Work with no scrolling in between, the reader is exactly where they were, deep inside the cards or not.
        if (target === 'Work') expect(Math.abs(now.offset - start.offset), `${label}: pixels from the top`).toBeLessThanOrEqual(8);
      }
    });
  }
});
