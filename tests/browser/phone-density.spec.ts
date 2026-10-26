import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { spawn } from 'node:child_process';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';
import { HarnessController } from '../../apps/daemon/src/controller.ts';
import { HIT_FLOOR, PHONE_SIZES, phoneMetrics, surfaceOverlaps } from './phone-metrics.ts';

// UI-6: phone density and occlusion. At 320, 360, 390 and 430 px wide and 844x390 landscape, the surfaces that sit on the
// session (Files overlay, toolbox, map controls, import drawer, composer) never lie on top of each other, keep every control at
// 32 px, and the returning-user Home keeps its rows whole and its list reachable. Header surfaces are UI-1's.
let dir: string, id: string, app: App, server: RunningServer;
// A fresh app per test: workspace grants and layout state persist on the server.
test.beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-phone-density-'));
  const root = join(dir, 'repo'); mkdirSync(join(root, 'src'), { recursive: true });
  writeFileSync(join(root, 'src', 'actual.ts'), 'export const value = 42;\n');
  const journal = join(dir, 'session.jsonl'), session = '55555555-5555-4555-8555-555555555555';
  const lines: unknown[] = [{ type: 'user', uuid: 'u1', sessionId: session, cwd: root, timestamp: '2026-10-07T12:00:00Z', message: { role: 'user', content: 'Phone density session' } }];
  for (let i = 0; i < 6; i++) lines.push({ type: 'assistant', uuid: `a${i}`, sessionId: session, cwd: root, timestamp: `2026-10-07T12:00:0${i + 1}Z`, message: { role: 'assistant', content: [{ type: 'text', text: `Paragraph ${i}. ${'The checkout guard treats a zero total as missing. '.repeat(4)}` }] } });
  writeFileSync(journal, lines.map(line => JSON.stringify(line)).join('\n') + '\n');
  // A synthetic native harness that only advertises one model, enough to open the composer's menus.
  const transport = join(dir, 'synthetic-harness.mjs');
  writeFileSync(transport, `import {createInterface} from 'node:readline';
const send=v=>process.stdout.write(JSON.stringify(v)+'\\n');
createInterface({input:process.stdin}).on('line',line=>{const v=JSON.parse(line);
 if(v.type==='control_request') send({type:'control_response',response:{subtype:'success',request_id:v.request_id,response:{models:[{value:'synthetic-model',displayName:'Synthetic model',supportedEffortLevels:['low','high']}],commands:[]}}});});`);
  app = new App(join(dir, 'store')); id = (await app.ingest.importSource('claude-code', journal)).recordingId;
  server = await startServer({ app, port: 0, token: 'synthetic-phone-density', controllerFactory: (a, w) => new HarnessController(a, w, { resolveExecutable: () => process.execPath, launch: ((_bin: string, _args: string[], opts: any) => spawn(process.execPath, [transport], opts)) as typeof spawn }) });
});
test.afterEach(async () => { await server?.close(); await app?.close(); if (dir) { if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); } });
test.use({ actionTimeout: 5000 });

// Controls on the surfaces this task owns. History cards, the prompt rail and the header are not in the list: cards are the
// evidence itself, the rail is a row of position marks, and the header belongs to UI-1.
const CONTROLS = [
  '.composer-minimize', '.modern-attachment', '.native-options > summary', '.send-prompt', '.stop-turn', '.composer-actions button',
  '.folder-explorer button', '.folder-explorer summary', '.folder-explorer input',
  '.catalog-toggle', '.workbench-station button', '.toolbox-collapse',
  '.map-tools button', '.map-tools input', '.map-zoom button', '.map-connections button', '.map-connections summary',
  '.mh-home .icon-btn', '.mh-home .mh-row-end button',
].join(', ');

