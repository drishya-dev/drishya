import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join,resolve,sep} from 'node:path';
import {test,expect} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
let dir:string,id:string,app:App,server:RunningServer;
const output=Array.from({length:70},(_,i)=>`ordinary output ${i}`).join('\n')+'\n'+'FAIL src/source.test.ts\n  at run (src/source.ts:2:1)\nsrc/source.ts(2,4): error TS100\nhttps://example.invalid/src/source.ts:9\n../outside.ts:2\nRunning 1 test using 1 worker\n  x 1 src/source.test.ts:2:1 › diagnostic preview\n  1 failed\n';
test.beforeAll(async()=>{
 dir=mkdtempSync(join(tmpdir(),'drishya-output-paths-'));const root=join(dir,'repo');mkdirSync(root);mkdirSync(join(root,'src'));writeFileSync(join(root,'src/source.ts'),'CURRENT DISK MUST NOT LOAD');
 const common={cwd:root,sessionId:'output-paths',timestamp:'2026-10-20T10:00:00Z'};
 const rows=[
  {...common,type:'user',uuid:'u',message:{role:'user',content:'Inspect source and diagnostic navigation'}},
  {...common,type:'assistant',uuid:'read',message:{role:'assistant',content:[{type:'tool_use',id:'r',name:'Read',input:{file_path:join(root,'src/source.ts')}}]}},
  {...common,type:'user',uuid:'read-result',message:{role:'user',content:[{type:'tool_result',tool_use_id:'r',content:'1→export const captured=1;\n2→export const capturedSecond=2;'}]}},
  {...common,type:'assistant',uuid:'grep',message:{role:'assistant',content:[{type:'tool_use',id:'g',name:'Grep',input:{pattern:'capturedSecond',path:root,output_mode:'content','-n':true}}]}},
  {...common,type:'user',uuid:'grep-result',message:{role:'user',content:[{type:'tool_result',tool_use_id:'g',content:'src/source.ts:2:export const capturedSecond=2;'}]}},
  {...common,type:'assistant',uuid:'shell',message:{role:'assistant',content:[{type:'tool_use',id:'s',name:'Bash',input:{command:'check fixture'}}]}},
  {...common,type:'user',uuid:'shell-result',message:{role:'user',content:[{type:'tool_result',tool_use_id:'s',content:output}]}},
 ];const journal=join(dir,'session.jsonl');writeFileSync(journal,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');app=new App(join(dir,'store'));id=(await app.ingest.importSource('claude-code',journal)).recordingId;server=await startServer({app,port:0});
});
test.beforeEach(async({page})=>{let first=true;await page.route('**/v1/working-locations',async route=>{if(first&&route.request().method()==='GET'){first=false;await page.request.delete(route.request().url(),{headers:{'content-type':'application/json'}});}await route.continue();});});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});}});

test('diagnostic paths retain output, open captured ranges and keep disk separate',async({page})=>{
 const disk:string[]=[];page.on('request',request=>{if(/\/workspace\/(?:file|document|approve)/.test(request.url()))disk.push(request.url());});
 await page.goto(server.launchUrl);await page.locator('.home').waitFor();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
 const card=page.locator('article.op-shell');await card.locator('[data-expand-op]').click();const material=card.locator('.output').first();await expect(material).toHaveText(output);
 await expect(material.getByRole('button')).toHaveCount(4);
 const link=material.getByRole('button',{name:'Open captured work for src/source.ts at line 2',exact:true}).first();await link.focus();await link.press('Enter');
 let reader=page.getByRole('dialog',{name:'Work on src/source.ts',exact:true});await expect(reader).toContainText('capturedSecond');await expect(reader).not.toContainText('CURRENT DISK');expect(disk).toEqual([]);
 await page.keyboard.press('Escape');await material.getByRole('button',{name:'Open captured work for src/source.test.ts',exact:true}).click();
 reader=page.getByRole('dialog',{name:'Work on src/source.test.ts',exact:true});await expect(reader).toContainText('No matching captured actions');expect(disk).toEqual([]);await page.keyboard.press('Escape');
 await card.locator('.case-bar').first().click();const caseReader=page.getByRole('dialog',{name:'Captured test result',exact:true});await expect(caseReader.getByRole('button',{name:'Open captured work for src/source.test.ts at line 2',exact:true})).toBeVisible();await page.keyboard.press('Escape');
 const search=page.locator('article.op-search');await search.focus();await search.press('Enter');const inspector=page.getByRole('region',{name:'Operation detail'});await inspector.locator('.search-bead').click();
 reader=page.getByRole('dialog',{name:'Work on src/source.ts',exact:true});await expect(reader.getByRole('combobox',{name:'First evidence',exact:true})).toHaveValue(/\/search\/0$/);await expect(reader).toContainText('Exact captured search result');expect(disk).toEqual([]);
 for(const width of [1440,390,320]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);await page.screenshot({path:`.local/files2-output-reader-${width}.png`});}
});

test('library diagnostic locations load their owning recording before captured file evidence',async({page})=>{
 await page.goto(server.launchUrl);await page.locator('.home').waitFor();await page.evaluate(()=>window.dispatchEvent(new Event('drishya-search-library')));
 const search=page.getByRole('dialog',{name:'Search session evidence',exact:true});await search.getByRole('searchbox',{name:'Search all imported session evidence'}).fill('run');
 const link=search.getByRole('button',{name:'Open captured work for src/source.ts at line 2',exact:true}).first();await expect(link).toBeVisible();await link.click();
 await expect(search).toHaveCount(0);const reader=page.getByRole('dialog',{name:'Work on src/source.ts',exact:true});await expect(reader).toContainText('capturedSecond');await expect(reader).not.toContainText('CURRENT DISK');
});

test('recording search paths open evidence without replacing the observation jump',async({page})=>{
 await page.goto(server.launchUrl);await page.locator('.home').waitFor();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
 await page.getByRole('button',{name:'Search',exact:true}).click();const search=page.getByRole('dialog',{name:'Search this recording'});await search.getByRole('textbox').fill('source');
 await expect(search.locator('.search-hit').first()).toBeVisible();const path=search.getByRole('button',{name:'Open captured work for src/source.ts',exact:true}).first();await expect(path).toBeVisible();await path.click();
 await expect(page.getByRole('dialog',{name:'Work on src/source.ts',exact:true})).toContainText('capturedSecond');
});
