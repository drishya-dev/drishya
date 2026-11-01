import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {expect,test} from './legacy-test.ts';
import {pointAtHistory} from './history-gestures.ts';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
let dir:string,app:App,server:RunningServer;
test.beforeAll(async()=>{dir=mkdtempSync(join(tmpdir(),'drishya-inline-json-'));app=new App(dir);server=await startServer({app,port:0,token:'synthetic-inline-json'});});
test.afterAll(async()=>{await server.close();await app.close();if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('unsafe path');rmSync(dir,{recursive:true,force:true});});

// CONTENT-10: complete JSON is read in the card itself; nothing resident says "Inspect data" and nothing captured is hidden.
async function open(page:import('@playwright/test').Page,raw:string){
 const sample=JSON.parse(readFileSync(resolve('apps/ui/public/demo/bundle.json'),'utf8')),op=sample.projection.operations.find((item:{kind:string})=>item.kind==='mcp');op.artifactIds=[];
 op.detail={kind:'mcp',server:'records',tool:'list',input:{},resultPreview:raw};
 await page.route('**/demo/bundle.json',route=>route.fulfill({json:sample}));await page.goto(new URL('/?demo&experience=modern&motion=0',server.launchUrl).href);
 await expect(page.locator('.history')).toBeVisible();await pointAtHistory(page);await page.mouse.wheel(0,-100000);
 const card=page.locator(`article[data-op-id="${op.id}"]`);await card.scrollIntoViewIfNeeded();return card;
}
for(const width of [600,1440])test(`complete JSON reads inline with exact Original at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 const raw=JSON.stringify({rows:[{id:1,name:'alpha'},{id:2,name:'beta'}],next:null});
 const card=await open(page,raw),reading=card.getByRole('region',{name:'Captured data reading',exact:true});
 await expect(reading).toBeVisible();await expect(reading.getByRole('tree',{name:'Captured JSON tree',exact:true})).toBeVisible();
 await expect(card.getByRole('button',{name:'Inspect data',exact:true})).toHaveCount(0);await expect(card.getByText('Choose reading format')).toHaveCount(0);
 await reading.getByRole('button',{name:'Original',exact:true}).press('Enter');await expect(reading.locator('.data-original')).toHaveText(raw);
 await reading.getByRole('button',{name:'Open larger',exact:true}).press('Enter');
 const dialog=page.getByRole('dialog',{name:'Captured data',exact:true});await expect(dialog).toBeVisible();await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
});
test('a JSON field inside a wrapper never replaces the sibling text',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 const raw=JSON.stringify({content:[{type:'text',text:'Sibling stays visible'},{type:'text',mimeType:'application/json',text:JSON.stringify({a:1,b:[1,2,3]},null,2)}]});
 const card=await open(page,raw);
 await expect(card.getByRole('region',{name:'Captured data reading',exact:true})).toHaveCount(0);await expect(card).toContainText('Sibling stays visible');
});
test('text that is not complete JSON stays literal',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 const card=await open(page,'{"rows":[{"id":1,');
 await expect(card.getByRole('region',{name:'Captured data reading',exact:true})).toHaveCount(0);await expect(card).toContainText('{"rows":[{"id":1,');
});
