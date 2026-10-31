import { openGitDestination } from './git-navigation.ts';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';
import { HarnessController } from '../../apps/daemon/src/controller.ts';

// UI-7: no visible text on the demo session (cards expanded: code, diff, test, search, shell) falls below 4.5:1 on any of the seven palettes.
let dir: string, app: App, server: RunningServer;
test.beforeAll(async () => { dir = mkdtempSync(join(tmpdir(), 'drishya-palette-contrast-')); app = new App(dir); server = await startServer({ app, port: 0, token: 'synthetic-palette-contrast' }); });
test.afterAll(async () => { await server?.close(); await app?.close(); if (dir && resolve(dir).startsWith(resolve(tmpdir()) + sep)) rmSync(dir, { recursive: true, force: true }); });

// `scope` limits the walk to text inside one surface; `floor` is the ratio below which a line is reported (raise it to print the lowest ratios).
async function measure(page: Page, scope = 'body', floor = 4.5) {
  return page.evaluate(({ scope, floor }) => {
    // One canvas and a cache per colour string: the walk asks for every ancestor of every text, and a canvas per call times out on a large page.
    const canvas = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!, cache = new Map<string, number[]>();
    const rgba = (value: string) => { let c = cache.get(value); if (!c) { canvas.clearRect(0, 0, 1, 1); canvas.fillStyle = value; canvas.fillRect(0, 0, 1, 1); c = [...canvas.getImageData(0, 0, 1, 1).data].map((v, i) => i === 3 ? v / 255 : v); cache.set(value, c); } return c; };
    const over = (f: number[], b: number[]) => f.slice(0, 3).map((v, i) => v * f[3]! + b[i]! * (1 - f[3]!)).concat(1);
    const luma = (rgb: number[]) => rgb.slice(0, 3).map(v => { const c = v / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i]!, 0);
    const out = new Map<string, { ratio: number; n: number; sample: string; size: number }>();
    for (const el of document.querySelectorAll<HTMLElement>('body *')) {
      if (!el.closest(scope) || !el.getClientRects().length || !el.checkVisibility() || el.closest('[aria-hidden=true]') || el.matches('svg *,option,:disabled')) continue;
      if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent?.trim())) continue;
      const style = getComputedStyle(el); if (parseFloat(style.opacity) < .05) continue;
      const parents: Element[] = []; for (let p: Element | null = el; p; p = p.parentElement) parents.unshift(p);
      let bg = [255, 255, 255, 1]; for (const p of parents) bg = over(rgba(getComputedStyle(p).backgroundColor), bg);
      const fg = over(rgba(style.color), bg), a = luma(fg), b = luma(bg), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      const key = `${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 2).join('.')}`;
      const prev = out.get(key);
      if (!prev || ratio < prev.ratio) out.set(key, { ratio, n: (prev?.n ?? 0) + 1, sample: (el.textContent ?? '').trim().slice(0, 24), size: parseFloat(style.fontSize) }); else prev.n++;
    }
    return [...out].filter(([, v]) => v.ratio < floor).sort((x, y) => x[1].ratio - y[1].ratio).slice(0, 8).map(([k, v]) => `${v.ratio.toFixed(2)} ${v.size}px ${k} ×${v.n} "${v.sample}"`);
  }, { scope, floor });
}

test('visible text keeps 4.5:1 on every palette on the expanded demo session', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${server.url}/?demo&experience=modern&motion=0#token=${server.token}`);
  await expect(page.locator('.viewer')).toBeVisible();
  for (const card of await page.locator('article.op').all().then(a => a.slice(0, 6))) { await card.focus().catch(() => undefined); await page.keyboard.press('Enter').catch(() => undefined); }
  // Expanded cards show captured source: line numbers prove the guard is looking at real material.
  await expect(page.locator('.ln-no').first()).toBeVisible();
  for (const palette of ['jet', 'paper', 'midnight', 'mocha', 'tokyo', 'nord', 'gruvbox']) {
    await page.evaluate(v => { document.documentElement.dataset.palette = v; }, palette);
    await page.evaluate(() => Promise.race([Promise.all(document.getAnimations().filter(a => a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => undefined))), new Promise(d => setTimeout(d, 1500))]));
    expect(await measure(page), palette).toEqual([]);
  }
});

