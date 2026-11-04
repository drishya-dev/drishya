import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,sep} from 'node:path';
import {test,expect} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
let dir:string,app:App,server:RunningServer,id:string;
test.beforeAll(async()=>{
 dir=mkdtempSync(join(tmpdir(),'drishya-plan-identity-'));app=new App(join(dir,'data'));server=await startServer({app,port:0});
 const timestamp='2026-10-25T00:00:00Z',base={timestamp,cwd:dir,sessionId:'ambiguous-plan'};
 const lists=[['pending','completed','pending'],['pending','completed','completed']];
 const rows:object[]=[{...base,type:'user',uuid:'prompt',message:{role:'user',content:'Review both checks'}}];
 lists.forEach((statuses,index)=>{
  const todos=statuses.map((status,n)=>({content:n<2?'Run tests':'Unique check',status,activeForm:'Checking'}));
  rows.push({...base,type:'assistant',uuid:'a'+index,message:{id:'m'+index,role:'assistant',content:[{type:'tool_use',id:'todo'+index,name:'TodoWrite',input:{todos}}]}});
  rows.push({...base,type:'user',uuid:'r'+index,message:{role:'user',content:[{type:'tool_result',tool_use_id:'todo'+index,content:'Todos updated'}]}});
 });
 const source=join(dir,'session.jsonl');writeFileSync(source,rows.map(r=>JSON.stringify(r)).join('\n')+'\n');id=(await app.ingest.importSource('claude-code',source)).recordingId;
});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});}});
for(const width of [1440,600])test(`duplicate plan labels keep literal states and honest revision summaries at ${width}px`,async({page})=>{
 // Each viewport starts fresh; the preceding case deliberately saved an expanded card.
 await page.request.delete(`${server.url}/v1/working-locations`,{headers:{authorization:`Bearer ${server.token}`,'content-type':'application/json'}});
 await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce'});await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
 const cards=page.locator('article.op-plan');await expect(cards).toHaveCount(2);
 const pinned=cards.last().getByRole('group',{name:'Plan checklist'});await expect(pinned).toContainText('2 of 3 done');await pinned.getByRole('button',{name:'Show plan',exact:true}).click();await expect(pinned.locator('li').filter({hasText:'Run tests'})).toHaveCount(2);
 const delta=cards.nth(0).locator('.plan-delta');await expect(delta).toHaveCount(0);await expect(cards.nth(1).locator('.plan-change')).toHaveText(['completed']);
 const expand=cards.nth(1).locator('button.op-expand');await expand.focus();await expand.press('Enter');await expect(expand).toHaveAttribute('aria-expanded','true');
 const full=cards.nth(1).locator('.plan-material');await expect(full).toBeVisible();await expect(full.locator('li').filter({hasText:'Run tests'})).toHaveCount(2);
 await expect(full.locator('li.plan-pending').filter({hasText:'Run tests'})).toHaveCount(1);await expect(full.locator('li.plan-completed').filter({hasText:'Run tests'})).toHaveCount(1);
 await expect(full.locator('li').filter({hasText:'Run tests'}).locator('.plan-change')).toHaveCount(0);
 await full.getByRole('button',{name:'Earlier revision'}).press('Enter');await expect(full).toContainText('Revision 1');await expect(full).toContainText('1 of 3 done');
 await full.getByRole('button',{name:'Later revision'}).press('Enter');await expect(full).toContainText('Revision 2');await expect(full.getByRole('button',{name:'Later revision'})).toBeDisabled();
});
