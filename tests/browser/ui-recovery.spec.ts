import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string, app: App, server: RunningServer;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-recovery-'));
  const journal = join(dir, 'synthetic.jsonl'); copyFileSync(resolve('fixtures/synthetic/claude/checkout-fix.jsonl'), journal);
  app = new App(join(dir, 'store')); await app.ingest.importSource('claude-code', journal);
  server = await startServer({ app, port: 0, token: 'synthetic-recovery' });
});
test.afterAll(async () => { await server.close(); await app.close(); if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); });

test('map and verification failures offer local retry without replacing captured history', async ({ page }) => {
  let mapFails = true, verificationFails = true;
  await page.route('**/v1/recordings/*/graph', route => mapFails ? route.fulfill({ status: 500, json: { error: 'Synthetic map error' } }) : route.continue());
  await page.route('**/v1/recordings/*/verification/*', route => verificationFails ? route.fulfill({ status: 500, json: { error: 'Synthetic verification error' } }) : route.continue());
  await page.goto(server.launchUrl);
  await page.getByRole('button', { name: /Free orders reach checkout/ }).click();
  await expect(page.getByRole('button', { name: 'Retry repository map' })).toBeVisible();
  const firstHistory = await page.locator('.history').evaluate(element => { element.setAttribute('data-recovery-reference', 'retained'); return element.getAttribute('data-recovery-reference'); });
  mapFails = false;
  await page.getByRole('button', { name: 'Retry repository map' }).click();
  await expect(page.getByRole('button', { name: 'Retry repository map' })).toHaveCount(0);
  await expect(page.locator('.history')).toHaveAttribute('data-recovery-reference', firstHistory!);
  const edit = page.locator('article.op-edit').last();
  await edit.getByRole('button', { name: /Expand/ }).click();
  await edit.getByRole('button', { name: 'Open provenance and file states' }).click();
  const detail = page.getByRole('complementary', { name: 'Operation detail' });
  await expect(detail.getByRole('button', { name: 'Retry test verification' })).toBeVisible();
  verificationFails = false;
  await detail.getByRole('button', { name: 'Retry test verification' }).click();
  await expect(detail.getByRole('region', { name: 'Test runs after this change' })).toContainText('Recorded order');
  await expect(detail.getByRole('button', { name: 'Retry test verification' })).toHaveCount(0);
  await expect(page.locator('.history')).toHaveAttribute('data-recovery-reference', firstHistory!);
});

test('keyboard search has a neutral visible focus ring with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(new URL('/?demo&experience=classic', server.launchUrl).href);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  const input = page.getByPlaceholder('Search prose, commands, paths…');
  await input.focus();
  expect(await input.evaluate(element => getComputedStyle(element).outlineWidth)).toBe('2px');
  await page.keyboard.press('Escape');
  await expect(input).toBeHidden();
});