// UI-7 slice 2: the overlays people open on top of the session, on the same seven palettes.
test('overlays keep 4.5:1 on every palette', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${server.url}/?demo&experience=modern&motion=0#token=${server.token}`);
  await expect(page.locator('.viewer')).toBeVisible();
  const palettes = ['jet', 'paper', 'midnight', 'mocha', 'tokyo', 'nord', 'gruvbox'];
  const settle = () => page.evaluate(() => Promise.race([Promise.all(document.getAnimations().filter(a => a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => undefined))), new Promise(d => setTimeout(d, 1500))]));
  const overlays: [string, () => Promise<void>, () => Promise<void>][] = [
    ['Settings', async () => { await page.getByRole('button', { name: 'Workspace settings', exact: true }).click(); await expect(page.getByRole('dialog', { name: 'Workspace settings' })).toBeVisible(); }, () => page.keyboard.press('Escape')],
    ['Navigator', async () => { await page.keyboard.press('Control+k'); await expect(page.getByRole('dialog', { name: 'Navigate workspace' })).toBeVisible(); }, () => page.keyboard.press('Escape')],
    ['Search', async () => { await page.getByRole('button', { name: 'Search', exact: true }).click(); await expect(page.getByRole('dialog', { name: 'Search this recording' })).toBeVisible(); }, () => page.keyboard.press('Escape')],
    ['Shortcuts', async () => { await page.locator('.history').focus(); await page.keyboard.press('?'); await expect(page.getByRole('dialog', { name: 'Reading shortcuts', exact: true })).toBeVisible(); }, () => page.keyboard.press('Escape')],
  ];
  const found: string[] = [];
  for (const [name, show, hide] of overlays) {
    await show();
    for (const palette of palettes) {
      await page.evaluate(v => { document.documentElement.dataset.palette = v; }, palette); await settle();
      for (const line of await measure(page)) found.push(`${name} / ${palette}: ${line}`);
    }
    await hide(); await settle();
  }
  expect(found).toEqual([]);
});

// UI-7 slice 3: the composer and its menus, the toolbox menus, the Workspace editor, the Git review dialog and the header over the map.
const ALL_PALETTES = ['jet', 'paper', 'midnight', 'mocha', 'tokyo', 'nord', 'gruvbox'];
// Colour transitions must settle before measuring, but a spinner never finishes: wait only for finite running animations, bounded.
const settled = (page: Page) => page.evaluate(() => Promise.race([Promise.all(document.getAnimations().filter(a => a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => undefined))), new Promise(d => setTimeout(d, 1500))]));
// With DRISHYA_CONTRAST_REPORT set the lowest ratios per state are printed instead of asserted, so a change can be measured before it is judged.
const REPORT = !!process.env.DRISHYA_CONTRAST_REPORT;
async function everyPalette(page: Page, state: string, found: string[], scope = 'body') {
  for (const palette of ALL_PALETTES) {
    await page.evaluate(v => { document.documentElement.dataset.palette = v; }, palette); await settled(page);
    const lines = await measure(page, scope, REPORT ? 99 : 4.5);
    if (REPORT) console.log(`CONTRAST ${state} / ${palette}: ${lines.slice(0, 2).join(' | ') || 'nothing measured'}`);
    else for (const line of lines) found.push(`${state} / ${palette}: ${line}`);
  }
}
// Keyboard, not a resting pointer: hover reading can move the cards under it.
async function press(page: Page, target: Locator) { await target.focus(); await page.keyboard.press('Enter'); }

