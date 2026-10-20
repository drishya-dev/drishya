import {mkdtempSync,rmSync,writeFileSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {expect,test,type Page} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';

let dir:string,app:App,server:RunningServer,parentId:string,restore:()=>void;
async function revealNewerWork(page:Page) {
  const utilities=page.locator('.studio-actions > .workspace-menu');
  if(await utilities.getAttribute('open')===null)await utilities.locator(':scope > summary').click();
  const section=page.locator('.session-segments');await expect(section.locator('summary')).toBeVisible();
  await section.locator('summary').click();
  return section;
}
test.beforeAll(async()=>{
  dir=mkdtempSync(join(tmpdir(),'drishya-segment-browser-'));
  const family='11111111-1111-1111-1111-111111111111',parentThread='22222222-2222-2222-2222-222222222222',childThread='33333333-3333-3333-3333-333333333333';
  const parent=join(dir,`rollout-${family}_${parentThread}.jsonl`),child=join(dir,`rollout-${family}_${childThread}.jsonl`);
  const message=(text:string)=>({timestamp:'2026-10-17T00:00:00Z',type:'response_item',payload:{type:'message',role:'assistant',content:[{type:'output_text',text}]}});
  writeFileSync(parent,[{timestamp:'2026-10-16T00:00:00Z',type:'session_meta',payload:{id:family,cwd:dir}},message('EARLIER_NATIVE_SEGMENT')].map(row=>JSON.stringify(row)).join('\n')+'\n');
  writeFileSync(child,[{timestamp:'2026-10-17T00:00:00Z',type:'session_meta',payload:{id:family,cwd:dir,history_mode:'paginated',history_base:{thread_id:parentThread,end_ordinal_exclusive:2,end_byte_offset:statSync(parent).size}}},message('NEWER_NATIVE_SEGMENT_CONFIRMED')].map(row=>JSON.stringify(row)).join('\n')+'\n');
  app=new App(join(dir,'store'));
  const adapter=app.ingest.adapter('codex'),original=adapter.discover;
  adapter.discover=async()=>[parent,child].map((path,index)=>({adapterId:'codex',harness:'codex',path,cwd:dir,bytes:statSync(path).size,title:'Same conversation',modifiedAt:`2026-10-${16+index}T00:00:00Z`,companions:[]}));restore=()=>{adapter.discover=original;};
  parentId=(await app.ingest.importSource('codex',parent)).recordingId;
  server=await startServer({app,port:0,token:'synthetic-segment-navigation'});
});
test.afterAll(async()=>{if(server)await server.close();if(app)await app.close();restore?.();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary directory');rmSync(dir,{recursive:true,force:true});}});

test('native segment lookup is authenticated, read-only, and explicit navigation opens newer work',async({page,request})=>{
  const endpoint=`${server.url}/v1/recordings/${parentId}/segments`;
  expect((await request.get(endpoint)).status()).toBe(401);
  const before=app.store.listRecordings().length;
  const lookup=await request.get(endpoint,{headers:{authorization:`Bearer ${server.token}`}});
  expect(lookup.status()).toBe(200);expect((await lookup.json()).items).toHaveLength(1);expect(app.store.listRecordings()).toHaveLength(before);
  const prompts:string[]=[];page.on('request',r=>{if(r.url().includes('/controller/prompt'))prompts.push(r.url());});
  await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${parentId}`);
  await expect(page.locator('.history')).toContainText('EARLIER_NATIVE_SEGMENT');
  await expect(page.locator('.studio-actions > .session-segments')).toHaveCount(0);
  const menu=await revealNewerWork(page);
  await expect(menu).toContainText('this history stays available');
  await page.getByRole('heading').first().click();await expect(menu).not.toHaveAttribute('open','');
  await revealNewerWork(page);await menu.locator('summary').focus();await page.keyboard.press('Enter');await page.keyboard.press('Enter');await page.keyboard.press('Escape');await expect(menu.locator('summary')).toBeFocused();
  await menu.locator('summary').click();await menu.getByRole('button',{name:/^Open /}).click();
  await expect(page.locator('.history')).toContainText('NEWER_NATIVE_SEGMENT_CONFIRMED');await expect(menu).toHaveCount(0);
  expect(app.store.listRecordings()).toHaveLength(before+1);expect(prompts).toEqual([]);expect(app.ingest.isLive(parentId)).toBe(true);
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${parentId}`);await expect(page.locator('.history')).toContainText('EARLIER_NATIVE_SEGMENT');
  await page.setViewportSize({width:390,height:844});await revealNewerWork(page);
  const bounds=await menu.locator(':scope>div').boundingBox();expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(390);
  await page.getByRole('heading').first().click();await page.keyboard.press('Control+k');
  const navigation=page.getByRole('dialog',{name:'Navigate workspace'});await navigation.getByRole('combobox').fill('Newer session work');await navigation.getByRole('combobox').press('Enter');
  await expect(menu).toHaveAttribute('open','');await expect(menu.locator('summary')).toBeFocused();
});

test('a delayed import cannot pull the user back from Home into another native segment',async({page})=>{
  let release!:()=>void,entered!:()=>void;const gate=new Promise<void>(done=>{release=done;}),started=new Promise<void>(done=>{entered=done;});
  await page.route('**/v1/recordings/*/segments',async route=>{const response=await route.fetch();const body=await response.json();for(const item of body.items)item.source.importedRecordingId=undefined;await route.fulfill({json:body});});
  await page.route('**/v1/import',async route=>{entered();await gate;await route.continue();});
  await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${parentId}`);
  const menu=await revealNewerWork(page);await menu.getByRole('button',{name:/^Open /}).click();await started;
  await page.getByRole('button',{name:'Drishya',exact:true}).click();await expect(page.locator('.home')).toBeVisible();
  const imported=page.waitForResponse(r=>new URL(r.url()).pathname==='/v1/import');release();await imported;
  await expect(page.locator('.home')).toBeVisible();await expect(page.locator('.history')).toHaveCount(0);
});
