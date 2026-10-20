import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string, app: App, server: RunningServer;
const ids: Record<string, string> = {};
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-typed-browser-')); app = new App(join(dir, 'store'));
  for (const name of ['three-commands', 'file-change', 'image-view', 'mcp-call']) ids[name] = (await app.ingest.importSource('codex', resolve('fixtures/synthetic/codex-items', `${name}.jsonl`))).recordingId;
  server = await startServer({ app, port: 0 });
});

test('existing local typed children retain parent evidence in an isolated historical reader', async ({ page }) => {
  test.skip(!process.env.DRISHYA_TYPED_REAL_CONFIG, 'Opt-in isolated redacted store copy only');
  const config = JSON.parse(readFileSync(process.env.DRISHYA_TYPED_REAL_CONFIG!, 'utf8')) as { dir: string; id: string; childId: string; parentId: string };
  if (!resolve(config.dir).startsWith(resolve('.local/data-1-real-'))) throw new Error('Require the dedicated isolated typed-items store');
  const isolated = new App(config.dir), local = await startServer({ app: isolated, port: 0 });
  try {
    const child = isolated.projection(config.id).operations.find(op => op.id === config.childId)!;
    await page.route(/\/v1\/.*(?:controller|native)/, route => route.fulfill({ status: 404, body: '{}' }));
    await page.route('**/live', route => route.fulfill({ contentType: 'application/json', body: '{"live":false}' }));
    await page.route('**/refresh', route => route.fulfill({ contentType: 'application/json', body: '{"added":0,"more":false}' }));
    await page.goto(local.launchUrl); await expect(page.locator('.home')).toBeVisible();
    await page.goto(`${local.url}/?experience=modern&motion=0&at=${child.endSequence! + 1}#/r/${config.id}`);
    await expect(page.locator('.history')).toBeVisible({ timeout: 60_000 });
    const card = page.locator(`.history article[data-op-id="${config.childId}"]`);
    await expect(card).toBeVisible();
    await expect(card).toHaveClass(/op-test/);
    await expect(page.locator(`.history article[data-op-id="${config.parentId}"]`)).toHaveCount(0);
    await card.getByRole('button', { name: /Expand/ }).click();
    await card.locator('.captured-script>summary').click();
    await expect(card.locator('.captured-script .insp-note').first()).toContainText('Recorded between this call and its output.');
    await expect(card.locator('.captured-script')).toContainText(/tools\.(exec_command|apply_patch)/);
  } finally { await local.close(); await isolated.close(); }
});
test.afterAll(async () => { await server?.close(); await app?.close(); if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); });

test('typed child cards show true commands and tests, with the wrapper reachable only as Script', async ({ page }) => {
  await page.route(/\/v1\/.*controller/, route => route.fulfill({ status: 404, body: '{}' }));
  await page.route('**/live', route => route.fulfill({ contentType: 'application/json', body: '{"live":false}' }));
  await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${ids['three-commands']}`);
  const cards = page.locator('.history article.op');
  await expect(cards).toHaveCount(3);
  await expect(cards.filter({ hasText: 'pnpm test' })).toContainText('441 passed');
  await expect(cards.filter({ hasText: 'node --test' })).toHaveClass(/op-test/);
  const parent = app.projection(ids['three-commands']!).operations.find(op => op.tool === 'exec')!;
  await expect(page.locator(`article[data-op-id="${parent.id}"]`)).toHaveCount(0);
  await expect(page.locator('details.captured-script')).toHaveCount(0);
  const first = cards.filter({ hasText: 'pnpm test' });
  await first.getByRole('button', { name: /Expand/ }).click();
  await first.locator('.captured-script>summary').click();
  await expect(first.locator('.captured-script')).toContainText('tools.exec_command');
  const summary = await page.request.get(`${server.url}/v1/recordings/${ids['three-commands']}/summary`);
  expect(await summary.json()).toMatchObject({ tests: 2, errors: 1 });
  const commands = await page.request.get(`${server.url}/v1/recordings/${ids['three-commands']}/commands`);
  expect((await commands.json()).total).toBe(3);
  await page.screenshot({ path: resolve('.local/typed-children.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${ids['file-change']}`);
  await expect(page.locator('.history article.op-edit')).toHaveCount(1);
  await expect(page.locator('.history article.op-edit')).toContainText('FileChange');
  await page.locator('.history article.op-edit').getByRole('button', { name: /Expand/ }).click();
  await page.locator('.captured-script>summary').click();
  await expect(page.locator('.captured-script')).toContainText('tools.apply_patch');
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${ids['image-view']}`);
  await expect(page.locator('.history article.op')).toContainText('View image');
  await expect(page.locator('.history article.op img')).toHaveCount(0);
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${ids['mcp-call']}`);
  await expect(page.locator('.history article.op')).toHaveCount(1);
  await expect(page.locator('.history article.op')).toContainText('Synthetic documentation');
});
