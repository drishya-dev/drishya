import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,sep} from 'node:path';
import {test,expect} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from './browser-server.ts';
let dir:string,app:App,server:RunningServer,id:string;
test.beforeAll(async()=>{
 dir=mkdtempSync(join(tmpdir(),'drishya-prose-links-'));const root=join(dir,'captured-root').replaceAll('\\','/');
 const common={cwd:root,sessionId:'prose-link-fixture',timestamp:'2026-10-20T10:00:00Z'};
 const rows=[
  {...common,type:'user',uuid:'u1',message:{role:'user',content:'Read the source and explain the change'}},
  {...common,type:'assistant',uuid:'a1',message:{role:'assistant',content:[{type:'tool_use',id:'r1',name:'Read',input:{file_path:`${root}/src/source.ts`}}]}},
  {...common,type:'user',uuid:'u2',message:{role:'user',content:[{type:'tool_result',tool_use_id:'r1',content:'1→export const capturedValue = 42;\n2→export const retainedEvidence = true;'}]}},
  {...common,type:'assistant',uuid:'search',message:{role:'assistant',content:[{type:'tool_use',id:'s1',name:'Grep',input:{pattern:'retainedEvidence',path:root,output_mode:'content','-n':true}}]}},
  {...common,type:'user',uuid:'search-result',message:{role:'user',content:[{type:'tool_result',tool_use_id:'s1',content:'src/source.ts:2:export const retainedEvidence = true;'}]}},
  {...common,type:'assistant',uuid:'edit',message:{role:'assistant',content:[{type:'tool_use',id:'e1',name:'Edit',input:{file_path:`${root}/src/source.ts`,old_string:'export const capturedValue = 42;',new_string:'export const capturedValue = 43;'}}]}},
  {...common,type:'user',uuid:'edit-result',message:{role:'user',content:[{type:'tool_result',tool_use_id:'e1',content:'File updated successfully.'}]}},
  {...common,type:'assistant',uuid:'write',message:{role:'assistant',content:[{type:'tool_use',id:'w1',name:'Write',input:{file_path:`${root}/src/new.ts`,content:'export const createdByWrite = true;'}}]}},
  {...common,type:'user',uuid:'write-result',message:{role:'user',content:[{type:'tool_result',tool_use_id:'w1',content:'File written successfully.'}]}},
  {...common,type:'assistant',uuid:'a2',message:{role:'assistant',content:[{type:'text',text:`See **[source](${root.startsWith('/')?'':'/'}${root}/src/source.ts#L2)**, [relative](src/source.ts:1), and \`src/source.ts:2\`. [web](https://example.invalid/src/source.ts) and [outside](${root}-other/secret.txt) stay separate.`}]}},
 ];
 const journal=join(dir,'session.jsonl');writeFileSync(journal,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');
 app=new App(join(dir,'store'));id=(await app.ingest.importSource('claude-code',journal)).recordingId;server=await startServer({app,port:0});
});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});}});

