import {resolve} from 'node:path';
import {expect,test} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from './browser-server.ts';
const store=process.env.DRISHYA_REVIEW_STORE,ids=(process.env.DRISHYA_REVIEW_IDS??'').split(',').filter(Boolean);
let app:App,server:RunningServer;
test.skip(!store||!ids.length,'Opt in to an isolated copy of an already-redacted local store.');
test.beforeAll(async()=>{app=new App(store!);server=await startServer({app,port:0});});
test.afterAll(async()=>{if(server)await server.close();if(app)await app.close();});
for(const touch of [false,true])test(`READ-9 actual Codex/Claude source density and options (${touch?'touch':'mouse'})`,async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:touch,isMobile:touch});const page=await context.newPage();const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/v1/working-locations',route=>route.request().method()==='GET'?route.fulfill({json:{version:1,sessions:[]}}):route.continue());
 await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();
 for(const [index,id] of ids.entries()){
  await page.setViewportSize({width:1440,height:960});await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);await expect(page.locator('.history')).toBeVisible();
  const grant=page.getByRole('button',{name:/Enable workspace reading/});await expect(page.locator('.folder-explorer')).not.toHaveAttribute('data-reading-access','checking');if(await grant.isVisible())await grant.click();
  const graph=await app.graph(id),path=graph.nodes.filter(node=>!node.path.startsWith('.')&&/\.(ts|tsx|py|json)$/.test(node.path)).map(node=>node.path).sort((a,b)=>a.length-b.length)[0];expect(path).toBeTruthy();
  await page.evaluate(path=>window.dispatchEvent(new CustomEvent('drishya-preview-file',{detail:{path}})),path);const reader=page.locator('.file-peek-reader');await expect(reader.locator('.current-file-code')).not.toBeEmpty();
  for(const width of [390,320]){
   await page.setViewportSize({width,height:844});const options=reader.getByLabel('Reading options',{exact:true});await expect(options).toBeVisible();
   await expect.poll(()=>reader.evaluate(node=>node.querySelector('.current-file-code')!.getBoundingClientRect().height/node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(.62);
   const metrics=await reader.evaluate(node=>({ratio:node.querySelector('.current-file-code')!.getBoundingClientRect().height/node.getBoundingClientRect().height,overflow:node.scrollWidth-node.clientWidth}));expect(metrics.overflow).toBeLessThanOrEqual(1);
   console.log(JSON.stringify({session:index+1,width,touch,...metrics}));
   const find=reader.getByRole('searchbox',{name:'Find in current source file'});await find.fill('no-such-READ9-match');await expect(reader.locator('.source-find [role=status]')).toHaveText('0/0');await expect(reader.getByRole('button',{name:'Next match',exact:true})).toBeDisabled();
   if(touch)expect(parseFloat(await find.evaluate(node=>getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(16);
   await options.click();const menu=reader.locator('.current-reader-options>div');await expect(menu).toBeVisible();const box=(await menu.boundingBox())!;expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width+1);
   await expect(menu).toContainText('On disk');await menu.getByRole('textbox',{name:'Go to current source line'}).fill('1');await menu.getByRole('button',{name:'Go to line',exact:true}).click();await expect(reader.locator('[data-source-line="1"]')).toHaveAttribute('aria-current','location');
   await menu.getByRole('button',{name:'Wrap lines',exact:true}).click();await expect(reader.locator('.current-file-code')).toHaveClass(/wrap-source/);await menu.getByRole('button',{name:'Wrap lines',exact:true}).click();
   await options.focus();await page.keyboard.press('Escape');await expect(menu).toBeHidden();await expect(reader).toBeVisible();await expect(options).toBeFocused();
   await options.click();await reader.locator('header h2').click();await expect(menu).toBeHidden();await expect(reader).toBeVisible();await find.fill('');
   await page.screenshot({path:resolve(`.local/read9-actual-${index}-${width}-${touch}.png`)});
  }
  await reader.locator('header .reading-window-actions>button').last().click();await expect(reader).toHaveCount(0);
 }
 expect(errors).toEqual([]);await context.close();
});
