import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join,resolve,sep} from 'node:path';
import {test,expect} from '@playwright/test';import {App} from '../../apps/daemon/src/app.ts';import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
let dir:string,id:string,app:App,server:RunningServer;
test.beforeAll(async()=>{
 dir=mkdtempSync(join(tmpdir(),'drishya-rail-'));const journal=join(dir,'session.jsonl'),sessionId='66666666-6666-4666-8666-666666666675';const rows:unknown[]=[];
 for(let turn=0;turn<75;turn++){
  rows.push({type:'user',uuid:`u-${turn}`,sessionId,cwd:dir,message:{role:'user',content:`Rail turn ${turn}`}});
  const count=[2,12,80][turn]??0;if(!count)continue;
  const content=Array.from({length:count},(_,n)=>({type:'tool_use',id:`t-${turn}-${n}`,name:turn===2&&n===0?'Write':'Bash',input:turn===2&&n===0?{file_path:'src/created.ts',content:'export const created = true;\n'}:{command:`echo ${turn}-${n}`}}));
  rows.push({type:'assistant',uuid:`a-${turn}`,sessionId,message:{id:`a-${turn}`,role:'assistant',content}});
  rows.push({type:'user',uuid:`r-${turn}`,sessionId,message:{role:'user',content:content.map((tool,n)=>({type:'tool_result',tool_use_id:tool.id,content:'Captured fixture result',is_error:turn===1&&n===0}))}});
 }
 writeFileSync(journal,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');app=new App(join(dir,'store'));id=(await app.ingest.importSource('claude-code',journal)).recordingId;server=await startServer({app,port:0});
});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});}});
test.beforeEach(async({page})=>{
 let first=true;await page.route('**/v1/working-locations',async route=>{if(first&&route.request().method()==='GET'){first=false;await page.request.delete(route.request().url(),{headers:{'content-type':'application/json'}});}await route.continue();});
 await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/#/r/${id}`);
});
test('rail ticks are uniform and plain at rest; the captured ledger appears on hover',async({page})=>{
 const rail=page.getByRole('navigation',{name:'Prompt positions in history'});await expect(rail).toBeVisible();await rail.focus();await page.keyboard.press('Home');
 const first=rail.getByRole('button',{name:'Go to prompt: Rail turn 0',exact:true});await expect(first).toHaveAttribute('data-operation-count','2');
 const failure=rail.getByRole('button',{name:'Go to prompt: Rail turn 1',exact:true}),edited=rail.getByRole('button',{name:'Go to prompt: Rail turn 2',exact:true});
 await expect(failure).toHaveAttribute('data-operation-count','12');await expect(edited).toHaveAttribute('data-operation-count','80');
 await expect(rail.locator('.prompt-turn-failed, .prompt-turn-edited')).toHaveCount(0);
 await page.mouse.move(2,2);
 const widths=await rail.locator('.prompt-rail-tick').evaluateAll(ticks=>ticks.map(tick=>Math.round(tick.getBoundingClientRect().width)));expect(new Set(widths).size).toBe(1);
 await failure.hover();await expect(page.locator('.prompt-rail-ledger')).toContainText('12 captured operations');await expect(page.locator('.prompt-rail-ledger')).toContainText('1 failed');
 await edited.hover();await expect(page.locator('.prompt-rail-ledger')).toContainText('80 captured operations');await expect(page.locator('.prompt-rail-ledger')).toContainText('edited 1 file');
 await expect(edited).toHaveAttribute('aria-description',/80 captured operations/);
 await page.screenshot({path:'.local/turn3-ledger.png'});
});
test('full rail remains virtualized, keyboard addressable and readable at supported desktop widths',async({page})=>{
 const rail=page.getByRole('navigation',{name:'Prompt positions in history'});await expect(rail).toBeVisible();
 for(const width of [1440,900,600])await test.step(`${width}px rail keyboard navigation`,async()=>{
  await page.setViewportSize({width,height:844});await rail.focus();await page.keyboard.press('End');await expect(rail.locator('[data-prompt-ordinal="75"]')).toBeFocused();
  expect(await rail.locator('button').count()).toBeLessThan(75);
  await page.keyboard.press('Home');await expect(rail.locator('[data-prompt-ordinal="1"]')).toBeFocused();
  const edited=rail.locator('[data-prompt-ordinal="3"]');await edited.hover();await expect(page.locator('.prompt-rail-ledger')).toContainText('80 captured operations');
  const preview=await page.locator('.prompt-rail-preview').boundingBox();expect(preview!.x).toBeGreaterThanOrEqual(0);expect(preview!.x+preview!.width).toBeLessThanOrEqual(width);expect(preview!.y+preview!.height).toBeLessThanOrEqual(844);
  await page.screenshot({path:`.local/turn3-${width}.png`});await page.mouse.move(0,0);
 });
 await page.keyboard.press('End');await page.keyboard.press('Enter');
 await expect(page.locator('.turn').filter({hasText:'Rail turn 74'})).toBeVisible();
});
