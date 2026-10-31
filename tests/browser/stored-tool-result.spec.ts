import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {test,expect} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
let dir:string,app:App,server:RunningServer;
test.beforeAll(async()=>{dir=mkdtempSync(join(tmpdir(),'drishya-stored-result-'));app=new App(join(dir,'data'));server=await startServer({app,port:0});});
test.afterAll(async()=>{await server?.close();await app?.close();if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('Unsafe scratch path');rmSync(dir,{recursive:true,force:true});});
async function imported(harness:'codex'|'claude-code',output:string,tag:string){
 const now='2026-10-31T00:00:00Z';
 const rows=harness==='claude-code'?[
  {timestamp:now,sessionId:tag,cwd:dir,type:'user',uuid:'p',message:{role:'user',content:'Inspect the synthetic result'}},
  {timestamp:now,sessionId:tag,cwd:dir,type:'assistant',uuid:'a',message:{id:'m',role:'assistant',content:[{type:'tool_use',id:'capture',name:'mcp__fixture__inspect',input:{query:'synthetic'}}]}},
  {timestamp:now,sessionId:tag,cwd:dir,type:'user',uuid:'r',message:{role:'user',content:[{type:'tool_result',tool_use_id:'capture',content:output}]}}
 ]:[{type:'session_meta',payload:{id:tag,cwd:dir}},
 {timestamp:now,type:'response_item',payload:{type:'message',role:'user',content:[{type:'input_text',text:'Inspect the synthetic result'}]}},
 {timestamp:now,type:'response_item',payload:{type:'function_call',call_id:'capture',name:'mcp__fixture__inspect',arguments:'{}'}},
 {timestamp:now,type:'response_item',payload:{type:'function_call_output',call_id:'capture',output}}];
 const path=join(dir,tag+'.jsonl');writeFileSync(path,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');
 const id=(await app.ingest.importSource(harness,path)).recordingId,projection=app.projection(id);
 const op=projection.operations.find(o=>o.detail.kind==='mcp')!;expect(op).toBeTruthy();
 return{id,op,projection};
}
for(const harness of ['claude-code','codex'] as const)for(const width of [600,1440])test(`stored mixed result reaches its final sibling and original ${harness} ${width}`,async({page})=>{
 await page.setViewportSize({width,height:950});
 const output=JSON.stringify({content:[{type:'text',text:'begin\n'+'body text '.repeat(2200)+'\nfinal text sibling'},{type:'text',text:'second recorded sibling'}],structuredContent:{lastField:'last structured sibling'}});
 const {id,op,projection}=await imported(harness,output,`${harness}-${width}`);
 expect('resultPreview' in op.detail&&op.detail.resultPreview!.length).toBeLessThan(output.length);
 await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
 const card=page.locator(`article[data-op-id=${JSON.stringify(op.id)}]`);await card.scrollIntoViewIfNeeded();
 await card.locator('button.op-expand').click();const full=card.locator('.stored-tool-result');
 await expect(full).toContainText('Complete stored result');
 await full.getByRole('button',{name:'Show original result',exact:true}).click();
 expect(await full.locator('.stored-result-original').evaluate(node=>node.textContent)).toBe(output);
 await full.getByRole('button',{name:'Read formatted result',exact:true}).click();
 await card.press('Enter');const inspector=page.getByRole('complementary',{name:'Operation detail'});
 await expect(inspector.locator('.stored-tool-result')).toContainText('Complete stored result');
 await inspector.getByRole('button',{name:'Show original result',exact:true}).click();
 expect(await inspector.locator('.stored-result-original').evaluate(node=>node.textContent)).toBe(output);
 await page.context().grantPermissions(['clipboard-read','clipboard-write']);await inspector.getByRole('button',{name:'Copy original result',exact:true}).click();expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(output);
 expect(await inspector.evaluate(node=>node.scrollWidth-node.clientWidth)).toBeLessThanOrEqual(1);
 const end=projection.timeline.findIndex(item=>item.type==='op-end'&&item.operationId===op.id);
 await page.goto(`${server.url}/?experience=modern&motion=0&at=${end+1}#/r/${id}`);
 const replayCard=page.locator(`article[data-op-id=${JSON.stringify(op.id)}]`);await replayCard.scrollIntoViewIfNeeded();await replayCard.press('Enter');
 const replayInspector=page.getByRole('complementary',{name:'Operation detail'});await expect(replayInspector.locator('.stored-tool-result')).toContainText('Complete stored result');
 const timeline=page.getByRole('slider',{name:'Timeline',exact:true});await timeline.press('ArrowLeft');
 await expect(replayInspector.locator('.stored-tool-result')).toHaveCount(0);await expect(replayInspector).not.toContainText('final text sibling');
});
test('oversized single line and malformed output retain every byte through bounded continuation',async({page})=>{
 const output='@{broken: '+ '😀दृश्य'.repeat(180_000)+' final unparsed sibling\r\n';
 const {id,op,projection}=await imported('claude-code',output,'oversized');
 const artifact=projection.artifacts.find(a=>op.artifactIds.includes(a.id)&&a.kind==='output')!;expect(artifact).toBeTruthy();
 await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
 const card=page.locator(`article[data-op-id=${JSON.stringify(op.id)}]`);await card.scrollIntoViewIfNeeded();await card.press('Enter');
 const inspector=page.getByRole('complementary',{name:'Operation detail'}),full=inspector.locator('.stored-tool-result');
 let joined='';for(let n=0;n<100;n++){
  await expect(full).toContainText('Stored byte portion');
  const raw=full.getByRole('button',{name:'Show original result',exact:true});if(await raw.count())await raw.click();
  const text=await full.locator('.stored-result-original').evaluate(node=>node.textContent??'');expect(new TextEncoder().encode(text).length).toBeLessThanOrEqual(256*1024);joined+=text;
  const next=full.getByRole('button',{name:'Next portion',exact:true});if(await next.isDisabled())break;await next.click();await expect(full.getByText('Opening stored result…',{exact:true})).toHaveCount(0);
 }
 expect(joined).toBe(output);
 const path=`/v1/recordings/${id}/artifacts/${encodeURIComponent(artifact.id)}`;
 expect((await fetch(server.url+path+'?byteStart=0')).status).toBe(401);
 expect((await page.request.get(server.url+path+'?byteStart=NaN')).status()).toBe(400);
 expect((await page.request.get(server.url+path+'?byteStart=-1')).status()).toBe(400);
});
test('missing stored result and read failure stay explicit with retry and labelled preview',async({page})=>{
 const {id,op}=await imported('codex','Literal stored sibling beyond the preview '+ 'x'.repeat(5000),'missing');
 await page.route('**/artifacts/*?byteStart=*',route=>route.fulfill({json:{available:false,reason:'no-longer-stored'}}));
 await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
 const card=page.locator(`article[data-op-id=${JSON.stringify(op.id)}]`);await card.scrollIntoViewIfNeeded();await card.press('Enter');
 const inspector=page.getByRole('complementary',{name:'Operation detail'});await expect(inspector).toContainText('no longer stored');await expect(inspector).toContainText('Available preview');await expect(inspector.getByRole('button',{name:'Copy original result',exact:true})).toHaveCount(0);
 await page.unroute('**/artifacts/*?byteStart=*');await page.reload();await expect(inspector.locator('.stored-tool-result')).toContainText('Complete stored result');
});
