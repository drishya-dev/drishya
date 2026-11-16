import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { spawn } from 'node:child_process';
import { expect, test } from './legacy-test.ts';
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
    if(v.message.content==='QUESTION') {
      send({type:'control_request',request_id:'ask-native',request:{subtype:'can_use_tool',tool_name:'AskUserQuestion',input:{questions:[{question:'Which checks?',header:'Checks',multiSelect:true,options:[{label:'Unit tests',description:'Fast focused checks'},{label:'Typecheck',description:'Validate types'}]}]}}});return;
    }
    if(v.message.content === 'THINK') {
      send({type:'stream_event',event:{type:'content_block_start',index:0,content_block:{type:'thinking',thinking:''}}});
      send({type:'stream_event',event:{type:'content_block_delta',index:0,delta:{type:'thinking_delta',thinking:'Native exposed reasoning for the synthetic workspace.'}}});
      setTimeout(()=>{send({type:'stream_event',event:{type:'content_block_stop',index:0}});send({type:'result',is_error:false});},900);
      return;
    }
    send({type:'system',subtype:'init',tools:['Read','Edit','mcp__docs__lookup',...Array.from({length:90},(_,n)=>'mcp__synthetic__tool'+n)]});send({type:'control_request',request_id:'one',request:{subtype:'can_use_tool',tool_name:'Edit',input:{file_path:'src/actual.ts',new_string:'export const value = 43;'}}});}
  if(v.type==='control_response')send({type:'result',is_error:false,result:v.response.request_id==='ask-native'?JSON.stringify(v.response.response.updatedInput.answers):'Synthetic native transport completed the submitted prompt.'});
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

async function openComposer(page:import('@playwright/test').Page){
  const composer=page.getByRole('region',{name:'Harness prompt'});
  await expect(composer).toBeVisible();
  const expand=composer.getByRole('button',{name:'Expand prompt',exact:true});
  if(await expand.count())await expand.click();
  const location=composer.locator('.modern-composer-location');if(await location.count())await expect(location).not.toContainText(/Checking/);
}

test('Modern native workspace connects its composer, attachments, approval and evidence readers', async ({ page }) => {
  await page.goto(new URL('/?experience=modern', server.launchUrl).href + new URL(server.launchUrl).hash);
  await page.locator('.mh-session-open').filter({hasText:'Connected workspace synthetic session'}).click();await openComposer(page);
  await expect(page.locator('.studio-header')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Agents' })).toHaveCount(0);
  const composer = page.getByRole('region', { name: 'Harness prompt' });
  await composer.getByRole('button', { name: 'Enable this workspace', exact: true }).click();
  await expect(composer.getByRole('button', { name: 'Attach', exact:true })).toBeEnabled();
  await composer.locator('input[aria-label="Choose prompt files"]').setInputFiles({ name: 'source.ts', mimeType: 'text/plain', buffer: Buffer.from('export const attached = true;') });
  await composer.getByRole('textbox', { name: 'Prompt for selected harness session' }).fill('Review the source attachment');
  await composer.getByRole('button', { name: 'Send prompt', exact: true }).click();
  await composer.getByRole('checkbox', { name: 'This session is idle in other clients' }).check();
  await composer.getByRole('button', { name: 'Confirm and send', exact: true }).click();
  await expect(composer).toContainText('Edit · approval requested');
  await expect(composer.locator('.attachment-chip')).toHaveCount(0);
  await composer.getByRole('button', { name: 'Allow once', exact: true }).click();
  await expect(composer.getByRole('button', { name: 'Send prompt', exact: true })).toBeVisible();
  await page.locator('.modern-toolbox').getByText('Run tools',{exact:true}).click();
  await expect(page.locator('.md-runtime-tool').first()).toHaveText('Read');
  const folders = page.getByRole('complementary', { name: 'Repository files' });
  if(!await folders.isVisible())await page.getByRole('button', { name: 'Show files' }).click();
  await folders.getByRole('treeitem', { name: 'src', exact: true }).click();await folders.getByRole('treeitem', { name: 'actual.ts', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'src/actual.ts', exact: true })).toContainText('fromSelectedWorkspace');
});

