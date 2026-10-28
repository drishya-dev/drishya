import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string, id: string, app: App, server: RunningServer;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-workspace-band-'));
  writeFileSync(join(dir, 'reading.ts'), Array.from({ length: 80 }, (_, i) => `export const captured${i + 1} = ${i + 1};`).join('\n'));
  const journal = join(dir, 'session.jsonl');
  writeFileSync(journal, [
    { type: 'session_meta', payload: { id: 'workspace-band', cwd: dir } },
    { type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Read the file' }] } },
    { type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Reading it now.' }] } },
  ].map((row) => JSON.stringify(row)).join('\n') + '\n');
  app = new App(join(dir, 'data')); id = (await app.ingest.importSource('codex', journal)).recordingId; server = await startServer({ app, port: 0 });
});
test.afterAll(async () => { await server?.close(); await app?.close(); if (dir) { if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); } });
test.beforeEach(async ({ page }) => { let first = true; await page.route('**/v1/working-locations', async (route) => { if (first && route.request().method() === 'GET') { first = false; await page.request.delete(route.request().url(), { headers: { 'content-type': 'application/json' } }); } await route.continue(); }); });

// UI-12: the Workspace panel rises into the band between the header and the Files / Repository bar's own top edge.
for (const width of [600, 1440]) test(`the Workspace panel uses the band above it at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(server.launchUrl); await page.locator('.home').waitFor();
  await page.goto(`${server.url}/?experience=modern#/r/${id}`);
  await page.getByRole('button', { name: 'Open developer workspace', exact: true }).click();
  const desk = page.getByRole('region', { name: 'Developer workspace', exact: true });
  const approve = desk.getByRole('button', { name: 'Approve workspace reading' }), tabs = desk.getByRole('tablist', { name: 'Open workspace files' });
  await expect(approve.or(tabs)).toBeVisible();
  if (await approve.isVisible()) await approve.click();
  await expect(desk.getByRole('tablist', { name: 'Open workspace files' })).toBeVisible();
  const rect = (selector: string) => page.locator(selector).first().evaluate((el) => { const r = el.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) }; });
  const header = await rect('.modern-session-header'), leading = await rect('.workspace-leading'), panel = await rect('.developer-workspace');
  if (width > 820) {
    const explorer = await rect('.folder-explorer');
    // Beside the bar: the panel starts just under the header, above the Files panel's own top, and never over the bar or the Files panel.
    expect(panel.top - header.bottom).toBeLessThanOrEqual(14);
    expect(panel.top).toBeLessThan(explorer.top);
    expect(panel.left).toBeGreaterThanOrEqual(Math.max(explorer.right, leading.right));
  } else {
    // Full width below the bar: unchanged, and still clear of it.
    expect(panel.top).toBeGreaterThanOrEqual(leading.bottom - 1);
  }
  await expect(desk.getByRole('button', { name: 'Back to agent' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.mouse.move(0, 0); await page.screenshot({ path: `.local/ui12-${width}.png` });
});
