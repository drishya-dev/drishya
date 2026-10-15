import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from './legacy-test.ts';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string, app: App, server: RunningServer;
test.beforeAll(async () => { dir = mkdtempSync(join(tmpdir(), 'drishya-outcomes-')); app = new App(dir); server = await startServer({ app, port: 0, token: 'synthetic-outcomes' }); });
test.afterAll(async () => { await server.close(); await app.close(); if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); });

test('wrapped test facts appear inside Shell, stay bounded and keep raw evidence available', async ({ page }) => {
  const sample = JSON.parse(readFileSync(resolve('apps/ui/public/demo/bundle.json'), 'utf8'));
  const op = sample.projection.operations.filter((item: { kind: string }) => item.kind === 'test').at(-1);
  op.kind = 'shell'; op.title = 'Run mixed checks';
  const raw = JSON.stringify([{ i: 0, value: { output: 'Test Files 46 passed (46)\nTests 100000 passed (100000)', exit_code: 0 } }, { i: 1, value: { output: 'Tests: 1 failed, 4 passed, 1 skipped, 6 total', exit_code: 1 } }, { i: 2, value: { output: '', exit_code: 0 } }]);
  op.detail = { kind: 'shell', command: 'captured mixed orchestration', outputPreview: raw, exitCode: 0 };
  op.artifactIds = [];
  await page.route('**/demo/bundle.json', route => route.fulfill({ json: sample }));
  await page.goto(new URL('/?demo&experience=classic', server.launchUrl).href);
  const card = page.locator(`article[data-op-id="${op.id}"]`);
  await expect(card).toHaveClass(/op-shell/);
  await expect(card).toContainText('100,000 passed');
  await expect(card).toContainText('Suite summary: 46 passed (46)');
  await expect(card).toContainText('1 failed');
  await expect(card.locator('.captured-outcomes > section')).toHaveCount(2);
  expect(await card.locator('.verification-tile').count()).toBeLessThan(80);
  await page.screenshot({ path: resolve('.local/wrapped-test-outcomes.png') });
  await card.getByRole('button', { name: /Expand/ }).click();
  await expect(card).toContainText('"exit_code":1');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
