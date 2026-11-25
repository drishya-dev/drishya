import {mkdtempSync,writeFileSync,readFileSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {test,expect} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from './browser-server.ts';

let dir:string,id:string,app:App,server:RunningServer;
test.beforeAll(async()=>{
 dir=mkdtempSync(join(tmpdir(),'drishya-files4-review-'));
 for(const folder of ['one','two']){mkdirSync(join(dir,folder));writeFileSync(join(dir,folder,'reading.ts'),Array.from({length:7000},(_,i)=>`export const reading${i+1} = "${i===0?'wide '.repeat(400):'value'}";`).join('\n'));}
 writeFileSync(join(dir,'empty.ts'),'');
 writeFileSync(join(dir,'medium.ts'),Array.from({length:300},(_,i)=>`export const medium${i+1} = ${i+1};`).join('\n'));
 writeFileSync(join(dir,'notes.md'),'# Reader review\n\nA selectable **document** with `inline code`.\n\n| Name | Value |\n| --- | --- |\n| sample | one |\n\n```ts\nexport const sample = true;\n```\n');
 writeFileSync(join(dir,'long.md'),Array.from({length:6001},(_,i)=>`Document line ${i+1}`).join('\n'));
 const journal=join(dir,'session.jsonl');writeFileSync(journal,[{type:'session_meta',payload:{id:'files4-review',cwd:dir}},{type:'response_item',payload:{type:'message',role:'user',content:[{type:'input_text',text:'Review these files'}]}},{type:'response_item',payload:{type:'message',role:'assistant',content:[{type:'output_text',text:'Response'}]}}].map(row=>JSON.stringify(row)).join('\n')+'\n');
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
 await reader.getByLabel('File actions for one/reading.ts',{exact:true}).press('Enter');await reader.getByRole('button',{name:'Copy file',exact:true}).click();expect((await page.evaluate(()=>navigator.clipboard.readText())).replace(/\r\n/g,'\n')).toBe(readFileSync(join(dir,'one/reading.ts'),'utf8'));
});

test('split panes keep toolbars within their own narrow allocation',async({page})=>{
 await page.getByRole('textbox',{name:'Find repository files',exact:true}).fill('one/reading.ts');await page.locator('[data-spine-path="one/reading.ts"]').click();
 const desk=page.getByRole('region',{name:'Developer workspace',exact:true});await desk.getByLabel('Workspace layout actions',{exact:true}).press('Enter');await desk.getByRole('button',{name:'Split view',exact:true}).click();
 const second=desk.locator('.desk-pane').nth(1);await second.focus();const showFiles=second.getByRole('button',{name:'Show files',exact:true});if(await showFiles.isVisible())await showFiles.click();await page.getByRole('textbox',{name:'Find repository files',exact:true}).fill('two/reading.ts');await page.locator('[data-spine-path="two/reading.ts"]').click();
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

test('peek repeats one-match navigation, retains changed snapshots and resizes without losing its source',async({page})=>{
 const desk=page.getByRole('region',{name:'Developer workspace',exact:true});await desk.getByRole('button',{name:'Back to agent',exact:true}).click();await page.getByRole('textbox',{name:'Find repository files',exact:true}).fill('one/reading.ts');await page.locator('[data-spine-path="one/reading.ts"]').click();
 const peek=page.locator('.current-file-reader'),body=peek.locator('.current-file-code'),find=peek.getByRole('searchbox');await expect(body).toBeVisible();await find.fill('reading6900');await find.press('Enter');await expect(body.locator('[data-source-line="6900"]')).toBeVisible();await body.evaluate(node=>node.scrollTop=0);await expect(body.locator('[data-source-line="1"]')).toBeVisible();await find.press('Enter');await expect(body.locator('[data-source-line="6900"]')).toBeVisible();
 const before=readFileSync(join(dir,'one/reading.ts'));try{writeFileSync(join(dir,'one/reading.ts'),before.toString()+'\n// changed temporary fixture');await peek.getByRole('button',{name:'Refresh',exact:true}).click();await expect(peek.getByRole('region',{name:'Source version status'})).toBeVisible();await expect(peek.locator('footer')).toContainText('Retained snapshot');await peek.getByRole('button',{name:'Use latest',exact:true}).click();await expect(peek.locator('footer')).toContainText('On disk');}finally{writeFileSync(join(dir,'one/reading.ts'),before);}
 for(const [edge,dx,dy] of [['left',-40,0],['right',-20,0],['top',0,10],['bottom',0,-20]] as const){const before=(await peek.boundingBox())!,handle=(await peek.locator(`.edge-${edge}`).boundingBox())!;await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();await page.mouse.move(handle.x+handle.width/2+dx,handle.y+handle.height/2+dy,{steps:4});await page.mouse.up();const after=(await peek.boundingBox())!;expect(Math.abs((edge==='left'||edge==='right'?after.width-before.width:after.height-before.height)-(edge==='left'?-dx:edge==='top'?-dy:dx||dy))).toBeLessThan(2);}
 await peek.getByRole('button',{name:'Reset File reader window layout',exact:true}).click();await expect(find).toHaveValue('reading6900');
 for(const width of [900,600]){await page.setViewportSize({width,height:900});await expect(body).toBeVisible();await expect.poll(()=>peek.evaluate(node=>node.getBoundingClientRect().right)).toBeLessThanOrEqual(width);}
});

test('closing the selected workspace tab returns keyboard focus to the remaining file',async({page})=>{
 const desk=page.getByRole('region',{name:'Developer workspace',exact:true});for(const path of ['one/reading.ts','two/reading.ts']){await page.getByRole('textbox',{name:'Find repository files',exact:true}).fill(path);await page.locator(`[data-spine-path="${path}"]`).click();}
 const tabs=desk.getByRole('tablist');await expect(tabs.getByRole('tab',{selected:true})).toHaveAttribute('title',/^two\/reading.ts/);await desk.getByRole('button',{name:'Close workspace tab two/reading.ts',exact:true}).focus();await page.keyboard.press('Enter');await expect(tabs.getByRole('tab',{selected:true})).toBeFocused();await expect(tabs.getByRole('tab').locator('span').last()).toHaveText('reading.ts');
});

test('bounded Markdown fallback reaches the last source line and tab keys retain file identity',async({page})=>{
 const desk=page.getByRole('region',{name:'Developer workspace',exact:true});for(const path of ['one/reading.ts','two/reading.ts','long.md']){await page.getByRole('textbox',{name:'Find repository files',exact:true}).fill(path);await page.locator(`[data-spine-path="${path}"]`).click();}
 const reader=page.getByRole('region',{name:'Workspace file long.md',exact:true});await expect(reader.getByRole('status').filter({hasText:'5,000 lines'})).toBeVisible();await expect(reader.getByRole('button',{name:'Document',exact:true})).toBeDisabled();await expect(reader.locator('.desk-code')).toBeVisible();const line=reader.getByRole('textbox',{name:'Go to line in long.md'});await line.fill('6001');await line.press('Enter');await expect(reader.locator('[data-source-line="6001"]')).toBeVisible();
 const tabs=desk.getByRole('tablist'),selected=tabs.getByRole('tab',{selected:true});await selected.focus();await selected.press('Alt+Shift+ArrowLeft');await expect(tabs.getByRole('tab').nth(1)).toHaveAttribute('title',/^long.md/);await expect(selected).toBeFocused();await selected.press('Home');await expect(selected).toHaveAttribute('title',/^one\/reading.ts/);await selected.press('End');await expect(selected).toHaveAttribute('title',/^two\/reading.ts/);await expect(selected.locator('span').last()).toHaveText('reading.ts · two');
});

test('returning from a draft preserves deliberately scrolled source rather than its old line target',async({page})=>{
 await page.getByRole('textbox',{name:'Find repository files',exact:true}).fill('medium.ts');await page.locator('[data-spine-path="medium.ts"]').click();const reader=page.getByRole('region',{name:'Workspace file medium.ts',exact:true});
 await reader.getByRole('textbox',{name:'Go to line in medium.ts'}).fill('250');await reader.getByRole('textbox',{name:'Go to line in medium.ts'}).press('Enter');await expect(reader.locator('[data-source-line="250"]')).toBeVisible();await reader.locator('.desk-code').evaluate(node=>node.scrollTop=1000);await expect.poll(()=>reader.locator('.desk-code').evaluate(node=>node.scrollTop)).toBe(1000);
 await expect(reader.locator('.desk-code')).toHaveCSS('overflow-y','auto');
 await reader.getByRole('button',{name:'Edit file',exact:true}).click();await expect(reader.getByRole('textbox',{name:'Local draft for medium.ts',exact:true})).toBeVisible();await reader.getByRole('button',{name:'Read source',exact:true}).click();expect(await reader.locator('.desk-code').evaluate(node=>node.scrollTop)).toBe(1000);
});
