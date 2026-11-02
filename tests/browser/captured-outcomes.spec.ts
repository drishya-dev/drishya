import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from './legacy-test.ts';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string, app: App, server: RunningServer;
test.beforeAll(async () => { dir = mkdtempSync(join(tmpdir(), 'drishya-outcomes-')); app = new App(dir); server = await startServer({ app, port: 0, token: 'synthetic-outcomes' }); });
test.afterAll(async () => { await server.close(); await app.close(); if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); });

test('wrapped test facts appear inside Shell, stay bounded and keep raw evidence available', async ({ page }) => {
  const sample = JSON.parse(readFileSync(resolve('apps/ui/public/demo/bundle.json'), 'utf8'));
  const op = sample.projection.operations.filter((item: { kind: string }) => item.kind === 'test').at(-1);
  op.kind = 'shell'; op.title = 'Run mixed checks';
  const raw = JSON.stringify([{ i: 0, value: { output: 'Test Files 46 passed (46)\nTests 100000 passed (100000)', exit_code: 0 } }, { i: 1, value: { output: 'Tests: 1 failed, 4 passed, 1 skipped, 6 total', exit_code: 1 } }, { i: 2, value: { output: '', exit_code: 0 } }]);
  op.detail = { kind: 'shell', command: 'captured mixed orchestration', outputPreview: raw, exitCode: 0 };
  op.artifactIds = [];
  await page.route('**/demo/bundle.json', route => route.fulfill({ json: sample }));
  await page.goto(new URL('/?demo&experience=classic', server.launchUrl).href);
  const card = page.locator(`article[data-op-id="${op.id}"]`);
  await expect(card).toHaveClass(/op-shell/);
  await expect(card).toContainText(`${await page.evaluate(()=>(100000).toLocaleString())} passed`);
  await expect(card).toContainText('Suites: 46 passed (46)');
  await expect(card).toContainText('1 failed');
  await expect(card.locator('.captured-outcomes > section')).toHaveCount(2);
  expect(await card.locator('.verification-tile').count()).toBeLessThan(80);
  await page.screenshot({ path: resolve('.local/wrapped-test-outcomes.png') });
  await card.getByRole('button', { name: /Expand/ }).click();
  await expect(card).toContainText('"exit_code":1');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('unverified edits and creations show an explained neutral mark instead of a question mark',async({page})=>{
  const timestamp='2026-10-18T00:00:00Z',patch='*** Begin Patch\n*** Add File: new.ts\n+export const value=1;\n*** Update File: old.ts\n@@\n-old\n+new\n*** End Patch';
  const path=join(dir,'unknown-patch.jsonl'),rows=[{timestamp,type:'session_meta',payload:{id:'unknown-patch',cwd:dir}},{timestamp,type:'response_item',payload:{type:'custom_tool_call',name:'exec',input:`text(await tools.apply_patch(${JSON.stringify(patch)}));`,call_id:'wrapped'}},{timestamp,type:'response_item',payload:{type:'custom_tool_call_output',call_id:'wrapped',output:'{}'}}];
  writeFileSync(path,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');const id=(await app.ingest.importSource('codex',path)).recordingId;
  await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
  const marks=page.locator('.op .state-unknown');await expect(marks).toHaveCount(2);
  for(const mark of await marks.all()){await expect(mark).toHaveText('—');await expect(mark).toHaveAttribute('aria-label','Change unverified');await expect(mark).toHaveAttribute('title',/does not expose/);}
});


test('native and MCP test bars preserve captured indices, support keyboard selection and keep raw output',async({page})=>{
 const vitest='   ✓ passes its captured check 12ms\n   × preserves the failed assertion 3ms\nAssertionError: expected true to be false\nTests 1 failed | 1 passed (2)';
 const tap='TAP version 13\nok 1 - first captured case\nnot ok 2 - second captured case\n  ---\n  message: captured assertion detail\n  ...\nok 3 - later case # SKIP pending\n# tests 3\n# pass 1\n# fail 1\n# skipped 1';
 for(const adapter of ['codex','claude-code']){
  const timestamp='2026-10-18T00:00:00Z',session=`bars-${adapter}`,source=join(dir,session+'.jsonl');
  const calls=[{name:adapter==='codex'?'exec_command':'Bash',input:adapter==='codex'?{cmd:'node test-runner.mjs'}:{command:'node test-runner.mjs'},output:vitest},{name:'mcp__checks__run',input:{suite:'captured'},output:JSON.stringify({content:[{type:'text',text:tap}]})}];
  const rows:unknown[]=adapter==='codex'?[{timestamp,type:'session_meta',payload:{id:session,cwd:dir}}]:[{timestamp,type:'user',uuid:'prompt',cwd:dir,sessionId:session,message:{role:'user',content:'Run captured checks'}}];
  for(const [index,call] of calls.entries()){
   const id=`case-${index}`;
   if(adapter==='codex')rows.push({timestamp,type:'response_item',payload:{type:'function_call',name:call.name,call_id:id,arguments:JSON.stringify(call.input)}},{timestamp,type:'response_item',payload:{type:'function_call_output',call_id:id,output:call.output}});
   else rows.push({timestamp,type:'assistant',cwd:dir,sessionId:session,uuid:`assistant-${index}`,message:{id:`message-${index}`,role:'assistant',content:[{type:'tool_use',id,name:call.name,input:call.input}]}},{timestamp,type:'user',cwd:dir,sessionId:session,uuid:`result-${index}`,message:{role:'user',content:[{type:'tool_result',tool_use_id:id,content:call.output}]}});
  }
  writeFileSync(source,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');const id=(await app.ingest.importSource(adapter,source)).recordingId;
  await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
  const native=page.locator('article.op').filter({hasText:'passes its captured check'}).first();await expect(native.locator('.case-bar')).toHaveCount(2);
  const failed=native.getByRole('button',{name:/Captured case: failed/});await failed.hover();await expect(native.locator('.case-peek')).toContainText('preserves the failed assertion');await failed.click();await expect(page.getByRole('region',{name:'Selected captured test result'})).toContainText('AssertionError: expected true to be false');
  await page.getByRole('button',{name:'Close Captured test result'}).click();await native.locator('.case-bar').first().focus();await page.keyboard.press('ArrowRight');await expect(failed).toBeFocused();await page.keyboard.press('Enter');await expect(page.getByRole('region',{name:'Selected captured test result'})).toBeVisible();
  await page.getByRole('button',{name:'Close Captured test result'}).click();
  const mcp=page.locator('article.op').filter({hasText:'first captured case'}).first();await expect(mcp.locator('.case-bar')).toHaveCount(3);await mcp.getByRole('button',{name:/Test 2: failed/}).click();await expect(page.getByRole('region',{name:'Selected captured test result'})).toContainText('captured assertion detail');
  for(const width of [1440,390,320]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);await page.screenshot({path:resolve(`.local/test-bars-${adapter}-${width}.png`)});}
  await page.getByRole('button',{name:'Close Captured test result'}).click();await expect(page.getByRole('region',{name:'Operation detail',exact:true})).toHaveCount(0);await page.setViewportSize({width:1440,height:900});await failed.click();await page.getByRole('button',{name:'Open full captured output'}).click();await expect(native.locator('.op-expanded')).toContainText('AssertionError: expected true to be false');
 }
});


test('clipped wrapped output and long TAP recover truthful summaries from bounded artifact reads',async({page})=>{
 const timestamp='2026-10-18T00:00:00Z',source=join(dir,'bounded-outcomes.jsonl');
 const wrapped=JSON.stringify({output:'captured setup log\n'.repeat(300)+'   ✓ recovered complete wrapped case 2ms\nTests 1 passed (1)',exit_code:0});
 const tap='TAP version 13\n'+Array.from({length:700},(_,i)=>`ok ${i+1} - captured case ${i+1}`).join('\n')+'\n# tests 700\n# pass 700\n# fail 0';
 const rows:unknown[]=[{timestamp,type:'session_meta',payload:{id:'bounded-test-outcomes',cwd:dir}}];
 for(const [index,output] of [wrapped,tap].entries())rows.push({timestamp,type:'response_item',payload:{type:'function_call',name:'exec_command',call_id:`bounded-${index}`,arguments:JSON.stringify({cmd:`node captured-${index}.mjs`})}},{timestamp,type:'response_item',payload:{type:'function_call_output',call_id:`bounded-${index}`,output}});
 writeFileSync(source,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');const id=(await app.ingest.importSource('codex',source)).recordingId;
 const requests:string[]=[];page.on('request',request=>{if(request.url().includes('/artifacts/'))requests.push(request.url());});
 await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
 const first=page.locator('article.op').filter({hasText:'captured-0.mjs'}).first();await expect(first.locator('.case-bar')).toHaveCount(1);await expect(first.locator('.case-bar')).toHaveAttribute('aria-label',/recovered complete wrapped case/);
 const second=page.locator('article.op').filter({hasText:'captured-1.mjs'}).first();await expect(second.locator('.captured-outcomes')).toContainText('700 passed');await expect(second.locator('.case-bar')).toHaveCount(0);await expect(second.locator('.captured-outcomes')).toContainText('earlier case rows are not mapped');
 expect(requests.length).toBeGreaterThan(0);expect(requests.every(url=>!new URL(url).searchParams.has('count')||Number(new URL(url).searchParams.get('count'))<=200)).toBe(true);
});