async function settle(page: Page) {
  await page.evaluate(() => Promise.race([Promise.all(document.getAnimations().filter(a => a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => undefined))), new Promise(done => setTimeout(done, 1200))]));
}
async function assertClean(page: Page, state: string, options: { cut?: boolean } = {}) {
  await settle(page);
  const metrics = await phoneMetrics(page);
  expect.soft(metrics.overflow, `${state}: horizontal overflow`).toBeLessThanOrEqual(0);
  // Layout follows the composer's measured height a frame or two after it changes: judge the steady state.
  await expect.soft.poll(() => surfaceOverlaps(page), { message: `${state}: floating surfaces on top of each other`, timeout: 2500 }).toEqual([]);
  // Desktop-layout rows (wider than a phone) keep their pixels; only the phone row layout is held to this.
  if (options.cut !== false) expect.soft(metrics.cut, `${state}: parts cut by their container`).toEqual([]);
  const small = await page.evaluate(({ selector, floor }) => [...document.querySelectorAll<HTMLElement>(selector)].filter(el => el.getClientRects().length && el.checkVisibility() && !(el as HTMLButtonElement).disabled && !el.closest('[aria-hidden=true]')).map(el => { const host = el.closest('label') ?? el, b = host.getBoundingClientRect(); return { name: `${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 2).join('.')}`, w: Math.round(b.width), h: Math.round(b.height) }; }).filter(c => Math.min(c.w, c.h) < floor - 0.5).map(c => `${c.name} ${c.w}x${c.h}`), { selector: CONTROLS, floor: HIT_FLOOR });
  expect.soft(small, `${state}: controls under ${HIT_FLOOR}px`).toEqual([]);
}

async function demo(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.goto(`${server.url}/?demo&experience=modern&motion=0#token=${server.token}`);
  await expect(page.locator('.viewer')).toBeVisible();
}
async function press(locator: Locator) { await locator.focus(); await locator.press('Enter'); }

for (const [width, height] of PHONE_SIZES) {
  const at = `${width}x${height}`;
  test(`the demo session keeps its Files overlay, toolbox and map controls apart at ${at}`, async ({ page }) => {
    await demo(page, width, height);
    await assertClean(page, `${at} session`);
    // Files: portrait phones show the overlay on request; landscape shows it already.
    const show = page.getByRole('button', { name: 'Show files', exact: true });
    if (await show.count()) await press(show);
    if (width <= 650) await expect(page.locator('.folder-explorer')).toBeVisible();
    await assertClean(page, `${at} Files overlay`);
    const hide = page.getByRole('button', { name: 'Hide files', exact: true });
    if (await hide.count()) await press(hide);
    // Toolbox: a sheet behind the Tools button on portrait phones, a panel in landscape.
    const tools = page.getByRole('button', { name: 'Tools', exact: true });
    if (await tools.count()) await press(tools);
    await expect(page.locator('.workbench-station')).toBeVisible();
    await assertClean(page, `${at} toolbox`);
    if (await page.getByRole('button', { name: 'Close tools', exact: true }).count()) await press(page.getByRole('button', { name: 'Close tools', exact: true }));
    // Repository map, then its import drawer on a chosen file.
    await press(page.getByRole('button', { name: 'Explore repository map' }));
    await expect(page.locator('.map-tools')).toBeVisible();
    await assertClean(page, `${at} map`);
    await page.getByRole('textbox', { name: 'Find a file on the map' }).fill('src/checkout/guard.ts');
    const match = page.locator('.map-matches').getByRole('button', { name: 'src/checkout/guard.ts', exact: true });
    await press(match);
    await press(page.getByRole('switch', { name: 'Import paths' }));
    const drawer = page.getByRole('region', { name: 'Direct import connections' });
    await expect(drawer.locator('.map-connection-root')).toHaveText('src/checkout/guard.ts');
    await assertClean(page, `${at} import drawer`);
    // The drawer must stay usable: at least 150 px of it show (or all of it, when it is shorter), the rest scrolls inside it.
    const room = await drawer.evaluate(el => ({ visible: Math.round(el.clientHeight), content: Math.round(el.scrollHeight) }));
    expect(room.visible, `${at}: drawer height ${room.visible}px of ${room.content}px`).toBeGreaterThanOrEqual(Math.min(room.content, 150));
    // Its last control is reachable by scrolling the drawer, not hidden behind another surface.
    const open = drawer.getByRole('button', { name: 'Open recorded work', exact: true });
    await open.scrollIntoViewIfNeeded();
    const hit = await open.evaluate(el => { const b = el.getBoundingClientRect(), top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return top === el || el.contains(top); });
    expect(hit, `${at}: Open recorded work is covered`).toBe(true);
  });
}

