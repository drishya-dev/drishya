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

test('repeated TodoWrite lists show every checklist and revision comparison by default',async({page})=>{
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
 // Every captured revision keeps its complete checklist in History.
 const latest=cards.last().getByRole('group',{name:'Plan checklist'});
 await expect(page.getByRole('group',{name:'Plan checklist'})).toHaveCount(3);
 await expect(latest).toContainText('Revision 3 · 2 of 4 done');
 await expect(page.getByRole('button',{name:/Show plan|Collapse plan/})).toHaveCount(0);
 await expect(latest.locator('li.plan-completed')).toHaveCount(2);await expect(latest.locator('li.plan-in_progress')).toContainText('Add a regression test');
 await expect(cards.locator('.plan-list')).toHaveCount(3);
 await expect(cards.nth(0)).toContainText('Revision 1 · 0 of 3 done');
 await expect(cards.nth(1)).toContainText('Revision 2 · 1 of 3 done');await expect(cards.nth(1).locator('li').filter({hasText:'Read the cart code'}).locator('.plan-change')).toHaveText('completed');
 await expect(cards.nth(2)).toContainText('Revision 3 · 2 of 4 done');await expect(cards.nth(2).locator('li').filter({hasText:'Fix the total check'})).toHaveAttribute('data-change','completed');
 if(process.env.IMG_SHOT)await page.getByRole('region',{name:'Session work'}).screenshot({path:resolve('.local/plan-pinned.png')});
 // Expanded, the list steps back through the updates it went through.
 // Keyboard, not a pointer: moving the pointer over the card can start hover reading, which moves it under the click.
 const expand=cards.nth(2).locator('button.op-expand');await expand.focus();await page.keyboard.press('Enter');await expect(expand).toHaveAttribute('aria-expanded','true');
 const expanded=page.locator('.plan-material');await expect(expanded).toBeVisible();
 await expanded.getByRole('button',{name:'Earlier revision'}).click();
 await expect(expanded).toContainText('Revision 2 · 1 of 3 done');
 await expect(expanded.locator('li.plan-completed')).toHaveCount(1);
});

for (const width of [600,1440]) test(`Codex plan revisions keep all items, inline differences and replay boundaries at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:960});
 const session=`codex-open-${width}`,source=join(dir,session+'.jsonl');
 const items=Array.from({length:24},(_,index)=>({step:index===0?'A long captured step '.repeat(18):`Captured step ${index+1}`,status:index===0?'in_progress':'pending'}));
 const changed=items.slice(0,-1).map((item,index)=>({...item,status:index===0?'completed':index===1?'in_progress':item.status}));
 const rows:object[]=[{type:'session_meta',payload:{id:session,cwd:dir}},
  {type:'response_item',payload:{type:'message',role:'user',content:[{type:'input_text',text:'Follow the captured checklist'}]}}];
 for(const [index,plan] of [items,changed].entries()){
  rows.push({type:'response_item',payload:{type:'function_call',call_id:`plan-${index}`,name:'update_plan',arguments:JSON.stringify({plan})}});
  rows.push({type:'response_item',payload:{type:'function_call_output',call_id:`plan-${index}`,output:'Plan updated'}});
 }
 writeFileSync(source,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');
 const id=(await app.ingest.importSource('codex',source)).recordingId;
 await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();
 await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
 const cards=page.locator('article.op-plan');await expect(cards).toHaveCount(2);
 await expect(cards.first().locator('li')).toHaveCount(24);await expect(cards.last().locator('li')).toHaveCount(23);
 await expect(cards.last().locator('.plan-removed')).toHaveText('Left out of this revision: Captured step 24');
 const badge=cards.last().locator('.plan-change').first();
 await expect(badge).toHaveText('completed');await expect(badge).toHaveCSS('opacity','1');await expect(badge).toHaveCSS('position','static');
 await expect(page.getByRole('button',{name:/Show plan|Collapse plan|Show all.*items|Show fewer/})).toHaveCount(0);
 for(const list of await cards.locator('.plan-list').all()){
  const bounds=await list.evaluate(el=>({height:el.clientHeight,max:getComputedStyle(el).maxBlockSize,overflow:el.scrollWidth-el.clientWidth}));
  expect(bounds.height).toBeLessThanOrEqual(360);expect(bounds.max).toBe('360px');expect(bounds.overflow).toBeLessThanOrEqual(1);
 }
 const list=cards.first().locator('.plan-list');await list.scrollIntoViewIfNeeded();await list.evaluate(el=>el.scrollTop=el.scrollHeight);
 await expect(cards.first().locator('.plan-text').last()).toBeInViewport();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 const first=app.projection(id).operations.find(op=>op.kind==='plan')!;
 await page.goto(`${server.url}/?experience=modern&motion=0&at=${first.startSequence+1}#/r/${id}`);
 await expect(cards).toHaveCount(1);await expect(cards.locator('li')).toHaveCount(24);
 await expect(cards.locator('.plan-change,.plan-removed')).toHaveCount(0);
 await expect(cards.locator('li.plan-completed')).toHaveCount(0);
});