test('Modern reader keeps comparison and action history reachable without stacking secondary controls',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto(server.launchUrl);await page.locator('.home').waitFor();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
 await page.locator('.prose button.md-path').first().click();
 const reader=page.getByRole('dialog',{name:'Work on src/source.ts',exact:true}),options=reader.getByLabel('File actions',{exact:true});
 await expect(reader.locator('.file-workspace-layout')).toHaveClass(/trail-hidden/);
 await expect(reader).toContainText('retainedEvidence');
 await options.focus();await options.press('Enter');
 const show=reader.getByRole('button',{name:'Show actions',exact:true});await show.focus();await show.press('Enter');
 await expect(reader.getByRole('navigation',{name:'File action history'})).toBeVisible();
 await expect(reader.getByRole('button',{name:'Compare evidence',exact:true})).toBeEnabled();
 await reader.getByRole('button',{name:'Compare evidence',exact:true}).click();
 await expect(reader.getByRole('combobox',{name:'Second step',exact:true})).toBeVisible();
 await reader.getByRole('combobox',{name:'Second step',exact:true}).selectOption({index:1});
 await reader.getByRole('button',{name:'Single evidence',exact:true}).click();
 await expect(reader.getByRole('combobox',{name:'Second step',exact:true})).toHaveCount(0);
 await options.focus();await options.press('Enter');await page.keyboard.press('Escape');await expect(options).toBeFocused();await expect(reader).toBeVisible();
 for(const width of [1440,900,390,320]){
  await page.setViewportSize({width,height:844});
  await expect(reader.getByRole('combobox',{name:'First step',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({path:`.local/ui5-file-controls-${width}.png`});
 }
});

test('local prose links open exact source without current-file IO or browser navigation',async({page})=>{
 const diskRequests:string[]=[];page.on('request',request=>{if(/\/workspace\/(?:file|document|approve)/.test(request.url()))diskRequests.push(request.url());});
 await page.goto(server.launchUrl);await page.locator('.home').waitFor();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
 const local=page.locator('.prose button.md-path');await expect(local).toHaveCount(3);
 const url=page.url();
 for(const index of [0,1,2]){
  const link=local.nth(index);await link.focus();await page.keyboard.press('Enter');
  const reader=page.getByRole('dialog',{name:'Work on src/source.ts',exact:true});await expect(reader).toBeVisible();
  await expect(reader).toContainText('source.ts');
  await expect(reader).toContainText('capturedValue');
  await reader.getByLabel('File actions',{exact:true}).click();await expect(reader.getByRole('button',{name:'Enable workspace reading',exact:true})).toBeVisible();
  expect(page.url()).toBe(url);expect(diskRequests).toEqual([]);
  await reader.getByRole('button',{name:'Close Work on src/source.ts',exact:true}).click();await expect(reader).toHaveCount(0);
 }
 // LINK-1: a web address in prose is a real link that opens in a new tab; an outside path stays inert text.
 {const web=page.locator('.prose a.md-url').filter({hasText:'web'});await expect(web).toHaveCount(1);await expect(web).toHaveAttribute('target','_blank');await expect(web).toHaveAttribute('rel',/noopener/);}
 {const inert=page.locator('.prose span.md-link').filter({hasText:'outside'});await expect(inert).toHaveCount(1);await inert.click();expect(page.url()).toBe(url);}
 const card=page.locator('article.op-read');await card.locator('header button.captured-file-path').focus();await page.keyboard.press('Enter');
 let reader=page.getByRole('dialog',{name:'Work on src/source.ts',exact:true});await expect(reader.getByRole('combobox',{name:'First step',exact:true})).toHaveValue(/\/read$/);
 await page.keyboard.press('Escape');await expect(reader).toHaveCount(0);
 for(const kind of ['edit','write']){
  const file=kind==='edit'?'src/source.ts':'src/new.ts';const title=page.locator('article.op-edit header').getByRole('button',{name:`Open work on ${file}`,exact:true});await title.focus();await page.keyboard.press('Enter');
  reader=page.getByRole('dialog',{name:`Work on ${file}`,exact:true});await expect(reader).toBeVisible();
  await expect(reader).toContainText(kind==='edit'?'capturedValue':'createdByWrite');
  if(kind==='edit')await expect(reader.getByRole('combobox',{name:'First step',exact:true})).toHaveValue(/\/patch$/);
  await page.keyboard.press('Escape');await expect(reader).toHaveCount(0);
 }
 const search=page.locator('article.op-search');
 for(const expanded of [false,true]){
  if(expanded)await search.locator('[data-expand-op]').click();
  await search.locator('.search-bead').first().focus();await page.keyboard.press('Enter');
  reader=page.getByRole('dialog',{name:'Work on src/source.ts',exact:true});
  await expect(reader.getByRole('combobox',{name:'First step',exact:true})).toHaveValue(/\/search\/0$/);
  await expect(reader).toContainText('Exact search result');
  await expect(reader.locator('[data-source-line="2"]')).toContainText('retainedEvidence');
  await page.keyboard.press('Escape');await expect(reader).toHaveCount(0);
 }
 await page.setViewportSize({width:320,height:568});await local.first().click();
 await expect(page.getByRole('dialog',{name:'Work on src/source.ts',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(diskRequests).toEqual([]);
});
