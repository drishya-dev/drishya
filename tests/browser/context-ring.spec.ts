import { readFileSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string, app: App, server: RunningServer;
test.beforeAll(async () => { dir = mkdtempSync(join(tmpdir(), 'drishya-context-ring-')); app = new App(dir); server = await startServer({ app, port: 0, token: 'synthetic-context-ring' }); });
test.afterAll(async () => { await server?.close(); await app?.close(); if (dir) { if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); } });

async function open(page: Page, usage: unknown) {
  const bundle = JSON.parse(readFileSync(resolve('apps/ui/public/demo/bundle.json'), 'utf8'));
  if (usage) bundle.projection.usage = usage; else delete bundle.projection.usage;
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route('**/demo/bundle.json', route => route.fulfill({ json: bundle }));
  await page.goto(new URL('/?demo&experience=modern&motion=0', server.launchUrl).href);
  await expect(page.locator('.session-line')).toBeVisible();
}
const request = (input: number) => ({ source: 'codex-token-count', cumulative: false, tokens: { input }, contextWindow: 258400 });

test('recorded request input and window retain their ratio and disclose its derivation', async ({ page }) => {
  await open(page, { latest: { source: 'codex-token-count', cumulative: true, tokens: { total: 900000 }, contextWindow: 258400 }, byTurn: { t1: request(40000), t2: request(129200) } });
  const ring = page.locator('.session-line .context-ring');
  await expect(ring).toHaveCount(1);
  await expect(ring).toHaveAttribute('aria-label', /^Last request input: 129,200 of 258,400 context window tokens\. 50% ratio, derived from the harness's recorded values\.$/);
  await expect(ring).not.toHaveAttribute('data-high', 'true');
  const box = (await ring.boundingBox())!;
  expect(box.width).toBeLessThanOrEqual(13);
  expect(box.height).toBeLessThanOrEqual(13);
  expect(await ring.evaluate(el => getComputedStyle(el.querySelector('.context-ring-fill')!).strokeDasharray)).toMatch(/^[\d.]+px?,? [\d.]+/);
  await page.locator('.session-line').screenshot({ path: resolve('.local/context-ring.png') });
});

test('a high recorded request ratio turns amber, and no context window means no ring', async ({ page }) => {
  await open(page, { byTurn: { t1: request(245000) } });
  await expect(page.locator('.session-line .context-ring')).toHaveAttribute('data-high', 'true');
  await open(page, undefined);
  await expect(page.locator('.session-line .context-ring')).toHaveCount(0);
  await open(page, { byTurn: { t1: { source: 'claude-message-usage', cumulative: false, tokens: { input: 120000 } } } });
  await expect(page.locator('.session-line .context-ring')).toHaveCount(0);
});
