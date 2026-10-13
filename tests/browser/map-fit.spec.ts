import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';
let dir: string, app: App, server: RunningServer;
test.beforeAll(async () => { dir = mkdtempSync(join(tmpdir(), 'drishya-fit-')); app = new App(dir); server = await startServer({ app, port: 0, token: 'synthetic-fit' }); });
test.afterAll(async () => { await server.close(); await app.close(); if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); });
test('Fit preserves manual spatial orientation and leaves labels inside narrow map bounds', async ({ page }) => {
  await page.goto(new URL('/?demo', server.launchUrl).href);
  await page.getByRole('button', { name: 'Explore repository map' }).click();
  const map = page.locator('.map.exploring');
  const box = (await map.boundingBox())!;
  await page.mouse.move(box.x + box.width * .45, box.y + box.height * .5);
  await page.mouse.down(); await page.mouse.move(box.x + box.width * .45 + 80, box.y + box.height * .5 + 30, { steps: 8 }); await page.mouse.up();
  const yaw = await map.getAttribute('data-map-yaw'), pitch = await map.getAttribute('data-map-pitch');
  const fit = page.getByRole('button', { name: 'Fit', exact: true });
  await fit.focus(); await page.keyboard.press('Enter');
  expect(await map.getAttribute('data-map-yaw')).toBe(yaw); expect(await map.getAttribute('data-map-pitch')).toBe(pitch);
  for (const width of [1280, 844, 390]) {
    await page.setViewportSize({ width, height: 844 }); await fit.focus(); await page.keyboard.press('Enter');
    const labels = map.locator('.map-file-label:visible');
    await expect.poll(() => labels.count()).toBeGreaterThan(0);
    for (const label of await labels.all()) {
      const rect = (await label.boundingBox())!;
      expect(rect.x).toBeGreaterThanOrEqual(0); expect(rect.x + rect.width).toBeLessThanOrEqual(width);
    }
  }
});