// A workspace the native harness stub and the Git review can read: a repository with one committed file that has an unstaged change.
let fresh: { dir: string; root: string; id: string; app: App; server: RunningServer } | undefined;
test.afterEach(async () => {
  if (!fresh) return; const { dir, app, server } = fresh; fresh = undefined;
  await server.close(); await app.close(); if (resolve(dir).startsWith(resolve(tmpdir()) + sep)) rmSync(dir, { recursive: true, force: true });
});
async function freshWorkspace() {
  // A fresh app and server per test: workspace grants and the native run persist on the server and would change what the next test opens.
  const dir = mkdtempSync(join(tmpdir(), 'drishya-palette-menus-')), root = join(dir, 'session-repository'); mkdirSync(join(root, 'src'), { recursive: true });
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, windowsHide: true });
  git('init'); git('config', 'user.name', 'Synthetic'); git('config', 'user.email', 'synthetic@example.invalid');
  writeFileSync(join(root, 'src', 'actual.ts'), 'export const value = 42;\nexport const label = "contrast";\n'); git('add', '.'); git('commit', '-m', 'fixture');
  writeFileSync(join(root, 'src', 'actual.ts'), 'export const value = 43;\nexport const label = "contrast";\n');
  const journal = join(dir, 'session.jsonl');
  writeFileSync(journal, JSON.stringify({ type: 'user', uuid: 'u1', sessionId: '77777777-7777-4777-8777-777777777777', cwd: root, timestamp: '2026-10-26T12:00:00Z', message: { role: 'user', content: 'Palette contrast session' } }) + '\n');
  // A synthetic native harness: advertises one model with efforts and asks for one Edit approval.
  const transport = join(dir, 'synthetic-harness.mjs');
  writeFileSync(transport, `import {createInterface} from 'node:readline';
const send=v=>process.stdout.write(JSON.stringify(v)+'\\n');
createInterface({input:process.stdin}).on('line',line=>{
  const v=JSON.parse(line);
  if(v.type==='control_request') send({type:'control_response',response:{subtype:'success',request_id:v.request_id,response:{models:[{value:'synthetic-model',displayName:'Synthetic model',supportedEffortLevels:['low','high']}],commands:[]}}});
  if(v.type==='user') { send({type:'system',subtype:'init',tools:['Read','Edit']}); send({type:'control_request',request_id:'one',request:{subtype:'can_use_tool',tool_name:'Edit',input:{file_path:'src/actual.ts',new_string:'export const value = 44;'}}}); }
  if(v.type==='control_response') send({type:'result',is_error:false,result:'done'});
});`);
  const app = new App(join(dir, 'store')), id = (await app.ingest.importSource('claude-code', journal)).recordingId;
  const server = await startServer({ app, port: 0, token: 'synthetic-palette-menus', controllerFactory: (a, w) => new HarnessController(a, w, { resolveExecutable: () => process.execPath, launch: ((_bin: string, _args: string[], opts: any) => spawn(process.execPath, [transport], opts)) as typeof spawn }) });
  return fresh = { dir, root, id, app, server };
}
async function openSession(page: Page, w: Awaited<ReturnType<typeof freshWorkspace>>) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(w.server.launchUrl); await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${w.server.url}/?experience=modern&motion=0#/r/${w.id}`);
}

