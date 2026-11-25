import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep,basename} from 'node:path';
import {test,expect,type Page,type Locator} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from './browser-server.ts';

const path='src/backend/adapters/very-long-command-registration-and-configuration-handler.spec.ts';
const extraPaths=['configuration.directory/README-WITHOUT-EXTENSION-AND-A-VERY-LONG-NAME','.project-settings-for-an-extended-runtime'];
let dir:string,app:App,server:RunningServer;
const ids:Record<string,string>={};
test.beforeAll(async()=>{
 dir=mkdtempSync(join(tmpdir(),'drishya-ui16-'));mkdirSync(join(dir,'src/backend/adapters'),{recursive:true});
 writeFileSync(join(dir,path),'export const value = 1;\n');
 const claude:unknown[]=[{type:'user',uuid:'u',sessionId:'ui16',cwd:dir,message:{role:'user',content:'Update the synthetic adapter.'}},
  {type:'assistant',uuid:'a',sessionId:'ui16',cwd:dir,message:{role:'assistant',content:[{type:'tool_use',id:'edit',name:'Edit',input:{file_path:join(dir,path),old_string:'value = 1',new_string:'value = 2'}}]}},
  {type:'user',uuid:'r',sessionId:'ui16',cwd:dir,message:{role:'user',content:[{type:'tool_result',tool_use_id:'edit',content:'File updated.'}]}}];
 const patch=`*** Begin Patch\n*** Update File: ${path}\n@@\n-export const value = 1;\n+export const value = 2;\n*** End Patch`;
 const codex:unknown[]=[{type:'session_meta',payload:{id:'ui16-codex',cwd:dir}},{type:'response_item',payload:{type:'message',role:'user',content:[{type:'input_text',text:'Update the synthetic adapter.'}]}},
  {type:'response_item',payload:{type:'custom_tool_call',call_id:'edit',name:'apply_patch',input:patch}},
  {type:'response_item',payload:{type:'custom_tool_call_output',call_id:'edit',output:`Success. Updated the following files:\nM ${path}`}}];
 for(const [index,extra] of extraPaths.entries()){
  mkdirSync(join(dir,extra,'..'),{recursive:true});writeFileSync(join(dir,extra),'alpha\n');
  claude.push({type:'assistant',uuid:`extra-a${index}`,sessionId:'ui16',cwd:dir,message:{role:'assistant',content:[{type:'tool_use',id:`extra${index}`,name:'Edit',input:{file_path:join(dir,extra),old_string:'alpha',new_string:'beta'}}]}},{type:'user',uuid:`extra-r${index}`,sessionId:'ui16',cwd:dir,message:{role:'user',content:[{type:'tool_result',tool_use_id:`extra${index}`,content:'File updated.'}]}});
  codex.push({type:'response_item',payload:{type:'custom_tool_call',call_id:`extra${index}`,name:'apply_patch',input:`*** Begin Patch\n*** Update File: ${extra}\n@@\n-alpha\n+beta\n*** End Patch`}},{type:'response_item',payload:{type:'custom_tool_call_output',call_id:`extra${index}`,output:`Success. Updated the following files:\nM ${extra}`}});
 }
 app=new App(join(dir,'store'));
 for(const [harness,rows] of [['claude-code',claude],['codex',codex]] as const){const file=join(dir,`${harness}.jsonl`);writeFileSync(file,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');ids[harness]=(await app.ingest.importSource(harness,file)).recordingId;}
 server=await startServer({app,port:0});mkdirSync('.local',{recursive:true});
});
for(const harness of ['claude-code','codex'])test(`${harness} keeps dotted folders, dotfiles and extensionless names literal`,async({page})=>{
 await page.setViewportSize({width:1440,height:900});const {explorer}=await open(page,ids[harness]);
 const resize=explorer.getByRole('separator',{name:'Resize Files reading space'});await resize.press('Home');
 const folder=explorer.getByRole('treeitem',{name:'configuration.directory',exact:true});await folder.click();await expect(folder.locator('.file-row-extension')).toHaveCount(0);
 for(const extra of extraPaths){
  const row=explorer.locator(`[data-spine-path=${JSON.stringify(extra)}]`),name=row.locator('.file-row-name');
  await expect(row).toBeVisible();await expect(name).toHaveText(basename(extra));await expect(row.locator('.file-change')).toHaveText('E');await expect(row.locator('.file-row-extension')).toHaveCount(0);
  expect(await name.evaluate(el=>({ellipsis:getComputedStyle(el).textOverflow,clipped:el.scrollWidth>el.clientWidth}))).toEqual({ellipsis:'ellipsis',clipped:true});
  expect((await geometry(row)).overflow).toBeLessThanOrEqual(1);
 }
 // Search labels contain full relative paths; a dotted parent is not a filename extension.
 await explorer.getByRole('textbox',{name:'Find repository files'}).fill(extraPaths[0]);
 const found=explorer.locator(`[data-spine-path=${JSON.stringify(extraPaths[0])}]`);await expect(found.locator('.file-row-name')).toHaveText(extraPaths[0]);await expect(found.locator('.file-row-extension')).toHaveCount(0);
});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('Unsafe temporary directory');rmSync(dir,{recursive:true,force:true});}});
async function open(page:Page,id:string){
 await page.route('**/v1/working-locations',route=>route.request().method()==='GET'?route.fulfill({json:{version:1,sessions:[]}}):route.continue());
 await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);await expect(page.locator('.viewer')).toBeVisible();
 if(!await page.locator('.folder-explorer').isVisible())await page.getByRole('button',{name:'Show files',exact:true}).click();
 const explorer=page.locator('.folder-explorer');for(const name of ['src','backend','adapters'])await explorer.getByRole('treeitem',{name,exact:true}).click();
 const row=explorer.getByRole('treeitem',{name:basename(path),exact:true});await expect(row).toBeVisible();await expect(row.locator('.file-change')).toHaveText('E');return {explorer,row};
}
async function geometry(row:Locator){return row.evaluate(el=>{
 const name=el.querySelector<HTMLElement>('.file-row-name')!,badge=el.querySelector<HTMLElement>('.file-evidence')!,r=el.getBoundingClientRect(),n=name.getBoundingClientRect(),b=badge.getBoundingClientRect();
 return {name:n.width,badge:b.width,gap:b.left-n.right,right:r.right-b.right,overflow:el.scrollWidth-el.clientWidth,grow:getComputedStyle(badge).flexGrow};
});}
for(const harness of ['claude-code','codex'])for(const width of [600,1440])test(`${harness} Files gives available width to the name at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});const {explorer,row}=await open(page,ids[harness]);
 const resize=explorer.getByRole('separator',{name:'Resize Files reading space'});
 const readings=[];
 for(const key of width===1440?['Home','End']:['']){
  if(key){await resize.press(key);await expect(resize).toHaveAttribute('aria-valuenow',key==='Home'?'220':'420');}
  const measured=await geometry(row);readings.push({...measured,rail:(await explorer.boundingBox())!.width});
  await explorer.screenshot({path:resolve(`.local/ui16-rail-${width}-${key||'overlay'}.png`)});
  expect(measured.badge).toBeLessThan(32);expect(measured.grow).toBe('0');expect(measured.gap).toBeLessThanOrEqual(10);expect(measured.right).toBeLessThanOrEqual(12);expect(measured.overflow).toBeLessThanOrEqual(1);
  // Compare literal DOM text: Chromium innerText inserts a layout newline between flex items.
  await expect(row).toHaveAttribute('title',path);await expect(row.locator('.file-row-name')).toHaveText(basename(path));
  await expect(row.locator('.file-row-extension')).toHaveText('.ts');
  expect(await row.locator('.file-row-extension').evaluate(el=>el.getBoundingClientRect().width>=el.scrollWidth-1)).toBe(true);
 }
 if(readings.length===2)expect(Math.abs((readings[1].name-readings[0].name)-(readings[1].rail-readings[0].rail))).toBeLessThanOrEqual(2);
 writeFileSync(resolve(`.local/ui16-metrics-${harness}-${width}.json`),JSON.stringify({harness,width,readings}));
 expect(await explorer.locator('.folder-tree').evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
 await page.screenshot({path:resolve(`.local/ui16-${harness}-${width}.png`)});
});
