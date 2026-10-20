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
  await page.getByRole('button',{name:'Git review',exact:true}).click();
  const reader=page.getByRole('dialog',{name:'Git review',exact:true});
  const workspace=reader.getByRole('button',{name:'Approve current workspace'}),git=reader.getByRole('button',{name:'Approve read-only Git'}),refresh=reader.getByRole('button',{name:'Refresh changes',exact:true});
  await expect(workspace.or(git).or(refresh)).toBeVisible();
  if(await workspace.isVisible())await workspace.click();
  await expect(git.or(refresh)).toBeVisible();if(await git.isVisible())await git.click();
  await expect(reader.locator('.git-patch')).toContainText('value = 2');return reader;
}

test('Modern Git review keeps three controls, dismisses its keyboard menu and retains exact handoff validation',async({page})=>{
  const reader=await openReview(page),nav=reader.getByRole('navigation',{name:'Git review controls'}),actions=nav.getByLabel('Git review actions');
  await expect(nav.locator(':scope>button,:scope>.desk-options>summary')).toHaveCount(3);
  await expect(reader.locator('.git-history-entry,.modern-git-context,.modern-git-scope')).toHaveCount(0);
  await actions.focus();await page.keyboard.press('Enter');
  await expect(reader.getByRole('button',{name:'Preview handoff'})).toBeDisabled();
  await page.keyboard.press('ArrowDown');await expect(reader.getByRole('button',{name:'Recorded work',exact:true})).toBeFocused();
  await page.keyboard.press('Escape');await expect(actions).toBeFocused();
  await expect(nav.locator('.desk-options')).not.toHaveAttribute('open','');
  await actions.click();await reader.locator('.git-selected-file-header strong').click();
  await expect(nav.locator('.desk-options')).not.toHaveAttribute('open','');
  const files=nav.getByRole('button',{name:/Files/});await files.click();await expect(reader.locator('#git-changed-files')).toBeHidden();await files.click();await expect(reader.locator('#git-changed-files')).toBeVisible();
  await reader.getByRole('checkbox',{name:'Reviewed displayed patch'}).check();await reader.getByRole('textbox',{name:'Local review note'}).fill('Reviewed exact fixture patch');
  await actions.click();await reader.getByRole('button',{name:'Preview handoff',exact:true}).click();
  await expect(reader.getByRole('textbox',{name:'Handoff preview'})).toHaveValue(/Reviewed exact fixture patch/);
  await expect(nav.locator('.desk-options')).not.toHaveAttribute('open','');
  writeFileSync(join(root,'source.ts'),'export const value = 3;\n');
  await actions.click();await reader.getByRole('button',{name:'Preview handoff',exact:true}).click();
  await expect(reader.getByRole('alert')).toContainText('Repository changed');
  await expect(reader.getByRole('textbox',{name:'Handoff preview'})).toHaveCount(0);
  await expect(reader.getByRole('checkbox',{name:'Reviewed displayed patch'})).not.toBeChecked();
  writeFileSync(join(root,'source.ts'),'export const value = 2;\n');
});

test('Modern Git review retains readable identity and contained menus at narrow widths',async({page})=>{
  const reader=await openReview(page);
  for(const width of [1440,900,390,320]){
    await page.setViewportSize({width,height:960});
    const nav=reader.getByRole('navigation',{name:'Git review controls'});await expect(nav).toBeInViewport();
    const rect=await nav.boundingBox();expect(rect!.x).toBeGreaterThanOrEqual(0);expect(rect!.x+rect!.width).toBeLessThanOrEqual(width);
    await nav.getByLabel('Git review actions').click();
    const menu=nav.locator('.desk-options-body');await expect(menu).toBeVisible();
    const bounds=await menu.boundingBox();expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(width);
    await page.keyboard.press('Escape');await expect(menu).toBeHidden();
    await expect(reader.getByRole('button',{name:'Open on disk',exact:true})).toBeVisible();
    await page.screenshot({path:`.local/ui5-controls-${width}.png`});
  }
});
