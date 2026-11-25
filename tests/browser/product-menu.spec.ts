import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from './browser-server.ts';

let dir: string, app: App, server: RunningServer;
test.beforeAll(async () => { dir = mkdtempSync(join(tmpdir(), 'drishya-menu-')); app = new App(dir); server = await startServer({ app, port: 0, token: 'synthetic-menu' }); });
test.afterAll(async () => { await server.close(); await app.close(); if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); });

const open = async (page: import('@playwright/test').Page, width = 1440) => {
  await page.setViewportSize({ width, height: 900 });
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(new URL('/?demo&experience=modern&motion=0', server.launchUrl).href);
  await expect(page.locator('article.op').first()).toBeVisible();
};

for (const width of [1440, 600]) test(`a card offers its existing actions at ${width}px, and closing returns to it`, async ({ page }) => {
  await open(page, width);
  // By id: expanding can scroll an earlier card into the mounted window.
  const id = await page.locator('article.op-edit').first().getAttribute('data-op-id');
  const card = page.locator(`article[data-op-id="${id}"]`);
  await card.locator('.op-head').click({ button: 'right', position: { x: 12, y: 12 } });
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  for (const name of ['Expand', 'Add a note', 'Copy', 'Copy path']) await expect(menu.getByRole('menuitem', { name, exact: true })).toBeVisible();
  await expect(menu.getByRole('menuitem').first()).toBeFocused();
  const box = (await menu.boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(width);
  await page.keyboard.press('ArrowDown'); await expect(menu.getByRole('menuitem', { name: 'Add a note', exact: true })).toBeFocused();
  await page.keyboard.press('End'); await expect(menu.getByRole('menuitem', { name: 'Copy path', exact: true })).toBeFocused();
  await page.keyboard.press('Home'); await expect(menu.getByRole('menuitem', { name: 'Expand', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(menu).toHaveCount(0);
  await expect(card.locator('button.op-expand')).toHaveAttribute('aria-expanded', 'true');
});

test('Add a note opens the note on the step, and Copy path copies', async ({ page }) => {
  await open(page);
  const card = page.locator('article.op-edit').first();
  await card.locator('.op-head').click({ button: 'right', position: { x: 12, y: 12 } });
  await page.getByRole('menuitem', { name: 'Add a note', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Note on this step', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await card.locator('.op-head').click({ button: 'right', position: { x: 12, y: 12 } });
  await page.getByRole('menuitem', { name: 'Copy path', exact: true }).click();
  await expect(page.getByRole('menu')).toHaveCount(0);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\.\w+$/);
});

test('a file row opens the menu from the keyboard, and Escape returns focus', async ({ page }) => {
  await open(page);
  const row = page.locator('[data-spine-path]').first();
  await expect(row).toBeVisible();
  await row.focus();
  await row.dispatchEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: 0, clientY: 0 });
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Copy path', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(row).toBeFocused();
});

test('selected text, editable fields and other places keep the browser menu', async ({ page }) => {
  await open(page);
  const prevented = (selector: string) => page.locator(selector).first().evaluate(node => { const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true }); node.dispatchEvent(event); return event.defaultPrevented; });
  expect(await prevented('.modern-session-header')).toBe(false);
  await page.locator('article.op .op-head').first().evaluate(node => { const range = document.createRange(); range.selectNodeContents(node); getSelection()!.removeAllRanges(); getSelection()!.addRange(range); });
  expect(await prevented('article.op .op-head')).toBe(false);
  await expect(page.getByRole('menu')).toHaveCount(0);
});