test('the composer and its menus keep 4.5:1 on every palette', async ({ page }) => {
  await openSession(page, await freshWorkspace());
  const composer = page.getByRole('region', { name: 'Harness prompt' }); await expect(composer).toBeVisible();
  const found: string[] = [], at = (state: string) => everyPalette(page, state, found, '[aria-label="Harness prompt"]');
  await at('composer pill');
  const pill = composer.getByRole('button', { name: 'Expand prompt', exact: true }); if (await pill.count()) await pill.click();
  await expect(composer.getByRole('button', { name: 'Minimize prompt', exact: true })).toBeVisible();
  await at('composer expanded');
  const input = composer.getByRole('textbox', { name: 'Prompt for selected harness session' }); await input.fill('A draft with text');
  await at('composer draft');
  const menu = composer.locator('.native-options > summary'); await press(page, menu);
  await expect(composer.getByRole('button', { name: 'Enable this workspace', exact: true })).toBeVisible();
  await at('connection menu (workspace not enabled)');
  await composer.getByRole('button', { name: 'Enable this workspace', exact: true }).click();
  await expect(composer.getByRole('button', { name: 'Read native settings', exact: true })).toBeEnabled();
  await composer.getByRole('button', { name: 'Read native settings', exact: true }).click();
  await expect(composer.getByRole('combobox', { name: 'Model', exact: true })).toBeEnabled();
  await at('connection menu (native settings read)');
  await press(page, menu);
  await composer.getByRole('combobox', { name: 'Native model' }).selectOption('synthetic-model');
  await expect(composer.getByRole('combobox', { name: 'Reasoning effort' })).toBeVisible();
  await at('model and effort selects');
  await input.fill('Edit the file'); await input.press('Enter');
  await composer.getByRole('checkbox', { name: 'This session is idle in other clients' }).check();
  await at('send confirmation');
  await composer.getByRole('button', { name: 'Confirm and send', exact: true }).click();
  await expect(composer.locator('.tool-approval')).toBeVisible();
  await at('running with an approval request');
  expect(found).toEqual([]);
});

test('the toolbox and its menus keep 4.5:1 on every palette', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${server.url}/?demo&experience=modern&motion=0#token=${server.token}`);
  const toolbox = page.getByRole('complementary', { name: 'Tools and agents' }); await expect(toolbox.getByText('Toolbox', { exact: true })).toBeVisible();
  const found: string[] = [], at = (state: string) => everyPalette(page, state, found, '.modern-tool-station, [aria-label="Tools and agents"]');
  await at('toolbox at rest');
  const read = toolbox.locator('.instrument.k-read'); await press(page, read);
  await expect(read).toHaveAttribute('aria-pressed', 'true');
  await at('toolbox with an instrument focused');
  await press(page, toolbox.getByRole('button', { name: 'Clear focus ×', exact: true }));
  const mcpServer = toolbox.locator('.md-server').filter({ has: page.locator('[data-mcp-server]') }).first(); await expect(mcpServer).toBeVisible();
  await press(page, mcpServer.locator('summary'));
  const tool = mcpServer.locator('button[data-mcp-tool]').first(); await expect(tool).toBeVisible();
  await at('MCP server drawer open');
  await press(page, tool); await expect(tool).toHaveAttribute('aria-pressed', 'true');
  await at('MCP tool focused');
  await press(page, toolbox.getByRole('button', { name: 'Clear focus ×', exact: true }));
  await press(page, toolbox.locator('.md-agents>summary'));
  await at('agents disclosure open');
  expect(found).toEqual([]);
});