for (const width of [600,1440]) test(`large native task replacements keep removed evidence inline and bounded at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:960});
 await page.emulateMedia({reducedMotion:'reduce'});
 const session=`native-removals-${width}`,source=join(dir,session+'.jsonl');
 const tasks=Array.from({length:2000},(_,index)=>({id:String(index+1),subject:index===1999?`Final captured task · exact title ${'x'.repeat(600)}`:`Captured native task ${index+1}`,status:'pending'}));
 const rows:object[]=[{type:'user',uuid:'p',cwd:dir,sessionId:session,message:{role:'user',content:'Replace the captured native task list'}}];
 for(const [index,list] of [tasks,[{id:'replacement',subject:'Replacement task',status:'in_progress'}]].entries()){
  rows.push({type:'assistant',uuid:`a-${index}`,cwd:dir,sessionId:session,message:{id:`m-${index}`,role:'assistant',content:[{type:'tool_use',id:`list-${index}`,name:'TaskList',input:{}}]}});
  rows.push({type:'user',uuid:`r-${index}`,cwd:dir,sessionId:session,toolUseResult:{tasks:list},message:{role:'user',content:[{type:'tool_result',tool_use_id:`list-${index}`,content:'Synthetic native task list'}]}});
 }
 writeFileSync(source,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');
 const id=(await app.ingest.importSource('claude-code',source)).recordingId;
 await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();
 await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
 const cards=page.locator('article.op-plan');await expect(cards).toHaveCount(2);
 await expect(cards.first().locator('.plan-list li')).toHaveCount(2000);
 const replacement=cards.last();await expect(replacement.locator('.plan-list li')).toHaveCount(1);
 await expect(replacement.locator('.plan-text')).toHaveText('Replacement task');
 const removed=replacement.locator('.plan-removed');
 const exact=`Left out of this revision: ${tasks.map(task=>task.subject).join(' · ')}`;
 await expect(removed).toHaveText(exact);
 await expect(page.getByRole('button',{name:/Show plan|Collapse plan|Show all.*items|Show fewer/})).toHaveCount(0);
 const bounds=await removed.evaluate(el=>({height:el.clientHeight,max:getComputedStyle(el).maxBlockSize,overflowY:getComputedStyle(el).overflowY,scrollHeight:el.scrollHeight,widthOverflow:el.scrollWidth-el.clientWidth}));
 expect(bounds.height).toBeLessThanOrEqual(360);expect(bounds.max).toBe('360px');
 expect(bounds.overflowY).toBe('auto');expect(bounds.scrollHeight).toBeGreaterThan(bounds.height);
 expect(bounds.widthOverflow).toBeLessThanOrEqual(1);
 const cardBounds=await replacement.boundingBox();expect(cardBounds!.height).toBeLessThan(600);
 await removed.scrollIntoViewIfNeeded();
 // The last exact title remains reachable and selectable in the inline receipt, without expanding the card.
 const selection=await removed.evaluate((el,title)=>{
  el.scrollTop=el.scrollHeight;
  const node=el.lastChild!;
  const range=document.createRange();range.setStart(node,node.textContent!.length-title.length);range.setEnd(node,node.textContent!.length);
  const selected=window.getSelection()!;selected.removeAllRanges();selected.addRange(range);
  const text=selected.toString(),rect=range.getBoundingClientRect(),bounds=el.getBoundingClientRect();
  return {text,visible:rect.top>=bounds.top-1&&rect.bottom<=bounds.bottom+1,atEnd:el.scrollTop+el.clientHeight>=el.scrollHeight-1};
 },tasks.at(-1)!.subject);
 expect(selection.text).toBe(tasks.at(-1)!.subject);expect(selection.visible).toBe(true);expect(selection.atEnd).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});
