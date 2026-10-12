import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { spawn } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';
import { HarnessController } from '../../apps/daemon/src/controller.ts';

let dir: string, app: App, server: RunningServer;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-connected-browser-'));
  const root = join(dir, 'session-repository'); mkdirSync(root); mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src', 'actual.ts'), 'export const fromSelectedWorkspace = 42;\n' + Array.from({length:250},(_,n)=>`// line ${n}`).join('\n'));
  writeFileSync(join(root, 'src', 'other.ts'), "import { fromSelectedWorkspace } from './actual';\n");
  const journal = join(dir, 'session.jsonl');
  const base = { sessionId: '55555555-5555-4555-8555-555555555555', cwd: root, timestamp: '2026-10-07T12:00:00Z' };
  writeFileSync(journal, [
    {...base,type:'user',uuid:'u1',message:{role:'user',content:'Connected workspace synthetic session'}},
    {...base,type:'assistant',uuid:'a1',message:{role:'assistant',content:[{type:'tool_use',id:'read1',name:'Read',input:{file_path:join(root,'src','actual.ts')}}]}},
    {...base,type:'user',uuid:'r1',message:{role:'user',content:[{type:'tool_result',tool_use_id:'read1',content:'1\t// recorded historical bytes'}]}},
  ].map(v=>JSON.stringify(v)).join('\n')+'\n');
  const transport = join(dir, 'synthetic-harness.mjs');
  writeFileSync(transport, `import {createInterface} from 'node:readline';
const send=v=>process.stdout.write(JSON.stringify(v)+'\\n');
createInterface({input:process.stdin}).on('line',line=>{
  const v=JSON.parse(line);
  if(v.type==='control_request') send({type:'control_response',response:{subtype:'success',request_id:v.request_id,response:{models:[{value:'synthetic-model',displayName:'Synthetic model',supportedEffortLevels:['low','high']}],commands:[{name:'compact'}]}}});
  if(v.type==='user') {
    if(v.message.content === 'THINK') {
      send({type:'stream_event',event:{type:'content_block_start',index:0,content_block:{type:'thinking',thinking:''}}});
      send({type:'stream_event',event:{type:'content_block_delta',index:0,delta:{type:'thinking_delta',thinking:'Native exposed reasoning for the synthetic workspace.'}}});
      setTimeout(()=>{send({type:'stream_event',event:{type:'content_block_stop',index:0}});send({type:'result',is_error:false});},900);
      return;
    }
    send({type:'system',subtype:'init',tools:['Read','Edit','mcp__docs__lookup',...Array.from({length:90},(_,n)=>'mcp__synthetic__tool'+n)]});send({type:'control_request',request_id:'one',request:{subtype:'can_use_tool',tool_name:'Edit',input:{file_path:'src/actual.ts',new_string:'export const value = 43;'}}});}
  if(v.type==='control_response')send({type:'result',is_error:false,result:'Synthetic native transport completed the submitted prompt.'});
});`);
  app = new App(join(dir,'store')); await app.ingest.importSource('claude-code',journal);
  const largeRoot = join(dir, 'large-repository'); mkdirSync(largeRoot);
  for (const group of ['client', 'server', 'shared']) {
    mkdirSync(join(largeRoot, group)); mkdirSync(join(largeRoot, group, 'src'));
    for (let n = 0; n < 60; n++) writeFileSync(join(largeRoot, group, 'src', `file${n}.ts`), n ? `import './file0';\nexport const value = ${n};` : 'export const value = 0;');
  }
  const largeJournal = join(dir, 'large.jsonl');
  writeFileSync(largeJournal, JSON.stringify({ ...base, cwd: largeRoot, sessionId: '66666666-6666-4666-8666-666666666666', type: 'user', uuid: 'large1', message: { role: 'user', content: 'Hierarchical map synthetic session' } }) + '\n');
  await app.ingest.importSource('claude-code', largeJournal);
  server = await startServer({app,port:0,token:'synthetic-connected-test',controllerFactory:(a,w)=>new HarnessController(a,w,{resolveExecutable:()=>process.execPath,launch:((_bin:string,_args:string[],opts:any)=>spawn(process.execPath,[transport],opts)) as typeof spawn})});
});
test.afterAll(async()=>{ await server?.close(); await app?.close(); if (dir) {if (!resolve(dir).startsWith(resolve(tmpdir())+sep)) throw new Error('unsafe test cleanup'); rmSync(dir,{recursive:true,force:true});} });

