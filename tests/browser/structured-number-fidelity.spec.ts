import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {test,expect,type Page} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
let dir:string,app:App,server:RunningServer;
const row='{"id":9007199254740993,"amount":1.2300,"negative":-0,"large":1e400,"tiny":1e-400,"text":"9007199254740993"}',raw=`{"items":[${row}]}`;
test.beforeAll(async()=>{dir=mkdtempSync(join(tmpdir(),'drishya-number-fidelity-'));app=new App(dir);server=await startServer({app,port:0});});
test.afterAll(async()=>{await server?.close();await app?.close();if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});});
async function open(page:Page,kind:'mcp'|'shell'){
 await page.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{(window as any).copied=text;}}});});
 const sample=JSON.parse(readFileSync(resolve('apps/ui/public/demo/bundle.json'),'utf8')),op=sample.projection.operations.find((x:{kind:string})=>x.kind==='mcp');sample.projection.operations=[op];sample.projection.prose=[];sample.projection.timeline=sample.projection.timeline.filter((x:{operationId?:string})=>x.operationId===op.id);sample.projection.passages=[{id:'numbers',agentId:op.agentId,operationIds:[op.id],proseIds:[],firstStep:1,lastStep:2}];op.kind=kind;op.artifactIds=[];op.detail=kind==='mcp'?{kind:'mcp',server:'records',tool:'numbers',input:{},resultPreview:raw}:{kind:'shell',command:'synthetic captured numbers',outputPreview:raw,exitCode:0};
 await page.route('**/demo/bundle.json',route=>route.fulfill({json:sample}));await page.goto(new URL('/?demo&experience=modern&motion=0',server.launchUrl).href);await page.locator(`article[data-op-id="${op.id}"]`).getByRole('button',{name:/^(Open larger|Inspect data)$/}).press('Enter');return page.getByRole('dialog',{name:'Captured data',exact:true});
}
for(const kind of ['mcp','shell'] as const)test(`${kind} preserves captured number spelling in table, tree, copy and Original`,async({page})=>{
 await page.setViewportSize({width:390,height:844});const dialog=await open(page,kind),table=dialog.getByRole('table',{name:'Captured records',exact:true});await expect(table).toBeVisible();const cells=table.getByRole('cell');
 for(const [index,value] of ['9007199254740993','1.2300','-0','1e400','1e-400'].entries())await expect(cells.nth(index)).toHaveText(value);
 await cells.first().getByRole('button').press('Enter');const selected=dialog.getByRole('region',{name:'Selected data value',exact:true});await expect(selected.locator('pre')).toHaveText('9007199254740993');await selected.getByRole('button',{name:'Copy value',exact:true}).press('Enter');await expect.poll(()=>page.evaluate(()=>(window as any).copied)).toBe('9007199254740993');
 await dialog.getByRole('button',{name:'Tree',exact:true}).press('Enter');const search=dialog.getByRole('textbox',{name:'Find key or value',exact:true});await search.fill('/items/0');await dialog.locator('.data-value[title="/items/0"]').press('Enter');await selected.getByRole('button',{name:'Copy value',exact:true}).press('Enter');await expect.poll(()=>page.evaluate(()=>(window as any).copied)).toBe(row);
 await search.fill('9007199254740993');await expect(dialog.locator('.data-tree-row')).toHaveCount(2);await expect(dialog.locator('.data-tree-row').first()).toContainText('9007199254740993');await dialog.getByRole('button',{name:'Original',exact:true}).press('Enter');await expect(dialog.locator('.data-original')).toHaveText(raw);await dialog.getByRole('button',{name:'Copy original',exact:true}).press('Enter');await expect.poll(()=>page.evaluate(()=>(window as any).copied)).toBe(raw);
 const bounds=(await dialog.boundingBox())!;expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(391);
});
test('a parser without primitive source context keeps exact Original instead of rounded inspection',async({page})=>{
 await page.addInitScript(()=>{const parse=JSON.parse;JSON.parse=(text,reviver)=>parse(text,reviver?function(key,value){return reviver.call(this,key,value);}:undefined);});const dialog=await open(page,'mcp');await expect(dialog.getByRole('table')).toHaveCount(0);await expect(dialog).toContainText('lossless number support');await expect(dialog.locator('.data-original')).toHaveText(raw);await dialog.getByRole('button',{name:'Copy original',exact:true}).press('Enter');await expect.poll(()=>page.evaluate(()=>(window as any).copied)).toBe(raw);
});
