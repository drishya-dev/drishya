import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,sep} from 'node:path';
import {test,expect} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from './browser-server.ts';
let dir:string,app:App,server:RunningServer,id:string;
test.beforeAll(async()=>{
 dir=mkdtempSync(join(tmpdir(),'drishya-question-literal-'));app=new App(join(dir,'data'));server=await startServer({app,port:0});
 const timestamp='2026-10-25T00:00:00Z',base={timestamp,cwd:dir,sessionId:'literal-answers'};
 const questions=[null,
  {question:'Deploy?',multiSelect:true,options:[{label:'Docker'},{label:'No'}]},
  {question:'Area?',multiSelect:true,options:[{label:'Cart'},{label:'Checkout'}]},
  {question:'Next?',options:[{label:'Continue'}]},
  {question:'Choose?',multiSelect:true,options:[{label:'A'},{label:'B'},{label:'A, B'}]},
  {question:'Name?',options:[{label:'Alpha'},{label:'Beta'}]},
 ];
 const result='The user answered: "Deploy?"="Do not use Docker. Nothing yet.", "Area?"="Cartography, Cart", "Next?"=""Keep quotes", and punctuation...", "Choose?"="A, B", "Name?"="Alpha" selected preview:\nexample command\n"captured reference"\nexample.dev. You can now continue with these answers in mind.';
 const rows=[{...base,type:'user',uuid:'p',message:{role:'user',content:'Review these choices'}},
  {...base,type:'assistant',uuid:'a',message:{id:'m',role:'assistant',content:[{type:'tool_use',id:'ask',name:'AskUserQuestion',input:{questions}}]}},
  {...base,type:'user',uuid:'r',message:{role:'user',content:[{type:'tool_result',tool_use_id:'ask',content:result}]}}];
 const source=join(dir,'session.jsonl');writeFileSync(source,rows.map(r=>JSON.stringify(r)).join('\n')+'\n');id=(await app.ingest.importSource('claude-code',source)).recordingId;
});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});}});
for(const width of [1440,390])test(`captured answers keep literal words and do not select substrings at ${width}px`,async({page})=>{
 await page.request.delete(`${server.url}/v1/working-locations`,{headers:{authorization:`Bearer ${server.token}`,'content-type':'application/json'}});
 await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce'});await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
 const card=page.locator('article.op').filter({hasText:'AskUserQuestion'}).first();const expand=card.locator('button.op-expand');await expand.focus();await expand.press('Enter');await expect(expand).toHaveAttribute('aria-expanded','true');
 const group=card.locator('.op-expanded').getByRole('group',{name:'Question to you'});await expect(group).toBeVisible();await expect(group.locator('section.question')).toHaveCount(5);
 const deploy=group.locator('section.question').filter({hasText:'Deploy?'});await expect(deploy.locator('[data-chosen]')).toHaveCount(0);await expect(deploy.locator('.question-typed')).toHaveText('Wrote Do not use Docker. Nothing yet.');
 const area=group.locator('section.question').filter({hasText:'Area?'});await expect(area.locator('[data-chosen]')).toHaveCount(1);await expect(area.locator('[data-chosen]')).toContainText('Cart');await expect(area.locator('.question-typed')).toHaveText('Also wrote Cartography');
 const next=group.locator('section.question').filter({hasText:'Next?'});await expect(next.locator('.question-typed')).toHaveText('Wrote "Keep quotes", and punctuation...');
 const ambiguous=group.locator('section.question').filter({hasText:'Choose?'});await expect(ambiguous.locator('[data-chosen]')).toHaveCount(0);await expect(ambiguous.locator('.question-typed')).toHaveText('Wrote A, B');
 const named=group.locator('section.question').filter({hasText:'Name?'});await expect(named.locator('[data-chosen]')).toHaveCount(1);await expect(named.locator('[data-chosen]')).toContainText('Alpha');await expect(named.locator('.question-typed')).toHaveCount(0);
 await expect(group).not.toContainText('example command');await expect(group).not.toContainText('You can now continue');await expect(group).toContainText('Question and answer');
});