test('Studio native workspace connects its composer, attachments, approval and evidence readers', async ({ page }) => {
  await page.goto(new URL('/?experience=studio', server.launchUrl).href + new URL(server.launchUrl).hash);
  await page.getByRole('button', { name: /Connected workspace synthetic session/ }).click();
  await expect(page.locator('.workbench-header')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Recorded agents' })).toHaveCount(0);
  const composer = page.getByRole('region', { name: 'Harness prompt' });
  await composer.getByRole('button', { name: 'Enable this workspace', exact: true }).click();
  await expect(composer.getByRole('button', { name: 'Add files or folders' })).toBeEnabled();
  await composer.locator('input[aria-label="Choose prompt files"]').setInputFiles({ name: 'source.ts', mimeType: 'text/plain', buffer: Buffer.from('export const attached = true;') });
  await composer.getByRole('textbox', { name: 'Prompt for selected harness session' }).fill('Review the source attachment');
  await composer.getByRole('button', { name: 'Send prompt', exact: true }).click();
  await composer.getByRole('checkbox', { name: 'This session is idle in other clients' }).check();
  await composer.getByRole('button', { name: 'Confirm and send', exact: true }).click();
  await expect(composer).toContainText('Edit · approval requested');
  await expect(composer.locator('.attachment-chip')).toHaveCount(0);
  await composer.getByRole('button', { name: 'Allow once', exact: true }).click();
  await expect(composer.getByRole('button', { name: 'Send prompt', exact: true })).toBeVisible();
  await expect(page.locator('.runtime-tools')).toContainText('Available in connected runtime');
  await page.getByRole('button', { name: 'Show session folders' }).click();
  const folders = page.getByRole('complementary', { name: 'Session folders' });
  await folders.getByRole('treeitem', { name: 'actual.ts', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'src/actual.ts', exact: true })).toContainText('fromSelectedWorkspace');
});

