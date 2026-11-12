// UI-38: the mark is one SVG everywhere: Home's header and opening, the session header and the browser tab.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string, app: App, server: RunningServer, id: string;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-brand-mark-'));
  app = new App(dir);
  id = (await app.ingest.importSource('claude-code', resolve('fixtures/synthetic/claude/checkout-fix.jsonl'))).recordingId;
  server = await startServer({ app, port: 0 });
});
test.afterAll(async () => {
  await server?.close(); await app?.close();
  if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path');
  rmSync(dir, { recursive: true, force: true });
});

test('Home and the session header draw the mark as SVG in the palette ink, and the shell requests no raster mark', async ({ page }) => {
  const raster: string[] = [];
  page.on('request', request => { if (/\/brand\/drishya(-\d+)?\.png$/.test(new URL(request.url()).pathname)) raster.push(request.url()); });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(server.launchUrl);
  await expect(page.locator('.mh-home')).toBeVisible();
  for (const place of ['.mh-header .brand-mark', '.mh-opening-mark .brand-mark']) {
    await expect(page.locator(`${place} svg`), place).toBeVisible();
    await expect(page.locator(`${place} img`), place).toHaveCount(0);
    // Six ribbons, each resolved to this instance's own path.
    expect(await page.locator(`${place} svg use`).evaluateAll(uses => uses.every(use => !!document.getElementById(use.getAttribute('href')!.slice(1)))), place).toBe(true);
    await expect(page.locator(`${place} svg use`)).toHaveCount(6);
  }
  const ids = await page.locator('.brand-mark svg path').evaluateAll(paths => paths.map(path => path.id));
  expect(new Set(ids).size, 'each mark has its own ids').toBe(ids.length);
  // Jet Black shows the website's cream; Paper shows its own dark ink.
  const ink = () => page.locator('.mh-opening-mark .brand-mark').evaluate(el => getComputedStyle(el).color);
  await page.evaluate(() => { document.documentElement.dataset.palette = 'jet'; document.documentElement.dataset.theme = 'dark'; });
  expect(await ink()).toBe('rgb(241, 238, 228)');
  await page.evaluate(() => { document.documentElement.dataset.palette = 'paper'; document.documentElement.dataset.theme = 'light'; });
  const paper = (await ink()).match(/\d+/g)!.map(Number);
  expect(Math.max(...paper), 'dark ink on the light palette').toBeLessThan(110);
  await page.evaluate(() => { document.documentElement.dataset.palette = 'jet'; document.documentElement.dataset.theme = 'dark'; });
  await page.goto(`${server.url}/?experience=modern#/r/${id}`);
  await expect(page.locator('.history')).toBeVisible();
  await expect(page.locator('.modern-identity .brand-mark svg')).toBeVisible();
  await expect(page.locator('.modern-identity .brand-mark img')).toHaveCount(0);
  expect(raster, 'no raster mark requested by the shell').toEqual([]);
});

test('the browser tab uses the SVG mark, which adapts to a light or dark tab strip', async ({ page }) => {
  await page.goto(server.launchUrl);
  await expect(page.locator('.mh-home')).toBeVisible();
  const icon = page.locator('link[rel~="icon"][type="image/svg+xml"]');
  await expect(icon).toHaveCount(1);
  expect(await icon.evaluate((link: HTMLLinkElement) => new URL(link.href).pathname)).toBe('/brand/drishya-tab.svg');
  // It comes before the raster fallbacks, which stay for browsers without SVG tab icons.
  expect(await page.evaluate(() => [...document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]')].map(link => link.type || 'ico'))).toEqual(['image/svg+xml', 'image/png', 'image/png', 'ico']);
  const response = await page.request.get(`${server.url}/brand/drishya-tab.svg`);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('image/svg+xml');
  const body = await response.text();
  expect(body).toContain('prefers-color-scheme:dark');
  expect(body).not.toMatch(/<script|href="http|xlink:href="http/);
});
