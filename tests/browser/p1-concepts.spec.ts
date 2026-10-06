import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string;
let app: App;
let server: RunningServer;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-concepts-'));
  app = new App(join(dir, 'data'));
  server = await startServer({ app, port: 0, token: 'synthetic-concept-test' });
});
test.afterAll(async () => {
  await server?.close();
  await app?.close();
  if (dir) {
    if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('refusing to remove a directory outside temp');
    rmSync(dir, { recursive: true, force: true });
  }
});

for (const direction of ['studio', 'relay', 'atlas']) {
  test(`${direction} preserves captured reading, file filtering, passage arrivals and narrow-screen access`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(new URL(`/concepts/${direction}.html`, server.launchUrl).href);
    await expect(page.getByRole('heading', { name: 'Free orders reach checkout', exact: true })).toBeVisible();
    await expect(page.locator('.tools [data-tool]')).toHaveCount(2);
    const contrast = await page.evaluate(() => {
      const root = getComputedStyle(document.body);
      const luminance = (hex: string) => {
        const value = hex.trim().slice(1);
        const channels = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255)
          .map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
        return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
      };
      const backgrounds = ['--bg', '--source', '--chrome'].map((token) => luminance(root.getPropertyValue(token)));
      return ['--ink', '--muted', '--faint'].flatMap((token) => {
        const text = luminance(root.getPropertyValue(token));
        return backgrounds.map((background) => (Math.max(text, background) + .05) / (Math.min(text, background) + .05));
      });
    });
    expect(Math.min(...contrast)).toBeGreaterThanOrEqual(4.5);
    const read = page.locator('.op-title').filter({ hasText: 'Read src/checkout/guard.ts 1–14' });
    await read.click();
    const reader = page.getByRole('dialog');
    await expect(reader).toContainText("if (!cart.total) return 'missing-total';");
    await expect(reader).toContainText('No current file content is substituted');
    await page.getByRole('button', { name: 'Close reading space' }).click();
    await expect(reader).toBeHidden();
    await expect(read).toBeFocused();
    const before = await page.locator('.position').innerText();
    await page.getByRole('button', { name: 'Reveal next captured passage ↗' }).click();
    await expect(page.locator('.position')).not.toHaveText(before);
    await expect(page.locator('.relationships path').first()).toBeAttached();
    await page.locator('.stage').hover();
    await page.mouse.wheel(0, 100);
    await expect(page.locator('.relationships path')).toHaveCount(0);
    await expect(page.locator('.history')).toContainText("if (!cart.total) return 'missing-total';");
    if (direction === 'atlas') await page.locator('.world [data-file="src/checkout/guard.ts"]').click();
    else await page.locator('.file-index [data-file="src/checkout/guard.ts"]').click();
    await expect(page.locator('.selection-note')).toHaveText('src/checkout/guard.ts');
    expect(await page.locator('.history .operation').evaluateAll((els) => els.every((el) => el.textContent?.includes('guard.ts')))).toBe(true);
    await page.locator('.op-title').filter({ hasText: 'Edit src/checkout/guard.ts' }).click();
    await page.getByRole('button', { name: 'Earlier captured read', exact: true }).click();
    await expect(reader.locator('.reader-material')).toContainText('if (!cart.total)');
    await expect(reader.locator('.reader-material')).toContainText('not a verified immediate-before state');
    await page.getByRole('button', { name: 'Reconstructed after', exact: true }).click();
    await expect(reader.locator('.reader-material')).toContainText('cart.total == null');
    await expect(reader.locator('.reader-material')).toContainText('derived snapshot');
    await page.getByRole('button', { name: 'Close reading space' }).click();
    await page.getByRole('button', { name: 'Clear selection ↗' }).click();
    await page.getByRole('button', { name: 'Motion on', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Motion off', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await page.getByRole('button', { name: 'Map on', exact: true }).click();
    await expect(page.locator('.world')).toBeHidden();
    await page.screenshot({ path: `.local/p1-concept-${direction}.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Tools', exact: true }).click();
    await expect(page.getByRole('complementary', { name: 'Observed tools' })).toBeVisible();
    await page.getByRole('button', { name: 'Close tools', exact: true }).click();
    await expect(page.getByRole('complementary', { name: 'Observed tools' })).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    expect(errors).toEqual([]);
  });
}
