// SHIP-8: the map recedes beneath reading material and its labels never collide. Synthetic repository with a dense import
// star, so lines cross the reading column and clusters crowd. Real-session checks are recorded in docs/review/ship-8-map-quiet.md.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { spawn } from 'node:child_process';
import { expect, test } from './legacy-test.ts';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';
import { HarnessController } from '../../apps/daemon/src/controller.ts';

let dir: string, app: App, server: RunningServer, recordingId: string;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-map-quiet-'));
  const root = join(dir, 'dense-repository'); mkdirSync(root);
  for (const group of ['client', 'server', 'shared', 'tools']) {
    mkdirSync(join(root, group)); mkdirSync(join(root, group, 'src'));
    for (let n = 0; n < 70; n++) writeFileSync(join(root, group, 'src', `file${n}.ts`), n ? `import './file0';\nimport './file${n - 1}';\nexport const value = ${n};` : 'export const value = 0;');
  }
  const base = { sessionId: '77777777-7777-4777-8777-777777777777', cwd: root, timestamp: '2026-11-10T12:00:00Z' };
  const journal = join(dir, 'quiet.jsonl');
  writeFileSync(journal, [
    { ...base, type: 'user', uuid: 'u1', message: { role: 'user', content: 'Quiet zone synthetic session' } },
    { ...base, type: 'assistant', uuid: 'a1', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'read1', name: 'Read', input: { file_path: join(root, 'client', 'src', 'file3.ts') } }] } },
    { ...base, type: 'user', uuid: 'r1', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'read1', content: '1\texport const value = 3;' }] } },
    { ...base, type: 'assistant', uuid: 'a2', message: { role: 'assistant', content: [{ type: 'text', text: 'The client module imports the shared entry point; nothing else changed.' }] } },
  ].map(v => JSON.stringify(v)).join('\n') + '\n');
  const transport = join(dir, 'quiet-harness.mjs');
  writeFileSync(transport, `import {createInterface} from 'node:readline';
const send=v=>process.stdout.write(JSON.stringify(v)+'\\n');
createInterface({input:process.stdin}).on('line',line=>{const v=JSON.parse(line);if(v.type==='control_request')send({type:'control_response',response:{subtype:'success',request_id:v.request_id,response:{models:[],commands:[]}}});});`);
  app = new App(join(dir, 'store')); recordingId = (await app.ingest.importSource('claude-code', journal)).recordingId;
  server = await startServer({ app, port: 0, token: 'synthetic-map-quiet', controllerFactory: (a, w) => new HarnessController(a, w, { resolveExecutable: () => process.execPath, launch: ((_bin: string, _args: string[], opts: any) => spawn(process.execPath, [transport], opts)) as typeof spawn }) });
});
test.afterAll(async () => { await server?.close(); await app?.close(); if (dir) { if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('unsafe test cleanup'); rmSync(dir, { recursive: true, force: true }); } });

async function openMap(page: import('@playwright/test').Page, flat = false) {
  if (flat) await page.addInitScript(() => localStorage.setItem('drishya.mapDepth', 'false'));
  await page.goto(server.launchUrl);
  await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/#/r/${recordingId}`);
  await expect(page.getByRole('region', { name: 'Harness prompt' })).toBeVisible();
  const rail = page.getByRole('complementary', { name: 'Repository files' });
  if (!await rail.isVisible()) await page.getByRole('button', { name: 'Show files', exact: true }).click();
  await expect(rail).toBeVisible();
  // Approval is remembered for the checkout, so later tests in this file find it already enabled.
  const enable = rail.getByRole('button', { name: /Enable workspace reading/ });
  if (await enable.count()) await enable.click();
  await expect(page.locator('.map')).toHaveAttribute('data-map-scope', 'all');
}

