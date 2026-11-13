// Yash, 13 Nov: the reading column starts after the Files panel (or its chips, when minimised) and ends before the
// Toolbox, with the same gap at both ends, at every zoom (1152 is a 1440 screen at 125 %).
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string, app: App, server: RunningServer, id: string;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-reading-column-'));
  app = new App(dir);
  id = (await app.ingest.importSource('claude-code', resolve('fixtures/synthetic/claude/checkout-fix.jsonl'))).recordingId;
  server = await startServer({ app, port: 0 });
});
test.afterAll(async () => {
  await server?.close(); await app?.close();
  if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path');
  rmSync(dir, { recursive: true, force: true });
});

const gaps = (page: Page) => page.evaluate(() => {
  const vis = (s: string) => [...document.querySelectorAll<HTMLElement>(s)].filter(e => getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0).map(e => e.getBoundingClientRect());
  const column = document.querySelector<HTMLElement>('.history-inner')!, r = column.getBoundingClientRect(), c = getComputedStyle(column);
  const left = Math.max(...vis('.workspace-leading > *, .folder-explorer').map(x => x.right));
  const right = Math.min(...vis('.modern-toolbox, .complete-prompt-rail, .history-prompt-marks').map(x => x.left));
  return { left: r.left + parseFloat(c.paddingLeft) - left, right: right - (r.right - parseFloat(c.paddingRight)) };
});

for (const width of [1152, 1440, 2000]) {
  test(`the column sits between the side chrome with equal gaps, Files open and minimised, at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/v1/working-locations', route => route.request().method() === 'GET' ? route.fulfill({ json: { version: 1, sessions: [] } }) : route.fulfill({ json: { saved: true, revisions: {} } }));
    await page.goto(server.launchUrl);
    await expect(page.locator('.mh-home')).toBeVisible();
    await page.goto(`${server.url}/?experience=modern#/r/${id}`);
    await expect(page.locator('.history article.op').first()).toBeVisible();
    await expect.poll(async () => (await gaps(page)).left).toBeGreaterThanOrEqual(23);
    const open = await gaps(page);
    expect(Math.abs(open.left - open.right), `Files open: ${JSON.stringify(open)}`).toBeLessThanOrEqual(2);
    await page.locator('.folder-explorer header button').first().click();
    await expect.poll(async () => { const g = await gaps(page); return Math.abs(g.left - g.right) <= 2 && g.left >= 23; }).toBe(true);
  });
}

// UI-42 (Yash, 13 Nov): the passages use the whole width between the panels. The column's 1280 px cap is gone, rows of
// cards wrap across all of it, prose keeps its 75ch measure on the left edge, and no card sits under a side panel.
for (const width of [1440, 2000, 2560]) {
  test(`passages span the width between the panels; prose keeps its measure; no card under a side panel at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route('**/v1/working-locations', route => route.request().method() === 'GET' ? route.fulfill({ json: { version: 1, sessions: [] } }) : route.fulfill({ json: { saved: true, revisions: {} } }));
    await page.goto(server.launchUrl);
    await expect(page.locator('.mh-home')).toBeVisible();
    await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
    await expect(page.locator('.history article.op').first()).toBeVisible();
    await expect.poll(async () => (await gaps(page)).left).toBeGreaterThanOrEqual(23);
    const m = await page.evaluate(() => {
      const vis = (s: string) => [...document.querySelectorAll<HTMLElement>(s)].filter(e => getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0).map(e => e.getBoundingClientRect());
      const column = document.querySelector<HTMLElement>('.history-inner')!, r = column.getBoundingClientRect(), c = getComputedStyle(column);
      const side = vis('.workspace-leading > *, .folder-explorer, .modern-toolbox, .complete-prompt-rail, .history-prompt-marks');
      const content = { left: r.left + parseFloat(c.paddingLeft), right: r.right - parseFloat(c.paddingRight) };
      const prose = vis('.history .prose p');
      return {
        maxWidth: c.maxWidth, width: content.right - content.left,
        space: Math.min(...vis('.modern-toolbox, .complete-prompt-rail, .history-prompt-marks').map(x => x.left)) - Math.max(...vis('.workspace-leading > *, .folder-explorer').map(x => x.right)) - 48,
        under: vis('.history article.op').filter(o => side.some(k => o.right > k.left + 1 && o.left < k.right - 1 && o.bottom > k.top + 1 && o.top < k.bottom - 1)).length,
        proseMax: Math.max(0, ...prose.map(p => p.width)), proseLeft: prose[0] ? prose[0].left - content.left : 0,
      };
    });
    expect(m.maxWidth, 'the 1280 px cap is lifted once the column is placed').toBe('none');
    expect(Math.abs(m.width - m.space), `the column fills the space between the panels: ${JSON.stringify(m)}`).toBeLessThanOrEqual(2);
    expect(m.under, 'no card under a side panel').toBe(0);
    expect(m.proseMax, 'prose keeps its reading measure').toBeLessThanOrEqual(75 * 11);
    expect(m.proseLeft, 'prose starts at the column edge (its own 6 px indent), not centred').toBeLessThanOrEqual(8);
    if (width >= 2000) expect(m.width, 'wide windows use more than the old cap').toBeGreaterThan(1280);
  });
}