test('current source reading finds, navigates and wraps bounded disk pages without replacing captured evidence', async ({ page }) => {
  await page.goto(server.launchUrl);
  await page.getByRole('button', { name: /Connected workspace synthetic session/ }).click();
  const folders = page.getByRole('complementary', { name: 'Session folders' });
  const enable = folders.getByRole('button', { name: /Enable workspace reading/ });
  if (await enable.count()) await enable.click();
  await folders.getByRole('treeitem', { name: 'actual.ts', exact: true }).click();
  const reader = page.getByRole('dialog', { name: 'src/actual.ts', exact: true });
  const resize = reader.getByRole('separator', { name: 'Resize current source reading space' });
  await resize.press('ArrowLeft');
  await expect(resize).toHaveAttribute('aria-valuenow', '1072');
  await reader.getByRole('textbox', { name: 'Go to current source line' }).fill('9999');
  await reader.getByRole('button', { name: 'Go to line', exact: true }).click();
  await expect(reader.locator('.source-go')).toContainText('251');
  await reader.getByRole('searchbox', { name: 'Find in current source page' }).fill('fromSelectedWorkspace');
  await expect(reader.locator('.source-find')).toContainText('1 matching line');
  await reader.getByRole('button', { name: 'Next match', exact: true }).click();
  await expect(reader.locator('[data-source-line="1"]')).toHaveAttribute('aria-current', 'location');
  await reader.getByRole('textbox', { name: 'Go to current source line' }).fill('205');
  await reader.getByRole('button', { name: 'Go to line', exact: true }).click();
  await expect(reader).toContainText('Lines 201–251 of 251');
  await expect(reader.locator('[data-source-line="205"]')).toHaveAttribute('aria-current', 'location');
  await reader.getByRole('button', { name: 'Wrap lines', exact: true }).click();
  await expect(reader.locator('.current-file-code')).toHaveClass(/wrap-source/);
  await page.screenshot({ path: resolve('.local/source-reader-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(reader.getByRole('button', { name: 'Next lines' })).toBeVisible();
  const bounds = await reader.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: resolve('.local/source-reader-narrow.png') });
  await reader.getByRole('button', { name: 'Recorded work on this file' }).click();
  const historical = page.getByRole('dialog', { name: 'Work on src/actual.ts' });
  await expect(historical).toContainText('recorded historical bytes');
  await expect(historical).not.toContainText('fromSelectedWorkspace');
});

test('source reading links qualified current imports to a bounded map neighborhood', async ({ page }) => {
  await page.goto(server.launchUrl);
  await page.getByRole('button', { name: /Connected workspace synthetic session/ }).click();
  const folders = page.getByRole('complementary', { name: 'Session folders' });
  const enable = folders.getByRole('button', { name: /Enable workspace reading/ });
  if (await enable.count()) await enable.click();
  await page.getByRole('button', { name: 'Explore repository map', exact: true }).click();
  const approve = page.getByRole('button', { name: 'Map the whole repository', exact: true });
  if (await approve.count()) await approve.click();
  await expect(page.locator('.map-legend')).toContainText('2 files · 1 imports');
  await page.getByRole('button', { name: 'Back to work' }).click();
  await folders.getByRole('treeitem', { name: 'actual.ts', exact: true }).click();
  const reader = page.getByRole('dialog', { name: 'src/actual.ts', exact: true });
  await reader.locator('.import-context summary').click();
  await expect(reader.locator('.import-context')).toContainText('Current index');
  await expect(reader.locator('.import-context')).toContainText('src/other.ts');
  await expect(reader.locator('.import-context')).toContainText('Imported by');
  await reader.locator('.import-context').getByRole('button', { name: 'Read current file src/other.ts' }).click();
  const neighbor = page.getByRole('dialog', { name: 'src/other.ts', exact: true });
  await expect(neighbor).toContainText('On disk');
  await expect(neighbor).toContainText("import { fromSelectedWorkspace }");
  await neighbor.getByRole('button', { name: 'Back in reading history', exact: true }).click();
  await expect(reader).toContainText('On disk');
  await reader.getByRole('button', { name: 'Forward in reading history', exact: true }).click();
  await expect(neighbor).toContainText("import { fromSelectedWorkspace }");
  await neighbor.locator('.import-context summary').click();
  await neighbor.locator('.import-context').getByRole('button', { name: 'Read current file src/actual.ts' }).click();
  await reader.locator('.import-context summary').click();
  await reader.getByRole('button', { name: 'Focus on map' }).click();
  await expect(page.locator('.map')).toHaveAttribute('data-map-scope', 'direct-neighborhood');
  await expect(page.locator('.map-connections')).toContainText('src/actual.ts');
  await expect(page.locator('.map-legend')).toContainText('2 neighborhood files · 1 shown imports');
  await expect.poll(async () => (await page.locator('.map-file-label').filter({ hasText: 'src/actual.ts' }).first().boundingBox())?.y ?? 0).toBeGreaterThan(250);
  await page.screenshot({ path: resolve('.local/feedback-neighborhood.png') });
  await page.getByRole('button', { name: 'Show full map', exact: true }).click();
  await expect(page.locator('.map')).toHaveAttribute('data-map-scope', 'all');
});

test('native model settings and attachment menus dismiss outside without detaching Follow', async ({ page }) => {
  await page.goto(server.launchUrl);
  await page.getByRole('button', { name: /Connected workspace synthetic session/ }).click();
  const composer = page.getByRole('region', { name: 'Harness prompt' });
  const enable = composer.getByRole('button', { name: 'Enable this workspace', exact: true });
  if (await enable.count()) await enable.click();
  const policy = composer.locator('.permission-policy');
  await policy.locator('summary').click();
  await policy.getByRole('button', { name: 'Read native settings' }).click();
  await policy.getByLabel('Model').selectOption('synthetic-model');
  await policy.getByLabel('Effort').selectOption('high');
  await page.locator('.crown-title').click({ force: true });
  await expect(policy).not.toHaveAttribute('open', '');
  await expect(page.getByRole('switch', { name: 'Automatically follow new work' })).toHaveAttribute('aria-checked', 'true');
  await composer.getByRole('button', { name: 'Add files or folders' }).click();
  await expect(composer.locator('.composer-add-menu')).toBeVisible();
  await page.locator('.crown-title').click({ force: true });
  await expect(composer.locator('.composer-add-menu')).toHaveCount(0);
  const menu = page.locator('.workspace-menu');
  await menu.locator(':scope > summary').click();
  await page.locator('.crown-title').click({ force: true });
  await expect(menu).not.toHaveAttribute('open', '');
});

test('selected workspace folders read current files separately from the exact historical source',async({page})=>{
  await page.goto(server.launchUrl); await page.getByRole('button',{name:/Connected workspace synthetic session/}).click();
  const folder = page.getByRole('complementary',{name:'Session folders'});
  await expect(folder).toHaveCount(1);
  await expect(folder).toContainText('session-repository');
  await expect(page.getByRole('group', { name: 'Recorded agents' })).toHaveCount(0);
  await expect(page.locator('.history-transport .prompt-menu')).toHaveCount(0);
  const centre = () => page.locator('.history-inner').evaluate(el => { const r = el.getBoundingClientRect(); return r.x + r.width / 2; });
  const before = await centre();
  expect(Math.abs(before - page.viewportSize()!.width / 2)).toBeLessThan(2);
  const folderBox = await folder.boundingBox();
  expect(folderBox!.height).toBeGreaterThan(page.viewportSize()!.height * .75);
  await expect(page.locator('.passage-agent')).toHaveCount(0);

  const enableReading = folder.getByRole('button',{name:/Enable workspace reading/});
  if (await enableReading.count()) await enableReading.click();
  await expect(folder.getByRole('button',{name:/Enable workspace reading/})).toHaveCount(0);
  await folder.getByRole('treeitem',{name:'actual.ts',exact:true}).click();
  const reader=page.getByRole('dialog',{name:'src/actual.ts',exact:true});
  await expect(reader.getByTitle('Current disk · not a historical snapshot')).toHaveText('On disk');
  await expect(reader).toContainText('fromSelectedWorkspace');
  await expect(reader).not.toContainText('recorded historical bytes');
  await reader.getByRole('button',{name:'Next lines'}).click();
  await expect(reader).toContainText('Lines 201–251 of 251');
  await reader.getByRole('button',{name:'Recorded work on this file'}).click();
  const historical=page.getByRole('dialog',{name:'Work on src/actual.ts'});
  await expect(historical).toContainText('recorded historical bytes');
  await expect(historical).not.toContainText('fromSelectedWorkspace');
  await historical.getByRole('button',{name:'Close Work on src/actual.ts'}).click();
  await page.getByRole('button',{name:'Show session folders',exact:true}).click();
  await expect(folder).toHaveCount(0);
  expect(Math.abs(await centre() - before)).toBeLessThan(2);
  await page.getByRole('button',{name:'Show session folders',exact:true}).click();
  await expect(folder).toHaveCount(1);
  await page.getByRole('button',{name:'Explore repository map',exact:true}).click();
  await expect(page.locator('.map-legend')).toContainText('2 files · 1 imports');
  await page.getByRole('button',{name:'Zoom into repository'}).click();
  await page.getByRole('button',{name:'Back to work'}).click();
  await expect(page.locator('.history')).toBeVisible();
});

test('composer attaches code and pasted screenshots, removes chips and sends them through the native API', async ({ page }) => {
  await page.goto(server.launchUrl); await page.getByRole('button', { name: /Connected workspace synthetic session/ }).click();
  const composer = page.getByRole('region', { name: 'Harness prompt' });
  const enable = composer.getByRole('button', { name: 'Enable this workspace', exact: true });
  if (await enable.count()) await enable.click();
  // The real picker is unavailable while workspace consent is being refreshed.
  await expect(composer.getByRole('button', { name: 'Add files or folders' })).toBeEnabled();
  await composer.locator('input[aria-label="Choose prompt files"]').setInputFiles([
    { name: 'source.ts', mimeType: 'text/plain', buffer: Buffer.from('export const selectedSource = true;') },
    { name: 'remove.txt', mimeType: 'text/plain', buffer: Buffer.from('Remove this attachment') }
  ]);
  await expect(composer.getByRole('button', { name: 'Remove attachment source.ts' })).toBeVisible();
  await composer.getByRole('button', { name: 'Remove attachment remove.txt' }).click();
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  await composer.getByRole('textbox').evaluate((el, image) => {
    const clipboardData = new DataTransfer();
    clipboardData.items.add(new File([Uint8Array.from(atob(image), char => char.charCodeAt(0))], 'screenshot.png', { type: 'image/png' }));
    el.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData }));
  }, png);
  await expect(composer.getByRole('img', { name: 'Preview screenshot.png' })).toBeVisible();
  let sent: any;
  await page.route('**/controller/prompt', async route => { sent = route.request().postDataJSON(); await route.continue(); });
  await composer.getByRole('textbox').fill('Review the attached source and screenshot');
  await composer.getByRole('button', { name: 'Send prompt', exact: true }).click();
  await composer.getByRole('checkbox', { name: 'This session is idle in other clients' }).check();
  await composer.getByRole('button', { name: 'Confirm and send', exact: true }).click();
  await expect(composer).toContainText('approval requested');
  expect(sent.attachments.map((a: any) => a.name)).toEqual(['source.ts', 'screenshot.png']);
  expect(sent.attachments[1].data).toBe(png);
  await expect(composer.locator('.attachment-chip')).toHaveCount(0);
  await composer.getByRole('button', { name: 'Stop turn', exact: true }).click();
  await expect(composer.getByRole('button', { name: 'Send prompt', exact: true })).toBeVisible();
  await composer.locator('input[aria-label="Choose prompt folder"]').setInputFiles(join(dir, 'session-repository'));
  await expect(composer.locator('.attachment-chip')).not.toHaveCount(0);
  if (process.env.DRISHYA_REVIEW_SHOTS) await page.screenshot({ path: resolve('.local/attachment-composer.png') });
});

