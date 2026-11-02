import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {test,expect} from './legacy-test.ts';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
import {parityFixture,paritySurfaces} from './fixtures/content-parity.ts';
let dir:string,app:App,server:RunningServer;
test.setTimeout(25000);
test.beforeAll(async()=>{dir=mkdtempSync(join(tmpdir(),'drishya-content-parity-'));app=new App(dir);server=await startServer({app,port:0,token:'synthetic-parity'});});
test.afterAll(async()=>{await server.close();await app.close();if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('unsafe temporary path');rmSync(dir,{recursive:true,force:true});});
for(const width of[600,1440])for(const surface of paritySurfaces)test(`${surface} retains its captured material at ${width}px`,async({page})=>{
 const {bundle,opId}=parityFixture(surface);await page.setViewportSize({width,height:900});let remote=0;await page.route('https://example.invalid/**',route=>{remote++;return route.abort();});await page.route('**/demo/bundle.json',route=>route.fulfill({json:bundle}));await page.goto(new URL(`/?demo&experience=modern&motion=0&at=${Math.max(bundle.projection.timeline.findIndex(item=>item.type==='op-end'&&item.operationId===opId),bundle.projection.timeline.findIndex(item=>item.type==='op-start'&&item.operationId===opId))+1}`,server.launchUrl).href);await expect(page.locator('.history')).toBeVisible();const history=page.locator('.history');await history.focus();await page.keyboard.press('Shift+C');const card=page.locator(`article[data-op-id="${opId}"]`);await card.scrollIntoViewIfNeeded();await expect(card).toBeVisible();
 const expand=card.locator('button.op-expand');await expand.press('Enter');await expect(expand).toHaveAttribute('aria-expanded','true');const material=card.locator('.op-expanded');await expect(material).toBeVisible();
 switch(surface){
  case 'read':await expect(material.locator('[data-source-line="1"]')).toBeAttached();await expect(material.getByRole('button',{name:'Next lines',exact:true})).toBeEnabled();break;
  case 'edit':await expect(material).toContainText('could not be verified');await expect(material.getByRole('button',{name:'Next change lines',exact:true})).toBeEnabled();break;
  case 'search':await expect(material).toContainText('123 recorded results');await expect(material.locator('.search-bead')).toHaveCount(123);break;
  case 'test':await expect(material).toContainText('literal captured failure');await expect(material).toContainText('fixture test');break;
  case 'plan':await expect(material.locator('.plan-list li')).toHaveCount(80);await expect(material).toContainText('Captured step 80');break;
  case 'delegation':await expect(material).toContainText('Captured delegated task');await expect(material).toContainText(/acknowledgement|returned/);break;
  case 'question':await expect(material.getByRole('group',{name:'Question to you'})).toContainText('No answer was captured');await expect(material.locator('.question-options li')).toHaveCount(2);break;
  case 'process':await expect(material).toContainText('Still waiting for a recorded outcome');await expect(material).toContainText('Exit not captured');await expect(material).toContainText('Running session: 731');await expect(card.locator('.state-returned')).toHaveCount(1);break;
  case 'unknown-mcp':await expect(material).toContainText('Captured mixed sibling');await expect(material.getByRole('button',{name:'Inspect resources · 1',exact:true})).toBeVisible();break;
  case 'orchestration':await expect(card.locator('.state-returned')).toHaveCount(1);await expect(material).toContainText('Captured sibling failed');await expect(material.getByRole('button',{name:'Inspect data',exact:true})).toHaveCount(1);break;
  case 'truncated':await expect(material).toContainText('captured incomplete source');break;
  case 'missing':await expect(material).toContainText('No result content recorded');break;
 }
 expect(await material.evaluate(n=>n.scrollWidth-n.clientWidth)).toBeLessThanOrEqual(1);expect(remote).toBe(0);await page.screenshot({path:resolve(`.local/parity-fixture-${surface}-${width}.png`)});
});
async function visibleCapturedText(locator:import('@playwright/test').Locator,marker:string){
 return locator.evaluate((element,marker)=>{const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);let node:Node|null;while(node=walker.nextNode()){const index=node.textContent?.indexOf(marker)??-1;if(index<0)continue;const range=document.createRange();range.setStart(node,index);range.setEnd(node,index+marker.length);const rect=range.getBoundingClientRect();let top=rect.top,bottom=rect.bottom;for(let parent=element.parentElement;parent;parent=parent.parentElement){if(/auto|scroll|hidden|clip/.test(getComputedStyle(parent).overflowY)){const bounds=parent.getBoundingClientRect();top=Math.max(top,bounds.top);bottom=Math.min(bottom,bounds.bottom);}if(parent.matches('article[data-op-id]'))break;}return Math.max(0,bottom-top);}return 0;},marker);
}
for(const width of[600,1440])for(const form of ['mcp','native'] as const)for(const balance of ['large-input','large-output','error','empty'] as const)test(`${form} ${balance} preserves allocation, raw access and reading controls at ${width}px`,async({page})=>{
 const {parityExchange}=await import('./fixtures/content-parity.ts'),{bundle,opId,input,output}=parityExchange(form,balance);await page.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(value:string)=>{(window as any).parityCopied=value;}}});});await page.setViewportSize({width,height:900});await page.route('**/demo/bundle.json',route=>route.fulfill({json:bundle}));await page.goto(new URL(`/?demo&experience=modern&motion=0&at=${bundle.projection.timeline.findIndex(item=>item.type==='op-end'&&item.operationId===opId)+1}`,server.launchUrl).href);const card=page.locator(`article[data-op-id="${opId}"]`);await card.scrollIntoViewIfNeeded();
 if(balance==='large-input')expect(await visibleCapturedText(card,'SHORT CAPTURED RESULT')).toBeGreaterThan(8);
 if(balance==='large-output')expect(await visibleCapturedText(card,'captured-record-0')).toBeGreaterThan(8);
 if(balance==='error')await expect(card.locator('.state-error')).toHaveCount(1);
 await card.locator('button.op-expand').press('Enter');const material=card.locator('.op-expanded'),argumentsView=material.locator('.tool-input');await argumentsView.getByRole('button',{name:'Show raw',exact:true}).press('Enter');await expect(argumentsView.locator('pre.json').first()).toHaveText(input);await argumentsView.getByRole('button',{name:'Inspect argument data',exact:true}).press('Enter');let dialog=page.getByRole('dialog',{name:'Data',exact:true});await dialog.getByRole('button',{name:'Original',exact:true}).press('Enter');await expect(dialog.locator('.data-original')).toHaveText(input);await dialog.getByRole('button',{name:'Copy original',exact:true}).press('Enter');await expect.poll(()=>page.evaluate(()=>(window as any).parityCopied)).toBe(input);await page.keyboard.press('Escape');
 if(balance==='large-input'){await argumentsView.getByRole('button',{name:'Show fields',exact:true}).press('Enter');await argumentsView.getByRole('button',{name:'Next fields',exact:true}).press('Enter');await expect(argumentsView).toContainText('field_30');}
 if(balance==='large-output'){await material.getByRole('button',{name:'Inspect data',exact:true}).press('Enter');dialog=page.getByRole('dialog',{name:'Data',exact:true});await expect(dialog.getByRole('row').count()).resolves.toBeLessThan(30);await dialog.locator('.data-viewport').evaluate(n=>{n.scrollTop=n.scrollHeight;n.scrollLeft=n.scrollWidth;});await dialog.getByRole('button',{name:'last captured field',exact:true}).press('Enter');await expect(dialog.getByRole('region',{name:'Selected data value'})).toContainText('/items/1199/late');await dialog.getByRole('button',{name:'Original',exact:true}).press('Enter');await expect(dialog.locator('.data-original')).toHaveText(output);await dialog.getByRole('button',{name:'Copy original',exact:true}).press('Enter');await expect.poll(()=>page.evaluate(()=>(window as any).parityCopied)).toBe(output);await page.keyboard.press('Escape');}
 if(balance==='empty'){await expect(material).toContainText('No result content recorded');await expect(material.getByRole('button',{name:'Inspect data',exact:true})).toHaveCount(0);}else await expect(material).toContainText(balance==='large-output'?'captured-record-1199':output);
 expect(await material.evaluate(n=>n.scrollWidth-n.clientWidth)).toBeLessThanOrEqual(1);
});
