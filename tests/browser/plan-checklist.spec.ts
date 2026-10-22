import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,sep} from 'node:path';
import {test,expect} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
let dir:string,app:App,server:RunningServer;
test.beforeAll(async()=>{dir=mkdtempSync(join(tmpdir(),'drishya-plan-'));app=new App(dir);server=await startServer({app,port:0});});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});}});

type Todo={content:string;status:string;activeForm:string};
const todo=(content:string,status:string):Todo=>({content,status,activeForm:content});

test('repeated TodoWrite lists read as one checklist pinned under the prompt, each update as one line',async({page})=>{
 const timestamp='2026-10-18T00:00:00Z',session='plan-thread',source=join(dir,session+'.jsonl');
 const lists:Todo[][]=[
  [todo('Read the cart code','in_progress'),todo('Fix the total check','pending'),todo('Add a regression test','pending')],
  [todo('Read the cart code','completed'),todo('Fix the total check','in_progress'),todo('Add a regression test','pending')],
  [todo('Read the cart code','completed'),todo('Fix the total check','completed'),todo('Add a regression test','in_progress'),todo('Update the changelog','pending')],
 ];
 const rows:object[]=[{timestamp,type:'user',uuid:'p',cwd:dir,sessionId:session,message:{role:'user',content:'Fix the cart total'}}];
 lists.forEach((todos,index)=>{
  rows.push({timestamp,type:'assistant',cwd:dir,sessionId:session,uuid:`a${index}`,message:{id:`m${index}`,role:'assistant',content:[{type:'tool_use',id:`todo${index}`,name:'TodoWrite',input:{todos}}]}});
  rows.push({timestamp,type:'user',cwd:dir,sessionId:session,uuid:`r${index}`,message:{role:'user',content:[{type:'tool_result',tool_use_id:`todo${index}`,content:'Todos have been modified successfully.'}]}});
 });
 writeFileSync(source,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');const id=(await app.ingest.importSource('claude-code',source)).recordingId;
 await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
 const cards=page.locator('article.op-plan');await expect(cards).toHaveCount(3);
 // The newest list is pinned under the prompt; every update in the stream is one line saying what it changed.
 const latest=page.locator('.turn').getByRole('group',{name:'Plan checklist'});
 await expect(page.getByRole('group',{name:'Plan checklist'})).toHaveCount(1);
 await expect(latest).toContainText('Plan · 2 of 4 done · revision 3');
 await expect(latest.locator('li.plan-completed')).toHaveCount(2);await expect(latest.locator('li.plan-in_progress')).toContainText('Add a regression test');
 await expect(cards.locator('.plan-list')).toHaveCount(0);
 await expect(cards.nth(0)).toContainText('Revision 1 · 0 of 3 done');
 await expect(cards.nth(1)).toContainText('Revision 2 · 1 of 3 done');await expect(cards.nth(1)).toContainText('completed Read the cart code');
 await expect(cards.nth(2)).toContainText('Revision 3 · 2 of 4 done');await expect(cards.nth(2)).toContainText('completed Fix the total check');
 if(process.env.IMG_SHOT)await page.getByRole('region',{name:'Captured work'}).screenshot({path:resolve('.local/plan-pinned.png')});
 // Expanded, the list steps back through the updates it went through.
 // Keyboard, not a pointer: moving the pointer over the card can start hover reading, which moves it under the click.
 const expand=cards.nth(2).locator('button.op-expand');await expand.focus();await page.keyboard.press('Enter');await expect(expand).toHaveAttribute('aria-expanded','true');
 const expanded=page.locator('.plan-material');await expect(expanded).toBeVisible();
 await expanded.getByRole('button',{name:'Earlier revision'}).click();
 await expect(expanded).toContainText('Revision 2 · 1 of 3 done');
 await expect(expanded.locator('li.plan-completed')).toHaveCount(1);
});