test('the composer submits through the real API transport, handles one approval and keeps session ownership visible',async({page})=>{
  await page.goto(server.launchUrl); await page.getByRole('button',{name:/Connected workspace synthetic session/}).click();
  await expect(page.getByRole('textbox',{name:'Prompt for selected harness session'})).toBeVisible();
  const composer=page.getByRole('region',{name:'Harness prompt'});
  await expect(composer).toContainText('session-repository');
  const box = await composer.boundingBox();
  expect(Math.abs(box!.x + box!.width / 2 - page.viewportSize()!.width / 2)).toBeLessThan(2);
  await expect(composer.getByRole('button', { name: 'Add files or folders' })).toBeEnabled();

  const enable=composer.getByRole('button',{name:'Enable this workspace',exact:true});
  if (await enable.count()) await enable.click();
  const promptInput = composer.getByRole('textbox',{name:'Prompt for selected harness session'});
  await promptInput.fill('Please explain the selected workspace\n' + 'More context\n'.repeat(12));
  const expandedHeight = (await promptInput.boundingBox())!.height;
  await expect(composer.getByRole('button',{name:'Send prompt'})).toBeEnabled();
  await composer.getByRole('textbox',{name:'Prompt for selected harness session'}).press('Enter');
  await expect(promptInput).not.toHaveValue('');
  await expect(composer.locator('.tool-approval')).toHaveCount(0);
  await composer.getByRole('checkbox',{name:'This session is idle in other clients'}).check();
  await composer.getByRole('textbox',{name:'Prompt for selected harness session'}).press('Enter');
  await expect(composer).toContainText('Edit · approval requested');
  await expect(promptInput).toHaveValue('');
  expect((await promptInput.boundingBox())!.height).toBeLessThan(expandedHeight);
  expect((await composer.boundingBox())!.height).toBeLessThan(150);
  await expect(composer.getByRole('button', { name: 'Stop turn' }).locator('svg')).toHaveCount(1);
  await expect(page.locator('.runtime-tools')).toContainText('Available in connected runtime');
  const inventory = page.locator('.runtime-tools');
  await inventory.locator('summary').click();
  await inventory.locator('ol').evaluate(el => el.scrollTop = el.scrollHeight);
  await expect(inventory.locator('summary')).toBeInViewport();
  await inventory.locator('summary').click();
  await composer.getByRole('button',{name:'Allow once',exact:true}).click();
  await expect(composer.getByRole('button', { name: 'Send prompt', exact: true })).toBeVisible();
  await expect(composer.locator('.controller-receipt')).toHaveCount(0);
  await expect(composer).not.toContainText('Synthetic native transport completed the submitted prompt.');
  expect((await composer.boundingBox())!.height).toBeLessThan(150);
  await expect(page.getByRole('complementary',{name:'Session folders'})).toHaveCount(1);
  if(process.env.DRISHYA_REVIEW_SHOTS==='1') await page.screenshot({path:resolve('.local/connected-composer.png')});
});

