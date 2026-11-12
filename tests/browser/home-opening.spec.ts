// SHIP-3: Home opens like the website's first screen; the session library is a sheet that comes up on scroll,
// with a small overview (activity by day, totals, recent workspaces) above the list.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string, app: App, server: RunningServer, claudeId: string, codexId: string;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-home-opening-'));
  app = new App(dir);
  claudeId = (await app.ingest.importSource('claude-code', resolve('fixtures/synthetic/claude/checkout-fix.jsonl'))).recordingId;
  codexId = (await app.ingest.importSource('codex', resolve('fixtures/synthetic/codex/rollout-checkout-review.jsonl'))).recordingId;
  server = await startServer({ app, port: 0 });
});
test.afterAll(async () => {
  await server?.close(); await app?.close();
  if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path');
  rmSync(dir, { recursive: true, force: true });
});

// `count` listed sessions across three workspaces, three a day going back; the two imported recordings come first.
async function home(page: Page, count: number) {
  const day = 86400000, at = (i: number) => new Date(Date.now() - 600000 - Math.floor(i / 3) * day).toISOString();
  const recordings = Array.from({ length: count }, (_, i) => ({
    id: i === 0 ? claudeId : i === 1 ? codexId : `rec_listed_${i}`, harness: i % 3 === 1 ? 'codex' : 'claude-code', title: `Listed session ${String(i + 1).padStart(3, '0')}`,
    workspaceRoot: `/work/${['alpha', 'beta', 'gamma'][i % 3]}`, createdAt: at(i), updatedAt: at(i), lastSourceTime: at(i), observationCount: 12, live: false, pinned: false, health: { state: 'idle', live: false },
  }));
  await page.route('**/v1/recordings', route => route.fulfill({ json: { recordings } }));
  await page.route('**/v1/sources', route => route.fulfill({ json: { sources: [], errors: [] } }));
  await page.goto(server.launchUrl);
  await expect(page.locator('.mh-home')).toBeVisible();
}
const docked = (page: Page) => page.evaluate(() => document.querySelector('.mh-home')!.classList.contains('mh-docked'));

for (const [width, height] of [[1440, 900], [600, 900], [1280, 720]] as const) test(`${width}x${height}: the opening fills the first screen and the top of the sheet shows in it`, async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(String(error)));
  await page.setViewportSize({ width, height });
  await home(page, 60);
  await expect(page.locator('.mh-opening-line')).toHaveText('See the work behind the change.');
  for (const part of ['.mh-opening-mark', '.mh-wordmark', '.mh-opening-line', '.mh-latest', '.mh-browse', '.mh-opening-facts']) await expect(page.locator(part), part).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('heading', { name: 'Your sessions.' })).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('link', { name: 'Star on GitHub' })).toBeInViewport();
  // The first action is the latest session when nothing is running or resumable.
  await expect(page.locator('.mh-latest')).toContainText('Listed session 001');
  // Nothing in the opening overlaps anything else in it, and the words stay clear of the sheet.
  const layout = await page.evaluate(() => {
    const box = (el: Element) => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; };
    const parts = [...document.querySelectorAll('.mh-opening-mark,.mh-wordmark,.mh-opening-line,.mh-opening-actions,.mh-opening-facts')].map(box);
    return { ordered: parts.every((p, i) => i === 0 || p.top >= parts[i - 1]!.bottom - 1), clear: parts.at(-1)!.bottom <= box(document.querySelector('.mh-sheet')!).top, mark: document.querySelector('.mh-opening-mark .brand-mark')!.getBoundingClientRect().width };
  });
  expect(layout.ordered, 'opening parts stack without overlap').toBe(true);
  expect(layout.clear, 'the words end above the sheet').toBe(true);
  expect(layout.mark).toBeGreaterThanOrEqual(52);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('scrolling brings the sheet up, then scrolls the list; scrolling back returns to the opening', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await home(page, 200);
  const list = page.locator('.mh-session-list'), scroller = page.locator('.mh-scroll');
  expect(await docked(page)).toBe(false);
  // Before the sheet is docked the wheel moves the page, never the list; the footer passes the wheel through.
  await page.mouse.move(720, 880); await page.mouse.wheel(0, 200);
  await expect.poll(() => scroller.evaluate(el => el.scrollTop)).toBeGreaterThan(100);
  expect(await list.evaluate(el => el.scrollTop)).toBe(0);
  await page.mouse.move(720, 500); await page.mouse.wheel(0, 3000);
  await expect.poll(() => docked(page)).toBe(true);
  await expect(page.locator('.mh-opening')).not.toBeInViewport();
  await page.mouse.move(800, 600); await page.mouse.wheel(0, 900);
  await expect.poll(() => list.evaluate(el => el.scrollTop)).toBeGreaterThan(500);
  // Back: the list first, then the page.
  await page.mouse.wheel(0, -4000); await expect.poll(() => list.evaluate(el => el.scrollTop)).toBe(0);
  await page.mouse.wheel(0, -4000);
  await expect.poll(() => docked(page)).toBe(false);
  await expect(page.locator('.mh-opening-line')).toBeInViewport({ ratio: 1 });
});

