import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let app: App, server: RunningServer, dir: string, first: string, second: string, journal: string;
test.beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-storage-ui-'));
  journal = join(dir, 'claude.jsonl');
  copyFileSync(resolve('fixtures/synthetic/claude/checkout-fix.jsonl'), journal);
  app = new App(join(dir, 'data'));
  first = (await app.ingest.importSource('claude-code', journal)).recordingId;
  second = (await app.ingest.importSource('codex', resolve('fixtures/synthetic/codex/rollout-checkout-review.jsonl'))).recordingId;
  server = await startServer({ app, port: 0, watchRoots: [] });
});
test.afterEach(async () => { await server?.close(); await app?.close(); if (dir) rmSync(dir, { recursive: true, force: true }); });
async function storage(page: Page) {
  await page.route('**/v1/sources', route => route.fulfill({ json: { sources: [], errors: [] } }));
  await page.goto(`${server.url}/?experience=modern#token=${server.token}`);
  await page.getByRole('button', { name: 'Workspace settings', exact: true }).click();
  await page.getByRole('tab', { name: 'Storage', exact: true }).click();
}
for (const width of [600, 1440]) test(`confirmed clearing preserves another session and supports reimport at ${width} px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const original = readFileSync(journal);
  await storage(page);
  const panel = page.locator('.storage-settings');
  await expect(panel.getByRole('heading', { name: 'Local storage' })).toBeVisible();
  await expect(panel.locator('.storage-session')).toHaveCount(2);
  const row = panel.locator('.storage-session').filter({ hasText: first.slice(0, 12) });
  await row.getByRole('button', { name: 'Clear local data', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'Clear imported session?' });
  await expect(confirm).toContainText(first.slice(0, 12));
  await expect(confirm).toContainText('Native recordings remain');
  await confirm.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(row.getByRole('button')).toBeFocused();
  expect(app.store.getRecording(first)).toBeDefined();
  await row.getByRole('button').click();
  await confirm.getByRole('button', { name: 'Clear imported data', exact: true }).click();
  await expect(panel.locator('.storage-session')).toHaveCount(1);
  expect(app.store.getRecording(first)).toBeUndefined();
  expect(app.store.countObservations(second)).toBeGreaterThan(0);
  expect(readFileSync(journal)).toEqual(original);
  await app.ingest.importSource('claude-code', journal);
  await panel.getByRole('button', { name: 'Refresh storage', exact: true }).click();
  await expect(panel.locator('.storage-session')).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('storage loading and failed clearing never claim success or remove another row', async ({ page }) => {
  let release!: () => void;
  const waiting = new Promise<void>(r => { release = r; });
  await page.route('**/v1/storage?details=1', async route => { await waiting; await route.continue(); });
  await storage(page);
  await expect(page.locator('.storage-settings')).toContainText('Measuring local storage');
  release();
  await expect(page.locator('.storage-session')).toHaveCount(2);
  await page.route(`**/v1/recordings/${first}`, route => route.request().method() === 'DELETE' ? route.fulfill({ status: 500, json: { error: 'Clear failed fixture' } }) : route.continue());
  await page.locator('.storage-session').filter({ hasText: first.slice(0, 12) }).getByRole('button').click();
  await page.getByRole('button', { name: 'Clear imported data', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Clear imported session?' })).toContainText('Clear failed fixture');
  expect(app.store.getRecording(first)).toBeDefined();
  expect(app.store.getRecording(second)).toBeDefined();
});

test('clearing the viewed live session returns to the library and stops following', async ({ page }) => {
  await page.route('**/v1/sources', route => route.fulfill({ json: { sources: [], errors: [] } }));
  await page.goto(`${server.url}/?experience=modern#token=${server.token}`);
  await page.getByRole('button', { name: 'Workspace settings', exact: true }).waitFor();
  await page.goto(`${server.url}/?experience=modern#/r/${first}`);
  await page.getByRole('button', { name: 'Workspace settings', exact: true }).click();
  await page.getByRole('tab', { name: 'Storage', exact: true }).click();
  await page.locator('.storage-session').filter({ hasText: first.slice(0, 12) }).getByRole('button').click();
  await page.getByRole('button', { name: 'Clear imported data', exact: true }).click();
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.locator('.mh-home')).toBeVisible();
  expect(app.ingest.isLive(first)).toBe(false);
  expect(app.store.getRecording(first)).toBeUndefined();
  expect(app.store.countObservations(second)).toBeGreaterThan(0);
});
