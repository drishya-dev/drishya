import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let app: App;
let server: RunningServer;
let dir: string;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-search-'));
  app = new App(dir);
  server = await startServer({ app, port: 0, token: 'synthetic-search-test' });
});
test.afterAll(async () => {
  await server?.close();
  await app?.close();
  if (dir && resolve(dir).startsWith(resolve(tmpdir()) + sep)) rmSync(dir, { recursive: true, force: true });
});

test('search dismisses outside without swallowing the click, toggles, and restores keyboard focus', async ({ page }) => {
  await page.goto(new URL('/?demo', server.launchUrl).href);
  const trigger = page.getByRole('button', { name: 'Search', exact: true });
  const panel = page.getByRole('dialog', { name: 'Search this recording' });
  await trigger.click();
  await expect(panel.getByRole('textbox')).toBeFocused();
  await panel.getByRole('textbox').fill('checkout');
  await expect(panel.locator('.search-results button').first()).toBeVisible();
  await panel.getByRole('textbox').click();
  await expect(panel).toBeVisible();
  await page.getByRole('button', { name: 'Workspace settings' }).click();
  await expect(panel).toBeHidden();
  await expect(page.getByRole('dialog', { name: 'Workspace settings' })).toBeVisible();
  await page.keyboard.press('Escape');
  await trigger.click();
  await trigger.click();
  await expect(panel).toBeHidden();
  await trigger.click();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await panel.getByRole('button', { name: 'Close search' }).click();
  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await panel.locator('.search-results button').first().click();
  await expect(panel).toBeHidden();
  await expect(page.locator('.turn-text').filter({ hasText: "Free orders don't reach checkout" })).toBeInViewport();
});

test('search has a finite entrance and stays contained with reduced motion on mobile', async ({ page }) => {
  await page.goto(new URL('/?demo', server.launchUrl).href);
  const panel = page.getByRole('dialog', { name: 'Search this recording' });
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(panel).toHaveCSS('animation-name', 'compact-search-arrive');
  const horizontal = await panel.evaluate(el => el.getAnimations().flatMap(a => (a.effect as KeyframeEffect).getKeyframes()).filter(k => k.transform).map(k => new DOMMatrixReadOnly(k.transform as string).m41));
  expect(horizontal.every(x => Math.abs(x) < .5)).toBe(true);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Enter');
  await expect(panel).toBeVisible();
  await expect(panel).toHaveCSS('animation-name', 'none');
  await page.keyboard.press('Escape');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(panel).toHaveCSS('animation-name', 'none');
  const box = (await panel.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: resolve('.local/search-mobile.png') });
});