test('visible new material animates with Follow off without moving the reading position', async ({ page }) => {
  const root = join(dir, 'session-repository');
  const journal = join(dir, 'independent-motion.jsonl');
  const base = { sessionId: '88888888-8888-4888-8888-888888888888', cwd: root, timestamp: '2026-10-08T12:00:00Z' };
  writeFileSync(journal, JSON.stringify({ ...base, type: 'user', uuid: 'motion-user', message: { role: 'user', content: 'Independent motion synthetic session' } }) + '\n');
  const { recordingId } = await app.ingest.importSource('claude-code', journal);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(server.launchUrl);
  await page.getByRole('button', { name: /Independent motion synthetic session/ }).click();
  await page.getByRole('switch', { name: 'Automatically follow new work' }).click();
  await page.evaluate(() => {
    (window as any).independentArrivals = [];
    (window as any).wheelMotionStates = [];
    const animate = HTMLElement.prototype.animate;
    HTMLElement.prototype.animate = function(...args) {
      const animation = animate.apply(this, args);
      queueMicrotask(() => { if (animation.id.startsWith('surface-')) {
        (window as any).independentArrivals.push(this.dataset.opId);
        this.closest('.history')?.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: -1 }));
        (window as any).wheelMotionStates.push(animation.playState);
      } });
      return animation;
    };
  });
  const top = await page.locator('.history').evaluate(el => el.scrollTop);
  appendFileSync(journal, JSON.stringify({ ...base, type: 'assistant', uuid: 'motion-tool', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'independent-shell', name: 'Bash', input: { command: 'echo synthetic motion' } }] } }) + '\n');
  await app.ingest.sync(recordingId);
  const operation = page.locator('article.op-shell');
  await expect(operation).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).independentArrivals)).toContain(`${recordingId}.independent-shell`);
  expect(await page.evaluate(() => (window as any).wheelMotionStates)).not.toContain('idle');
  expect(await page.locator('.history').evaluate(el => el.scrollTop)).toBe(top);
  await expect(page.getByRole('switch', { name: 'Automatically follow new work' })).toHaveAttribute('aria-checked', 'false');
});

