import { appendFileSync, copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';
let dir: string, app: App, server: RunningServer, largeId: string;
const bundle = JSON.parse(readFileSync(resolve('apps/ui/public/demo/bundle.json'), 'utf8'));
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-canvas-'));
  const journal = join(dir, 'large-synthetic.jsonl');
  copyFileSync(resolve('fixtures/synthetic/claude/checkout-fix.jsonl'), journal);
  const rows: object[] = [];
  for (let i = 0; i < 220; i++) {
    const base = { cwd: '/home/dev/shop', sessionId: 'c0ffee00-0000-4000-8000-000000000001', timestamp: '2026-10-15T06:00:00.000Z' };
    rows.push({ ...base, uuid: `canvas-call-${i}`, type: 'assistant', message: { id: `canvas-msg-${i}`, role: 'assistant', content: [{ type: 'text', text: `Captured synthetic reading ${i}.` }, { type: 'tool_use', id: `canvas-${i}`, name: 'Read', input: { file_path: '/home/dev/shop/src/checkout/guard.ts' } }] } });
    rows.push({ ...base, uuid: `canvas-result-${i}`, type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: `canvas-${i}`, content: `1\t// captured synthetic line ${i}` }] } });
  }
  appendFileSync(journal, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
  app = new App(join(dir, 'data')); largeId = (await app.ingest.importSource('claude-code', journal)).recordingId;
  server = await startServer({ app, port: 0, token: 'canvas-synthetic-only' });
});
test.afterAll(async () => { await server?.close(); await app?.close(); if (dir) { if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); } });
// UI-4: Modern is the only product choice; these journeys exercise the retained versions, so they turn the developer switch on.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('drishya-dev-ui-versions', '1'); } catch { /* the URL switch works without storage */ } });
});
const url = (extra = '') => new URL(`/?demo&experience=canvas&motion=0${extra}`, server.launchUrl).href;

