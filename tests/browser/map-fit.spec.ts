import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from './legacy-test.ts';
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
  // 600 px is the narrowest supported window (AGENTS.md); the old 390 px case was a phone width.
  for (const width of [1280, 844, 600]) {
    await page.setViewportSize({ width, height: 844 }); await fit.focus(); await page.keyboard.press('Enter');
    // The resize and Fit reposition labels over the next frames. Reading them one by one straight away measured the previous
    // width's layout, or a label that had just been hidden (macOS runner, 18 Nov). Read every visible label in one frame
    // until the fitted layout holds: some are shown and none crosses the window's edges.
    await expect.poll(() => map.evaluate((el, width) => {
      const shown = [...el.querySelectorAll('.map-file-label')].map(label => ({ box: label.getBoundingClientRect(), style: getComputedStyle(label) }))
        .filter(({ box, style }) => box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none');
      return { shown: shown.length > 0, outside: shown.filter(({ box }) => box.left < 0 || box.right > width).length };
    }, width), { timeout: 15_000 }).toEqual({ shown: true, outside: 0 });
  }
});