test('connected action flow and agent switches replace tabs without inventing causal edges',async({page})=>{
  await page.goto(new URL('/?demo',server.launchUrl).href);
  await page.locator('.history').evaluate(el=>{el.scrollTop=0;});
  await expect(page.locator('.workspace-views')).toHaveCount(0);
  await page.locator('.station-agent-menu > summary').click();
  await expect(page.getByRole('switch',{name:'Filter by claude-opus-5 agent'})).toBeVisible();
  await page.getByRole('switch',{name:'Filter by claude-opus-5 agent'}).click();
  await expect(page.getByRole('switch',{name:'Filter by claude-opus-5 agent'})).toBeChecked();
  await page.getByRole('switch',{name:'Filter by claude-opus-5 agent'}).click();
  await page.getByRole('button',{name:'Show session folders',exact:true}).click();
  await page.setViewportSize({width:1600,height:1000});
  await expect(page.locator('.flow-connections > g > path')).not.toHaveCount(0);
  const routes = page.locator('.flow-connections > g > path');
  for (const route of await routes.all()) {
    await expect(route).toHaveCSS('fill', 'none');
    expect(await route.evaluate(el => getComputedStyle(el).stroke)).not.toBe('none');
  }

  await expect(page.locator('.flow-connections')).toContainText(/Recorded sequence|same-artifact/);
  const chrome = await page.locator('.history .op').evaluateAll(nodes => nodes.map(n => ({ error: n.classList.contains('st-error'), border: getComputedStyle(n).borderColor, header: getComputedStyle(n.querySelector('.op-head')!).backgroundColor })));
  expect(new Set(chrome.filter(n => !n.error).map(n => n.border)).size).toBe(1);
  expect(new Set(chrome.map(n => n.header)).size).toBe(1);
  expect(chrome.find(n => n.error)?.border).not.toBe(chrome.find(n => !n.error)?.border);

  if(process.env.DRISHYA_REVIEW_SHOTS==='1') {
    await page.getByRole('button',{name:'Show session folders',exact:true}).click();
    await expect(page.locator('.folder-explorer')).toHaveCSS('opacity', '1');
    await page.screenshot({path:resolve('.local/connected-materials.png')});
    await page.getByRole('button',{name:'Explore repository map',exact:true}).click();
    await page.screenshot({path:resolve('.local/connected-map.png')});
    await page.getByRole('button',{name:'Back to work'}).click();
    await page.getByRole('button',{name:'Show session folders',exact:true}).click();
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('a large repository groups spatial density and reveals files at the zoomed location', async ({ page }) => {
  await page.goto(server.launchUrl);
  await page.getByRole('button', { name: /Hierarchical map synthetic session/ }).click();
  await page.getByRole('complementary', { name: 'Session folders' }).getByRole('button', { name: /Enable workspace reading/ }).click();
  await page.getByRole('button', { name: 'Explore repository map', exact: true }).click();
  await expect.poll(() => page.locator('.map-group').count()).toBeGreaterThan(0);
  expect(await page.locator('.map-group').count()).toBeLessThan(48);
  await expect(page.locator('.map-legend')).toContainText('180 files');
  await expect(page.locator('.map')).toHaveAttribute('data-map-depth', 'spatial-3d');
  await page.evaluate(() => {
    const context = document.querySelector<HTMLCanvasElement>('[data-spatial-renderer]')!.getContext('webgl')!;
    const clear = context.clear.bind(context);
    (window as any).mapPaints = 0;
    context.clear = (...args: Parameters<WebGLRenderingContext['clear']>) => { (window as any).mapPaints++; clear(...args); };
  });
  await page.locator('.map-group').first().click();
  await expect.poll(() => page.evaluate(() => (window as any).mapPaints)).toBeGreaterThan(3);
  await page.mouse.move(0, 0);
  await page.waitForTimeout(450);
  const settledPaints = await page.evaluate(() => (window as any).mapPaints);
  await page.waitForTimeout(250);
  // One deferred graph/hover state commit may paint after the camera settles.
  // A perpetual animation loop would paint repeatedly during this quiet interval.
  expect(await page.evaluate(() => (window as any).mapPaints) - settledPaints).toBeLessThanOrEqual(1);
  await expect(page.getByRole('button', { name: /parent/ })).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Find a file on the map' }).fill('client/src/file0.ts');
  await page.getByRole('button', { name: 'client/src/file0.ts', exact: true }).click();
  await expect(page.locator('.map-tip')).toContainText('client/src/file0.ts');
  await page.getByRole('button', { name: 'Fit', exact: true }).click();
  await expect.poll(() => page.locator('.map-group').count()).toBeGreaterThan(0);
  expect(await page.locator('.map-group').count()).toBeLessThan(48);
  if (process.env.DRISHYA_REVIEW_SHOTS === '1') { await page.waitForTimeout(450); await page.screenshot({ path: resolve('.local/connected-grouped-map.png') }); }
});


test('long captured labels and inputs remain inside material allocations on desktop and mobile', async ({ page }) => {
  await page.route('**/demo/bundle.json', async route => {
    const response = await route.fetch(); const bundle = await response.json();
    for (const op of bundle.projection.operations) {
      op.title += ' ' + 'longCapturedIdentifier'.repeat(35);
      if (op.detail.kind === 'shell') op.detail.command += ' ' + 'longCapturedArgument'.repeat(50);
      if (op.detail.kind === 'mcp') op.detail.input = { capturedLongValue: 'longCapturedValue'.repeat(60) };
    }
    await route.fulfill({ response, json: bundle });
  });
  await page.goto(new URL('/?demo', server.launchUrl).href);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.locator('.history .op-head, .history .op-body').evaluateAll(nodes => nodes.filter(n => n.scrollWidth > n.clientWidth + 1).length)).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});


test('map file reading leaves a usable graph beside the bounded reader', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(server.launchUrl);
  await page.getByRole('button', { name: /Connected workspace synthetic session/ }).click();
  await page.getByRole('button', { name: 'Explore repository map', exact: true }).click();
  await page.getByRole('textbox', { name: 'Find a file on the map' }).fill('actual.ts');
  await page.locator('.map-matches').getByRole('button', { name: 'src/actual.ts', exact: true }).click();
  await page.getByRole('button', { name: 'Open recorded work on this file' }).click();
  const reader = page.getByRole('dialog', { name: 'Work on src/actual.ts' });
  await expect(reader).toContainText('recorded historical bytes');
  await expect(reader).toHaveClass(/map-reader/);
  const graph = await page.locator('.map').boundingBox();
  const reading = await reader.boundingBox();
  expect(graph!.x + graph!.width).toBeLessThan(reading!.x);
  await page.getByRole('button', { name: 'Zoom into repository' }).click();
  await reader.getByRole('button', { name: 'Close Work on src/actual.ts' }).focus();
  await page.keyboard.press('Escape');
  await expect(reader).toHaveCount(0);
  await expect(page.locator('.map')).toHaveClass(/exploring/);
});


test('compact native composer contains its decoration and narrow form without artificial scrollbars', async ({ page }) => {
  const root = join(dir, 'session-repository');
  const journal = join(dir, 'glass-proof.jsonl');
  const base = { sessionId: '77777777-7777-4777-8777-777777777777', cwd: root, timestamp: '2026-10-07T12:00:00Z' };
  writeFileSync(journal, [
    { ...base, type: 'user', uuid: 'glass-user', message: { role: 'user', content: 'Glass proof synthetic session' } },
    { ...base, type: 'assistant', uuid: 'glass-prose', message: { role: 'assistant', content: [{ type: 'text', text: Array.from({ length: 20 }, (_, n) => `Captured explanation ${n}: the source remains available as the developer reads earlier work. These paragraphs are actual synthetic journal content, not cloned overlay text or a fake backdrop.`).join('\n\n') }] } },
  ].map(row => JSON.stringify(row)).join('\n') + '\n');
  await app.ingest.importSource('claude-code', journal);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(server.launchUrl);
  await page.getByRole('button', { name: /Glass proof synthetic session/ }).click();
  const composer = page.getByRole('region', { name: 'Harness prompt' });
  await expect(composer).toBeVisible();
  const field = composer.locator('textarea');
  for (const value of ['', 'A short prompt', 'First line\nSecond line']) {
    await field.fill(value);
    await expect.poll(() => field.evaluate(el => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(0);
    expect(await field.evaluate(el => getComputedStyle(el).overflowY)).toBe('hidden');
  }
  await field.fill('');
  await page.locator('.history').dispatchEvent('wheel', { deltaY: -100 });
  await page.locator('.history').evaluate(el => { el.scrollTop = 300; });
  const glass = await composer.evaluate(el => {
    const box = el.getBoundingClientRect();
    const prose = document.querySelector('.prose')!.getBoundingClientRect();
    const history = document.querySelector('.history')!.getBoundingClientRect();
    return { worldBottom: history.bottom, composerBottom: box.bottom, opacity: getComputedStyle(el).opacity, background: getComputedStyle(el).backgroundColor, field: getComputedStyle(el.querySelector('textarea')!).backgroundColor, decoration: getComputedStyle(el, '::before').content, overflowX: el.scrollWidth - el.clientWidth, overflowY: el.scrollHeight - el.clientHeight, overlapping: prose.top < box.bottom && prose.bottom > box.top };
  });
  expect(glass.opacity).toBe('1');
  expect(glass.background).toMatch(/^rgb\(/);
  expect(glass.field).toBe('rgba(0, 0, 0, 0)');
  expect(glass.decoration).toBe('none');
  expect(glass.overflowX).toBe(0);
  expect(glass.overflowY).toBe(0);
  expect(glass.overlapping).toBe(true);
  expect(glass.worldBottom).toBeGreaterThanOrEqual(glass.composerBottom);
  if (process.env.DRISHYA_REVIEW_SHOTS === '1') await page.screenshot({ path: resolve('.local/native-composer-glass.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await composer.locator('textarea').fill('a-long-prompt-token-' .repeat(30));
  await expect.poll(() => composer.evaluate(el => el.scrollWidth - el.clientWidth)).toBe(0);
  await expect.poll(() => composer.evaluate(el => el.scrollHeight - el.clientHeight)).toBe(0);
  await field.fill('A prompt that wraps across a couple of lines in a narrow window but fits comfortably when the window is wider.');
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect.poll(() => field.evaluate(el => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(0);
  expect(await field.evaluate(el => getComputedStyle(el).overflowY)).toBe('hidden');
  await field.fill(Array.from({ length: 12 }, (_, i) => `Long prompt line ${i}`).join('\n'));
  await expect.poll(() => field.evaluate(el => el.scrollHeight - el.clientHeight)).toBeGreaterThan(0);
  expect(await field.evaluate(el => getComputedStyle(el).overflowY)).toBe('auto');

});

test('submission is visible before native output, exposed reasoning hands off to captured history', async ({ page }) => {
  await page.goto(server.launchUrl);
  await page.getByRole('button', { name: /Connected workspace synthetic session/ }).click();
  const composer = page.getByRole('region', { name: 'Harness prompt' });
  const enable = composer.getByRole('button', { name: 'Enable this workspace', exact: true });
  if (await enable.count()) await enable.click();
  await page.route('**/controller/prompt', async route => { await new Promise(resolve => setTimeout(resolve, 400)); await route.continue(); });
  await composer.getByRole('textbox').fill('THINK');
  await composer.getByRole('button', { name: 'Send prompt' }).click();
  await composer.getByRole('checkbox', { name: 'This session is idle in other clients' }).check();
  await composer.getByRole('button', { name: 'Confirm and send' }).click();
  const progress = page.getByRole('region', { name: 'Native turn progress' });
  await expect(progress).toContainText('Sending prompt');
  await expect(progress).toContainText('Thinking');
  await expect(progress).toContainText('Submitted here');
  await expect(progress).not.toContainText('Native exposed reasoning');
  await expect(progress).toContainText('Native exposed reasoning for the synthetic workspace.');
  await expect(composer.getByRole('textbox')).toHaveValue('');
  if (process.env.DRISHYA_REVIEW_SHOTS) await page.screenshot({ path: resolve('.local/native-thinking-review.png') });
  const journal = join(dir, 'session.jsonl');
  const id = (await app.ingest.importSource('claude-code', journal)).recordingId;
  const base = { sessionId: '55555555-5555-4555-8555-555555555555', cwd: join(dir, 'session-repository'), timestamp: '2026-10-08T12:00:00Z' };
  appendFileSync(journal, [
    { ...base, type: 'user', uuid: 'native-prompt-proof', message: { role: 'user', content: 'THINK' } },
    { ...base, type: 'assistant', uuid: 'native-thinking-proof', message: { role: 'assistant', content: [{ type: 'thinking', thinking: 'Native exposed reasoning for the synthetic workspace.' }] } },
  ].map(row => JSON.stringify(row)).join('\n') + '\n');
  await app.ingest.sync(id);
  await expect(progress).toHaveCount(0);
  await expect(page.locator('.prose-reasoning').filter({ hasText: 'Native exposed reasoning for the synthetic workspace.' })).toHaveCount(1);
});