test('the Workspace editor and the Git review dialog keep 4.5:1 on every palette', async ({ page }) => {
  await openSession(page, await freshWorkspace());
  await page.route('**/v1/working-locations', route => route.request().method() === 'GET' ? route.fulfill({ json: { version: 1, sessions: [] } }) : route.continue());
  const found: string[] = [];
  // Workspace: open a file, start a local draft, type in it, then the draft comparison and the file-actions menu.
  await page.getByRole('button', { name: 'Open developer workspace', exact: true }).click();
  const desk = page.getByRole('region', { name: 'Developer workspace', exact: true }), approve = desk.getByRole('button', { name: 'Approve workspace reading', exact: true });
  await expect(approve.or(desk.getByRole('tablist'))).toBeVisible(); if (await approve.isVisible()) await approve.click();
  await page.getByRole('textbox', { name: 'Find repository files', exact: true }).fill('actual.ts'); await page.locator('[data-spine-path="src/actual.ts"]').click();
  const pane = desk.locator('.desk-pane').first(), at = (state: string) => everyPalette(page, state, found, '[aria-label="Developer workspace"]');
  await expect(pane.getByRole('button', { name: 'Edit file', exact: true })).toBeVisible();
  await at('Workspace file (read)');
  await pane.getByRole('button', { name: 'Edit file', exact: true }).click();
  const editor = pane.getByRole('textbox', { name: 'Local draft for src/actual.ts', exact: true }); await expect(editor).toContainText('contrast');
  await editor.focus(); await editor.press('Control+End'); await page.keyboard.insertText('\nexport const drafted = true; // a local draft');
  await at('Workspace draft editor');
  await pane.getByRole('button', { name: 'Compare draft', exact: true }).click();
  await at('Workspace draft comparison');
  await pane.getByRole('button', { name: 'Edit draft', exact: true }).click();
  await press(page, pane.getByLabel('File actions for src/actual.ts', { exact: true })); await expect(pane.locator('details.desk-options[open]')).toHaveCount(1);
  await at('Workspace file-actions menu');
  await page.keyboard.press('Escape');
  await press(page, desk.getByLabel('Workspace layout actions', { exact: true })); await expect(desk.locator('details.desk-options[open]')).toHaveCount(1);
  await at('Workspace layout menu');
  await page.keyboard.press('Escape');
  // The review dialog belongs to the session view; the desk covers its button.
  await page.reload(); await expect(page.getByRole('region', { name: 'Harness prompt' })).toBeVisible();
  // Git review: grants, then the working-tree patch, side by side, the raw patch and the file list.
  await openGitDestination(page, 'Git review');
  const reader = page.getByRole('dialog', { name: 'Git review', exact: true }), git = (state: string) => everyPalette(page, state, found, '[data-contrast-scope=git]');
  await reader.evaluate(el => el.setAttribute('data-contrast-scope', 'git'));
  const workspace = reader.getByRole('button', { name: 'Approve current workspace', exact: true }), gitConsent = reader.getByRole('button', { name: 'Approve read-only Git', exact: true }), refresh = reader.getByRole('button', { name: 'Refresh changes', exact: true });
  await expect(workspace.or(gitConsent).or(refresh)).toBeVisible();
  await git('Git review before consent');
  if (await workspace.isVisible()) await workspace.click();
  await expect(gitConsent.or(refresh)).toBeVisible(); if (await gitConsent.isVisible()) await gitConsent.click();
  await expect(reader.getByRole('complementary', { name: 'Git changed files', exact: true })).toBeVisible();
  await expect(reader.locator('.unified-change').first()).toBeVisible();
  await git('Git review patch (unified)');
  await reader.getByRole('button', { name: 'Side by side', exact: true }).click();
  await expect(reader.getByRole('region', { name: 'Current Git patch side by side' })).toBeVisible();
  await git('Git review patch (side by side)');
  await reader.getByRole('button', { name: 'Raw patch', exact: true }).click();
  await expect(reader.locator('.code .ln').first()).toBeVisible();
  await git('Git review raw patch');
  expect(found).toEqual([]);
});