test('Browse, the search field and a recent workspace each dock the sheet', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await home(page, 60);
  const top = () => page.locator('.mh-scroll').evaluate(el => el.scrollTo(0, 0));
  await page.getByRole('button', { name: /Browse 60 sessions/ }).click();
  await expect.poll(() => docked(page)).toBe(true);
  await top(); await expect.poll(() => docked(page)).toBe(false);
  await page.getByRole('textbox', { name: 'Find sessions', exact: true }).focus();
  await expect.poll(() => docked(page)).toBe(true);
  await top(); await expect.poll(() => docked(page)).toBe(false);
  await page.getByRole('group', { name: 'Recent workspaces' }).getByRole('button', { name: /beta/ }).click();
  await expect.poll(() => docked(page)).toBe(true);
  await expect(page.locator('.mh-results>header h2')).toHaveText('beta');
  await expect(page.locator('.mh-results>header')).toContainText('20 sessions');
});

test('the first action opens the latest session', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await home(page, 6);
  await page.locator('.mh-latest').click();
  await expect(page).toHaveURL(new RegExp(`#/r/${claudeId}`));
});

test('the overview counts exactly what the list holds', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await home(page, 60);
  const overview = page.getByRole('region', { name: 'Overview' });
  // 60 sessions, three a day: 21 in the last seven days; 40 Claude Code and 20 Codex; three workspaces.
  await expect(overview.locator('.mh-ov-totals')).toContainText('Sessions60');
  await expect(overview.locator('.mh-ov-totals')).toContainText('This week21');
  await expect(overview.locator('.mh-ov-totals')).toContainText('Workspaces3');
  await expect(overview.locator('.mh-ov-harness')).toContainText('Claude Code 40 · Codex 20');
  const cells = overview.locator('.mh-ov-grid i');
  await expect(cells).toHaveCount(84);
  // Twenty days of three sessions each, ending today: twenty lit cells, all at the top level.
  await expect(overview.locator('.mh-ov-grid i[data-level="4"]')).toHaveCount(20);
  await expect(overview.locator('.mh-ov-grid i[data-level="0"]')).toHaveCount(64);
  await expect(cells.last()).toHaveAttribute('title', /^3 sessions · /);
  await expect(overview.getByRole('group', { name: 'Recent workspaces' }).getByRole('button')).toHaveCount(3);
  await expect(overview.getByRole('group', { name: 'Recent workspaces' }).getByRole('button').first()).toContainText('20 sessions');
});

test('a short window keeps the list: the overview is one line of totals', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await home(page, 60);
  await page.getByRole('button', { name: /Browse 60 sessions/ }).click();
  await expect.poll(() => docked(page)).toBe(true);
  await expect(page.locator('.mh-ov-grid')).toBeHidden();
  await expect(page.locator('.mh-ov-recent')).toBeHidden();
  await expect(page.locator('.mh-ov-totals')).toBeVisible();
  expect((await page.locator('.mh-overview').boundingBox())!.height).toBeLessThan(44);
  expect(await page.locator('.mh-session').evaluateAll(rows => rows.filter(row => { const r = row.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }).length)).toBeGreaterThanOrEqual(4);
});

test('with no sessions the opening still stands and there is no overview', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await home(page, 0);
  await expect(page.locator('.mh-opening-line')).toBeInViewport({ ratio: 1 });
  await expect(page.locator('.mh-latest,.mh-resume')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Overview' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Your agents. In view.' })).toBeInViewport();
});