const labelOverlaps = (page: import('@playwright/test').Page) => page.evaluate(() => {
  const boxes = [...document.querySelectorAll<HTMLElement>('.map-group, .map-file-label')]
    .filter(el => getComputedStyle(el).visibility !== 'hidden' && Number(getComputedStyle(el).opacity) > .05)
    .map(el => el.getBoundingClientRect());
  let overlaps = 0;
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i]!, b = boxes[j]!;
    if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) overlaps++;
  }
  return { shown: boxes.length, overlaps };
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 600, height: 800 }]) {
  test(`visible map labels never overlap at ${viewport.width} px across the zoom range`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openMap(page);
    await page.getByRole('button', { name: 'Explore repository map', exact: true }).click();
    await expect.poll(() => page.locator('.map-group').count()).toBeGreaterThan(0);
    const fit = page.getByRole('button', { name: 'Fit', exact: true });
    let sawLabels = 0;
    const check = async () => { await page.waitForTimeout(380); const r = await labelOverlaps(page); expect(r.overlaps).toBe(0); sawLabels += r.shown; };
    await fit.click(); await check();
    for (const name of ['Zoom into repository', 'Zoom into repository', 'Zoom into repository', 'Zoom into repository', 'Zoom out of repository', 'Zoom out of repository', 'Zoom out of repository', 'Zoom out of repository', 'Zoom out of repository', 'Zoom out of repository']) {
      await page.getByRole('button', { name, exact: true }).click(); await check();
    }
    expect(sawLabels).toBeGreaterThan(viewport.width < 700 ? 2 : 10); // UI-28c: the controls keep the composer's rest height reserved, so the 600 px window shows fewer labels
    // The selected file's import neighbourhood is placed first and still collides with nothing.
    await fit.click();
    await page.getByRole('switch', { name: /Import paths/ }).click();
    await expect(page.locator('.map-connections')).toBeVisible();
    await check();
  });
}

test('hovering a spatial group names the files inside it, touched ones first', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openMap(page);
  await page.getByRole('button', { name: 'Explore repository map', exact: true }).click();
  await expect.poll(() => page.locator('.map-group').count()).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Fit', exact: true }).click();
  await page.waitForTimeout(400);
  const group = page.locator('.map-group').first();
  const count = Number((await group.locator('strong').textContent())!.trim());
  await group.hover();
  const members = page.locator('.map-tip-members li');
  await expect(members.first()).toBeVisible();
  expect(await members.count()).toBeLessThanOrEqual(5);
  const text = await page.locator('.map-tip-members').innerText();
  expect(text).toMatch(/src\/file\d+\.ts/);
  if (count > 4) await expect(page.locator('.map-tip-members')).toContainText(`+ ${count - 4} more`);
  // Leaving the label closes the card: no resident clutter.
  await page.mouse.move(5, 450);
  await expect(page.locator('.map-tip')).toHaveCount(0);
});