test('Modern is the default and explicit retained-version choices survive a launch without a version query', async ({ page }) => {
  const ordinary = new URL('/?demo&motion=0', server.launchUrl).href;
  await page.goto(ordinary);
  await expect(page.locator('html')).toHaveAttribute('data-ui-version', 'modern');
  await expect(page.locator('html')).toHaveAttribute('data-experience', 'classic');
  await page.getByRole('button', { name: 'Workspace settings', exact: true }).click();
  await page.getByRole('tab', { name: 'UI versions', exact: true }).click();
  await page.getByRole('button', { name: /^Legacy/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-experience', 'classic');
  await page.goto(ordinary);
  await expect(page.locator('html')).toHaveAttribute('data-experience', 'classic');
  await page.getByRole('button', { name: 'Workspace settings', exact: true }).click();
  await page.getByRole('tab', { name: 'UI versions', exact: true }).click();
  await page.getByRole('button', { name: /^Canvas/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-experience', 'canvas');
  await page.goto(ordinary);
  await expect(page.locator('html')).toHaveAttribute('data-experience', 'canvas');
});

test('Canvas, Modern and Legacy switch without losing a real recording or loading the other shell', async ({ page }) => {
  await page.goto(server.launchUrl);
  await expect(page.locator('.home')).toBeVisible();
  await page.goto(new URL(`/?experience=canvas&motion=0#/r/${largeId}`, server.launchUrl).href);
  await expect(page.locator('.cv-workspace')).toBeVisible();
  await page.getByRole('button', { name: 'Workspace settings', exact: true }).click();
  await page.getByRole('tab', { name: 'UI versions', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Workbench/ })).toHaveCount(0);
  await page.getByRole('button', { name: /^Modern/ }).click();
  await expect(page.locator('[data-ui-version=modern] .connected-workspace')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`experience=modern.*#/r/${largeId}$`));
  await expect(page.locator('.cv-workspace')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('[data-ui-version=modern] .connected-workspace')).toBeVisible();
  await page.getByRole('button', { name: 'Workspace settings', exact: true }).click();
  await page.getByRole('tab', { name: 'UI versions', exact: true }).click();
  await page.getByRole('button', { name: /^Legacy/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-experience', 'classic');
  await expect(page).toHaveURL(new RegExp(`experience=classic.*#/r/${largeId}$`));
  await page.getByRole('button', { name: 'Workspace settings', exact: true }).click();
  await page.getByRole('tab', { name: 'UI versions', exact: true }).click();
  await page.getByRole('button', { name: /^Canvas/ }).click();
  await expect(page.locator('.cv-workspace')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`experience=canvas.*#/r/${largeId}$`));
});

test('a disconnected live stream reports cached reading and recovers without losing its recording', async ({ page }) => {
  await page.route('**/v1/changes', route => route.abort());
  await page.goto(server.launchUrl);
  await expect(page.locator('.home')).toBeVisible();
  await page.goto(new URL(`/?experience=canvas&motion=0#/r/${largeId}`, server.launchUrl).href);
  await expect(page.locator('.cv-zoom')).toContainText('Reconnecting');
  await expect(page.locator('.cv-node').first()).toBeVisible();
  const title = await page.locator('.cv-header h1').textContent();
  await page.unroute('**/v1/changes');
  await expect(page.locator('.cv-zoom')).not.toContainText('Reconnecting');
  await expect(page.locator('.cv-header h1')).toHaveText(title!);
});

test('Canvas uses the requested local materials and reads captured code in its independent reader', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const external: string[] = [], errors: string[] = [];
  page.on('request', request => { if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== new URL(server.launchUrl).origin) external.push(request.url()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url());
  await expect(page.locator('.cv-workspace')).toBeVisible();
  expect((await page.locator('.cv-header').boundingBox())!.height).toBe(56);
  expect((await page.getByRole('navigation', { name: 'Workspace navigation' }).boundingBox())!.width).toBe(56);
  await expect(page.locator('textarea')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^(Send|Approve|Run command)$/ })).toHaveCount(0);
  await expect(page.locator('.cv-workspace')).toHaveCSS('background-color', 'rgb(24, 24, 27)');
  await page.getByRole('textbox', { name: 'Search actions, files, commands' }).fill('guard');
  await page.getByRole('region', { name: 'Search results' }).getByRole('button').filter({ hasText: /Read.*guard/ }).first().click();
  const reader = page.getByRole('complementary', { name: 'Selected action reader' });
  await expect(reader).toContainText('checkoutBlock');
  await expect(reader.locator('[data-source-line="1"]')).toContainText('import type');
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (text: string) => { document.documentElement.dataset.copiedMaterial = text; } } }));
  await reader.getByRole('button', { name: 'Copy visible captured content', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-copied-material', /export function checkoutBlock/);
  expect(await page.locator('html').getAttribute('data-copied-material')).not.toContain('Copy captured page');
  const card = page.locator('.cv-node.selected');
  expect((await card.boundingBox())!.width).toBe(292);
  expect((await card.boundingBox())!.x).toBeGreaterThan((await page.locator('.cv-left-panel').boundingBox())!.x + 284);
  await expect(card).toHaveCSS('border-top-color', 'rgb(90, 169, 255)');
  await reader.getByRole('button', { name: 'Open file history', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Work on src/checkout/guard.ts' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Close reader' }).click();
  await expect(reader).toHaveCount(0);
  expect(await page.evaluate(async () => { await document.fonts.load('400 14px Outfit'); return document.fonts.check('400 14px Outfit'); })).toBe(true);
  expect(external).toEqual([]); expect(errors).toEqual([]);
});

test('keyboard jumps preserve history and open the real failure, edit and neighbouring action', async ({ page }) => {
  await page.goto(url());
  await page.locator('.cv-viewport').focus();
  await page.keyboard.press('f');
  const reader = page.getByRole('complementary', { name: 'Selected action reader' });
  await expect(reader).toContainText('Failed');
  await expect(reader).toContainText('allows a free order');
  await page.keyboard.press('e');
  await expect(reader.locator('.diff').first()).toBeVisible();
  const title = await reader.locator('h2').textContent();
  await page.keyboard.press('ArrowRight');
  await expect(reader.locator('h2')).not.toHaveText(title!);
  await page.keyboard.press('Escape');
  await expect(reader).toHaveCount(0);
  await page.keyboard.press('/');
  await expect(page.getByRole('textbox', { name: 'Search actions, files, commands' })).toBeFocused();
  await expect(page.locator('.cv-replay-controls')).toContainText('Replay');
});

