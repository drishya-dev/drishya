import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,sep} from 'node:path';
import {test,expect} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
let dir:string,app:App,server:RunningServer;
test.beforeAll(async()=>{dir=mkdtempSync(join(tmpdir(),'drishya-question-'));app=new App(dir);server=await startServer({app,port:0});});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});}});

test('a AskUserQuestion reads as a question with its answer, not raw JSON',async({page})=>{
 const timestamp='2026-10-18T00:00:00Z',session='ask-q',source=join(dir,session+'.jsonl');
 const question='Which area should the fix start in?';
 const rows=[
  {timestamp,type:'user',uuid:'p',cwd:dir,sessionId:session,message:{role:'user',content:'Fix the cart'}},
  {timestamp,type:'assistant',cwd:dir,sessionId:session,uuid:'a1',message:{id:'m1',role:'assistant',content:[{type:'tool_use',id:'ask1',name:'AskUserQuestion',input:{questions:[{question,header:'Area',multiSelect:false,options:[{label:'Cart totals',description:'src/cart'},{label:'Checkout',description:'src/checkout'}]}]}}]}},
  {timestamp,type:'user',cwd:dir,sessionId:session,uuid:'r1',message:{role:'user',content:[{type:'tool_result',tool_use_id:'ask1',content:`The user answered: "${question}"="Cart totals"`}]}},
 ];
 writeFileSync(source,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');const id=(await app.ingest.importSource('claude-code',source)).recordingId;
 await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
 const card=page.locator('article.op').filter({hasText:'AskUserQuestion'}).first();await expect(card).toBeVisible();
 const question_card=card.getByRole('group',{name:'Question to you'});
 await expect(question_card).toContainText(question);await expect(question_card).toContainText('Cart totals');
 await expect(question_card.locator('.question-header')).toContainText('Area');
 // The offered options are kept (CONTENT-3), so the card lists them and marks the one chosen.
 await expect(question_card.locator('.question-options li')).toHaveCount(2);
 await expect(question_card.locator('.question-options li[data-chosen]')).toHaveText(/Cart totals/);
 await expect(question_card).not.toContainText('not the offered options');
});
