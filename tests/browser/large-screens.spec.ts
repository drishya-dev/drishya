// LAYOUT-1b: one root scale grows design lengths in both dimensions. The map
// stays in viewport/device pixels, and the 600–1440 reference stays unchanged.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string, app: App, server: RunningServer, recording: string;

test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-large-screens-'));
  app = new App(join(dir, 'store'));
  const root = join(dir, 'repo');
  mkdirSync(root);
  writeFileSync(join(root, 'main.ts'), 'export const stage = 1;\n');
  for(let i=0;i<40;i++)writeFileSync(join(root,`z-${i}.ts`),'export {};\n');
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
  await page.route('**/controller',route=>route.fulfill({json:{harness:'claude-code',available:false,state:'idle',output:'',tools:[],approvals:[]}}));
  let first = true;
  await page.route('**/v1/working-locations', async (route) => {
    if (first && route.request().method() === 'GET') { first = false; await page.request.delete(route.request().url(), { headers: { 'content-type': 'application/json' } }); }
    await route.continue();
  });
});

async function open(page: Page, width: number, height=900) {
  await page.setViewportSize({ width, height });
  await page.goto(server.launchUrl);
  await page.locator('.home').waitFor();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${recording}`);
  if (width <= 820) return; // narrow desktop windows use the Files drawer
  const grant = page.getByRole('button', { name: /^Enable workspace reading/ });
  const explorer = page.locator('.folder-explorer');
  await expect(grant.or(page.locator('.folder-explorer[data-reading-access=current]'))).toBeVisible();
  if (await grant.isVisible()) await grant.click();
  await expect(explorer).toHaveAttribute('data-reading-access', 'current');
  // Compare composer toggles after asynchronous Files/tool inventories have arrived.
  await expect(page.locator('[data-spine-path="main.ts"]')).toHaveAttribute('aria-setsize','41');
  await expect(page.locator('.modern-toolbox .tool-list')).toHaveCount(1);
  await page.evaluate(()=>document.fonts.ready);
}
/** Left and right edge of the first match, or null when it is not on screen. */
const span = (page: Page, selector: string) => page.evaluate((s) => {
  const r = document.querySelector(s)?.getBoundingClientRect();
  return r && r.width > 0 ? { left: r.left, right: r.right } : null;
}, selector);

for (const theme of ['dark','light','midnight']) for (const [width,height,scale] of [[1024,900,1],[1440,900,1],[1920,1080,1.2],[2560,1440,1.6],[3840,2160,2.25]]) {
  test(`${theme} ${width}×${height}: root sizing fills the viewport with readable panels`, async ({ page }) => {
    await page.addInitScript(theme=>localStorage.setItem('drishya.theme',theme),theme);
    await open(page,width!,height);
    expect((await page.locator('.history').boundingBox())!.y).toBe(0);
    await expect.poll(()=>page.evaluate(()=>Number(document.documentElement.style.getPropertyValue('--ui-scale')))).toBe(scale);
    expect(await page.evaluate(()=>parseFloat(getComputedStyle(document.documentElement).fontSize))).toBeCloseTo(16*scale!,1);
    const readingType=await page.evaluate(()=>['.history .prose','.history .turn-text','.modern-native-composer textarea'].map(selector=>{const style=getComputedStyle(document.querySelector(selector)!);return {selector,size:parseFloat(style.fontSize),family:style.fontFamily};}));
    for(const type of readingType){expect(type.size,type.selector).toBeCloseTo(15*scale!,1);expect(type.family,type.selector).toContain('Segoe UI');}
    const inside=(box:{left:number;right:number}|null,name:string)=>{
      expect(box,name).not.toBeNull();expect(box!.left,name+' left').toBeGreaterThanOrEqual(-.5);expect(box!.right,name+' right').toBeLessThanOrEqual(width!+.5);
    };
    for(const selector of ['.modern-identity','.workspace-utilities','.folder-explorer','.history-inner','.toolbox-rail'])inside(await span(page,selector),selector);
    const column=(await span(page,'.history-inner'))!;
    expect(column.right-column.left).toBeLessThanOrEqual(1280*scale!+.5);
    if(width!>=1440)expect((column.right-column.left)/width!).toBeGreaterThan(.60);
    const files=(await span(page,'.folder-explorer'))!;expect(files.right-files.left).toBeCloseTo(260*scale!,0);expect(files.left).toBeCloseTo(18*scale!,0);
    const map=await page.locator('.map').boundingBox();expect(map!.width).toBeCloseTo(width!,0);expect(map!.height).toBeCloseTo(height!,0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
    const file=page.locator('[data-spine-path]').filter({has:page.getByText('main.ts',{exact:true})});
    expect((await file.boundingBox())!.height).toBeCloseTo(32*scale!,0);
    const panels=async()=>Promise.all(['.folder-explorer','.toolbox-rail','.modern-tool-station'].map(selector=>page.locator(selector).boundingBox()));
    const initial=await panels();
    for(let toggle=0;toggle<2;toggle++){
      await page.locator('.composer-minimize').click();
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const current=await panels();
      for(let i=0;i<initial.length;i++)for(const key of ['x','y','width','height'] as const)expect(Math.abs(current[i]![key]-initial[i]![key]),`panel ${i} ${key} after composer toggle`).toBeLessThan(1);
    }
    await file.click();await expect(page.locator('.file-peek-reader[open]')).toBeVisible();inside(await span(page,'.file-peek-reader'),'file peek');
    await open(page,width!,height);await page.getByRole('button',{name:'Open developer workspace',exact:true}).click();await expect(page.locator('.developer-workspace')).toBeVisible();
    const desk=(await span(page,'.developer-workspace'))!;inside(desk,'Workspace');expect(desk.right-desk.left).toBeGreaterThan(width!*.55);
  });
}
for(const theme of ['dark','light','midnight'])test(`${theme} 600px keeps its baseline and does not overflow`,async({page})=>{
  await page.addInitScript(theme=>localStorage.setItem('drishya.theme',theme),theme);await open(page,600);
  expect((await page.locator('.history').boundingBox())!.y).toBe(0);
  expect(await page.evaluate(()=>({scale:Number(document.documentElement.style.getPropertyValue('--ui-scale')),root:parseFloat(getComputedStyle(document.documentElement).fontSize),overflow:document.documentElement.scrollWidth-innerWidth}))).toEqual({scale:1,root:16,overflow:0});
});

test('a resized Files rail keeps its logical width when the viewport scale changes',async({page})=>{
  await open(page,2560,1440);
  const resize=page.getByRole('separator',{name:'Resize Files reading space',exact:true});
  await resize.focus();await page.keyboard.press('ArrowRight');
  await expect(resize).toHaveAttribute('aria-valuenow','448'); // 416 physical CSS pixels + one keyboard step
  await page.setViewportSize({width:1440,height:900});
  await expect(resize).toHaveAttribute('aria-valuenow','280');
  expect((await page.locator('.folder-explorer').boundingBox())!.width).toBeCloseTo(280,0);
  await page.setViewportSize({width:2560,height:1440});
  await expect(resize).toHaveAttribute('aria-valuenow','448');
  await resize.focus();await page.keyboard.press('Enter');
  await expect(resize).toHaveAttribute('aria-valuenow','416');
});
