import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {test,expect} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';

for(const width of [600,1440])test(`remembered checkout and connection acknowledgement at ${width}`,async({page})=>{
  const dir=mkdtempSync(join(tmpdir(),'drishya-connection-browser-')),root=join(dir,'repository');mkdirSync(root);
  writeFileSync(join(root,'file.ts'),'export const synthetic=1;');
  const journal=join(dir,'source.jsonl');writeFileSync(journal,JSON.stringify({type:'user',uuid:'u',sessionId:'44444444-4444-4444-8444-444444444444',cwd:root,message:{role:'user',content:'Synthetic connection'}})+'\n');
  const app=new App(join(dir,'home'));let server:RunningServer|undefined;
  try {
    const id=(await app.ingest.importSource('claude-code',journal)).recordingId;server=await startServer({app,port:0});
    let sent=0,failed=false;
    const state=()=>({state:failed?'failed':'completed',harness:'claude-code',available:true,output:'',tools:[],inventory:'unknown',approvals:[],settings:{models:[{id:'synthetic-a',name:'Synthetic A',efforts:['low','high']},{id:'synthetic-b',name:'Synthetic B',efforts:['low','high']}],model:'synthetic-a'}});
    await page.route('**/controller',route=>route.fulfill({json:state()}));
    await page.route('**/controller/prompt',async route=>{expect(route.request().postDataJSON().exclusive).toBe(true);sent++;await route.fulfill({json:state()});});
    await page.setViewportSize({width,height:1000});await page.goto(server.launchUrl);await page.locator('.home').waitFor();
    await page.goto(`${server.url}/?experience=modern#/r/${id}`);
    await page.getByRole('region',{name:'Harness prompt'}).getByRole('button',{name:'Expand prompt',exact:true}).click();
    await expect(page.locator('.modern-composer-location')).toContainText('repository');
    const rail=page.getByRole('complementary',{name:'Repository files'});
    if(!await rail.isVisible())await page.getByRole('button',{name:'Show files',exact:true}).click();
    const remember=rail.getByRole('checkbox',{name:'Remember for this checkout'});await expect(remember).toBeChecked();
    await rail.getByRole('button',{name:'Enable workspace reading',exact:false}).click();
    await expect(remember).toHaveCount(0);
    const composer=page.getByRole('region',{name:'Harness prompt'}),input=composer.getByRole('textbox',{name:'Prompt for selected harness session'});
    if(!await input.isVisible())await composer.getByRole('button',{name:/Write a prompt|Expand prompt|Open prompt/}).click();
    await input.fill('Synthetic first request');await input.press('Enter');
    const confirm=composer.getByRole('group',{name:'Confirm session access'});await expect(confirm).toBeVisible();expect(sent).toBe(0);
    await composer.getByRole('checkbox',{name:'This session is idle in other clients'}).check();await composer.getByRole('button',{name:'Confirm and send',exact:true}).click();
    await expect(input).toHaveValue('');expect(sent).toBe(1);
    await composer.getByRole('combobox',{name:'Native model',exact:true}).selectOption('synthetic-b');
    await composer.getByRole('combobox',{name:'Reasoning effort',exact:true}).selectOption('high');
    await input.fill('Synthetic second request');await input.press('Enter');await expect(input).toHaveValue('');expect(sent).toBe(2);await expect(confirm).toHaveCount(0);
    await page.reload();await expect(rail.getByRole('button',{name:'Enable workspace reading',exact:false})).toHaveCount(0);
    await input.fill('Synthetic after reload');await input.press('Enter');await expect(confirm).toBeVisible();expect(sent).toBe(2);
    await composer.getByRole('checkbox',{name:'This session is idle in other clients'}).check();await composer.getByRole('button',{name:'Confirm and send',exact:true}).click();await expect(input).toHaveValue('');expect(sent).toBe(3);
    failed=true;await expect(composer).toContainText('failed',{timeout:6000});failed=false;await expect(composer.locator('.modern-composer-state')).not.toContainText('failed',{timeout:6000});
    await input.fill('Synthetic after failure');await input.press('Enter');await expect(confirm).toBeVisible();expect(sent).toBe(3);
    await composer.getByRole('checkbox',{name:'This session is idle in other clients'}).check();await composer.getByRole('button',{name:'Confirm and send',exact:true}).click();await expect(input).toHaveValue('');expect(sent).toBe(4);
    await page.context().setOffline(true);await expect(composer).toContainText('Connection unavailable');
    await page.context().setOffline(false);await input.fill('Synthetic after reconnect');await expect(composer.getByRole('button',{name:'Send prompt'})).toBeEnabled();await input.press('Enter');await expect(confirm).toBeVisible();expect(sent).toBe(4);
    if(!await rail.isVisible())await page.getByRole('button',{name:'Show files',exact:true}).click();
    await page.request.post(`${server.url}/v1/recordings/${id}/workspace/revoke`,{data:{}});await expect(rail.getByRole('button',{name:'Enable workspace reading',exact:false})).toBeVisible({timeout:6000});
  }finally{await server?.close();await app.close();if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('Unsafe scratch cleanup');rmSync(dir,{recursive:true,force:true});}
});


