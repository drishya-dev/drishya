// LAYOUT-1c: the stage cap is physical; browser zoom/OS scaling alone choose text size.
// Laptop/desktop zoom-out fills the window, while a physically ultrawide stage stays centred.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

const STAGE_MAX = 2560;
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
  if (width <= 820) return; // the Files panel is a drawer at narrow supported windows; only overflow is checked there
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

for (const width of [1440, 1920, 2149, 2560, 3840, 5120]) {
  test(`${width}px: every dock, the column, the Workspace and the peek stay inside the stage`, async ({ page }) => {
    await open(page, width);
    const edge = Math.max(0, (width - STAGE_MAX) / 2), inside = (box: { left: number; right: number } | null, name: string) => {
      expect(box, name).not.toBeNull();
      expect(box!.left, `${name} left`).toBeGreaterThanOrEqual(edge - 0.5);
      expect(box!.right, `${name} right`).toBeLessThanOrEqual(width - edge + 0.5);
    };
    for (const selector of ['.modern-identity', '.workspace-utilities', '.folder-explorer', '.history-inner', '.toolbox-rail']) inside(await span(page, selector), selector);
    // UI-42: the column spans the space between the Files panel and the Toolbox (no 1280 px cap); only prose keeps a measure.
    const column = (await span(page, '.history-inner'))!, files = (await span(page, '.folder-explorer'))!, tools = (await span(page, '.modern-toolbox'))!;
    expect(column.left, 'history column starts at the Files panel').toBeGreaterThanOrEqual(files.right - 80);
    expect(column.right, 'history column ends at the Toolbox').toBeLessThanOrEqual(tools.left + 80);
    expect(await page.evaluate(() => Math.max(0, ...[...document.querySelectorAll('.history .prose p')].map(p => p.getBoundingClientRect().width))), 'prose keeps its reading measure').toBeLessThanOrEqual(75 * 11);

    const file = page.locator('[data-spine-path]').filter({ has: page.getByText('main.ts', { exact: true }) });
    await file.click();
    await expect(page.locator('.file-peek-reader[open]')).toBeVisible();
    const peek = (await span(page, '.file-peek-reader'))!;
    inside(peek, 'file peek');
    // The peek must resolve the same calc/rem CSS limit as the docks, not parse the expression as a number.
    expect(peek.right - peek.left, 'file peek keeps its reading width').toBeGreaterThanOrEqual(360);
    expect(Math.abs(peek.right - (Math.min(width, STAGE_MAX) + edge - 48)), 'file peek docks 48 px inside the stage edge').toBeLessThan(1.5);

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

for(const ratio of [1,.8,.67,.5,.33])test(`1920 device px at ${ratio}: zoom leaves docks at the edges`,async({browser})=>{
 const context=await browser.newContext({viewport:{width:Math.round(1920/ratio),height:Math.round(1080/ratio)},deviceScaleFactor:ratio});try{const page=await context.newPage();await open(page,Math.round(1920/ratio),Math.round(1080/ratio));
 await expect(page.locator('html')).not.toHaveAttribute('data-stage-limited');expect(await page.evaluate(()=>getComputedStyle(document.documentElement).fontSize)).toBe('16px');
 expect((await span(page,'.workspace-leading'))!.left).toBeLessThan(25);expect((await page.evaluate(()=>innerWidth))-(await span(page,'.workspace-utilities'))!.right).toBeCloseTo(30,1);
 if(ratio<1)expect((await span(page,'.history-inner'))!.right-(await span(page,'.history-inner'))!.left).toBeGreaterThan(1280);
 await expect(page.locator('.history .prose').first()).toHaveCSS('font-size','15px');
 const ratioValue=await page.evaluate(()=>Number(getComputedStyle(document.documentElement).getPropertyValue('--device-ratio')));expect(ratioValue).toBeCloseTo(ratio,3);
 }finally{await context.close();}
});

// UI-37: high-density screens fill like a standard screen of the same CSS size (4K at 150 %, Retina laptops at 2x).
for(const [width,height,ratio] of [[2560,1440,1.5],[1920,1080,2],[1728,1117,2],[1512,982,2]] as const)test(`${width}x${height} CSS px at ratio ${ratio}: a high-density screen fills edge to edge`,async({browser})=>{
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:ratio});try{const page=await context.newPage();await open(page,width,height);
 await expect(page.locator('html')).not.toHaveAttribute('data-stage-limited');expect(await page.evaluate(()=>getComputedStyle(document.documentElement).fontSize)).toBe('16px');
 expect((await span(page,'.workspace-leading'))!.left).toBeLessThan(25);expect(width-(await span(page,'.workspace-utilities'))!.right).toBeCloseTo(30,1);
 await expect(page.locator('.history .prose').first()).toHaveCSS('font-size','15px');
 }finally{await context.close();}
});
test('a 3840 CSS px window at ratio 1.5 (a 5760 device px screen) still centres a 2560 CSS px stage',async({browser})=>{
 const context=await browser.newContext({viewport:{width:3840,height:1440},deviceScaleFactor:1.5});try{const page=await context.newPage();await open(page,3840,1440);
 await expect(page.locator('html')).toHaveAttribute('data-stage-limited','');
 expect((await span(page,'.workspace-leading'))!.left).toBeCloseTo((3840-2560)/2+18,0);
 }finally{await context.close();}
});

test('ratio-only changes update the physical cap and retain one stable final dock position',async({browser})=>{
 const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1});try{const page=await context.newPage();await open(page,1920,1080);const cdp=await context.newCDPSession(page);
 for(const ratio of [.8,.67,.5,.33,1]){await cdp.send('Emulation.setDeviceMetricsOverride',{width:Math.round(1920/ratio),height:Math.round(1080/ratio),deviceScaleFactor:ratio,mobile:false});await expect.poll(()=>page.evaluate(()=>Number(document.documentElement.style.getPropertyValue('--device-ratio')))).toBeCloseTo(ratio,3);await expect(page.locator('html')).not.toHaveAttribute('data-stage-limited');const left=(await span(page,'.workspace-leading'))!.left;await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));expect((await span(page,'.workspace-leading'))!.left).toBeCloseTo(left,1);expect(left).toBeLessThan(25);}
 }finally{await context.close();}
});
