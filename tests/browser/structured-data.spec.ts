import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {expect,test} from './legacy-test.ts';
import {pointAtHistory} from './history-gestures.ts';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
let dir:string,app:App,server:RunningServer;
test.beforeAll(async()=>{dir=mkdtempSync(join(tmpdir(),'drishya-data-'));app=new App(dir);server=await startServer({app,port:0,token:'synthetic-data'});});
test.afterAll(async()=>{await server.close();await app.close();if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('unsafe path');rmSync(dir,{recursive:true,force:true});});
test('JSON reading reaches late rows and fields with bounded DOM and exact original access',async({page})=>{
 const sample=JSON.parse(readFileSync(resolve('apps/ui/public/demo/bundle.json'),'utf8'));
 const op=sample.projection.operations.find((item:{kind:string})=>item.kind==='mcp');op.title='Captured records';op.artifactIds=[];
 const raw=JSON.stringify({items:Array.from({length:1200},(_,index)=>({id:index,name:`record ${index}`,nested:{text:'line one\nline two'},...(index===1199?{late:'last captured field'}:{})}))});
 op.detail={kind:'mcp',server:'records',tool:'list',input:{},resultPreview:raw};
 await page.route('**/demo/bundle.json',route=>route.fulfill({json:sample}));
 await page.goto(new URL('/?demo&experience=modern&motion=0',server.launchUrl).href);
 const card=page.locator(`article[data-op-id="${op.id}"]`);await expect(page.locator('.history')).toBeVisible();await pointAtHistory(page);await page.mouse.wheel(0,-100000);await expect(card).toBeAttached();await card.scrollIntoViewIfNeeded();await card.getByRole('button',{name:'Inspect data'}).first().click();
 const dialog=page.getByRole('dialog',{name:'Captured data'}),viewport=dialog.locator('.data-viewport');
 await expect(dialog.getByRole('table')).toBeVisible();await expect(dialog.getByRole('columnheader',{name:'late',exact:true})).toHaveCount(1);
 expect(await dialog.getByRole('row').count()).toBeLessThan(30);
 await viewport.evaluate(element=>{element.scrollTop=element.scrollHeight;element.scrollLeft=element.scrollWidth;});
 await dialog.getByRole('button',{name:'last captured field',exact:true}).click();await expect(dialog.getByRole('region',{name:'Selected data value'})).toContainText('/items/1199/late');
 await dialog.getByRole('button',{name:'Tree',exact:true}).click();await dialog.getByRole('textbox',{name:'Find key or value'}).fill('record 1199');await dialog.locator('.data-value').click();await expect(dialog.locator('.data-selection')).toContainText('record 1199');
 await dialog.getByRole('textbox',{name:'Find key or value'}).fill('');await dialog.getByRole('button',{name:'Expand items',exact:true}).click();await dialog.locator('[role=treeitem]').first().focus();await page.keyboard.press('End');await expect(dialog.locator('[role=treeitem][aria-selected=true]')).toBeFocused();
 await dialog.getByRole('button',{name:'Original',exact:true}).click();await expect(dialog.locator('.data-original')).toHaveText(raw);
 for(const width of [1440,390,320]){await page.setViewportSize({width,height:900});const box=(await dialog.boundingBox())!;expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width+1);expect(await dialog.evaluate(element=>element.scrollWidth-element.clientWidth)).toBeLessThanOrEqual(1);}
 await page.screenshot({path:resolve('.local/structured-data-phone.png')});
 await dialog.getByRole('button',{name:'Close Captured data'}).click();await expect(dialog).toHaveCount(0);await expect(page.getByRole('complementary',{name:'Operation detail',exact:true})).toHaveCount(0);
});

test('reading windows reverse from their actual entrance and dismiss immediately for keyboard or reduced motion',async({page})=>{
 await page.addInitScript(()=>{
  const original=Element.prototype.animate;(window as any).__readerMotion=[];
  Element.prototype.animate=function(frames,options){if(this instanceof HTMLDialogElement)(window as any).__readerMotion.push({frames,options});return original.call(this,frames,options);};
 });
 const sample=JSON.parse(readFileSync(resolve('apps/ui/public/demo/bundle.json'),'utf8'));
 const op=sample.projection.operations.find((item:{kind:string})=>item.kind==='mcp');op.detail.resultPreview='{"answer":42}';
 await page.route('**/demo/bundle.json',route=>route.fulfill({json:sample}));
 await page.goto(new URL('/?demo&experience=modern',server.launchUrl).href);await expect(page.locator('.history')).toBeVisible();await pointAtHistory(page);await page.mouse.wheel(0,-100000);
 const trigger=page.locator(`article[data-op-id="${op.id}"]`).getByRole('button',{name:'Inspect data'}).first();await trigger.click();
 const dialog=page.getByRole('dialog',{name:'Captured data'});
 const before=await dialog.evaluate(element=>{const animation=element.getAnimations()[0];animation.pause();animation.currentTime=70;const style=getComputedStyle(element);return {opacity:style.opacity,transform:style.transform};});
 await dialog.getByRole('button',{name:'Close Captured data'}).click({force:true});
 const frames=await page.evaluate(()=>(window as any).__readerMotion.at(-1).frames);
 expect(frames[0].opacity).toBe(before.opacity);expect(frames[0].transform).toBe(before.transform);
 await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();
 await trigger.click();await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
 const exits=await page.evaluate(()=>(window as any).__readerMotion.filter((item:any)=>item.options.duration===140).length);expect(exits).toBe(1);
 await page.emulateMedia({reducedMotion:'reduce'});await trigger.click();await dialog.getByRole('button',{name:'Close Captured data'}).click();await expect(dialog).toHaveCount(0);
 expect(await page.evaluate(()=>(window as any).__readerMotion.filter((item:any)=>item.options.duration===140).length)).toBe(1);
 await page.emulateMedia({reducedMotion:'no-preference'});await page.getByRole('button',{name:'Workspace settings',exact:true}).click();const settings=page.getByRole('dialog',{name:'Workspace settings',exact:true});await settings.getByRole('button',{name:'Close Workspace settings'}).click();await expect(settings).toHaveCount(0);
 expect(await page.evaluate(()=>(window as any).__readerMotion.filter((item:any)=>item.options.duration===140).length)).toBe(2);
 const folder=page.getByRole('treeitem',{name:'src',exact:true});await folder.click();await expect(folder).toHaveAttribute('aria-expanded','true');expect(await folder.locator('.folder-disclosure').evaluate(element=>getComputedStyle(element).transitionDuration)).toBe('0.14s');
 await folder.focus();await page.keyboard.press('ArrowLeft');await expect(folder).toHaveAttribute('aria-expanded','false');expect(await folder.locator('.folder-disclosure').evaluate(element=>getComputedStyle(element).transitionDuration)).toBe('0s');
});
