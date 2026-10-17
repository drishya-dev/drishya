import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {expect,test} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
let dir:string,app:App,server:RunningServer;
test.beforeAll(async()=>{
  dir=mkdtempSync(join(tmpdir(),'drishya-library-browser-'));app=new App(join(dir,'store'));
  for(const name of ['first','second']){
    const path=join(dir,`${name}.jsonl`),timestamp='2026-10-17T00:00:00Z';
    writeFileSync(path,[{type:'session_meta',timestamp,payload:{id:name,cwd:join(dir,name)}},...Array.from({length:30},(_,i)=>({type:'response_item',timestamp,payload:{type:'message',role:'assistant',content:[{type:'output_text',text:`FINDME_${name}_${i} sharedneedle captured evidence`} ]}}))].map(row=>JSON.stringify(row)).join('\n')+'\n');
    await app.ingest.importSource('codex',path);
  }
  server=await startServer({app,port:0,token:'synthetic-library-browser'});
});
test.afterAll(async()=>{if(server)await server.close();if(app)await app.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary directory');rmSync(dir,{recursive:true,force:true});}});

test('Home evidence search pages across sessions and opens the exact captured point',async({page})=>{
  await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.getByRole('button',{name:'Search evidence',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Search session evidence'}),query=dialog.getByRole('searchbox');
  await expect(query).toBeFocused();
  await query.fill('sharedneedle');await expect(dialog.locator('.library-search-results>button')).toHaveCount(50);
  await dialog.getByRole('button',{name:'Next results'}).click();await expect(dialog.locator('.library-search-results>button')).toHaveCount(10);
  await dialog.getByRole('button',{name:'First page'}).click();await expect(dialog.locator('.library-search-results>button')).toHaveCount(50);
  await query.fill('FINDME_first_4');await expect(dialog.locator('.library-search-results>button')).toHaveCount(1);
  await dialog.locator('.library-search-results>button').click();await expect(dialog).toHaveCount(0);
  await expect(page.locator('.history [data-prose-id]').filter({hasText:'FINDME_first_4'})).toBeVisible();
  await page.keyboard.press('Control+k');const navigation=page.getByRole('dialog',{name:'Navigate workspace'});await navigation.getByRole('combobox').fill('Search all session evidence');await navigation.getByRole('combobox').press('Enter');await expect(dialog).toBeVisible();
  await expect(dialog.locator('.library-search-results>button')).toHaveCount(1);
  for(const width of [900,390]){await page.setViewportSize({width,height:844});expect(await dialog.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);const bounds=await dialog.boundingBox();expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(width);}
  await page.screenshot({path:resolve('.local/library-search-phone.png')});
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
});

test('changed queries ignore stale search responses and filters remain explicit',async({page})=>{
  await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.getByRole('button',{name:'Search evidence',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Search session evidence'}),query=dialog.getByRole('searchbox');
  let release!:()=>void,entered!:()=>void;const gate=new Promise<void>(done=>release=done),started=new Promise<void>(done=>entered=done);
  await page.route('**/v1/search-library?**',async route=>{if(new URL(route.request().url()).searchParams.get('q')==='sharedneedle'){entered();await gate;}await route.continue();});
  await query.fill('sharedneedle');await started;await query.fill('FINDME_second_7');await expect(dialog.locator('.library-search-results>button')).toHaveCount(1);
  const stale=page.waitForResponse(response=>new URL(response.url()).pathname==='/v1/search-library'&&new URL(response.url()).searchParams.get('q')==='sharedneedle');release();await stale;
  await expect(dialog.locator('.library-search-results>button')).toContainText('FINDME_second_7');
  await dialog.locator('summary').click();await dialog.getByLabel('Evidence harness').selectOption('claude-code');await expect(dialog).toContainText('No indexed evidence matched');
});
