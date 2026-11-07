import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string, app: App, server: RunningServer;
test.beforeAll(async () => { dir = mkdtempSync(join(tmpdir(), 'drishya-clarity-')); app = new App(dir); server = await startServer({ app, port: 0, token: 'synthetic-clarity' }); });
test.afterAll(async () => { await server?.close(); await app?.close(); if (dir) { if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); } });

// CLARITY-1: Clarity is a skin of Modern (data-ui-version stays "modern"), and its `@layer clarity` rules beat every legacy rule.
const url = (query: string) => new URL(`/?demo&motion=0${query}`, server.launchUrl).href;
const root = (page: Page) => page.locator('html');

test('Modern is the Modern skin; Clarity is Modern plus data-ui-skin', async ({ page }) => {
  await page.goto(url('&experience=modern'));
  await expect(root(page)).toHaveAttribute('data-ui-version', 'modern');
  await expect(root(page)).toHaveAttribute('data-ui-skin', 'modern');
  await page.goto(url('&experience=clarity'));
  await expect(root(page)).toHaveAttribute('data-ui-version', 'modern');
  await expect(root(page)).toHaveAttribute('data-ui-skin', 'clarity');
});

test('Settings switches to Clarity and back; the choice persists and the page stays open', async ({ page }) => {
  await page.goto(url('&experience=modern'));
  await page.getByRole('button', { name: 'Workspace settings', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Workspace settings' });
  await settings.getByRole('tab', { name: 'UI versions', exact: true }).click();
  await settings.getByRole('button', { name: /^Clarity/ }).click();
  await expect(root(page)).toHaveAttribute('data-ui-skin', 'clarity');
  expect(new URL(page.url()).searchParams.has('demo')).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('drishya-ui-version'))).toBe('clarity');
  // A plain link (no ?experience=) now opens Clarity, because the choice was saved.
  await page.goto(url(''));
  await expect(root(page)).toHaveAttribute('data-ui-skin', 'clarity');
  await page.getByRole('button', { name: 'Workspace settings', exact: true }).click();
  await page.getByRole('tab', { name: 'UI versions', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Clarity/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /^Modern/ }).click();
  await expect(root(page)).toHaveAttribute('data-ui-skin', 'modern');
  expect(await page.evaluate(() => localStorage.getItem('drishya-ui-version'))).toBe('modern');
});

test('every app stylesheet is in @layer legacy, ordered before clarity, and a clarity rule beats a high-specificity legacy rule', async ({ page }) => {
  await page.goto(url('&experience=clarity'));
  await expect(root(page)).toHaveAttribute('data-ui-skin', 'clarity');
  await page.locator('body *').first().waitFor({ state: 'attached' });
  const result = await page.evaluate(() => {
    const unlayered: string[] = []; let order = '';
    for (const sheet of document.styleSheets) {
      for (const rule of sheet.cssRules) {
        if (rule instanceof CSSLayerStatementRule) { order ||= rule.nameList.join(', '); continue; }
        if (rule instanceof CSSLayerBlockRule) continue;
        unlayered.push(rule.cssText.slice(0, 60));
      }
    }
    // Legacy sets font-family with `:root[data-ui-version=modern][data-experience=classic] body` (0,3,1); Clarity's probe selector is weaker.
    const probe = (layer: string) => {
      const style = document.createElement('style');
      style.textContent = `@layer ${layer} { :root[data-ui-skin=clarity] body { font-family: ClarityProbe; } }`;
      document.head.append(style);
      const family = getComputedStyle(document.body).fontFamily; style.remove(); return family;
    };
    return { unlayered, order, legacy: probe('legacy'), clarity: probe('clarity') };
  });
  expect(result.order).toBe('legacy, clarity');
  expect(result.unlayered).toEqual([]);
  expect(result.legacy).not.toContain('ClarityProbe');
  expect(result.clarity).toContain('ClarityProbe');
});
