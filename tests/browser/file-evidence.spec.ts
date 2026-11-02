import { appendFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';
import { fileEvidence } from '../../packages/scene/src/file-evidence.ts';
let app: App, server: RunningServer, dir: string, journal: string, id: string;
const base={sessionId:'files-evidence-browser',timestamp:'2026-10-20T10:00:00Z'};
const read=(n:number,result=true)=>[
  {...base,cwd:dir,type:'assistant',uuid:`a${n}`,message:{role:'assistant',content:[{type:'tool_use',id:`read${n}`,name:'Read',input:{file_path:join(dir,'src','read.ts')}}]}},
  ...(result?[{...base,cwd:dir,type:'user',uuid:`r${n}`,message:{role:'user',content:[{type:'tool_result',tool_use_id:`read${n}`,content:'1\texport const value = 1;'}]}}]:[]),
].map(row=>JSON.stringify(row)).join('\n')+'\n';
test.beforeAll(async()=>{
  dir=mkdtempSync(join(tmpdir(),'drishya-files1-'));mkdirSync(join(dir,'src'));writeFileSync(join(dir,'src','read.ts'),'export const value = 1;');writeFileSync(join(dir,'src','untouched.ts'),'// no activity');
  journal=join(dir,'source.jsonl');writeFileSync(journal,read(0)+read(1));app=new App(join(dir,'store'));id=(await app.ingest.importSource('claude-code',journal)).recordingId;
  server=await startServer({app,port:0});
});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir&&resolve(dir).startsWith(resolve(tmpdir())+sep))rmSync(dir,{recursive:true,force:true});});
async function open(page:Page,running:RunningServer,recordingId:string){
  await page.route('**/v1/working-locations',route=>route.request().method()==='GET'?route.fulfill({json:{version:1,sessions:[]}}):route.continue());
  await page.goto(running.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${running.url}/?experience=modern&motion=0#/r/${recordingId}`);await expect(page.locator('.viewer')).toBeVisible();
  if(!await page.locator('.folder-explorer').isVisible())await page.getByRole('button',{name:'Show files',exact:true}).click();
}
test('tree filters activity, preserves navigation and updates open calls and results',async({page})=>{
  await page.setViewportSize({width:1440,height:960});await open(page,server,id);
  const explorer=page.locator('.folder-explorer'),find=explorer.getByRole('textbox',{name:'Find repository files'});
  await explorer.getByRole('button',{name:/Enable workspace reading/}).click();
  await find.fill('src/');const row=explorer.locator('[data-spine-path="src/read.ts"]');
  await expect(row).toHaveAttribute('aria-description',/2 captured read calls/);await expect(explorer.locator('.file-reads,.folder-evidence')).toHaveCount(0);
  await expect(explorer.locator('[data-spine-path="src/untouched.ts"]')).toBeVisible();
  await explorer.getByLabel('File filters',{exact:true}).click();await explorer.getByRole('button',{name:'Touched',exact:true}).click();
  await expect(explorer.locator('[data-spine-path="src/untouched.ts"]')).toHaveCount(0);await expect(row).toBeVisible();
  await explorer.getByLabel('File filters',{exact:true}).click();await page.keyboard.press('Escape');await expect(explorer.locator('.tree-evidence-filter')).not.toHaveAttribute('open');await expect(explorer.getByLabel('File filters',{exact:true})).toBeFocused();
  await explorer.getByLabel('File filters',{exact:true}).click();await page.locator('.folder-root').click();await expect(explorer.locator('.tree-evidence-filter')).not.toHaveAttribute('open');
  await find.fill('');await expect(explorer.locator('[aria-description="1 file with activity"]')).toBeVisible();
  await find.fill('src/read.ts');await row.click();await expect(page.locator('.current-file-reader')).toBeVisible();await page.getByRole('button',{name:'Close src/read.ts',exact:true}).last().click();
  await app.ingest.startLive('claude-code',journal);await page.reload();await expect(explorer).toBeVisible();await find.fill('src/read.ts');
  appendFileSync(journal,read(2,false));await app.ingest.importSource('claude-code',journal);
  await expect(row).toHaveAttribute('aria-description',/3 captured read calls/);await expect(row.getByLabel('Open tool call',{exact:true})).toBeVisible();
  appendFileSync(journal,JSON.stringify({...base,cwd:dir,type:'user',uuid:'r2',message:{role:'user',content:[{type:'tool_result',tool_use_id:'read2',content:'1\texport const value = 1;'}]}})+'\n');await app.ingest.importSource('claude-code',journal);
  await expect(row.getByLabel('Open tool call',{exact:true})).toHaveCount(0);
  await page.screenshot({path:resolve('.local/files1-live.png')});
});
const actualStore=process.env.DRISHYA_REVIEW_STORE,actualIds=(process.env.DRISHYA_REVIEW_IDS??'').split(',').filter(Boolean);
test('actual dense Codex and Claude sessions show whole-session counts without clipping',async({page})=>{
  test.skip(!actualStore||!actualIds.length,'Requires explicit local redacted store and session IDs');
  const actualApp=new App(actualStore!),actualServer=await startServer({app:actualApp,port:0});const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  try{for(const recordingId of actualIds){
    await page.setViewportSize({width:1440,height:960});await open(page,actualServer,recordingId);
    const p=actualApp.projection(recordingId),paths=p.files.map(file=>file.path),evidence=fileEvidence(p,paths),target=evidence.find(file=>file.readCalls>1)??evidence.find(file=>file.change)??evidence[0];
    const explorer=page.locator('.folder-explorer');
    if(!target){
      test.info().annotations.push({type:'capture-limit',description:`${recordingId}: no supported read/change paths`});
      await explorer.getByRole('textbox',{name:'Find repository files'}).fill('');await explorer.getByLabel('File filters',{exact:true}).click();await explorer.getByRole('button',{name:'Touched',exact:true}).click();
      if(!p.files.some(file=>file.roles.some(role=>role!=='mentioned')))await expect(explorer).toContainText('No file activity');
      await expect(explorer.locator('.file-change,.file-reads,.file-now')).toHaveCount(0);continue;
    }
    await explorer.getByRole('textbox',{name:'Find repository files'}).fill(target.path);
    const row=explorer.locator(`[data-spine-path=${JSON.stringify(target.path)}]`);await expect(row).toBeVisible();
    if(target!.readCalls)await expect(row).toHaveAttribute('aria-description',new RegExp(`${target!.readCalls} captured read calls`));
    if(target!.change)await expect(row.locator('.file-change')).toHaveText(target!.change);
    expect(await row.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({path:resolve(`.local/files1-${recordingId}.png`)});
    for(const width of [390,320]) {
      await page.setViewportSize({width,height:844});if(!await explorer.isVisible())await page.getByRole('button',{name:'Show files',exact:true}).click();
      await expect(row).toBeVisible();expect(await explorer.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
      await explorer.getByLabel('File filters',{exact:true}).click();await expect(explorer.getByRole('button',{name:'Touched',exact:true})).toBeVisible();
      const menu=await explorer.locator('.tree-evidence-filter-menu').boundingBox();expect(menu!.width).toBeGreaterThan(160);expect(menu!.x).toBeGreaterThanOrEqual(0);expect(menu!.x+menu!.width).toBeLessThanOrEqual(width);
      await page.keyboard.press('Escape');await expect(explorer).toBeVisible();
    }
  }expect(errors).toEqual([]);}finally{await actualServer.close();await actualApp.close();}
});
