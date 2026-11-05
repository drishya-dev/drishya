import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {test,expect} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
let dir:string,app:App,server:RunningServer;const ids=new Map<number,string>();
test.beforeAll(async()=>{
 dir=mkdtempSync(join(tmpdir(),'drishya-inventories-'));app=new App(join(dir,'store'));
 for(const count of [3,300]){
  const journal=join(dir,`session-${count}.jsonl`),sessionId=`66666666-6666-4666-8666-${String(count).padStart(12,'0')}`;
  const content=Array.from({length:count},(_,n)=>({type:'tool_use',id:`tool-${n}`,name:`mcp__synthetic__tool_${String(n).padStart(3,'0')}`,input:{index:n}}));
  writeFileSync(journal,[{type:'user',uuid:`u-${count}`,sessionId,cwd:dir,message:{role:'user',content:'Synthetic inventory acceptance'}},{type:'assistant',uuid:`a-${count}`,sessionId,message:{id:`a-${count}`,role:'assistant',content}},{type:'user',uuid:`r-${count}`,sessionId,message:{role:'user',content:content.map(tool=>({type:'tool_result',tool_use_id:tool.id,content:'Synthetic result'}))}}].map(row=>JSON.stringify(row)).join('\n')+'\n');
  ids.set(count,(await app.ingest.importSource('claude-code',journal)).recordingId);
 }
 server=await startServer({app,port:0});
});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});}});
for(const count of [3,300])test(`${count} captured MCP and runtime tools stay reachable in a bounded disclosure`,async({page})=>{
 await page.route('**/controller',r=>r.fulfill({json:{harness:'claude-code',available:false,output:'',tools:Array.from({length:count},(_,n)=>`mcp__synthetic__tool_${String(n).padStart(3,'0')}`),inventory:'runtime',approvals:[],state:'idle'}}));
 await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/#/r/${ids.get(count)}`);
 await expect(page.locator('.modern-toolbox')).toBeVisible();const runtime=page.getByRole('region',{name:'Available runtime tools',includeHidden:true}),mcp=page.getByRole('region',{name:'MCP tools for synthetic',includeHidden:true});
 for(const list of [mcp,runtime]){
  const disclosure=list.locator('..'),summary=disclosure.locator(':scope>summary');await expect(disclosure).not.toHaveAttribute('open');await summary.click();await expect(disclosure).toHaveAttribute('open','');await expect(list).toBeVisible();
  await expect(list).toHaveAttribute('data-size',count===3?'fit':'scroll');await expect(list.locator(':scope>button,:scope>span')).toHaveCount(count);
  expect(await list.evaluate(root=>[...root.children].filter(el=>parseFloat(getComputedStyle(el).fontSize)<12).length)).toBe(0);
  expect(await list.locator('small').evaluateAll(nodes=>nodes.filter(el=>parseFloat(getComputedStyle(el).fontSize)<11).length)).toBe(0);
  const heights=await list.evaluate(e=>({client:e.clientHeight,scroll:e.scrollHeight}));
  if(count===3)expect(heights.scroll).toBeLessThanOrEqual(heights.client+1);
  else{
   expect(heights.client).toBeLessThanOrEqual(216);expect(heights.scroll).toBeGreaterThan(heights.client);
   await list.focus();await page.keyboard.press('End');await expect.poll(()=>list.evaluate(e=>e.scrollTop)).toBeGreaterThan(0);
   await expect(list.locator(':scope>button,:scope>span').last()).toBeInViewport();
   await expect(summary).toBeInViewport();
  }
  await summary.click();await expect(list).toBeHidden();
 }
 const toolbox=page.locator('.modern-toolbox');await expect(toolbox.locator('.md-agents')).not.toHaveAttribute('open');
 for(const palette of ['jet','paper','midnight','mocha','tokyo','nord','gruvbox']){
  await page.evaluate(p=>document.documentElement.dataset.palette=p,palette);
  expect(await toolbox.evaluate(root=>[...root.querySelectorAll<HTMLElement>('*')].filter(el=>el.getClientRects().length&&el.checkVisibility()&&[...el.childNodes].some(n=>n.nodeType===3&&n.textContent?.trim())&&parseFloat(getComputedStyle(el).fontSize)<11).map(el=>({text:el.textContent?.slice(0,40),font:getComputedStyle(el).fontSize})))).toEqual([]);
  expect(await toolbox.locator('.md-server>summary').evaluateAll(nodes=>nodes.filter(el=>parseFloat(getComputedStyle(el).fontSize)<12).length)).toBe(0);
 }
 const captured=mcp.locator('..').locator(':scope>summary');await captured.click();await mcp.locator('button').first().click();
 const clear=toolbox.getByRole('button',{name:'Clear focus ×',exact:true});await expect(clear).toBeVisible();expect(await clear.evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(12);await clear.click();await expect(clear).toHaveCount(0);await captured.click();
 for(const width of [1440,900,600]){
  await page.setViewportSize({width,height:960});if(!await page.locator('.workbench-station').isVisible())await page.getByRole('button',{name:'Tools',exact:true}).click();const summary=runtime.locator('..').locator(':scope>summary');if (!await summary.locator('..').evaluate(el=>(el as HTMLDetailsElement).open)) await summary.click();
  await expect(runtime).toBeVisible();const bounds=await runtime.boundingBox();expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(width);
  await runtime.evaluate(e=>{e.scrollTop=e.scrollHeight;});await expect(runtime.locator('span').last()).toBeInViewport();
  await page.screenshot({path:`.local/ui10-${count}-${width}.png`});await summary.click();
 }
});
