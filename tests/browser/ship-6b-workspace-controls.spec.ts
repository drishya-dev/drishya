import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from './browser-server.ts';

let dir: string, id: string, app: App, server: RunningServer;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-ship-6b-'));
  writeFileSync(join(dir, 'first.ts'), 'export const original = true;\n');
  writeFileSync(join(dir, 'second.ts'), 'export const second = true;\n');
  const journal = join(dir, 'session.jsonl');
  writeFileSync(journal, [
    { type: 'session_meta', payload: { id: 'ship-6b', cwd: dir } },
    { type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Inspect files' }] } },
    { type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Fixture response' }] } },
  ].map(row => JSON.stringify(row)).join('\n') + '\n');
  app = new App(join(dir, 'data'));
  id = (await app.ingest.importSource('codex', journal)).recordingId;
  server = await startServer({ app, port: 0 });
});
test.afterAll(async () => {
  await server?.close(); await app?.close();
  if (dir) { if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); }
});
test.beforeEach(async ({ page }) => {
  await page.route('**/v1/working-locations', route => route.request().method() === 'GET'
    ? route.fulfill({ json: { version: 1, sessions: [] } }) : route.continue());
});

for (const width of [600, 1440]) {
  test(`Workspace patch search and receiving pane at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(server.launchUrl); await page.locator('.home').waitFor();
    await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
    await page.getByRole('button', { name: 'Open developer workspace', exact: true }).click();
    const desk = page.getByRole('region', { name: 'Developer workspace', exact: true });
    const approve = desk.getByRole('button', { name: 'Approve workspace reading', exact: true });
    await expect(approve.or(desk.getByRole('tablist'))).toBeVisible(); if (await approve.isVisible()) await approve.click();
    await expect(desk.getByRole('tablist')).toBeVisible();
    const trigger = desk.getByRole('button', { name: 'Choose workspace file', exact: true });
    if (await trigger.isVisible() && await trigger.getAttribute('aria-expanded') === 'false') await trigger.click();
    const findFile = page.getByRole('textbox', { name: 'Find repository files', exact: true });
    await findFile.fill('first.ts'); await page.locator('[data-spine-path="first.ts"]').click();
    const first = desk.locator('.desk-pane').nth(0);
    await first.getByRole('button', { name: 'Edit file', exact: true }).click();
    const editor = first.getByRole('textbox', { name: 'Local draft for first.ts', exact: true });
    await editor.press('Control+End'); await page.keyboard.type('\nexport const readableSearch = true;');
    await first.getByRole('button', { name: 'Compare draft', exact: true }).click();
    const controls = first.getByRole('group', { name: 'Patch reading controls', exact: true });
    const query = controls.getByRole('searchbox', { name: 'Find in patch' });
    await query.fill('readableSearch'); await expect(query).toBeFocused();
    expect((await query.boundingBox())!.width).toBeGreaterThanOrEqual(128);
    expect(await query.inputValue()).toBe('readableSearch');
    expect(await controls.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    await query.press('Enter'); await expect(first.locator('.patch-match')).toContainText('readableSearch');
    const layout = desk.getByLabel('Workspace layout actions', { exact: true });
    await layout.press('Enter'); await desk.getByRole('button', { name: 'Split view', exact: true }).press('Enter');
    if (width === 600) { await layout.press('Enter'); await desk.getByRole('button', { name: 'Pane 1 of 2 · switch', exact: true }).press('Enter'); }
    const second = desk.locator('.desk-pane').nth(1); await second.focus();
    await expect(second.getByText('Next file opens here')).toBeVisible();
    const showFiles = second.getByRole('button', { name: 'Show files', exact: true });
    if (width === 600) { await expect(showFiles).toBeVisible(); await showFiles.click(); }
    else { await expect(showFiles).toHaveCount(0); }
    await findFile.fill('second.ts'); await page.locator('[data-spine-path="second.ts"]').press('Enter');
    await expect(second.getByRole('region', { name: 'Workspace file second.ts', exact: true })).toBeVisible();
  });
}
