import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {expect,test} from './legacy-test.ts';
import {pointAtHistory} from './history-gestures.ts';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
let dir:string,app:App,server:RunningServer;
test.beforeAll(async()=>{dir=mkdtempSync(join(tmpdir(),'drishya-json-focus-'));app=new App(dir);server=await startServer({app,port:0});});
test.afterAll(async()=>{await server.close();await app.close();if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('unsafe path');rmSync(dir,{recursive:true,force:true});});

for(const width of [1440,390])test(`Explore in tree focuses the selected late container at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 const sample=JSON.parse(readFileSync(resolve('apps/ui/public/demo/bundle.json'),'utf8')),op=sample.projection.operations.find((item:{kind:string})=>item.kind==='mcp');op.artifactIds=[];
 const raw=JSON.stringify({items:Array.from({length:500},(_,id)=>({id,detail:id===499?{label:'last captured record',value:'literal'}:null}))});
 op.detail={kind:'mcp',server:'records',tool:'list',input:{},resultPreview:raw};
 await page.route('**/demo/bundle.json',route=>route.fulfill({json:sample}));await page.goto(new URL('/?demo&experience=modern&motion=0',server.launchUrl).href);
 await expect(page.locator('.history')).toBeVisible();await pointAtHistory(page);await page.mouse.wheel(0,-100000);const card=page.locator(`article[data-op-id="${op.id}"]`);await card.scrollIntoViewIfNeeded();const trigger=card.getByRole('button',{name:/^(Open larger|Inspect data)$/});await trigger.click();
 const dialog=page.getByRole('dialog',{name:'Captured data',exact:true}),viewport=dialog.locator('.data-viewport');await expect(dialog.getByRole('table')).toBeVisible();
 await viewport.evaluate(element=>{element.scrollTop=element.scrollHeight;element.scrollLeft=element.scrollWidth;});await dialog.getByRole('button',{name:'Object · 2',exact:true}).click();
 await expect(dialog.getByRole('region',{name:'Selected data value',exact:true})).toContainText('/items/499/detail');const explore=dialog.getByRole('button',{name:'Explore in tree',exact:true});await explore.focus();await page.keyboard.press('Enter');
 const selected=dialog.locator('[role=treeitem][aria-selected=true]');await expect(selected).toBeFocused();await expect(selected).toContainText('detail');
 expect(await dialog.getByRole('treeitem').count()).toBeLessThan(29);await page.keyboard.press('ArrowRight');await expect(dialog.locator('[role=treeitem][aria-selected=true]')).toContainText('label');await expect(dialog.getByRole('region',{name:'Selected data value',exact:true})).toContainText('last captured record');
 await page.screenshot({path:resolve(`.local/structured-navigation-${width}.png`)});await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();
});