test('agent and tool switches combine; Repository shows only real file references and captured history', async ({ page }) => {
  await page.goto(url());
  const tool = page.getByRole('switch', { name: 'Filter Read actions', exact: true });
  await tool.click();
  const agent = page.getByRole('switch', { name: 'Focus Explore', exact: true });
  await agent.click();
  await expect(tool).toHaveAttribute('aria-checked', 'true');
  await expect(agent).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(tool).toHaveAttribute('aria-checked', 'false');
  await page.getByRole('navigation', { name: 'Canvas views' }).getByRole('button', { name: 'Agents', exact: true }).click();
  await page.getByRole('button', { name: 'Fit', exact: true }).click();
  await expect(page.locator('.cv-passage-label').filter({ hasText: 'Helper' }).first()).toBeAttached();
  await page.getByRole('navigation', { name: 'Canvas views' }).getByRole('button', { name: 'Repository', exact: true }).click();
  const file = page.getByLabel('Repository map', { exact: true }).getByRole('button', { name: 'src/checkout/guard.ts', exact: true });
  await expect(file).toBeVisible();
  await file.click();
  await expect(page.getByRole('dialog', { name: 'Work on src/checkout/guard.ts' })).toBeVisible();
});

test('Appearance follows Dark, Light and System; economical and reduced-motion paths remain static', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto(url());
  await page.locator('.cv-viewport').focus(); await page.keyboard.press('f');
  await page.getByRole('button', { name: 'Workspace settings', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Workspace settings' });
  await settings.getByRole('button', { name: 'Light', exact: true }).click();
  await expect(page.locator('.cv-workspace')).toHaveCSS('background-color', 'rgb(244, 244, 245)');
  await expect(page.locator('.cv-active-path .cv-link-hit').first()).toHaveCSS('stroke', 'rgba(0, 0, 0, 0)');
  await settings.getByRole('button', { name: 'System', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await settings.getByRole('checkbox', { name: /^Low resource mode/ }).check();
  await expect(settings.getByRole('checkbox', { name: /^Motion/ })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.locator('.cv-workspace')).toHaveAttribute('data-motion', 'false');
  expect(await page.locator('.cv-node').count()).toBeLessThanOrEqual(32);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('html')).toHaveAttribute('data-low-resource', '');
});

test('final review opens the captured file patch and its exact action in the reader', async ({ page }) => {
  await page.goto(url());
  await page.getByRole('button', { name: 'Review changed files', exact: true }).click();
  const review = page.getByRole('dialog', { name: 'Review work', exact: true });
  await expect(review).toContainText('Whole recording');
  await review.getByRole('button', { name: 'src/checkout/guard.ts', exact: true }).click();
  const file = page.getByRole('dialog', { name: 'Work on src/checkout/guard.ts', exact: true });
  await expect(file.locator('.diff').first()).toBeVisible();
  await file.locator('.file-trail-item:has(.op-kind.k-edit) .file-inspect').first().click();
  const reader = page.getByRole('complementary', { name: 'Selected action reader' });
  await expect(reader).toBeVisible();
  await expect(reader.locator('.diff').first()).toBeVisible();
  await expect(page.locator('.cv-node.selected')).toBeAttached();
});

test('phone and short landscape layouts preserve the reader and avoid document overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url());
  await expect(page.locator('.cv-left-panel')).toBeHidden();
  await page.locator('.cv-viewport').focus(); await page.keyboard.press('f');
  const reader = page.getByRole('complementary', { name: 'Selected action reader' });
  await expect(reader).toBeVisible();
  for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(size);
    const bounds = (await reader.boundingBox())!;
    expect(bounds.y).toBeGreaterThanOrEqual(56); expect(bounds.x).toBeGreaterThanOrEqual(48);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(size.width); expect(bounds.y + bounds.height).toBeLessThanOrEqual(size.height - 70);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('pan and zoom detach following; the canvas camera remains independent of replay evidence', async ({ page }) => {
  await page.goto(url());
  const world = page.locator('.cv-world');
  const before = await world.getAttribute('style');
  await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
  await expect(world).not.toHaveAttribute('style', before!);
  await page.locator('.cv-viewport').focus(); await page.keyboard.press('0');
  await expect(world).toHaveAttribute('style', /scale\(0\.35\)/);
  const read = bundle.projection.operations.find((op: { kind: string }) => op.kind === 'read');
  const start = bundle.projection.timeline.findIndex((event: { type: string; operationId?: string }) => event.type === 'op-start' && event.operationId === read.id) + 1;
  await page.goto(url(`&at=${start}`));
  await expect(page.locator('.cv-node').first()).toContainText('Waiting for output');
  await expect(page.locator('.cv-node .code')).toHaveCount(0);
  await expect(page.locator('.cv-replay-controls')).toContainText('Exit replay');
  await page.getByRole('button', { name: 'Exit replay', exact: true }).click();
  await expect(page.locator('.cv-node').first()).not.toContainText('Waiting for output');
});

test('paged Canvas loads earlier work, preserves selected evidence and bounds its mounted nodes', async ({ page }) => {
  await page.route('**/v1/recordings', async route => { const response = await route.fetch(); const data = await response.json(); for (const r of data.recordings) if (r.id === largeId) r.observationCount = 30000; await route.fulfill({ response, json: data }); });
  await page.goto(server.launchUrl);
  await expect(page.locator('.home')).toBeVisible();
  await page.goto(new URL(`/?experience=canvas&motion=0#/r/${largeId}`, server.launchUrl).href);
  await expect(page.locator('.cv-node').first()).toBeVisible();
  expect(await page.locator('.cv-node').count()).toBeLessThanOrEqual(96);
  await page.getByRole('button', { name: 'Fit', exact: true }).click();
  await expect(page.locator('.cv-node')).not.toHaveCount(0);
  await page.locator('.cv-bottom-bar').getByRole('button', { name: 'Next failure', exact: true }).click();
  const reader = page.getByRole('complementary', { name: 'Selected action reader' });
  await expect(reader).toContainText('allows a free order');
  const selected = await page.locator('.cv-node.selected').getAttribute('data-op-id');
  await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
  await expect(page.locator('.cv-node.selected')).toHaveAttribute('data-op-id', selected!);
  expect(await page.locator('.cv-node').count()).toBeLessThanOrEqual(96);
});

test('live arrivals follow the newest recorded action, detach for reading and return explicitly', async ({ page }) => {
  const journal = join(dir, 'live-canvas.jsonl');
  copyFileSync(resolve('fixtures/synthetic/claude/checkout-fix.jsonl'), journal);
  const id = (await app.ingest.importSource('claude-code', journal)).recordingId;
  app.ingest.startLive(id);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(server.launchUrl);
  await expect(page.locator('.home')).toBeVisible();
  await page.goto(new URL(`/?experience=canvas&motion=0#/r/${id}`, server.launchUrl).href);
  await expect(page.locator('.cv-node').first()).toBeVisible();
  const append = async (from: number) => {
    const rows: object[] = [];
    for (let n = from; n < from + 4; n++) {
      const base = { cwd: '/home/dev/shop', sessionId: 'c0ffee00-0000-4000-8000-000000000001', timestamp: '2026-10-15T08:00:00.000Z' };
      rows.push({ ...base, uuid: `canvas-live-call-${n}`, type: 'assistant', message: { id: `canvas-live-msg-${n}`, role: 'assistant', content: [{ type: 'tool_use', id: `canvas-live-${n}`, name: 'Read', input: { file_path: '/home/dev/shop/src/checkout/guard.ts' } }] } });
      rows.push({ ...base, uuid: `canvas-live-result-${n}`, type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: `canvas-live-${n}`, content: `1\t// live captured line ${n}` }] } });
    }
    appendFileSync(journal, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
    await app.ingest.sync(id);
  };
  await append(0);
  const latest = page.locator('.cv-node[data-node-id$="canvas-live-3"]');
  await expect(latest).toBeVisible();
  const visible = (await page.locator('.cv-viewport').boundingBox())!;
  await expect.poll(async () => { const r = await latest.boundingBox(); return !!r && r.y >= visible.y && r.y + r.height <= visible.y + visible.height; }).toBe(true);
  await page.getByRole('button', { name: 'Live', exact: true }).click();
  const camera = await page.locator('.cv-world').evaluate(el => (el as HTMLElement).style.transform);
  await append(4);
  await expect(page.getByRole('button', { name: /new · Back to latest/ })).toBeVisible();
  await expect.poll(() => page.locator('.cv-world').evaluate(el => (el as HTMLElement).style.transform)).toBe(camera);
  await page.getByRole('button', { name: /new · Back to latest/ }).click();
  const next = page.locator('.cv-node[data-node-id$="canvas-live-7"]');
  await expect.poll(async () => { const r = await next.boundingBox(); return !!r && r.y >= visible.y && r.y + r.height <= visible.y + visible.height; }).toBe(true);
});
