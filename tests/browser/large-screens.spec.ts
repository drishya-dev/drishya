// LAYOUT-1: past --stage-max (1920 px) the working composition is one centred stage, so extra width becomes map, never a wider
// gap between a dock and the thing it belongs to. Browser zoom changes the CSS viewport width in the same way (67 % of a
// 1440 px window is 2149 CSS px), so widths here stand for both large monitors and zoom-out. The stage never moves at or
// below 1920 px, and 600 px must not overflow sideways.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

const STAGE_MAX = 1920;
let dir: string, app: App, server: RunningServer, recording: string;

test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-large-screens-'));
  app = new App(join(dir, 'store'));
  const root = join(dir, 'repo');
  mkdirSync(root);
  writeFileSync(join(root, 'main.ts'), 'export const stage = 1;\n');
  const common = { cwd: root, sessionId: 'large-screens', timestamp: '2026-11-08T10:00:00Z' };
  const rows = [
    { type: 'user', uuid: 'u0', message: { role: 'user', content: 'Show me the stage at every width' } },
    { type: 'assistant', uuid: 'read', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'read-main', name: 'Read', input: { file_path: join(root, 'main.ts') } }] } },
    { type: 'user', uuid: 'read-result', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'read-main', content: 'export const stage = 1;\n' }] } },
    { type: 'assistant', uuid: 'reply', message: { role: 'assistant', content: [{ type: 'text', text: 'The file holds one constant.' }] } },
  ].map((row) => JSON.stringify({ ...common, ...row }));
  const journal = join(dir, 'session.jsonl');
  writeFileSync(journal, rows.join('\n') + '\n');
  recording = (await app.ingest.importSource('claude-code', journal)).recordingId;
  server = await startServer({ app, port: 0 });
});
test.afterAll(async () => {
  await server?.close();
  await app?.close();
  if (dir) {
    if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary directory');
    rmSync(dir, { recursive: true, force: true });
  }
});

// Every test starts without workspace consent (the first read of working locations clears what an earlier test granted).
test.beforeEach(async ({ page }) => {
  let first = true;
  await page.route('**/v1/working-locations', async (route) => {
    if (first && route.request().method() === 'GET') { first = false; await page.request.delete(route.request().url(), { headers: { 'content-type': 'application/json' } }); }
    await route.continue();
  });
});

async function open(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(server.launchUrl);
  await page.locator('.home').waitFor();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${recording}`);
  if (width <= 820) return; // the Files panel is a drawer at phone widths; only overflow is checked there
  const grant = page.getByRole('button', { name: /^Enable workspace reading/ });
  const explorer = page.locator('.folder-explorer');
  await expect(grant.or(page.locator('.folder-explorer[data-reading-access=current]'))).toBeVisible();
  if (await grant.isVisible()) await grant.click();
  await expect(explorer).toHaveAttribute('data-reading-access', 'current');
}
/** Left and right edge of the first match, or null when it is not on screen. */
const span = (page: Page, selector: string) => page.evaluate((s) => {
  const r = document.querySelector(s)?.getBoundingClientRect();
  return r && r.width > 0 ? { left: r.left, right: r.right } : null;
}, selector);

for (const width of [1440, 1920, 2149, 2560, 3840]) {
  test(`${width}px: every dock, the column, the Workspace and the peek stay inside the stage`, async ({ page }) => {
    await open(page, width);
    const edge = Math.max(0, (width - STAGE_MAX) / 2), inside = (box: { left: number; right: number } | null, name: string) => {
      expect(box, name).not.toBeNull();
      expect(box!.left, `${name} left`).toBeGreaterThanOrEqual(edge - 0.5);
      expect(box!.right, `${name} right`).toBeLessThanOrEqual(width - edge + 0.5);
    };
    for (const selector of ['.modern-identity', '.workspace-utilities', '.folder-explorer', '.history-inner', '.toolbox-rail']) inside(await span(page, selector), selector);
    const column = (await span(page, '.history-inner'))!;
    expect(column.right - column.left, 'history column keeps its reading maximum').toBeLessThanOrEqual(1280.5);

    const file = page.locator('[data-spine-path]').filter({ has: page.getByText('main.ts', { exact: true }) });
    await file.click();
    await expect(page.locator('.file-peek-reader[open]')).toBeVisible();
    inside(await span(page, '.file-peek-reader'), 'file peek');

    await open(page, width); // the peek and the Workspace are two modes: start again for the second
    await page.getByRole('button', { name: 'Open developer workspace', exact: true }).click();
    await expect(page.locator('.developer-workspace')).toBeVisible();
    const desk = (await span(page, '.developer-workspace'))!;
    inside(desk, 'Workspace');
    expect(desk.right - desk.left, 'Workspace stays inside the stage width').toBeLessThanOrEqual(STAGE_MAX);
  });
}

test('600px does not overflow sideways', async ({ page }) => {
  await open(page, 600);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
