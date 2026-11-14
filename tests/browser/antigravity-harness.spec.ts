import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';
import { createAntigravityAdapter } from '../../packages/adapter-antigravity/src/index.ts';
import { HarnessController } from '../../apps/daemon/src/controller.ts';
import { WorkspaceAccess } from '../../apps/daemon/src/workspace.ts';

let dir: string, app: App, server: RunningServer, id: string;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'ag-product-')); app = new App(join(dir, 'store'));
  const journal = join(dir, 'brain', 'synthetic', '.system_generated', 'logs', 'transcript.jsonl');
  mkdirSync(join(journal, '..'), { recursive: true });
  writeFileSync(journal, JSON.stringify({ step_index: 0, type: 'USER_INPUT', source: 'USER_EXPLICIT', status: 'DONE', created_at: '2026-11-13T10:00:00Z', content: 'Synthetic AG searchable needle', tool_calls: [] }) + '\n');
  const adapter = createAntigravityAdapter([dir]);
  const index = app.ingest.adapters.findIndex(a => a.descriptor.id === 'antigravity');
  app.ingest.adapters.splice(index, 1, adapter);
  id = (await app.ingest.importSource('antigravity', journal)).recordingId;
  server = await startServer({ app, port: 0, token: 'synthetic-ag-product' });
});
test.afterAll(async () => { await server?.close(); await app?.close(); if (dir) rmSync(dir, { recursive: true, force: true }); });

test('Antigravity is filterable and read-only', async ({ page }) => {
  await page.route('**/v1/sources', route => route.fulfill({ json: { sources: [], errors: [] } }));
  await page.goto(server.launchUrl);
  await expect(page.locator('.home')).toBeVisible();
  await page.getByLabel('Harness', { exact: true }).selectOption('antigravity');
  await expect(page.locator('.mh-session').filter({ hasText: 'Antigravity' })).toHaveCount(1);
  await page.getByRole('button', { name: 'Search sessions', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Search sessions' });
  await dialog.getByRole('searchbox').fill('searchable needle');
  await dialog.locator('summary').click(); await dialog.getByLabel('Harness').selectOption('antigravity');
  await expect(dialog.locator('.library-search-results>button').first()).toBeVisible();
  await expect(dialog.locator('.library-search-results>button').first()).toContainText('Antigravity');
  await dialog.locator('.library-search-results>button').first().click();
  await expect(page.getByText('Read-only: Antigravity cannot be steered from Drishya')).toBeVisible();
  await expect(page.getByLabel('Prompt for selected harness session')).toHaveCount(0);
});

test('native actions reject Antigravity before launching anything', async () => {
  let launches = 0;
  const controller = new HarnessController(app, new WorkspaceAccess(app), { launch: (() => { launches++; throw new Error('unexpected launch'); }) as never });
  await expect(controller.inspect(id)).rejects.toThrow('Read-only: Antigravity');
  await expect(controller.start(id, 'hello', true)).rejects.toThrow('Read-only: Antigravity');
  expect((await controller.readiness(id)).state).toBe('unsupported');
  expect(launches).toBe(0);
});
