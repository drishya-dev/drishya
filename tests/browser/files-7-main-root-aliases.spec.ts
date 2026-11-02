import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {test,expect,type Page} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
import {recordedFileRoots} from '../../apps/daemon/src/file-roots.ts';
let dir:string,id:string,alias:string,other:string,app:App,server:RunningServer;
const path='src/main.ts';
test.beforeAll(async()=>{
 dir=mkdtempSync(join(tmpdir(),'drishya-main-alias-browser-'));const main=join(dir,'repo'),worker=join(dir,'worker');
 mkdirSync(join(main,'src'),{recursive:true});mkdirSync(join(worker,'src'),{recursive:true});
 writeFileSync(join(main,path),'export const currentMain = true;\n');
 const journal=join(dir,'session.jsonl');
 const rows=[main,worker].flatMap((cwd,i)=>[
  {type:'assistant',uuid:`a${i}`,sessionId:'main-alias-browser',cwd,message:{content:[{type:'tool_use',id:`read${i}`,name:'Read',input:{file_path:join(cwd,path)}}]}},
  {type:'user',uuid:`r${i}`,sessionId:'main-alias-browser',cwd,message:{content:[{type:'tool_result',tool_use_id:`read${i}`,content:`     1\t// captured ${i===0?'main':'worker'} source`}]}}
 ]);
 writeFileSync(journal,rows.map((row,i)=>JSON.stringify({...row,timestamp:new Date(Date.UTC(2026,9,29,0,0,i)).toISOString()})).join('\n')+'\n');
 app=new App(join(dir,'data'));id=(await app.ingest.importSource('claude-code',journal)).recordingId;
 const metadata=await recordedFileRoots(app.store,[id]);const primary=metadata.roots.find(root=>root.root.replaceAll('\\','/')===main.replaceAll('\\','/'))!;
 alias=primary.prefix+'/'+path;other=metadata.roots.find(root=>root.prefix!==primary.prefix)!.prefix+'/'+path;
});
test.beforeEach(async()=>{server=await startServer({app,port:0});});
test.afterEach(async()=>{await server?.close();});
test.afterAll(async()=>{await app?.close();if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});});
async function open(page:Page,width:number){
 await page.setViewportSize({width,height:900});
 await page.route('**/v1/working-locations',route=>route.request().method()==='GET'?route.fulfill({json:{version:1,sessions:[]}}):route.continue());
 await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
 await expect(page.locator('.viewer')).toBeVisible();
}
async function choose(page:Page,identity:string,keyboard=false){
 const trigger=page.getByRole('button',{name:'Choose workspace file',exact:true});
 if(await trigger.isVisible()&&await trigger.getAttribute('aria-expanded')==='false')await trigger.click();
 else if(!await page.locator('.folder-explorer').isVisible())await page.getByRole('button',{name:'Show files',exact:true}).click();
 await page.getByRole('textbox',{name:'Find repository files',exact:true}).fill('main.ts');
 const row=page.locator(`[data-spine-path="${identity}"]`);if(keyboard)await row.press('Enter');else await row.click();
}
for(const width of [600,1440]){
 test(`main alias keeps identity through explicit current reading and back at ${width}px`,async({page})=>{
  const before=app.projection(id).files.map(file=>file.path);
  await open(page,width);await choose(page,alias);const captured=page.locator('.file-workspace');
  await expect(captured).toContainText('captured main source');await expect(page.locator('.current-file-reader')).toHaveCount(0);
  const enable=captured.getByRole('button',{name:'Enable workspace reading',exact:true});
  const read=captured.getByRole('button',{name:'Read file on disk',exact:true});await expect(enable.or(read)).toBeVisible();
  if(await enable.isVisible())await enable.click();else await read.click();
  const current=page.locator('.current-file-reader');await expect(current.locator('.current-file-code')).toContainText('currentMain');
  const recorded=current.getByRole('button',{name:'Agent work on this file',exact:true});
  if(!await recorded.isVisible())await current.getByLabel('Reading options',{exact:true}).press('Enter');
  await recorded.click();
  await expect(captured).toContainText('captured main source');await expect(captured).not.toContainText('No matching actions.');
  await captured.getByRole('button',{name:'Read file on disk',exact:true}).click();
  await expect(current.locator('.current-file-code')).toContainText('currentMain');
  if(width===1440){await choose(page,alias);await page.locator(`[data-spine-path="${alias}"]`).dblclick();await expect(current.locator(`[data-peek-path="${path}"]`)).not.toHaveClass(/preview/);await current.getByRole('button',{name:'Agent work on this file',exact:true}).click();await expect(captured).toContainText('captured main source');}
  expect(app.projection(id).files.map(file=>file.path)).toEqual(before);expect(before).toContain(alias);expect(before).toContain(other);
 });
 test(`approved Files alias opens Workspace with Enter and outside root stays at ${width}px`,async({page})=>{
  await open(page,width);await page.getByRole('button',{name:'Open developer workspace',exact:true}).click();
  const desk=page.getByRole('region',{name:'Developer workspace',exact:true});const approve=desk.getByRole('button',{name:'Approve workspace reading',exact:true});
  await expect(approve.or(desk.getByRole('tablist'))).toBeVisible();if(await approve.isVisible())await approve.click();
  await choose(page,alias,true);await expect(desk.getByRole('region',{name:`Workspace file ${path}`,exact:true}).locator('.desk-code')).toContainText('currentMain');
  await expect(page.locator('.file-workspace')).toHaveCount(0);await desk.getByRole('button',{name:'Back to agent',exact:true}).click();
  await choose(page,other);const captured=page.locator('.file-workspace');await expect(captured).toContainText('captured worker source');
  await expect(captured.getByRole('button',{name:'Read file on disk',exact:true})).toHaveCount(0);
 });
}
