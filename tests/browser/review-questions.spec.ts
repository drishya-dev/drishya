import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from './legacy-test.ts';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string, app: App, server: RunningServer;
test.beforeAll(async () => { dir = mkdtempSync(join(tmpdir(), 'drishya-questions-')); app = new App(dir); server = await startServer({ app, port: 0, token: 'synthetic-questions' }); });
test.afterAll(async () => { await server.close(); await app.close(); if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); });

test('review questions survive reload, return to the action and resolve only explicitly', async ({ page }) => {
  await page.goto(new URL('/?demo&experience=classic', server.launchUrl).href);
  const op = page.locator('article.op-edit').first();
  // Keyboard, not a pointer: moving the pointer over the card can start hover reading, which moves it under the click.
  const expand = op.locator('button.op-expand'); await expand.focus(); await page.keyboard.press('Enter'); await expect(expand).toHaveAttribute('aria-expanded', 'true');
  const inspector = page.getByRole('region', { name: 'Operation detail' });
  const targetTitle = await page.locator('article.op.expanded .op-title').first().innerText();
  await inspector.getByText('Leave a review question', { exact: true }).click();
  await inspector.getByRole('textbox', { name: 'Review question', exact: true }).fill('Check the zero-total path before approving');
  await inspector.getByRole('textbox', { name: 'Question owner' }).fill('Reviewer');
  await inspector.getByRole('button', { name: 'Save question', exact: true }).click();
  await expect(inspector).toContainText('Saved locally');
  await page.reload();
  await page.getByRole('button', { name: 'Review questions · 1', exact: true }).click();
  const queue = page.getByRole('dialog', { name: 'Review questions', exact: true });
  await expect(queue).toContainText('Check the zero-total path');
  await queue.getByRole('button', { name: 'Preview open questions' }).click();
  await expect(queue.getByRole('textbox', { name: 'Question handoff preview' })).toHaveValue(/Step reference:/);
  await queue.locator('.question-target').click();
  await expect(page.locator('article.op.expanded .op-title').first()).toHaveText(targetTitle);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Review questions · 1', exact: true }).click();
  await queue.getByRole('button', { name: 'Resolve question', exact: true }).click();
  await expect(queue.getByRole('region', { name: 'Open review questions' })).toContainText('No open review questions');
  await queue.getByText('Resolved questions · 1', { exact: true }).click();
  await expect(queue).toContainText('Check the zero-total path');
  await queue.getByRole('button', { name: 'Reopen question' }).click();
  await expect(queue.locator('section[aria-label="Open review questions"]')).toContainText('Check the zero-total path');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(queue).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