// The header's islands are translucent (a colour mix of the surface over whatever the map or a passing card puts behind them), so the ratio
// against the page background alone is optimistic. Measure what is actually painted: hide the header's text, screenshot it, and take the worst
// pixel behind each text box, the way the real glyphs sit over it.
async function headerOverPixels(page: Page) {
  const boxes = await page.evaluate(() => {
    const header = document.querySelector('.workspace-header'); if (!header) return [];
    const list: { key: string; sample: string; size: number; color: string; x: number; y: number; w: number; h: number }[] = [];
    for (const el of header.querySelectorAll<HTMLElement>('*')) {
      if (!el.getClientRects().length || !el.checkVisibility() || el.closest('[aria-hidden=true]') || el.matches('svg *,:disabled')) continue;
      if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent?.trim())) continue;
      const cs = getComputedStyle(el); if (parseFloat(cs.opacity) < .05) continue;
      const range = document.createRange(); range.selectNodeContents(el);
      for (const r of range.getClientRects()) { if (r.width < 2 || r.height < 2) continue; list.push({ key: `${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 2).join('.')}`, sample: (el.textContent ?? '').trim().slice(0, 24), size: parseFloat(cs.fontSize), color: cs.color, x: Math.max(0, Math.floor(r.x)), y: Math.max(0, Math.floor(r.y)), w: Math.ceil(r.width), h: Math.ceil(r.height) }); }
    }
    return list;
  });
  if (!boxes.length) return [];
  const hide = await page.addStyleTag({ content: '.workspace-header, .workspace-header * { color: transparent !important; text-shadow: none !important; -webkit-text-fill-color: transparent !important; }' });
  const shot = (await page.screenshot()).toString('base64'); await hide.evaluate(el => el.remove());
  return page.evaluate(async ({ shot, boxes }) => {
    const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(shot), c => c.charCodeAt(0))], { type: 'image/png' }));
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!; ctx.drawImage(bitmap, 0, 0);
    const scale = bitmap.width / innerWidth;
    const rgba = (value: string) => { const c = document.createElement('canvas').getContext('2d')!; c.clearRect(0, 0, 1, 1); c.fillStyle = value; c.fillRect(0, 0, 1, 1); return [...c.getImageData(0, 0, 1, 1).data].map((v, i) => i === 3 ? v / 255 : v); };
    const luma = (rgb: number[]) => rgb.slice(0, 3).map(v => { const c = v / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i]!, 0);
    const out = new Map<string, { ratio: number; n: number; sample: string; size: number }>();
    for (const b of boxes) {
      const x = Math.floor(b.x * scale), y = Math.floor(b.y * scale), w = Math.max(1, Math.min(Math.ceil(b.w * scale), canvas.width - x)), h = Math.max(1, Math.min(Math.ceil(b.h * scale), canvas.height - y));
      if (w < 1 || h < 1 || x >= canvas.width || y >= canvas.height) continue;
      const data = ctx.getImageData(x, y, w, h).data, fg = rgba(b.color); let worst = Infinity;
      for (let i = 0; i < data.length; i += 4) {
        const px = [data[i]!, data[i + 1]!, data[i + 2]!], text = px.map((v, k) => fg[k]! * fg[3]! + v * (1 - fg[3]!));
        const a = luma(text), l = luma(px), ratio = (Math.max(a, l) + .05) / (Math.min(a, l) + .05); if (ratio < worst) worst = ratio;
      }
      const prev = out.get(b.key);
      if (!prev || worst < prev.ratio) out.set(b.key, { ratio: worst, n: (prev?.n ?? 0) + 1, sample: b.sample, size: b.size }); else prev.n++;
    }
    return [...out].sort((p, q) => p[1].ratio - q[1].ratio).map(([k, v]) => `${v.ratio.toFixed(2)} ${v.size}px ${k} ×${v.n} "${v.sample}"`);
  }, { shot, boxes });
}

test('the header keeps 4.5:1 over the map and over passing cards on every palette', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${server.url}/?demo&experience=modern&motion=0#token=${server.token}`);
  await expect(page.locator('.viewer')).toBeVisible(); await expect(page.locator('.workspace-header')).toBeVisible();
  const found: string[] = [];
  const sweep = async (scene: string) => {
    for (const palette of ALL_PALETTES) {
      await page.evaluate(v => { document.documentElement.dataset.palette = v; }, palette); await settled(page);
      const lines = await headerOverPixels(page);
      if (REPORT) console.log(`CONTRAST header ${scene} / ${palette}: ${lines.slice(0, 3).join(' | ') || 'nothing measured'}`);
      else if (!lines.length) found.push(`${scene} / ${palette}: nothing measured`);
      else for (const line of lines.filter(l => parseFloat(l) < 4.5)) found.push(`header ${scene} / ${palette}: ${line}`);
    }
  };
  await sweep('over the map');
  // Expanded cards carry the brightest and densest material the header can have passing beneath it.
  for (const card of await page.locator('article.op').all().then(a => a.slice(0, 6))) { await card.focus().catch(() => undefined); await page.keyboard.press('Enter').catch(() => undefined); }
  await expect(page.locator('.ln-no').first()).toBeVisible();
  await page.locator('.history').evaluate(el => { el.scrollTop = 500; }); await settled(page);
  await sweep('over passing cards');
  expect(found).toEqual([]);
});