for(const version of ['modern']) test(`${version}: current source reading finds, navigates and wraps bounded disk pages without replacing evidence`, async ({ page }) => {
  const target=new URL(server.launchUrl);target.searchParams.set('experience',version);
  await page.goto(target.href);
  // Home also lists sessions discovered on this machine and pages long lists, so a fixture dated in the past may sit
  // beyond the first page; find it the way a reader would.
  await page.getByRole('textbox',{name:'Find sessions'}).fill('Connected workspace synthetic session');
  const session=page.locator('.mh-session-open').filter({hasText:'Connected workspace synthetic session'});
  await session.click();
  const folders = page.getByRole('complementary', { name: 'Repository files' });
  const enable = folders.getByRole('button', { name: /Enable workspace reading/ });
  await expect(folders).not.toHaveAttribute('data-reading-access','checking');
  if (await enable.count()) {await enable.click();await expect(folders.locator('.workspace-grant')).toHaveCount(0);}
  await folders.getByRole('treeitem', { name: 'src', exact: true }).click();await folders.getByRole('treeitem', { name: 'actual.ts', exact: true }).click();
  const reader = page.getByRole('dialog', { name: 'src/actual.ts', exact: true });
  await page.screenshot({path:resolve('.local/current-reader-check.png')});
  await expect(reader).toBeVisible();
  if(version==='classic') {   // Modern windows resize from their edges (covered by the reading-window journeys).
    const resize = reader.getByRole('separator', { name: 'Resize current source reading space' });
    await resize.press('ArrowLeft');
    await expect(resize).toHaveAttribute('aria-valuenow', '1072');
  }
  await reader.getByRole('textbox', { name: 'Go to current source line' }).fill('9999');
  await reader.getByRole('button', { name: 'Go to line', exact: true }).click();
  await expect(reader.locator('.source-go')).toContainText('251');
  await reader.getByRole('searchbox', { name: 'Find in current source file' }).fill('fromSelectedWorkspace');
  await expect(reader.locator('.source-find')).toContainText('1 matching line');
  await reader.getByRole('button', { name: 'Next match', exact: true }).click();
  await expect(reader.locator('[data-source-line="1"]')).toHaveAttribute('aria-current', 'location');
  await reader.getByRole('textbox', { name: 'Go to current source line' }).fill('205');
  await reader.getByRole('button', { name: 'Go to line', exact: true }).click();
  await expect(reader).toContainText('251 lines');
  await expect(reader.locator('[data-source-line="205"]')).toHaveAttribute('aria-current', 'location');
  await reader.getByRole('button', { name: 'Wrap lines', exact: true }).click();
  await expect(reader.locator('.current-file-code')).toHaveClass(/wrap-source/);
  for(const width of version==='modern'?[1440,390,320]:[]) {
    await page.setViewportSize({width,height:844});
    await expect.poll(()=>reader.evaluate(el=>el.querySelector('.current-file-code')!.getBoundingClientRect().height/el.getBoundingClientRect().height),{message:`${width}px reader source allocation`}).toBeGreaterThanOrEqual(width<=390?.62:.55);
    const allocation=await reader.evaluate(el=>({ratio:el.querySelector('.current-file-code')!.getBoundingClientRect().height/el.getBoundingClientRect().height,overflow:el.scrollWidth-el.clientWidth}));
    await page.screenshot({path:resolve(`.local/current-reader-${width}.png`),animations:'disabled'});
    expect(allocation.ratio,`${width}px: most of the current-file reader should remain source space`).toBeGreaterThanOrEqual(width<=390?.62:.55);
    expect(allocation.overflow).toBeLessThanOrEqual(1);
  }
  await page.setViewportSize({width:1440,height:900});
  await page.screenshot({ path: resolve('.local/source-reader-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  if(version==='modern')await reader.getByLabel('Reading options',{exact:true}).click();
  await expect(reader.getByRole('button', { name: 'Copy file' })).toBeVisible();
  const bounds = await reader.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: resolve('.local/source-reader-narrow.png') });
  await reader.getByRole('button', { name: 'Agent work on this file' }).click();
  const historical = page.getByRole('dialog', { name: 'Work on src/actual.ts' });
  await expect(historical).toContainText('recorded historical bytes');
  await expect(historical).not.toContainText('fromSelectedWorkspace');
});

// A reader remembers whether its import list was open, so reopening it must not toggle it shut.
const openImports=async(reader:import('@playwright/test').Locator)=>{const options=reader.getByLabel(/^File actions/);if(await options.count()&&!await reader.locator('.import-context').isVisible())await options.click();const imports=reader.locator('.import-context');if(!await imports.evaluate(node=>(node as HTMLDetailsElement).open))await imports.locator('summary').click();};

test('source reading links qualified current imports to a bounded map neighborhood', async ({ page }) => {
  await page.goto(server.launchUrl);
  await page.locator('.mh-session-open').filter({hasText:'Connected workspace synthetic session'}).click();await openComposer(page);
  await expect(page.locator('.modern-composer-location')).toBeVisible();
  await expect(page.locator('.modern-composer-location')).not.toContainText('Checking…');
  const folders = page.getByRole('complementary', { name: 'Repository files' });
  const enable = folders.getByRole('button', { name: /Enable workspace reading/ });
  await expect(page.locator('.modern-composer-location')).not.toContainText('Checking…');
  if (await enable.count()) await enable.click();
  await page.getByRole('button', { name: 'Explore repository map', exact: true }).click();
  const approve = page.getByRole('button', { name: 'Map the whole repository', exact: true });
  if (await approve.isVisible()) await approve.click();
  await expect(page.locator('.map-legend')).toContainText('2 files · 1 import');
  await page.getByRole('button', { name: 'Back to work' }).click();
  await folders.getByRole('treeitem', { name: 'src', exact: true }).click();await folders.getByRole('treeitem', { name: 'actual.ts', exact: true }).click();
  const peek=page.getByRole('dialog',{name:'src/actual.ts',exact:true});
  await peek.getByRole('button',{name:'Open in Workspace',exact:true}).click();
  const reader=page.getByRole('region',{name:'Workspace file src/actual.ts',exact:true});
  await openImports(reader);
  await expect(reader.locator('.import-context')).toContainText('Current index');
  await expect(reader.locator('.import-context')).toContainText('src/other.ts');
  await expect(reader.locator('.import-context')).toContainText('Imported by');
  await reader.getByRole('button',{name:'Read current file src/other.ts',exact:true}).click();
  const neighbor=page.getByRole('region',{name:'Workspace file src/other.ts',exact:true});
  await expect(neighbor).toContainText("import { fromSelectedWorkspace }");
  await page.locator('[data-workspace-tab$="src/actual.ts"]').getByRole('tab').click();
  await expect(reader).toContainText('fromSelectedWorkspace');
  await page.locator('[data-workspace-tab$="src/other.ts"]').getByRole('tab').click();
  await openImports(neighbor);
  await neighbor.getByRole('button',{name:'Read current file src/actual.ts',exact:true}).click();
  await openImports(reader);
  await reader.getByRole('button', { name: 'Focus on map' }).click();
  await expect(page.locator('.map')).toHaveAttribute('data-map-scope', 'direct-neighborhood');
  await expect(page.locator('.map-connections')).toContainText('src/actual.ts');
  await expect(page.locator('.map-legend')).toContainText('2 neighborhood files · 1 shown import');
  await expect.poll(async () => (await page.locator('.map-file-label').filter({ hasText: 'src/actual.ts' }).first().boundingBox())?.y ?? 0).toBeGreaterThan(250);
  await page.screenshot({ path: resolve('.local/feedback-neighborhood.png') });
  await page.getByRole('button', { name: 'Show full map', exact: true }).click();
  await expect(page.locator('.map')).toHaveAttribute('data-map-scope', 'all');
});

test('native model settings and attachment menus dismiss outside without detaching Follow', async ({ page }) => {
  await page.goto(server.launchUrl);
  await page.locator('.mh-session-open').filter({hasText:'Connected workspace synthetic session'}).click();await openComposer(page);
  const composer = page.getByRole('region', { name: 'Harness prompt' });
  await expect(page.locator('.modern-composer-location')).not.toContainText('Checking…');
  const enable = composer.getByRole('button', { name: 'Enable this workspace', exact: true });
  await expect(page.locator('.modern-composer-location')).not.toContainText('Checking…');
  if (await enable.count()) await enable.click();
  const follow = page.getByRole('switch', { name: 'Automatically follow new work' });
  const originalFollow = await follow.getAttribute('aria-checked');
  await composer.getByRole('button',{name:'Model',exact:true}).click();
  await composer.getByRole('menuitem',{name:/^Load model list/}).click();
  await composer.getByRole('button',{name:'Model',exact:true}).click();
  await composer.getByRole('menuitemradio',{name:'Synthetic model',exact:true}).click();
  await composer.getByRole('button',{name:'Reasoning effort',exact:true}).click();
  await composer.getByRole('menuitemradio',{name:'high',exact:true}).click();
  await composer.getByRole('button',{name:'Model',exact:true}).click();
  await page.mouse.click(page.viewportSize()!.width/2,15);
  await expect(composer.getByRole('menu',{name:'Model'})).toHaveCount(0);
  await expect(follow).toHaveAttribute('aria-checked',originalFollow!);
  const attach=composer.getByRole('button',{name:'Attach',exact:true});
  await attach.click();
  const attachments=composer.getByRole('menu',{name:'Attach',exact:true});
  await expect(attachments).toBeVisible();
  await attachments.getByRole('menuitem',{name:/^Images or files/}).focus();
  await page.keyboard.press('Escape');await expect(attachments).toHaveCount(0);await expect(attach).toBeFocused();
  await attach.click();await page.mouse.click(page.viewportSize()!.width/2,15);await expect(attachments).toHaveCount(0);
  const menu = page.locator('.workspace-menu');
  await menu.locator(':scope > summary').click();
  await page.mouse.click(page.viewportSize()!.width/2,15);
  await expect(menu).not.toHaveAttribute('open', '');
});

test('selected workspace folders read current files separately from the exact historical source',async({page})=>{
  await page.goto(server.launchUrl); await page.locator('.mh-session-open').filter({hasText:'Connected workspace synthetic session'}).click();await openComposer(page);
  const folder = page.getByRole('complementary',{name:'Repository files'});
  await expect(folder).toHaveCount(1);
  await expect(folder).toContainText('session-repository');
  await expect(page.getByRole('group', { name: 'Agents' })).toHaveCount(0);
  await expect(page.locator('.history-transport .prompt-menu')).toHaveCount(0);
  // Modern allocates the canvas between unequal side docks; Legacy's exact viewport-centre check is retired.
  await expect(page.locator('.history-inner')).toBeVisible();
  const folderBox = await folder.boundingBox();
  expect(folderBox!.height).toBeGreaterThan(0);
  expect(folderBox!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await expect(page.locator('.passage-agent')).toHaveCount(0);

  const enableReading = folder.getByRole('button',{name:/Enable workspace reading/});
  if (await enableReading.count()) await enableReading.click();
  await expect(folder.getByRole('button',{name:/Enable workspace reading/})).toHaveCount(0);
  await folder.getByRole('treeitem',{name:'src',exact:true}).click();await folder.getByRole('treeitem',{name:'actual.ts',exact:true}).click();
  const reader=page.getByRole('dialog',{name:'src/actual.ts',exact:true});
  await expect(reader.locator('footer')).toContainText('On disk');
  await expect(reader).toContainText('fromSelectedWorkspace');
  await expect(reader).not.toContainText('recorded historical bytes');
  await reader.getByRole('textbox',{name:'Go to current source line'}).fill('205');await reader.getByRole('button',{name:'Go to line',exact:true}).click();
  await expect(reader).toContainText('251 lines');
  await reader.getByRole('button',{name:'Agent work on this file'}).click();
  const historical=page.getByRole('dialog',{name:'Work on src/actual.ts'});
  await expect(historical).toContainText('recorded historical bytes');
  await expect(historical).not.toContainText('fromSelectedWorkspace');
  await historical.getByRole('button',{name:'Close Work on src/actual.ts'}).click();
  await page.getByRole('button',{name:'Show files',exact:true}).click();
  await expect(folder).toHaveCount(0);
  await page.getByRole('button',{name:'Show files',exact:true}).click();
  await expect(folder).toHaveCount(1);
  await page.getByRole('button',{name:'Explore repository map',exact:true}).click();
  await expect(page.locator('.map-legend')).toContainText('2 files · 1 import');
  await page.getByRole('button',{name:'Zoom into repository'}).click();
  await page.getByRole('button',{name:'Back to work'}).click();
  await expect(page.locator('.history')).toBeVisible();
});

test('composer attaches code and pasted screenshots, removes chips and sends them through the native API', async ({ page }) => {
  await page.goto(server.launchUrl); await page.locator('.mh-session-open').filter({hasText:'Connected workspace synthetic session'}).click();await openComposer(page);
  const composer = page.getByRole('region', { name: 'Harness prompt' });
  const enable = composer.getByRole('button', { name: 'Enable this workspace', exact: true });
  await expect(page.locator('.modern-composer-location')).not.toContainText('Checking…');
  if (await enable.count()) await enable.click();
  // The real picker is unavailable while workspace consent is being refreshed.
  await expect(composer.getByRole('button', { name: 'Attach', exact:true })).toBeEnabled();
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
  await expect(composer.getByRole('button', { name: 'Send prompt', exact: true })).toBeEnabled();
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
  await page.goto(server.launchUrl); await page.locator('.mh-session-open').filter({hasText:'Connected workspace synthetic session'}).click();await openComposer(page);
  await expect(page.getByRole('textbox',{name:'Prompt for selected harness session'})).toBeVisible();
  const composer=page.getByRole('region',{name:'Harness prompt'});
  await expect(composer).toContainText('session-repository');
  const box = await composer.boundingBox();
  expect(Math.abs(box!.x + box!.width / 2 - page.viewportSize()!.width / 2)).toBeLessThan(2);
  await expect(composer.getByRole('button', { name: 'Attach', exact:true })).toBeEnabled();

  const enable=composer.getByRole('button',{name:'Enable this workspace',exact:true});
  await expect(page.locator('.modern-composer-location')).not.toContainText('Checking…');
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
  await expect(promptInput).toBeEnabled();
  await promptInput.fill('Draft the next turn without sending it');
  await promptInput.press('Enter');
  await expect(composer.locator('.tool-approval')).toHaveCount(1);
  await expect(promptInput).toHaveValue('Draft the next turn without sending it');
  await page.locator('.modern-toolbox').getByText('Run tools',{exact:true}).click();
  await expect(page.locator('.md-runtime-tool').first()).toHaveText('Read');
  const inventory=page.locator('.modern-toolbox .md-server').filter({has:page.getByText('Run tools',{exact:true})});
  await expect(inventory).toHaveAttribute('open', '');
  await inventory.getByRole('region',{name:'Available runtime tools'}).evaluate(el=>el.scrollTop=el.scrollHeight);
  await expect(inventory.locator('summary')).toBeInViewport();
  await inventory.locator('summary').click();
  await composer.getByRole('button',{name:'Allow once',exact:true}).click();
  await expect(composer.getByRole('button', { name: 'Send prompt', exact: true })).toBeVisible();
  await expect(composer.locator('.controller-receipt')).toHaveCount(0);
  await expect(composer).not.toContainText('Synthetic native transport completed the submitted prompt.');
  await expect(promptInput).toHaveValue('Draft the next turn without sending it');
  expect((await composer.boundingBox())!.height).toBeLessThan(150);
  await expect(page.getByRole('complementary',{name:'Repository files'})).toHaveCount(1);
  if(process.env.DRISHYA_REVIEW_SHOTS==='1') await page.screenshot({path:resolve('.local/connected-composer.png')});
});

test('composer text drafts survive returning to the same recording without persisting attachments', async ({ page }) => {
  await page.goto(server.launchUrl);
  await page.locator('.mh-session-open').filter({hasText:'Connected workspace synthetic session'}).click();await openComposer(page);
  const composer = page.getByRole('region', { name: 'Harness prompt' });
  const input = composer.getByRole('textbox', { name: 'Prompt for selected harness session' });
  await input.fill('Keep this local draft');
  await expect(composer.locator('.modern-composer-location')).toContainText('session-repository');
  await expect(composer.locator('.modern-composer-identity')).toHaveAttribute('title',/Recording:/);
  // Measure both edges in one frame while the composer may still be expanding.
  const gap = await composer.evaluate(el => {
    const field = el.querySelector('textarea')!.getBoundingClientRect();
    const add = el.querySelector('[aria-label="Attach"]')!.getBoundingClientRect();
    return add.top - field.bottom;
  });
  expect(gap).toBeGreaterThanOrEqual(0);
  await page.getByRole('button', { name: 'Drishya', exact: true }).click();
  await page.locator('.mh-session-open').filter({hasText:'Connected workspace synthetic session'}).click();await openComposer(page);
  await expect(input).toHaveValue('Keep this local draft');
  await expect(composer.locator('.prompt-attachments')).toHaveCount(0);
  await page.screenshot({ path: resolve('.local/professional-composer.png') });
});

test('visible new material animates with Follow off without moving the reading position', async ({ page }) => {
  const root = join(dir, 'session-repository');
  const journal = join(dir, 'independent-motion.jsonl');
  const base = { sessionId: '88888888-8888-4888-8888-888888888888', cwd: root, timestamp: '2026-10-08T12:00:00Z' };
  writeFileSync(journal, JSON.stringify({ ...base, type: 'user', uuid: 'motion-user', message: { role: 'user', content: 'Independent motion synthetic session' } }) + '\n');
  const { recordingId } = await app.ingest.importSource('claude-code', journal);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(server.launchUrl);
  await page.locator('.mh-session-open').filter({hasText:'Independent motion synthetic session'}).click();await openComposer(page);
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
  await page.locator('.md-agents > summary').click();
  await expect(page.getByRole('switch',{name:'Filter by claude-opus-5 agent'})).toBeVisible();
  await page.getByRole('switch',{name:'Filter by claude-opus-5 agent'}).click();
  await expect(page.getByRole('switch',{name:'Filter by claude-opus-5 agent'})).toBeChecked();
  await page.getByRole('switch',{name:'Filter by claude-opus-5 agent'}).click();
  await page.getByRole('button',{name:'Show files',exact:true}).click();
  await page.setViewportSize({width:1600,height:1000});
  await expect(page.locator('.flow-connections > g > path')).not.toHaveCount(0);
  const routes = page.locator('.flow-connections > g > path');
  for (const route of await routes.all()) {
    await expect(route).toHaveCSS('fill', 'none');
    expect(await route.evaluate(el => getComputedStyle(el).stroke)).not.toBe('none');
  }

  await expect(page.locator('.flow-connections')).toContainText(/Order, not a causal link|same-artifact/);
  const chrome = await page.locator('.history .op').evaluateAll(nodes => nodes.map(n => ({ error: n.classList.contains('st-error'), border: getComputedStyle(n).borderColor, header: getComputedStyle(n.querySelector('.op-head')!).backgroundColor })));
  expect(new Set(chrome.filter(n => !n.error).map(n => n.border)).size).toBe(1);
  expect(new Set(chrome.map(n => n.header)).size).toBe(1);
  expect(chrome.find(n => n.error)?.border).not.toBe(chrome.find(n => !n.error)?.border);

  if(process.env.DRISHYA_REVIEW_SHOTS==='1') {
    await page.getByRole('button',{name:'Show files',exact:true}).click();
    await expect(page.locator('.folder-explorer')).toHaveCSS('opacity', '1');
    await page.screenshot({path:resolve('.local/connected-materials.png')});
    await page.getByRole('button',{name:'Explore repository map',exact:true}).click();
    await page.screenshot({path:resolve('.local/connected-map.png')});
    await page.getByRole('button',{name:'Back to work'}).click();
    await page.getByRole('button',{name:'Show files',exact:true}).click();
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('a large repository groups spatial density and reveals files at the zoomed location', async ({ page }) => {
  await page.goto(server.launchUrl);
  await page.locator('.mh-session-open').filter({hasText:'Hierarchical map synthetic session'}).click();await openComposer(page);
  await page.getByRole('complementary', { name: 'Repository files' }).getByRole('button', { name: /Enable workspace reading/ }).click();
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
  await page.getByRole('textbox', { name: 'Find a file on the map' }).fill('client/src/file0.ts');
  const match=page.locator('.map-matches').getByRole('button',{name:'client/src/file0.ts',exact:true});
  const bounds=(await match.boundingBox())!;
  await page.locator('.map-group').first().evaluate(node=>node.setAttribute('data-overlap-check',''));
  await page.addStyleTag({content:`.map-group[data-overlap-check]{position:fixed!important;left:${bounds.x}px!important;top:${bounds.y}px!important;width:${bounds.width}px!important;height:${bounds.height}px!important;opacity:1!important;}`});
  expect(await match.evaluate(node=>{const rect=node.getBoundingClientRect();return node.contains(document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2));}),'Search results must own clicks even when a spatial label crosses them').toBe(true);
  await match.click();await expect(page.locator('.map-tip')).toContainText('client/src/file0.ts');
  if (process.env.DRISHYA_REVIEW_SHOTS === '1') { await page.waitForTimeout(450); await page.screenshot({ path: resolve('.local/connected-grouped-map.png') }); }
});


test('long labels and inputs remain inside material allocations on desktop and mobile', async ({ page }) => {
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
  await page.locator('.mh-session-open').filter({hasText:'Connected workspace synthetic session'}).click();await openComposer(page);
  await page.getByRole('button', { name: 'Explore repository map', exact: true }).click();
  await page.getByRole('textbox', { name: 'Find a file on the map' }).fill('actual.ts');
  await page.locator('.map-matches').getByRole('button', { name: 'src/actual.ts', exact: true }).click();
  const selectedPoint = page.locator('.map-origin-point[data-origin-file="src/actual.ts"]');
  await expect(selectedPoint).toHaveAttribute('data-origin-visible', 'true');
  await expect.poll(async () => { const point = (await selectedPoint.boundingBox())!, world = (await page.locator('.map').boundingBox())!; return Math.round((point.x + point.width / 2 - world.x) / world.width * 100); }).toBe(50);
  await page.getByRole('button', { name: 'Open agent work on this file' }).click();
  const reader = page.getByRole('dialog', { name: 'Work on src/actual.ts' });
  await expect(reader).toContainText('recorded historical bytes');
  await expect(reader).toHaveClass(/map-reader/);
  const graph = await page.locator('.map').boundingBox();
  const reading = await reader.boundingBox();
  expect(graph!.x + graph!.width).toBeLessThan(reading!.x);
  await expect(selectedPoint).toHaveAttribute('data-origin-visible', 'true');
  await expect.poll(async () => { const point = (await selectedPoint.boundingBox())!, world = (await page.locator('.map').boundingBox())!; return Math.round((point.x + point.width / 2 - world.x) / world.width * 100); }).toBe(50);
  await page.getByRole('button', { name: 'Zoom into repository' }).click();
  await reader.getByRole('button', { name: 'Close Work on src/actual.ts' }).focus();
  await page.keyboard.press('Escape');
  await expect(reader).toHaveCount(0);
  await expect(page.locator('.map')).toHaveClass(/exploring/);
});


test('a recording without a workspace has a compact read-only state instead of dead prompt controls', async ({ page }) => {
  const journal = join(dir, 'no-workspace.jsonl');
  writeFileSync(journal, JSON.stringify({ type: 'user', uuid: 'no-workspace-user', sessionId: '99999999-9999-4999-8999-999999999999', message: { role: 'user', content: 'Recording without workspace' } }) + '\n');
  await app.ingest.importSource('claude-code', journal);
  await page.goto(server.launchUrl);
  await page.locator('.mh-session-open').filter({hasText:'Recording without workspace'}).click();await openComposer(page);
  const composer = page.getByRole('region', { name: 'Harness prompt' });
  await expect(composer).toContainText('Read-only here');
  await expect(composer.locator('textarea')).toHaveCount(0);
  await expect(composer.getByRole('button', { name: 'Send prompt' })).toHaveCount(0);
  await composer.getByRole('button', { name: 'Choose session' }).click();
  await expect(page.locator('.home')).toBeVisible();
});

test('compact native composer contains its decoration and narrow form without artificial scrollbars', async ({ page }) => {
  const root = join(dir, 'session-repository');
  const journal = join(dir, 'glass-proof.jsonl');
  const base = { sessionId: '77777777-7777-4777-8777-777777777777', cwd: root, timestamp: '2026-10-07T12:00:00Z' };
  writeFileSync(journal, [
    { ...base, type: 'user', uuid: 'glass-user', message: { role: 'user', content: 'Glass proof synthetic session' } },
    { ...base, type: 'assistant', uuid: 'glass-prose', message: { role: 'assistant', content: [{ type: 'text', text: Array.from({ length: 20 }, (_, n) => `Explanation ${n}: the source remains available as the developer reads earlier work. These paragraphs are actual synthetic journal content, not cloned overlay text or a fake backdrop.`).join('\n\n') }] } },
  ].map(row => JSON.stringify(row)).join('\n') + '\n');
  await app.ingest.importSource('claude-code', journal);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(server.launchUrl);
  await page.locator('.mh-session-open').filter({hasText:'Glass proof synthetic session'}).click();await openComposer(page);
  const composer = page.getByRole('region', { name: 'Harness prompt' });
  await expect(composer).toBeVisible();
  const field = composer.locator('textarea');
  await field.click();
  expect(await field.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('none');
  expect(await field.evaluate(el => getComputedStyle(el).borderTopWidth)).toBe('0px');
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
  expect(glass.background).toMatch(/^(?:rgba?\(|color\(srgb)/);
  expect(glass.background).not.toBe('rgba(0, 0, 0, 0)');
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

test('submission is visible before native output, exposed reasoning hands off to history', async ({ page }) => {
  await page.goto(server.launchUrl);
  await page.locator('.mh-session-open').filter({hasText:'Connected workspace synthetic session'}).click();await openComposer(page);
  const composer = page.getByRole('region', { name: 'Harness prompt' });
  const enable = composer.getByRole('button', { name: 'Enable this workspace', exact: true });
  await expect(page.locator('.modern-composer-location')).not.toContainText('Checking…');
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

test('Claude questions use the real local answer endpoint and preserve ordinary permission controls',async({page})=>{
  await page.goto(server.launchUrl);await page.locator('.mh-session-open').filter({hasText:'Connected workspace synthetic session'}).click();await openComposer(page);
  const composer=page.getByRole('region',{name:'Harness prompt'});
  await expect(page.locator('.modern-composer-location')).not.toContainText('Checking…');
  const grant=composer.getByRole('button',{name:'Enable this workspace',exact:true});if(await grant.count())await grant.click();
  await composer.getByRole('textbox',{name:'Prompt for selected harness session'}).fill('QUESTION');
  await composer.getByRole('button',{name:'Send prompt',exact:true}).click();
  await composer.getByRole('checkbox',{name:'This session is idle in other clients'}).check();await composer.getByRole('button',{name:'Confirm and send',exact:true}).click();
  const form=page.getByRole('form',{name:'Agent needs your input'});await expect(form).toBeVisible();
  await expect(composer.getByRole('button',{name:'Allow once',exact:true})).toHaveCount(0);
  await form.getByRole('checkbox',{name:/Unit tests/}).check();await form.getByRole('checkbox',{name:/Typecheck/}).check();
  await form.getByRole('button',{name:'Send answer',exact:true}).click();await expect(form).toHaveCount(0);
  const id=decodeURIComponent(new URL(page.url()).hash.slice(4));
  const status=await (await page.request.get(`${server.url}/v1/recordings/${id}/controller`)).json();
  expect(status.state).toBe('completed');expect(status.output).toContain('Unit tests, Typecheck');
  expect((await page.request.post(`${server.url}/v1/recordings/${id}/controller/answer`,{data:{runId:status.runId,requestId:'already-gone',answers:{}}})).status()).toBe(409);
});
