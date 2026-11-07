import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string, app: App, server: RunningServer;
test.beforeAll(async () => { dir = mkdtempSync(join(tmpdir(), 'drishya-modern-only-')); app = new App(dir); server = await startServer({ app, port: 0, token: 'synthetic-modern-only' }); });
test.afterAll(async () => { await server?.close(); await app?.close(); if (dir) { if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); } });

// UI-4 (25 Oct): Modern is the only version a person can choose. Legacy, Canvas and the chooser stay in the code.
const url = (query: string) => new URL(`/?demo&motion=0${query}`, server.launchUrl).href;
const openSettings = async (page: import('@playwright/test').Page) => {
  await page.getByRole('button', { name: 'Workspace settings', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Workspace settings' });
  await expect(dialog).toBeVisible();
  return dialog;
};

test('Settings lists the UI versions last (CLARITY-1 offers Clarity to everyone, Legacy only to developers)', async ({ page }) => {
  await page.goto(url(''));
  await expect(page.locator('html')).toHaveAttribute('data-ui-version', 'modern');
  const settings = await openSettings(page);
  await expect(settings.getByRole('tab')).toHaveText(['Appearance', 'Reading', 'Playback', 'Privacy', 'Keyboard', 'UI versions']);
  await settings.getByRole('tab', { name: 'UI versions', exact: true }).click();
  await expect(settings.getByRole('button', { name: /^Modern/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(settings.getByRole('button', { name: /^Clarity/ })).toContainText('In progress');
  await expect(settings.getByRole('button', { name: /^Legacy/ })).toHaveCount(0);
});

test('a Legacy or Canvas choice saved by an earlier build no longer applies', async ({ page }) => {
  for (const saved of ['classic', 'canvas']) {
    await page.addInitScript(value => { try { localStorage.setItem('drishya-ui-version', value); } catch { /* nothing to save to */ } }, saved);
    await page.goto(url(''));
    await expect(page.locator('html'), saved).toHaveAttribute('data-ui-version', 'modern');
    await page.unrouteAll();
  }
});

test('the retained versions stay reachable for developers: ?experience= and the ?versions switch', async ({ page }) => {
  await page.goto(url('&experience=classic'));
  await expect(page.locator('html')).toHaveAttribute('data-ui-version', 'classic');
  // Someone already on another version can always get back, without the switch.
  await page.getByRole('button', { name: 'Workspace settings', exact: true }).click();
  await page.getByRole('tab', { name: 'UI versions', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Modern/ })).toBeVisible();

  await page.goto(url('&versions'));
  await expect(page.locator('html')).toHaveAttribute('data-ui-version', 'modern');
  const settings = await openSettings(page);
  await expect(settings.getByRole('tab', { name: 'UI versions', exact: true })).toHaveCount(1);
  await settings.getByRole('tab', { name: 'UI versions', exact: true }).click();
  await expect(settings.getByRole('button', { name: /^Modern/ })).toHaveAttribute('aria-pressed', 'true');
});
