import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from './legacy-test.ts';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let app: App;
let server: RunningServer;
let dir: string;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-toolbar-'));
  app = new App(dir);
  server = await startServer({ app, port: 0, token: 'synthetic-toolbar-test' });
});

test('the growing demo follows long prose and a completed burst without manual scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(new URL('/?demo=live', server.launchUrl).href);
  const follow = page.getByRole('switch', { name: 'Automatically follow new work' });
  await expect(follow).toHaveAttribute('aria-checked', 'true');
  await expect.poll(async () => Number((await page.locator('.reading-status').innerText()).match(/\d+/)?.[0]), { timeout: 35_000 }).toBeGreaterThanOrEqual(14);
  await expect(page.getByRole('button', { name: /Back to latest/ })).toHaveCount(0);
  const history = page.locator('.history');
  await expect.poll(() => history.evaluate(el => Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop))).toBeLessThan(2);
  expect(await history.evaluate(el => el.scrollTop)).toBeGreaterThan(100);
  await page.getByRole('button', { name: 'Show complete sample' }).click();
  await expect(follow).toHaveAttribute('aria-checked', 'true');
  await expect.poll(() => history.evaluate(el => Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop))).toBeLessThan(2);
  await page.screenshot({ path: resolve('.local/live-follow-updated.png') });
});

test('clicks and downward scrolling preserve Follow; only upward scrolling or the switch holds it', async ({ page }) => {
  await page.goto(new URL('/?demo', server.launchUrl).href);
  const follow = page.getByRole('switch', { name: 'Automatically follow new work' });
  const history = page.locator('.history');
  await expect(follow).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('.workspace-activity')).toHaveCount(0);
  await expect(page.locator('.workspace-header .workspace-bar')).toHaveCount(0);
  await page.locator('.prose').last().click();
  await expect(follow).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Workspace settings', exact: true }).click();
  await page.getByRole('button', { name: 'Close Workspace settings' }).click();
  await expect(follow).toHaveAttribute('aria-checked', 'true');
  const bounds = (await history.boundingBox())!;
  await page.mouse.move(bounds.x + 4, bounds.y + bounds.height / 2);
  await page.mouse.wheel(0, 250);
  await expect(follow).toHaveAttribute('aria-checked', 'true');
  await page.mouse.wheel(0, -250);
  await expect(follow).toHaveAttribute('aria-checked', 'false');
  await page.mouse.wheel(0, 250);
  await expect(follow).toHaveAttribute('aria-checked', 'false');
  await follow.click();
  await expect(follow).toHaveAttribute('aria-checked', 'true');
});

test('map scope filters captured file locations and direct imports navigate exact files', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(new URL('/?demo', server.launchUrl).href);
  await page.getByRole('button', { name: 'Explore repository map' }).click();
  const search = page.getByRole('textbox', { name: 'Find a file on the map' });
  await page.getByRole('button', { name: /^Observed/ }).click();
  await search.fill('src/api/server.ts');
  await expect(page.locator('.map-matches').getByRole('button', { name: 'src/api/server.ts', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'All files', exact: true }).click();
  await expect(page.locator('.map-matches').getByRole('button', { name: 'src/api/server.ts', exact: true })).toBeVisible();
  await search.fill('src/checkout/guard.ts');
  await page.locator('.map-matches').getByRole('button', { name: 'src/checkout/guard.ts', exact: true }).click();
  await page.getByRole('switch', { name: 'Import paths' }).click();
  const connections = page.getByRole('region', { name: 'Direct import connections' });
  await expect(connections.locator('.map-connection-root')).toHaveText('src/checkout/guard.ts');
  await connections.getByRole('button', { name: /imports src\/cart\/types.ts/ }).click();
  await expect(connections.locator('.map-connection-root')).toHaveText('src/cart/types.ts');
  await expect(connections.getByRole('button', { name: /imported by src\/checkout\/guard.ts/ })).toBeVisible();
  await page.mouse.move(0, 0);
  await page.screenshot({ path: resolve('.local/map-import-paths.png') });
  await page.setViewportSize({ width: 390, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(connections.getByRole('button', { name: 'Open recorded work', exact: true })).toBeVisible();
  await page.screenshot({ path: resolve('.local/map-import-paths-mobile.png') });
});
test.afterAll(async () => {
  await server?.close();
  await app?.close();
  if (dir && resolve(dir).startsWith(resolve(tmpdir()) + sep)) rmSync(dir, { recursive: true, force: true });
});

test('workspace navigation stays readable and hit-testable through scrolling, comparison and narrow layouts', async ({ page }) => {
  for (const [width, height] of [[1920, 900], [1440, 900], [1024, 900], [768, 900], [390, 900], [2560, 1080], [1280, 720], [1024, 600], [900, 500], [844, 390], [390, 844]]) {
    await page.setViewportSize({ width: width!, height: height! });
    await page.goto(new URL('/?demo', server.launchUrl).href);
    const nav = page.getByRole('navigation', { name: 'Workspace views' });
    const visibleControls = nav.locator('button:visible, summary:visible');
    await expect(nav).toBeVisible();
    for (const control of await visibleControls.all()) {
      const box = (await control.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(28);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(await control.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(11);
      expect(await control.evaluate(el => {
        const r = el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      }), `Hit target at ${width}px: ${await control.innerText()} / ${await control.evaluate(el=>{const r=el.getBoundingClientRect(),top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return `${r.x},${r.y} -> ${top?.tagName}.${top?.className}`;})}`).toBe(true);
    }
    const before = (await nav.boundingBox())!;
    const history = page.locator('.history');
    const historyBox = (await history.boundingBox())!;
    // The left content gutter avoids the native scrollbar and nested material scrollers.
    await page.mouse.move(historyBox.x + 4, Math.min(height! - 90, 500));
    await expect.poll(async () => {
      // Virtualized passages acquire their real heights while scrolling toward the start.
      await page.mouse.wheel(0, -100_000);
      return history.evaluate(el => el.scrollTop);
    }).toBeLessThan(2);
    await page.mouse.wheel(0, 600);
    await expect.poll(() => history.evaluate(el => el.scrollTop)).toBeGreaterThan(20);
    const after = (await nav.boundingBox())!;
    expect(Math.abs(after.y - before.y)).toBeLessThan(1);
    await expect(page.getByRole('switch', { name: 'Agent overview', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Explore repository map' }).click();
    await expect(page.getByRole('button', { name: 'Back to work' })).toBeVisible();
    await page.getByRole('button', { name: 'Back to work' }).click();
    await expect(page.getByRole('button', { name: 'Watch live demo' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: resolve(`.local/toolbar-${width}.png`) });
  }
});
