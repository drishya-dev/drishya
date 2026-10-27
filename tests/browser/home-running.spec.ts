import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string, app: App, server: RunningServer, claudeId: string, codexId: string;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-home-running-'));
  app = new App(dir);
  claudeId = (await app.ingest.importSource('claude-code', resolve('fixtures/synthetic/claude/checkout-fix.jsonl'))).recordingId;
  codexId = (await app.ingest.importSource('codex', resolve('fixtures/synthetic/codex/rollout-checkout-review.jsonl'))).recordingId;
  server = await startServer({ app, port: 0 });
});
test.afterAll(async () => {
  await server?.close(); await app?.close();
  if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path');
  rmSync(dir, { recursive: true, force: true });
});

async function home(page: Page, following: boolean) {
  const now = new Date().toISOString();
  const base = { createdAt: now, updatedAt: now, lastSourceTime: now, observationCount: 24, live: following, pinned: false, health: { state: following ? 'following' : 'idle', live: following } };
  const recordings = [
    { ...base, id: claudeId, harness: 'claude-code', title: 'Synthetic Claude run', workspaceRoot: '/synthetic/alpha' },
    { ...base, id: codexId, harness: 'codex', title: 'Synthetic Codex run', workspaceRoot: '/synthetic/beta' },
  ];
  await page.route('**/v1/recordings', route => route.fulfill({ json: { recordings } }));
  await page.route('**/v1/sources', route => route.fulfill({ json: { sources: [], errors: [] } }));
  await page.goto(server.launchUrl);
  await expect(page.locator('.mh-home')).toBeVisible();
}

test('Running now is absent when no journal is being followed recently', async ({ page }) => {
  await home(page, false);
  await expect(page.locator('.mh-session')).toHaveCount(2);
  await expect(page.getByRole('region', { name: 'Running now' })).toHaveCount(0);
});

test('Running now stays above the library across repositories and opens its captured session', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await home(page, true);
  const strip = page.getByRole('region', { name: 'Running now' });
  await expect(strip).toBeVisible();
  await expect(strip.getByRole('button')).toHaveCount(2);
  await expect(strip).toContainText('Synthetic Claude run');
  await expect(strip).toContainText('Synthetic Codex run');
  await expect(strip).toHaveAttribute('title', /cannot tell whether the agent process is alive/);
  expect(await strip.evaluate(el => el.parentElement?.classList.contains('mh-home'))).toBe(true);
  const stripBounds = await strip.boundingBox(), libraryBounds = await page.locator('.mh-library').boundingBox();
  expect(stripBounds!.y + stripBounds!.height).toBeLessThanOrEqual(libraryBounds!.y);
  await page.locator('.mh-workspace-list button').filter({ hasText: 'alpha' }).click();
  await expect(page.locator('.mh-session')).toHaveCount(1);
  await expect(strip.getByRole('button')).toHaveCount(2);
  await strip.getByRole('button', { name: /Synthetic Codex run/ }).click();
  await expect(page).toHaveURL(new RegExp(`#/r/${codexId}$`));
  await expect(page.locator('.history')).toBeVisible();
});
