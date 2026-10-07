import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
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
  if(v.type==='control_request') send({type:'control_response',response:{subtype:'success',request_id:v.request_id,response:{}}});
  if(v.type==='user') {send({type:'system',subtype:'init',tools:['Read','Edit','mcp__docs__lookup']});send({type:'control_request',request_id:'one',request:{subtype:'can_use_tool',tool_name:'Edit',input:{file_path:'src/actual.ts',new_string:'export const value = 43;'}}});}
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

test('selected workspace folders read current files separately from the exact historical source',async({page})=>{
  await page.goto(server.launchUrl); await page.getByRole('button',{name:/Connected workspace synthetic session/}).click();
  const folder = page.getByRole('complementary',{name:'Session folders'});
  await expect(folder).toHaveCount(1);
  await expect(folder).toContainText('session-repository');
  await folder.getByRole('button',{name:/Enable workspace reading/}).click();
  await expect(folder.getByRole('button',{name:/Enable workspace reading/})).toHaveCount(0);
  await folder.getByRole('treeitem',{name:'actual.ts',exact:true}).click();
  const reader=page.getByRole('dialog',{name:'src/actual.ts',exact:true});
  await expect(reader).toContainText('Current disk · not a historical snapshot');
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
  await page.getByRole('button',{name:'Show session folders',exact:true}).click();
  await expect(folder).toHaveCount(1);
  await page.getByRole('button',{name:'Explore repository map',exact:true}).click();
  await expect(page.locator('.map-legend')).toContainText('2 files · 1 imports');
  await page.getByRole('button',{name:'Zoom into repository'}).click();
  await page.getByRole('button',{name:'Back to work'}).click();
  await expect(page.locator('.history')).toBeVisible();
});

test('the composer submits through the real API transport, handles one approval and keeps session ownership visible',async({page})=>{
  await page.goto(server.launchUrl); await page.getByRole('button',{name:/Connected workspace synthetic session/}).click();
  await expect(page.getByRole('textbox',{name:'Prompt for selected harness session'})).toBeVisible();
  const composer=page.getByRole('region',{name:'Harness prompt'});
  await expect(composer).toContainText('session-repository');
  const enable=composer.getByRole('button',{name:'Enable this workspace',exact:true});
  if (await enable.count()) await enable.click();
  await composer.getByRole('textbox',{name:'Prompt for selected harness session'}).fill('Please explain the selected workspace');
  await expect(composer.getByRole('button',{name:'Send prompt ↗'})).toBeDisabled();
  await composer.getByRole('checkbox',{name:'This session is idle in other clients'}).check();
  await composer.getByRole('button',{name:'Send prompt ↗'}).click();
  await expect(composer).toContainText('Edit · approval requested');
  await expect(page.locator('.runtime-tools')).toContainText('Available in connected runtime');
  await composer.getByRole('button',{name:'Allow once',exact:true}).click();
  await expect(composer.locator('.controller-receipt')).toContainText('completed');
  await composer.locator('.controller-receipt summary').click();
  await expect(composer).toContainText('Synthetic native transport completed the submitted prompt.');
  await expect(page.getByRole('complementary',{name:'Session folders'})).toHaveCount(1);
  if(process.env.DRISHYA_REVIEW_SHOTS==='1') await page.screenshot({path:resolve('.local/connected-composer.png')});
});

test('connected action flow and agent switches replace tabs without inventing causal edges',async({page})=>{
  await page.goto(new URL('/?demo',server.launchUrl).href);
  await page.locator('.history').evaluate(el=>{el.scrollTop=0;});
  await expect(page.locator('.workspace-views')).toHaveCount(0);
  await expect(page.getByRole('switch',{name:'Filter by claude-opus-5 agent'})).toBeVisible();
  await page.getByRole('switch',{name:'Filter by claude-opus-5 agent'}).click();
  await expect(page.getByRole('switch',{name:'Filter by claude-opus-5 agent'})).toBeChecked();
  await page.getByRole('switch',{name:'Filter by claude-opus-5 agent'}).click();
  await page.getByRole('button',{name:'Show session folders',exact:true}).click();
  await page.setViewportSize({width:1600,height:1000});
  await expect(page.locator('.flow-connections > path')).not.toHaveCount(0);
  await expect(page.locator('.flow-connections')).toContainText(/Recorded sequence|same-artifact/);
  if(process.env.DRISHYA_REVIEW_SHOTS==='1') {
    await page.getByRole('button',{name:'Show session folders',exact:true}).click();
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

test('a large repository starts with folder groups and drills into actual files instead of a node cloud', async ({ page }) => {
  await page.goto(server.launchUrl);
  await page.getByRole('button', { name: /Hierarchical map synthetic session/ }).click();
  await page.getByRole('complementary', { name: 'Session folders' }).getByRole('button', { name: /Enable workspace reading/ }).click();
  await page.getByRole('button', { name: 'Explore repository map', exact: true }).click();
  await expect(page.locator('.map-group')).toHaveCount(3);
  await expect(page.locator('.map-legend')).toContainText('180 files');
  await page.locator('.map-group').filter({ hasText: 'client' }).click();
  await expect(page.getByRole('button', { name: /client · parent/ })).toBeVisible();
  await expect(page.locator('.map-group')).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Find a file on the map' }).fill('client/src/file0.ts');
  await page.getByRole('button', { name: 'client/src/file0.ts', exact: true }).click();
  await expect(page.locator('.map-tip')).toContainText('client/src/file0.ts');
  await page.getByRole('button', { name: 'Fit', exact: true }).click();
  await expect(page.locator('.map-group')).toHaveCount(3);
  if (process.env.DRISHYA_REVIEW_SHOTS === '1') await page.screenshot({ path: resolve('.local/connected-grouped-map.png') });
});
