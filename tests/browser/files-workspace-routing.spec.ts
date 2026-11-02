import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string, id: string, app: App, server: RunningServer;
const paths = Array.from({ length: 9 }, (_, index) => `file-${index}.ts`);
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-files-workspace-'));
  for (const [index, path] of paths.entries()) writeFileSync(join(dir, path), `export const value = ${index};\n`);
  const journal = join(dir, 'session.jsonl');
  writeFileSync(journal, [
    { type: 'session_meta', payload: { id: 'files-workspace-routing', cwd: dir } },
    { type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Inspect workspace source' }] } },
  ].map(row => JSON.stringify(row)).join('\n') + '\n');
  app = new App(join(dir, 'data'));
  id = (await app.ingest.importSource('codex', journal)).recordingId;
  server = await startServer({ app, port: 0 });
});
test.afterAll(async () => {
  await server?.close(); await app?.close();
  if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path');
  rmSync(dir, { recursive: true, force: true });
});

async function openWorkspace(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.route('**/v1/working-locations', route => route.request().method() === 'GET' ? route.fulfill({ json: { version: 1, sessions: [] } }) : route.continue());
  await page.goto(server.launchUrl);
  await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
  await page.getByRole('button', { name: 'Open developer workspace', exact: true }).click();
  const desk = page.getByRole('region', { name: 'Developer workspace', exact: true });
  const approval = desk.getByRole('button', { name: 'Approve workspace reading', exact: true });
  await expect(approval.or(desk.getByRole('tablist'))).toBeVisible();
  if (await approval.isVisible()) await approval.click();
  await expect(desk.getByRole('tablist')).toBeVisible();
  return desk;
}

async function chooseFile(page: Page, desk: Locator, path: string, keyboard = false) {
  const trigger = desk.getByRole('button', { name: 'Choose workspace file', exact: true });
  if (await trigger.isVisible() && await trigger.getAttribute('aria-expanded') === 'false') await trigger.click();
  await page.getByRole('textbox', { name: 'Find repository files', exact: true }).fill(path);
  const row = page.locator(`[data-spine-path="${path}"]`);
  if (keyboard) await row.press('Enter'); else await row.click();
}

