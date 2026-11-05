import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string, app: App, server: RunningServer, ids: Record<string, string> = {};
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-session-menu-'));
  app = new App(join(dir, 'data'));
  for (const [harness, file] of [['claude-code', 'claude/checkout-fix.jsonl'], ['codex', 'codex/rollout-checkout-review.jsonl']] as const)
    ids[harness] = (await app.ingest.importSource(harness, resolve('fixtures/synthetic', file))).recordingId;
  server = await startServer({ app, port: 0, token: 'synthetic-session-menu' });
});
test.afterAll(async () => { await server?.close(); await app?.close(); if (dir) { if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); } });

// UI-15: the session menu is three groups that say what they are for, repeats nothing the header offers, fits the window at rest,
// and keeps every action it had.
for (const [width, height] of [[1440, 900], [600, 720]] as const) for (const harness of ['claude-code', 'codex'] as const)
  test(`the session menu is grouped, has no repeats and fits at ${width}x${height} (${harness})`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible();
    await page.goto(`${server.url}/?experience=modern&motion=0#/r/${ids[harness]}`);
    await expect(page.locator('.history')).toBeVisible();
    await page.getByLabel('More workspace options', { exact: true }).click();
    const menu = page.locator('.workspace-menu[open]'), list = menu.locator('.workspace-utilities');
    for (const heading of ['This session', 'Move around', 'Share']) await expect(list.getByText(heading, { exact: true })).toBeVisible();
    // Nothing the header already offers: Changes lives in the header only.
    await expect(list.getByRole('button', { name: 'Changes', exact: true })).toHaveCount(0);
    await expect(page.locator('.modern-session-header').getByRole('button', { name: 'Changes', exact: true })).toBeVisible();
    // Every former action is still here.
    for (const name of ['Notes', 'Replay this session']) await expect(list.getByRole('button', { name, exact: true })).toBeVisible();
    await expect(list.getByText('Session details', { exact: true })).toBeVisible();
    await expect(list.getByText('Navigate history', { exact: true })).toBeVisible();
    await expect(list.getByText('Usage', { exact: true })).toBeVisible();
    await expect(list.getByText(/local preview/)).toBeVisible();
    await expect(list.getByRole('link', { name: 'Export recording', exact: true })).toBeVisible();
    // At rest it fits the window without an inner scroll.
    const fit = await list.evaluate((el) => ({ scroll: el.scrollHeight - el.clientHeight, bottom: el.getBoundingClientRect().bottom, height: innerHeight }));
    await expect(menu.locator('.usage-peek')).not.toHaveAttribute('open');
    expect(fit.scroll, 'no inner scroll at rest').toBeLessThanOrEqual(1);
    expect(fit.bottom, 'menu bottom inside the window').toBeLessThanOrEqual(fit.height);
    // Usage reads as numbers and words, never as raw units.
    await menu.locator('.usage-peek>summary').click();
    await expect(menu.locator('.usage-peek')).toHaveAttribute('open', '');
    const usage = menu.locator('.usage-peek');
    await expect(usage).not.toContainText(/Unix seconds|\(minutes\)|\bms\b\)/);
    await expect(usage.locator('dd').filter({ hasText: /^\d{7,}$/ })).toHaveCount(0);
  });
