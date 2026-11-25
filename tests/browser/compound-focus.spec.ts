import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from './legacy-test.ts';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from './browser-server.ts';
let dir: string, app: App, server: RunningServer;
test.beforeAll(async () => { dir = mkdtempSync(join(tmpdir(), 'drishya-focus-')); app = new App(dir); server = await startServer({ app, port: 0, token: 'synthetic-focus' }); });
test.afterAll(async () => { await server.close(); await app.close(); if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); });

test('agent and action focus survive each other and can be cleared independently', async ({ page }) => {
  await page.goto(new URL('/?demo', server.launchUrl).href);
  await expect(page.locator('.workbench-station')).toBeVisible();
  const tool = page.locator('.instrument.k-read');
  await tool.click(); await expect(tool).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.md-agents > summary').click();
  await page.locator('.station-subagents > summary').click();
  const agent = page.getByRole('switch', { name: 'Filter by Explore agent', exact: true });
  await agent.click(); await expect(agent).toHaveAttribute('aria-checked', 'true');
  await expect(tool).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Show all agents', exact: true }).click();
  await expect(agent).toHaveAttribute('aria-checked', 'false');
  await expect(tool).toHaveAttribute('aria-pressed', 'true');
  await agent.click(); await tool.click();
  await expect(agent).toHaveAttribute('aria-checked', 'true');
  await expect(tool).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Clear focus', exact: true }).click();
  await expect(agent).toHaveAttribute('aria-checked', 'false');
  await expect(tool).toHaveAttribute('aria-pressed', 'false');
  // The Legacy crown shortcut is not part of Modern; the dock focus checks above remain.
});
