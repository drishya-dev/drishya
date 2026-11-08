import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {test,expect} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
import {searchDestination} from '../../apps/ui/src/lib/search-destination.ts';

let dir:string,app:App,server:RunningServer;
const samples=new Map<string,string>();
test.beforeAll(async()=>{
 dir=mkdtempSync(join(tmpdir(),'drishya-search-position-'));app=new App(join(dir,'data'));server=await startServer({app,port:0});
 for(const harness of ['claude-code','codex'] as const){
  const timestamp='2026-11-08T00:00:00Z',rows:unknown[]=harness==='codex'?[{type:'session_meta',payload:{id:harness,cwd:dir}}]:[];
  for(let n=0;n<5100;n++){
   if(n%50===0)rows.push(harness==='codex'?{timestamp,type:'response_item',payload:{type:'message',role:'user',content:[{type:'input_text',text:n===0?'promptdestination':'Continue synthetic work'}]}}:{timestamp,type:'user',uuid:`prompt-${n}`,sessionId:harness,cwd:dir,message:{role:'user',content:n===0?'promptdestination':'Continue synthetic work'}});
   const call=`call-${n}`,command=`echo synthetic-${n}`,output=n===1?'resultdestination':`output-${n}`;
   if(harness==='codex'){
    rows.push({timestamp,type:'response_item',payload:{type:'function_call',name:n===1?'exec':'functions.exec_command',call_id:call,arguments:JSON.stringify(n===1?{code:'text(await tools.exec_command({cmd:"echo child"}));'}:{cmd:command})}});
    if(n===1)rows.push({timestamp,type:'event_msg',payload:{type:'item_completed',thread_id:'synthetic',turn_id:'turn',item:{type:'CommandExecution',id:'child',command:['pwsh','-Command','echo child'],cwd:dir,status:'completed',exit_code:0,aggregated_output:'child output'}}});
    rows.push({timestamp,type:'response_item',payload:{type:'function_call_output',call_id:call,output}});
   }else rows.push({timestamp,type:'assistant',uuid:call,sessionId:harness,cwd:dir,message:{content:[{type:'tool_use',id:call,name:'Bash',input:{command}}]}},{timestamp,type:'user',uuid:call+'-result',sessionId:harness,cwd:dir,message:{content:[{type:'tool_result',tool_use_id:call,content:output}]}});
  }
  const path=join(dir,harness+'.jsonl');writeFileSync(path,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');samples.set(harness,(await app.ingest.importSource(harness,path)).recordingId);
 }
});
test.afterAll(async()=>{await server?.close();await app?.close();if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('Unsafe scratch path');rmSync(dir,{recursive:true,force:true});});
for(const harness of ['claude-code','codex'])for(const width of [600,1440])test(`search positions unloaded prompts and tool receipts ${harness} ${width}`,async({page})=>{
 const id=samples.get(harness)!,projection=app.projection(id);expect(app.paged(id)).toBe(true);
 await page.setViewportSize({width,height:950});await page.route('**/v1/working-locations',route=>route.request().method()==='GET'?route.fulfill({json:{version:1,sessions:[]}}):route.continue());
 await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?motion=0#/r/${id}`);
 const history=page.locator('.history');await expect.poll(()=>history.evaluate(el=>el.scrollTop)).toBeGreaterThan(1000);
 const end=await history.evaluate(el=>el.scrollTop);
 for(const query of ['promptdestination','resultdestination']){
  await page.keyboard.press('/');const response=page.waitForResponse(r=>r.url().includes(`/recordings/${id}/search?`));await page.getByLabel('Search prose, commands, paths',{exact:true}).fill(query);
  const hits=(await(await response).json()).hits;expect(hits).toHaveLength(1);const target=searchDestination(projection,hits[0].observationId)!;expect(target).toBeDefined();
  await page.locator('.search-hit').click();await expect(page.locator('.search:popover-open')).toHaveCount(0);
  if(target.kind==='operation')await expect(page.getByRole('region',{name:'Operation detail',exact:true})).toBeVisible();
  const selector=target.kind==='operation'?`[data-op-id="${target.id}"]`:`.passage-slot[data-in-turn="${target.step-1}"]`;
  await expect.poll(()=>page.locator(selector).first().evaluate(el=>{const r=el.getBoundingClientRect(),h=el.closest('.history')!.getBoundingClientRect();return r.bottom>h.top&&r.top<h.bottom;}).catch(()=>false)).toBe(true);
  expect(await history.evaluate(el=>el.scrollTop)).toBeLessThan(end-500);
  // Capture can keep running; selecting a hit must leave the live camera detached.
  await expect(page.getByRole('switch',{name:'Automatically follow new work',exact:true})).not.toBeChecked();
 }
});
