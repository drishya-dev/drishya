import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from './legacy-test.ts';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';
let dir: string, app: App, server: RunningServer;
test.beforeAll(async () => { dir = mkdtempSync(join(tmpdir(), 'drishya-craft-')); app = new App(dir); server = await startServer({ app, port: 0, token: 'synthetic-craft' }); });
test.afterAll(async () => { await server.close(); await app.close(); if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); });

test('settings preserve keyboard operation and fit short, narrow and wide reading spaces', async ({ page }) => {
  await page.goto(new URL('/?demo', server.launchUrl).href);
  const trigger = page.getByRole('button', { name: 'Workspace settings', exact: true });
  await expect(trigger).toBeVisible();
  const glyph = trigger.locator('svg');
  const centered = await glyph.evaluate(el => {
    const icon = el.getBoundingClientRect(), button = el.parentElement!.getBoundingClientRect();
    return [Math.abs(icon.x + icon.width / 2 - button.x - button.width / 2), Math.abs(icon.y + icon.height / 2 - button.y - button.height / 2)];
  });
  expect(centered.every(offset => offset < 1)).toBe(true);
  await trigger.click();
  const settings = page.getByRole('dialog', { name: 'Workspace settings' });
  await expect(settings.getByText('Earlier design backups')).toHaveCount(0);
  const reasoning = settings.getByRole('combobox', { name: 'Exposed reasoning detail' });
  await reasoning.selectOption('collapsed'); await expect(reasoning).toHaveValue('collapsed');
  const map = settings.getByRole('checkbox', { name: /^3D repository map/ });
  await map.press('Space'); await expect(map).not.toBeChecked();
  await expect(settings.getByRole('checkbox', { name: /^Slow background orbit/ })).toBeDisabled();
  expect(await map.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
  await map.press('Space'); await expect(map).toBeChecked();
  for (const [width, height] of [[1920,1080], [1280,720], [844,390], [390,844]]) {
    await page.setViewportSize({ width, height });
    await expect(settings).toBeVisible();
    expect(await settings.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    await settings.getByText('Sequence diagnostics', { exact: true }).click();
    await expect(settings.getByRole('button', { name: 'Replay sequence' })).toBeVisible();
    await settings.getByText('Sequence diagnostics', { exact: true }).click();
    await settings.getByRole('button', { name: 'Paper', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-palette', 'paper');
    await settings.getByRole('button', { name: 'Jet Black', exact: true }).click();
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await settings.locator('header').scrollIntoViewIfNeeded();
  await page.screenshot({ path: resolve('.local/interface-settings.png') });
  await page.keyboard.press('Escape'); await expect(settings).toHaveCount(0); await expect(trigger).toBeFocused();
});