test('beneath the reading column dots and import lines stay visible but translucent while the margins stay full strength', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await openMap(page, true);
  await expect(page.locator('.map')).toHaveAttribute('data-map-depth', 'flat');
  await expect(page.locator('.history-inner > *').first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('.map canvas:not([data-spatial-renderer])')!;
    const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    let drawn = 0; for (let i = 3; i < data.length; i += 4) if (data[i]! > 12) drawn++;
    return drawn;
  })).toBeGreaterThan(300);
  const result = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('.map canvas:not([data-spatial-renderer])')!;
    const column = document.querySelector('.history-inner > *')!.getBoundingClientRect();
    const map = document.querySelector('.map')!.getBoundingClientRect();
    const scale = canvas.width / map.width, feather = 72;
    const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    // Pixels above an alpha, counted per horizontal span. A quiet dot is .95 x .38 = 92 of 255; a full one is 242.
    const above = (left: number, right: number, alpha: number) => {
      let count = 0;
      for (let y = 0; y < canvas.height; y++) for (let x = Math.max(0, Math.floor(left * scale)); x < Math.min(canvas.width, Math.ceil(right * scale)); x++) if (data[(y * canvas.width + x) * 4 + 3]! > alpha) count++;
      return count;
    };
    const l = column.left - map.left, r = column.right - map.left;
    return {
      inside: above(l, r, 120), insideSeen: above(l, r, 12), insideMid: above(l, r, 90), outside: above(0, l - feather, 120) + above(r + feather, map.width, 120), outsideSeen: above(0, l - feather, 12) + above(r + feather, map.width, 12),
      quiet: document.querySelector('.map')!.getAttribute('data-map-quiet'),
    };
  });
  expect(result.quiet, 'the quiet zone is the measured reading column').toMatch(/^\d+,\d+$/);
  expect(result.outside, 'dots and lines in the margins keep their strength').toBeGreaterThan(300);
  // MAP-4: beneath the column the map is still there as translucent shapes (SHIP-8 had cleared it), but only the dot of the
  // file this passage read (and its antialiasing) reaches full strength: no line and no other dot does.
  expect(result.insideSeen, 'dots and lines stay visible, translucent, beneath the reading column').toBeGreaterThan(30);
  // SHIP-8's .3 / .08 floors left 35 pixels at mid strength here; the translucent floors leave thousands (measured, 13 Nov).
  expect(result.insideMid, 'beneath the column the shapes are present, not near-invisible').toBeGreaterThan(500);
  // Relative, because overlapping lines of the dense hub add up: a smaller share of what is drawn beneath the column is at full strength.
  expect(result.inside / result.insideSeen, 'beneath the column the map is translucent, not full strength').toBeLessThan(.8 * result.outside / result.outsideSeen);
  // Exploring has no reading material, so the whole map is full strength again.
  await page.getByRole('button', { name: 'Explore repository map', exact: true }).click();
  await page.waitForTimeout(500);
  const exploring = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('.map canvas:not([data-spatial-renderer])')!;
    const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    let max = 0; for (let i = 3; i < data.length; i += 4) max = Math.max(max, data[i]!);
    return max;
  });
  expect(exploring).toBeGreaterThan(110);
});

for (const width of [600, 1440]) test(`MAP-3 activity chips stay outside actual protected UI at ${width}px`, async ({page}) => {
 await page.setViewportSize({width,height:900});
 await page.addInitScript(()=>localStorage.setItem('drishya.mapOrbit','false'));
 await openMap(page);
 await page.waitForTimeout(400);
 const check=async()=>expect(await page.evaluate(()=>{
  const chips=[...document.querySelectorAll('.map-activity-chip')].map(e=>e.getBoundingClientRect());
  const protectedBoxes=[...document.querySelectorAll('.history-inner,.prompt-rail,.workspace-header,.workspace-bar,.workbench-station,.folder-explorer,.prompt-composer,[role="dialog"]')].filter(e=>e.getClientRects().length).map(e=>e.getBoundingClientRect());
  return chips.filter(a=>protectedBoxes.some(b=>a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom)).length;
 })).toBe(0);
 await check();
 await page.getByRole('button',{name:'Workspace settings',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Workspace settings'})).toBeVisible();await check();
 await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Explore repository map',exact:true}).click();
 await expect(page.locator('.map-activity-chip')).toHaveCount(0);
});

test('MAP-3 mounts a real filename/type chip in a free gutter and suppresses it when the gutter closes', async ({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.route('**/graph*',async route=>{
  const response=await route.fetch();const graph=await response.json();
  if(Array.isArray(graph.nodes))for(const node of graph.nodes)if(node.id==='client/src/file3.ts'){node.x=0;node.y=.75;}
  await route.fulfill({response,json:graph});
 });
 await openMap(page,true);
 const chip=page.locator('.map-activity-chip[data-path="client/src/file3.ts"]');
 await expect(chip).toBeVisible();await expect(chip.locator('.file-format')).toHaveCount(1);
 await expect(chip).toHaveAttribute('data-tone','read');
 await page.setViewportSize({width:600,height:900});
 await expect(chip).toHaveCount(0);
});
