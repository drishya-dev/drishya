import { readUncommitted } from './git-navigation.ts';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {expect,test} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';

let dir:string,root:string,id:string,app:App,server:RunningServer;
test.beforeAll(async()=>{
  dir=mkdtempSync(join(tmpdir(),'drishya-git-controls-'));root=join(dir,'repo');mkdirSync(root);
  const git=(...args:string[])=>execFileSync('git',args,{cwd:root,windowsHide:true});
  git('init');git('config','user.name','Synthetic');git('config','user.email','fixture@example.invalid');
  writeFileSync(join(root,'source.ts'),'export const value = 1;\n');git('add','.');git('commit','-m','fixture');
  writeFileSync(join(root,'source.ts'),'export const value = 2;\n');
  const journal=join(dir,'session.jsonl');
  writeFileSync(journal,JSON.stringify({type:'user',uuid:'u1',sessionId:'66666666-6666-4666-8666-666666666667',cwd:root,message:{role:'user',content:'Synthetic Git control acceptance'}})+'\n');
  app=new App(join(dir,'store'));id=(await app.ingest.importSource('claude-code',journal)).recordingId;
  server=await startServer({app,port:0});
});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});}});

test.beforeEach(async({page})=>{
  let first=true;
  await page.route('**/v1/working-locations',async route=>{
    if(first&&route.request().method()==='GET'){
      first=false;await page.request.delete(route.request().url(),{headers:{'content-type':'application/json'}});
    }
    await route.continue();
  });
});

async function openReview(page:import('@playwright/test').Page){
  await page.goto(`${server.url}/?experience=modern#token=${server.token}`);
  await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern#/r/${id}`);
  const reader=await readUncommitted(page);
  await expect(reader.locator('.compare-patch')).toContainText('value = 2');return reader;
}

test('Changes keeps its header to three controls, dismisses its keyboard menu and retains exact handoff validation',async({page})=>{
  const reader=await openReview(page),header=reader.locator('.compare-header'),actions=header.getByLabel('Changes actions',{exact:true});
  // The options menu, the refresh and the way back; the views are a row of choices, not controls.
  await expect(header.locator('.compare-header-end').locator(':scope>button,:scope>.desk-options>summary')).toHaveCount(3);
  await expect(reader.locator('.git-history-entry,.modern-git-context,.modern-git-scope')).toHaveCount(0);
  await actions.focus();await page.keyboard.press('Enter');
  await expect(reader.getByRole('button',{name:'Preview handoff'})).toBeDisabled();
  await page.keyboard.press('Escape');await expect(actions).toBeFocused();
  await expect(header.locator('.desk-options')).not.toHaveAttribute('open','');
  await actions.click();await reader.locator('.compare-file-title strong').click();
  await expect(header.locator('.desk-options')).not.toHaveAttribute('open','');
  await reader.getByRole('checkbox',{name:'Reviewed',exact:true}).check();
  await reader.getByRole('button',{name:'Note',exact:true}).click();await reader.getByRole('textbox',{name:'Local review note'}).fill('Reviewed exact fixture patch');
  await actions.click();await reader.getByRole('button',{name:'Preview handoff',exact:true}).click();
  await expect(reader.getByRole('textbox',{name:'Handoff preview'})).toHaveValue(/Reviewed exact fixture patch/);
  await expect(header.locator('.desk-options')).not.toHaveAttribute('open','');
  writeFileSync(join(root,'source.ts'),'export const value = 3;\n');
  await actions.click();await reader.getByRole('button',{name:'Preview handoff',exact:true}).click();
  await expect(reader.getByRole('alert')).toContainText('Repository changed');
  await expect(reader.getByRole('textbox',{name:'Handoff preview'})).toHaveCount(0);
  await expect(reader.getByRole('checkbox',{name:'Reviewed',exact:true})).not.toBeChecked();
  writeFileSync(join(root,'source.ts'),'export const value = 2;\n');
});

test('Changes retains a readable header and contained menus at every supported width',async({page})=>{
  const reader=await openReview(page);
  for(const width of [1440,900,600]){
    await page.setViewportSize({width,height:960});
    const header=reader.locator('.compare-header');await expect(header).toBeInViewport();
    const rect=await header.boundingBox();expect(rect!.x).toBeGreaterThanOrEqual(0);expect(rect!.x+rect!.width).toBeLessThanOrEqual(width);
    await header.getByLabel('Changes actions',{exact:true}).click();
    const menu=header.locator('.desk-options-body');await expect(menu).toBeVisible();
    const bounds=await menu.boundingBox();expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(width);
    await page.keyboard.press('Escape');await expect(menu).toBeHidden();
    await expect(reader.getByRole('button',{name:'Open on disk',exact:true})).toBeVisible();
    await page.screenshot({path:`.local/ui5-controls-${width}.png`});
  }
});
