import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from './legacy-test.ts';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string, app: App, server: RunningServer;
test.beforeAll(async () => { dir = mkdtempSync(join(tmpdir(), 'drishya-questions-')); app = new App(dir); server = await startServer({ app, port: 0, token: 'synthetic-questions' }); });
test.afterAll(async () => { await server.close(); await app.close(); if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); });

const expandFirstEdit = async (page: import('@playwright/test').Page) => {
  const op = page.locator('article.op-edit').first();
  // Keyboard, not a pointer: moving the pointer over the card can start hover reading, which moves it under the click.
  const expand = op.locator('button.op-expand'); await expand.focus(); await page.keyboard.press('Enter'); await expect(expand).toHaveAttribute('aria-expanded', 'true');
  return page.getByRole('region', { name: 'Operation detail' });
};

test('a note survives reload, returns to its step and resolves only explicitly', async ({ page }) => {
  await page.goto(new URL('/?demo&experience=classic', server.launchUrl).href);
  const step = await expandFirstEdit(page);
  const targetTitle = await page.locator('article.op.expanded .op-title').first().innerText();
  await step.getByText('Add a note', { exact: true }).click();
  await step.getByRole('textbox', { name: 'Note on this step', exact: true }).fill('Check the zero-total path before approving');
  await step.getByRole('button', { name: 'Needs follow-up' }).focus(); await page.keyboard.press('Enter');
  await step.getByRole('textbox', { name: 'Note owner' }).fill('Reviewer');
  await step.getByRole('button', { name: 'Save note', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(step).toContainText('Saved locally');
  await page.reload();
  await page.getByRole('button', { name: 'Notes · 1', exact: true }).click();
  const notes = page.getByRole('dialog', { name: 'Notes', exact: true });
  await expect(notes.getByRole('region', { name: 'Needs follow-up' })).toContainText('Check the zero-total path');
  await notes.getByRole('button', { name: 'Preview notes to follow up' }).click();
  await expect(notes.getByRole('textbox', { name: 'Notes handoff preview' })).toHaveValue(/Step reference:/);
  await notes.locator('.question-target').click();
  await expect(page.locator('article.op.expanded .op-title').first()).toHaveText(targetTitle);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Notes · 1', exact: true }).click();
  await notes.getByRole('button', { name: 'Resolve', exact: true }).click();
  await expect(notes.getByRole('region', { name: 'Needs follow-up' })).toHaveCount(0);
  await notes.getByText('Resolved · 1', { exact: true }).click();
  await expect(notes).toContainText('Check the zero-total path');
  await notes.getByRole('button', { name: 'Reopen', exact: true }).click();
  await expect(notes.getByRole('region', { name: 'Needs follow-up' })).toContainText('Check the zero-total path');
  await page.setViewportSize({ width: 600, height: 844 });
  await expect(notes).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
