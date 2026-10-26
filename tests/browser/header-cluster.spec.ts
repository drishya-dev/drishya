import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

// UI-1, header option C: on desktop widths Workspace, Git review and Git graph join the header's one navigation
// cluster (icons, names in aria-label); at the narrowest supported window (600 px) they keep their own row. Nothing overlaps at any width.
let dir: string, app: App, server: RunningServer, longId: string;
const LONG_TITLE = 'Make the checkout guard reject a missing total, keep the free-order path working and explain the remaining payment risk in plain language';
test.beforeAll(async () => { dir = mkdtempSync(join(tmpdir(), 'drishya-header-')); const root = join(dir, 'repo'); mkdirSync(root, { recursive: true }); const journal = join(dir, 'long.jsonl'); writeFileSync(journal, JSON.stringify({ type: 'user', uuid: 'u', sessionId: '66666666-6666-4666-8666-666666666666', cwd: root, message: { role: 'user', content: LONG_TITLE } }) + '\n'); app = new App(join(dir, 'store')); longId = (await app.ingest.importSource('claude-code', journal)).recordingId; server = await startServer({ app, port: 0, token: 'synthetic-header' }); });
test.afterAll(async () => { await server?.close(); await app?.close(); if (dir) { if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); } });

const url = () => `${server.url}/?demo&experience=modern&motion=0#token=${server.token}`;
// Desktop windows only (CLEAN-1): 600 px is the narrowest supported width, where the controls keep their own row.
const WIDTHS = [600, 601, 700, 820, 900, 1024, 1440];

for (const width of WIDTHS) {
  test(`header controls sit in one cluster and never overlap at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(url());
    await expect(page.locator('.modern-session-header')).toBeVisible();
    const header = page.locator('.modern-session-header');
    const phone = width <= 600;
    // Where the three navigation controls live: the header cluster on desktop widths, their own row on phones.
    for (const name of ['Open developer workspace', 'Git graph']) {
      await expect(header.getByRole('button', { name, exact: true })).toHaveCount(phone ? 0 : 1);
      await expect(page.locator('.workspace-bar').getByRole('button', { name, exact: true })).toHaveCount(phone ? 1 : 0);
    }
    // The row under the header is empty (zero area) on desktop widths, where its controls live in the cluster.
    if (phone) await expect(page.locator('.workspace-secondary')).toBeVisible(); else await expect(page.locator('.workspace-secondary')).toBeHidden();
    // Boxes of every floating header-level cluster must not intersect, and none leaves the window.
    const boxes = await page.evaluate(() => {
      const pick = (selector: string) => [...document.querySelectorAll<HTMLElement>(selector)].filter(el => el.checkVisibility() && el.getClientRects().length).map(el => { const r = el.getBoundingClientRect(); return { selector, left: r.left, right: r.right, top: r.top, bottom: r.bottom, area: r.width * r.height }; }).filter(box => box.area > 0);
      return [...pick('.modern-identity'), ...pick('.studio-actions'), ...pick('.workspace-leading'), ...pick('.workspace-secondary')];
    });
    for (const box of boxes) { expect(box.left, box.selector).toBeGreaterThanOrEqual(0); expect(box.right, box.selector).toBeLessThanOrEqual(width + 0.5); }
    for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++) {
      const x = boxes[a]!, y = boxes[b]!;
      const apart = x.right <= y.left + 0.5 || y.right <= x.left + 0.5 || x.bottom <= y.top + 0.5 || y.bottom <= x.top + 0.5;
      expect(apart, `${x.selector} overlaps ${y.selector} at ${width}px`).toBe(true);
    }
    expect(boxes.length, 'floating header-level clusters').toBe(phone ? 4 : 3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    // Every visible control in the cluster can be hit at its centre and is at least 32 px square.
    for (const control of await page.locator('.modern-session-header .studio-actions').locator('button:visible, summary:visible').all()) {
      const box = (await control.boundingBox())!;
      expect(box.width, await control.innerText()).toBeGreaterThanOrEqual(32);
      // A labelled control is as wide as its label: no text spills out of its box onto the neighbour.
      expect(await control.evaluate(el => el.scrollWidth <= el.clientWidth + 1), `label of ${await control.getAttribute('aria-label') ?? await control.innerText()} fits its box`).toBe(true);
      expect(box.height).toBeGreaterThanOrEqual(32);
      expect(await control.evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); })).toBe(true);
    }
  });
}

// A long session title truncates inside the identity pill; it must never run under the cluster.
for (const width of [600, 601, 640, 700, 701, 820, 1024]) {
  test(`a long session title stays clear of the navigation cluster at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${server.url}/?experience=modern&motion=0#token=${server.token}`); await expect(page.locator('.home')).toBeVisible();
    await page.goto(`${server.url}/?experience=modern&motion=0#/r/${longId}`);
    await expect(page.locator('.session-line-title')).toContainText('Make the checkout guard');
    const [identity, actions] = await page.evaluate(() => ['.modern-identity', '.studio-actions'].map(selector => { const r = document.querySelector(selector)!.getBoundingClientRect(); return { left: r.left, right: r.right }; }));
    expect(identity!.right, 'identity right edge vs cluster left edge').toBeLessThanOrEqual(actions!.left + 0.5);
    expect(actions!.right).toBeLessThanOrEqual(width + 0.5);
  });
}