for (const width of [600, 1440]) {
  test(`Files opens the selected Workspace pane by click and Enter, then returns to peek at ${width}px`, async ({ page }) => {
    const desk = await openWorkspace(page, width);
    await expect(desk.getByText('Choose a file from Files to open it here.', { exact: false })).toBeVisible();
    await expect(desk.getByText(/Select this pane, then choose/)).toHaveCount(0);
    // No pane selection is required for the first file.
    await chooseFile(page, desk, paths[0]!);
    const first = desk.locator('.desk-pane').nth(0);
    await expect(first.getByRole('region', { name: `Workspace file ${paths[0]}`, exact: true })).toBeVisible();
    await expect(desk.getByRole('tab')).toHaveCount(1);
    await expect(page.locator('.current-file-reader')).toHaveCount(0);

    await desk.getByLabel('Workspace layout actions', { exact: true }).press('Enter');
    await desk.getByRole('button', { name: 'Split view', exact: true }).press('Enter');
    const second = desk.locator('.desk-pane').nth(1);
    if (width === 600) {
      await desk.getByLabel('Workspace layout actions', { exact: true }).press('Enter');
      await desk.getByRole('button', { name: 'Pane 1 of 2 · switch', exact: true }).press('Enter');
    }
    await second.getByRole('button', { name: 'Show files', exact: true }).click();
    await chooseFile(page, desk, paths[1]!, true);
    await expect(second.getByRole('region', { name: `Workspace file ${paths[1]}`, exact: true })).toBeVisible();
    if (width === 600) {
      await desk.getByLabel('Workspace layout actions', { exact: true }).press('Enter');
      await desk.getByRole('button', { name: 'Pane 2 of 2 · switch', exact: true }).press('Enter');
    }
    await expect(first.getByRole('region', { name: `Workspace file ${paths[0]}`, exact: true })).toHaveCount(1);
    await expect(desk.getByRole('tab')).toHaveCount(2);
    await expect(page.locator('.current-file-reader')).toHaveCount(0);

    await desk.getByRole('button', { name: 'Back to agent', exact: true }).click();
    const show = page.getByRole('button', { name: 'Show files', exact: true });
    if (await show.getAttribute('aria-pressed') === 'false') await show.click();
    await page.getByRole('textbox', { name: 'Find repository files', exact: true }).fill(paths[0]!);
    await page.locator(`[data-spine-path="${paths[0]}"]`).click();
    await expect(desk).toHaveCount(0);
    await expect(page.locator('.current-file-reader')).toBeVisible();
  });

  test(`Files preserves eight tabs and a closed-tab local draft at ${width}px`, async ({ page }) => {
    const desk = await openWorkspace(page, width);
    await chooseFile(page, desk, paths[0]!);
    const document = desk.getByRole('region', { name: `Workspace file ${paths[0]}`, exact: true });
    await document.getByRole('button', { name: 'Edit file', exact: true }).click();
    const editor = document.getByRole('textbox', { name: `Local draft for ${paths[0]}`, exact: true });
    await expect(editor).toContainText('export const value = 0;');
    await editor.fill('export const retainedDraft = true;');
    await desk.getByRole('button', { name: `Close workspace tab ${paths[0]}`, exact: true }).click();
    await chooseFile(page, desk, paths[0]!, true);
    await expect(editor).toContainText('retainedDraft');
    for (const path of paths.slice(1, 8)) {
      await chooseFile(page, desk, path);
      await expect(desk.getByRole('region', { name: `Workspace file ${path}`, exact: true })).toBeVisible();
    }
    await expect(desk.getByRole('tab')).toHaveCount(8);
    await chooseFile(page, desk, paths[8]!);
    await expect(desk.getByRole('alert')).toHaveText('Eight files are open. Close a tab to open another.');
    await expect(desk.getByRole('tab')).toHaveCount(8);
    await expect(desk.getByRole('region', { name: `Workspace file ${paths[8]}`, exact: true })).toHaveCount(0);
    await expect(page.locator('.current-file-reader')).toHaveCount(0);
    expect(readFileSync(join(dir, paths[0]!), 'utf8')).toBe('export const value = 0;\n');
  });

  test(`Files reading leaves live capture and explicit replay available at ${width}px`, async ({ page }) => {
    const desk = await openWorkspace(page, width);
    await chooseFile(page, desk, paths[0]!);
    expect(app.ingest.isLive(id)).toBe(true);
    const before = app.store.countObservations(id), marker = `LIVE_FILES_WORKSPACE_${width}`;
    appendFileSync(join(dir, 'session.jsonl'), JSON.stringify({ type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: marker }] } }) + '\n');
    await app.ingest.sync(id);
    expect(app.store.countObservations(id)).toBeGreaterThan(before);
    await expect(desk.getByRole('region', { name: `Workspace file ${paths[0]}`, exact: true })).toBeVisible();
    await desk.getByRole('button', { name: 'Back to agent', exact: true }).click();
    await expect(page.locator('.history')).toContainText(marker);
    await page.getByLabel('More workspace options', { exact: true }).press('Enter');
    await page.getByRole('button', { name: 'Replay this session', exact: true }).press('Enter');
    await expect(page.getByLabel('Replay controls', { exact: true })).toBeVisible();
    await expect(desk).toHaveCount(0);
    expect(Number(await page.getByRole('slider', { name: 'Timeline', exact: true }).getAttribute('aria-valuemax'))).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Exit replay', exact: true }).click();
    await expect(page.getByLabel('Replay controls', { exact: true })).toHaveCount(0);
    await expect(page.locator('.history')).toContainText(marker);
  });
}
