// LAYOUT-1: past --stage-max (1920 px) the working composition is one centred stage, so extra width becomes map, never a wider
// gap between a dock and the thing it belongs to. Browser zoom changes the CSS viewport width in the same way (67 % of a
// 1440 px window is 2149 CSS px), so widths here stand for both large monitors and zoom-out. The stage never moves at or
// below 1920 px, and 600 px must not overflow sideways.
// LAYOUT-1b revert (Yash, 11 Nov): the interface size is never derived from the viewport; browser zoom and OS scaling own it.
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
  for (let i = 0; i < 40; i++) writeFileSync(join(root, `z-${i}.ts`), 'export {};\n');
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
  await page.route('**/controller', route => route.fulfill({ json: { harness: 'claude-code', available: false, state: 'idle', output: '', tools: [], approvals: [] } }));
  let first = true;
  await page.route('**/v1/working-locations', async (route) => {
    if (first && route.request().method() === 'GET') { first = false; await page.request.delete(route.request().url(), { headers: { 'content-type': 'application/json' } }); }
    await route.continue();
  });
});

async function open(page: Page, width: number, height = 900) {
  await page.setViewportSize({ width, height });
  await page.goto(server.launchUrl);
  await page.locator('.home').waitFor();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${recording}`);
  if (width <= 820) return; // the Files panel is a drawer at phone widths; only overflow is checked there
  const grant = page.getByRole('button', { name: /^Enable workspace reading/ });
  const explorer = page.locator('.folder-explorer');
  await expect(grant.or(page.locator('.folder-explorer[data-reading-access=current]'))).toBeVisible();
  if (await grant.isVisible()) await grant.click();
  await expect(explorer).toHaveAttribute('data-reading-access', 'current');
  // Compare composer toggles after asynchronous Files/tool inventories have arrived.
  await expect(page.locator('[data-spine-path="main.ts"]')).toHaveAttribute('aria-setsize', '41');
  await expect(page.locator('.modern-toolbox .tool-list')).toHaveCount(1);
  await page.evaluate(() => document.fonts.ready);
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

// Yash, 11 Nov: the interface size is never derived from the viewport. A 1920×1080 window at 100 % must look like 1440×900.
test('root and reading type are the same size at 1920×1080 as at 1440×900', async ({ page }) => {
  const measure = async () => page.evaluate(() => ({
    root: parseFloat(getComputedStyle(document.documentElement).fontSize),
    scaled: document.documentElement.hasAttribute('data-ui-scaled') || document.documentElement.style.getPropertyValue('--ui-scale') !== '',
    type: ['.history .prose', '.history .turn-text', '.modern-native-composer textarea'].map((selector) => {
      const style = getComputedStyle(document.querySelector(selector)!);
      return { selector, size: parseFloat(style.fontSize), family: style.fontFamily };
    }),
  }));
  await open(page, 1440, 900);
  const laptop = await measure();
  await open(page, 1920, 1080);
  const desktop = await measure();
  expect(desktop.root).toBe(16);
  expect(laptop.root).toBe(16);
  expect(desktop.scaled).toBe(false);
  expect(desktop.type).toEqual(laptop.type);
  for (const type of desktop.type) { expect(type.size, type.selector).toBe(15); expect(type.family, type.selector).toContain('Segoe UI'); }
});

// Yash, 10 Nov: the scrolling world reaches y=0 under the floating controls, and toggling the composer moves nothing else.
for (const [width, height] of [[1440, 900], [1920, 1080], [2560, 1440]]) {
  test(`${width}×${height}: history starts at the top and the composer toggle moves no panel`, async ({ page }) => {
    await open(page, width!, height);
    expect((await page.locator('.history').boundingBox())!.y).toBe(0);
    const panels = async () => Promise.all(['.folder-explorer', '.toolbox-rail', '.modern-tool-station'].map((selector) => page.locator(selector).boundingBox()));
    const initial = await panels();
    for (let toggle = 0; toggle < 2; toggle++) {
      await page.locator('.composer-minimize').click();
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const current = await panels();
      for (let i = 0; i < initial.length; i++) for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(current[i]![key] - initial[i]![key]), `panel ${i} ${key} after composer toggle`).toBeLessThan(1);
    }
  });
}