async function composerSession(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
  const composer = page.getByRole('region', { name: 'Harness prompt' }); await expect(composer).toBeVisible();
  return composer;
}
for (const [width, height] of PHONE_SIZES) {
  const at = `${width}x${height}`;
  test(`the composer owns the bottom edge with Follow, Tools, Files and the map at ${at}`, async ({ page }) => {
    const composer = await composerSession(page, width, height);
    await assertClean(page, `${at} composer pill`);
    await composer.getByRole('button', { name: 'Expand prompt', exact: true }).click();
    await expect(composer.getByRole('button', { name: 'Minimize prompt', exact: true })).toBeVisible();
    await composer.getByRole('textbox', { name: 'Prompt for selected harness session' }).fill('line one\nline two\nline three\nline four');
    await assertClean(page, `${at} composer drafting`);
    const show = page.getByRole('button', { name: 'Show files', exact: true });
    if (await show.count()) await press(show);
    await assertClean(page, `${at} composer with Files`);
    // The Files overlay stays above the composer however long its tree is.
    const gap = await page.evaluate(() => { const files = document.querySelector('.folder-explorer')?.getBoundingClientRect(), composerBox = document.querySelector('.prompt-composer')?.getBoundingClientRect(); return files && composerBox ? Math.round(composerBox.top - files.bottom) : 999; });
    expect(gap, `${at}: Files overlay bottom to composer top`).toBeGreaterThanOrEqual(0);
    const hide = page.getByRole('button', { name: 'Hide files', exact: true });
    if (await hide.count()) await press(hide);
    // The native menu opens inside the viewport.
    await press(composer.locator('.native-options > summary'));
    const menu = composer.locator('.native-options-menu'); await expect(menu).toBeVisible();
    const box = (await menu.boundingBox())!;
    expect(box.x, `${at}: menu left`).toBeGreaterThanOrEqual(0); expect(box.x + box.width, `${at}: menu right`).toBeLessThanOrEqual(width + 0.5);
    expect(box.y, `${at}: menu top`).toBeGreaterThanOrEqual(0); expect(box.y + box.height, `${at}: menu bottom`).toBeLessThanOrEqual(height + 0.5);
    await assertClean(page, `${at} composer menu`);
  });
}

const states = ['following', 'idle', 'importing', 'missing-source', 'unsupported', 'failed', 'stopped'] as const;
async function mockHome(page: Page, count: number) {
  const today = new Date().toISOString(), old = new Date(Date.now() - 9 * 864e5).toISOString();
  const recordings = Array.from({ length: count }, (_, i) => ({ id: `r-${i}`, title: `Session ${i}: long project name ${'review '.repeat(i % 5 * 6)}`, harness: i % 2 ? 'codex' : 'claude-code', workspaceRoot: i % 3 ? 'C:/projects/workspace-with-a-very-long-name' : 'C:/projects/研究-project', createdAt: today, updatedAt: today, lastSourceTime: i % 4 ? today : old, observationCount: 2490, live: i < 3, pinned: i === 5, sourceBytes: 100, privacyOutdated: i === 3, health: i < 20 ? { state: states[i % states.length], live: i < 3, backlog: i % 5 === 0, sources: [] } : undefined }));
  const sources = [{ adapterId: 'a', harness: 'codex', path: 'C:/x/new.jsonl', bytes: 5, modifiedAt: today, cwd: 'C:/projects/discovered', title: 'Discovered, not imported yet', companions: [] }];
  await page.route('**/v1/recordings', route => route.fulfill({ json: { recordings } }));
  await page.route('**/v1/sources', route => route.fulfill({ json: { sources, errors: [] } }));
}
for (const [width, height] of PHONE_SIZES) {
  const at = `${width}x${height}`;
  test(`Home with 120 sessions keeps rows whole and the list reachable at ${at}`, async ({ page }) => {
    await mockHome(page, 120);
    await page.setViewportSize({ width, height });
    await page.goto(`${server.url}/?experience=modern&motion=0#token=${server.token}`);
    await expect(page.locator('.mh-session').first()).toBeVisible();
    await assertClean(page, `${at} Home`, { cut: width <= 650 });
    // The list is the point of Home: after scrolling to it, a portrait phone shows at least three whole rows and a short landscape window two.
    await page.locator('.mh-home').evaluate(el => el.scrollTo(0, el.scrollHeight));
    const whole = await page.evaluate(() => { const list = document.querySelector('.mh-session-list')!.getBoundingClientRect(); return [...document.querySelectorAll('.mh-session')].filter(row => { const b = row.getBoundingClientRect(); return b.top >= list.top - 1 && b.bottom <= list.bottom + 1 && b.bottom <= innerHeight && b.top >= 0; }).length; });
    expect(whole, `${at}: whole session rows on screen`).toBeGreaterThanOrEqual(width > height ? 2 : 3);
  });
}
