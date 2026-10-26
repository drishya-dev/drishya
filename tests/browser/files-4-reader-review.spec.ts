import {mkdtempSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {test,expect} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';

let dir:string,id:string,app:App,server:RunningServer;
test.beforeAll(async()=>{
 dir=mkdtempSync(join(tmpdir(),'drishya-files4-review-'));
 for(const folder of ['one','two']){mkdirSync(join(dir,folder));writeFileSync(join(dir,folder,'reading.ts'),Array.from({length:7000},(_,i)=>`export const reading${i+1} = "${i===0?'wide '.repeat(400):'value'}";`).join('\n'));}
 writeFileSync(join(dir,'empty.ts'),'');
 writeFileSync(join(dir,'notes.md'),'# Reader review\n\nA selectable **document** with `inline code`.\n\n| Name | Value |\n| --- | --- |\n| sample | one |\n\n```ts\nexport const sample = true;\n```\n');
 const journal=join(dir,'session.jsonl');writeFileSync(journal,[{type:'session_meta',payload:{id:'files4-review',cwd:dir}},{type:'response_item',payload:{type:'message',role:'user',content:[{type:'input_text',text:'Review these files'}]}},{type:'response_item',payload:{type:'message',role:'assistant',content:[{type:'output_text',text:'Captured response'}]}}].map(row=>JSON.stringify(row)).join('\n')+'\n');
 app=new App(join(dir,'data'));id=(await app.ingest.importSource('codex',journal)).recordingId;server=await startServer({app,port:0});
});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});}});
test.beforeEach(async({page})=>{
 await page.route('**/v1/working-locations',route=>route.request().method()==='GET'?route.fulfill({json:{version:1,sessions:[]}}):route.continue());
 await page.setViewportSize({width:1440,height:960});await page.goto(server.launchUrl);await page.locator('.home').waitFor();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
 await page.getByRole('button',{name:'Open developer workspace',exact:true}).click();const desk=page.getByRole('region',{name:'Developer workspace',exact:true}),grant=desk.getByRole('button',{name:'Approve workspace reading'});await grant.or(desk.getByRole('tablist')).waitFor();if(await grant.isVisible())await grant.click();
});

test('whole source, repeated line navigation, syntax, wrap and exact copy',async({page,context})=>{
 await context.grantPermissions(['clipboard-read','clipboard-write']);
 await page.getByRole('textbox',{name:'Find repository files',exact:true}).fill('one/reading.ts');await page.locator('[data-spine-path="one/reading.ts"]').click();
 const reader=page.getByRole('region',{name:'Workspace file one/reading.ts',exact:true}),body=reader.locator('.desk-code'),line=reader.getByRole('textbox',{name:'Go to line in one/reading.ts'});
 await expect(body).toBeVisible();await page.screenshot({path:'.local/files4-review-baseline.png'});
 expect(await body.locator('[data-source-line]').count()).toBeLessThan(100);await expect(body.locator('.tk-kw').first()).toHaveText('export');
 expect(await body.locator('.ln-tx').first().evaluate(node=>getComputedStyle(node).lineHeight)).toBe('22px');
 await line.fill('6900');await line.press('Enter');await expect(body.locator('[data-source-line="6900"]')).toBeVisible();
 await body.evaluate(node=>node.scrollTop=0);await expect(body.locator('[data-source-line="1"]')).toBeVisible();await line.press('Enter');await expect(body.locator('[data-source-line="6900"]')).toBeVisible();
 await reader.getByRole('searchbox').fill('reading6999');await reader.getByRole('searchbox').press('Enter');await expect(body.locator('[data-source-line="6999"]')).toBeVisible();
 await line.fill('1');await line.press('Enter');await reader.getByRole('button',{name:'Wrap',exact:true}).click();await expect(body.locator('[data-source-line="1"] .ln-tx')).toHaveCSS('white-space','pre-wrap');
 await reader.getByLabel('File actions for one/reading.ts',{exact:true}).press('Enter');await reader.getByRole('button',{name:'Copy file',exact:true}).click();expect(await page.evaluate(()=>navigator.clipboard.readText())).toContain('reading7000');
});

test('split panes keep toolbars within their own narrow allocation',async({page})=>{
 await page.getByRole('textbox',{name:'Find repository files',exact:true}).fill('one/reading.ts');await page.locator('[data-spine-path="one/reading.ts"]').click();
 const desk=page.getByRole('region',{name:'Developer workspace',exact:true});await desk.getByLabel('Workspace layout actions',{exact:true}).press('Enter');await desk.getByRole('button',{name:'Split view',exact:true}).click();
 await desk.locator('.desk-pane').nth(1).getByRole('button',{name:'Show files',exact:true}).click();await page.getByRole('textbox',{name:'Find repository files',exact:true}).fill('two/reading.ts');await page.locator('[data-spine-path="two/reading.ts"]').click();
 for(const width of [1440,900,600]){
  await page.setViewportSize({width,height:960});if(await page.getByRole('button',{name:'Minimize files',exact:true}).isVisible())await page.getByRole('button',{name:'Minimize files',exact:true}).click();
  const divider=desk.getByRole('separator',{name:'Resize workspace panes'});if(await divider.isVisible()){await divider.focus();await divider.press('Home');}
  for(const toolbar of await desk.locator('.desk-source-tools:visible').all())expect(await toolbar.evaluate(node=>node.scrollWidth-node.clientWidth),`toolbar at ${width}`).toBeLessThanOrEqual(1);
  expect(await desk.evaluate(node=>node.scrollWidth-node.clientWidth)).toBeLessThanOrEqual(1);
 }
});

test('Markdown/source, empty files, retained local drafts and peek return',async({page})=>{
 const desk=page.getByRole('region',{name:'Developer workspace',exact:true});
 for(const path of ['notes.md','empty.ts']){await page.getByRole('textbox',{name:'Find repository files',exact:true}).fill(path);await page.locator(`[data-spine-path="${path}"]`).click();}
 const empty=page.getByRole('region',{name:'Workspace file empty.ts',exact:true});await expect(empty.locator('.desk-code')).toBeVisible();await empty.getByRole('button',{name:'Edit file',exact:true}).click();await empty.getByRole('textbox',{name:'Local draft for empty.ts',exact:true}).fill('local draft only');await empty.getByRole('button',{name:'Read source',exact:true}).click();await expect(empty.locator('.desk-code')).not.toContainText('local draft only');await expect(empty.getByText('Draft retained',{exact:true})).toBeVisible();
 await desk.getByRole('tab',{name:'notes.md',exact:true}).click();const md=page.getByRole('region',{name:'Workspace file notes.md',exact:true});await expect(md.getByRole('heading',{name:'Reader review'})).toBeVisible();await md.getByRole('button',{name:'Source',exact:true}).click();await expect(md.locator('.desk-code')).toContainText('# Reader review');
 await desk.getByRole('button',{name:'Back to agent',exact:true}).click();await page.getByRole('textbox',{name:'Find repository files',exact:true}).fill('notes.md');await page.locator('[data-spine-path="notes.md"]').click();const peek=page.locator('.current-file-reader');await expect(peek).toBeVisible();await expect(peek.getByRole('heading',{name:'Reader review'})).toBeVisible();await peek.getByRole('button',{name:'Open in Workspace',exact:true}).click();await expect(peek).toHaveCount(0);await desk.getByRole('button',{name:'Back to agent',exact:true}).click();await expect(peek).toBeVisible();
});
