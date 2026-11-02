import {build} from 'esbuild';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {test,expect} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
let dir:string,app:App,server:RunningServer;
test.beforeAll(async()=>{dir=mkdtempSync(join(tmpdir(),'drishya-stored-result-'));app=new App(join(dir,'data'));server=await startServer({app,port:0});});
test.afterAll(async()=>{await server?.close();await app?.close();if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('Unsafe scratch path');rmSync(dir,{recursive:true,force:true});});
async function imported(harness:'codex'|'claude-code',output:string,tag:string,structured?:unknown){
 const now='2026-10-31T00:00:00Z';
 const rows=harness==='claude-code'?[
  {timestamp:now,sessionId:tag,cwd:dir,type:'user',uuid:'p',message:{role:'user',content:'Inspect the synthetic result'}},
  {timestamp:now,sessionId:tag,cwd:dir,type:'assistant',uuid:'a',message:{id:'m',role:'assistant',content:[{type:'tool_use',id:'capture',name:'mcp__fixture__inspect',input:{query:'synthetic'}}]}},
  {timestamp:now,sessionId:tag,cwd:dir,type:'user',uuid:'r',...(structured!==undefined?{toolUseResult:structured}:{}),message:{role:'user',content:[{type:'tool_result',tool_use_id:'capture',content:output||[]}]}}
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
 await card.press('Enter');const inspector=page.getByRole('region',{name:'Operation detail'});
 await expect(inspector.locator('.stored-tool-result')).toContainText('Complete stored result');
 await inspector.getByRole('button',{name:'Show original result',exact:true}).click();
 expect(await inspector.locator('.stored-result-original').evaluate(node=>node.textContent)).toBe(output);
 await page.context().grantPermissions(['clipboard-read','clipboard-write']);await inspector.getByRole('button',{name:'Copy original result',exact:true}).click();expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(output);
 expect(await inspector.evaluate(node=>node.scrollWidth-node.clientWidth)).toBeLessThanOrEqual(1);
 const end=projection.timeline.findIndex(item=>item.type==='op-end'&&item.operationId===op.id);
 await page.goto(`${server.url}/?experience=modern&motion=0&at=${end+1}#/r/${id}`);
 const replayCard=page.locator(`article[data-op-id=${JSON.stringify(op.id)}]`);await replayCard.scrollIntoViewIfNeeded();await replayCard.press('Enter');
 const replayInspector=page.getByRole('region',{name:'Operation detail'});await expect(replayInspector.locator('.stored-tool-result')).toContainText('Complete stored result');
 const timeline=page.getByRole('slider',{name:'Timeline',exact:true});await timeline.press('ArrowLeft');
 await expect(replayInspector.locator('.stored-tool-result')).toHaveCount(0);await expect(replayInspector).not.toContainText('final text sibling');
});
test('oversized single line and malformed output retain every byte through bounded continuation',async({page})=>{
 const output='@{broken: '+ '😀दृश्य'.repeat(180_000)+' final unparsed sibling\r\n';
 const {id,op,projection}=await imported('claude-code',output,'oversized');
 const artifact=projection.artifacts.find(a=>op.artifactIds.includes(a.id)&&a.kind==='output');const artifactId=artifact?.id??`result:${op.id}`;
 await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
 const card=page.locator(`article[data-op-id=${JSON.stringify(op.id)}]`);await card.scrollIntoViewIfNeeded();await card.press('Enter');
 const inspector=page.getByRole('region',{name:'Operation detail'}),full=inspector.locator('.stored-tool-result');
 let joined='';for(let n=0;n<100;n++){
  await expect(full).toContainText('Stored byte portion');
  const raw=full.getByRole('button',{name:'Show original result',exact:true});if(await raw.count())await raw.click();
  const text=await full.locator('.stored-result-original').evaluate(node=>node.textContent??'');expect(new TextEncoder().encode(text).length).toBeLessThanOrEqual(256*1024);joined+=text;
  const next=full.getByRole('button',{name:'Next portion',exact:true});if(await next.isDisabled())break;await next.click();await expect(full.getByText('Opening stored result…',{exact:true})).toHaveCount(0);
 }
 expect(joined).toBe(output);
 const path=`/v1/recordings/${id}/artifacts/${encodeURIComponent(artifactId)}`;
 expect((await fetch(server.url+path+'?byteStart=0')).status).toBe(401);
 expect((await page.request.get(server.url+path+'?byteStart=NaN')).status()).toBe(400);
 // Like every other integer query on this server, a negative start is clamped to zero, never read from before the stored bytes.
 const negative=await page.request.get(server.url+path+'?byteStart=-1');expect(negative.status()).toBe(200);expect((await negative.json()).start).toBe(0);
});
test('missing stored result and read failure stay explicit with retry and labelled preview',async({page})=>{
 const {id,op}=await imported('codex','Literal stored sibling beyond the preview '+ 'x'.repeat(5000),'missing');
 await page.route('**/artifacts/*?byteStart=*',route=>route.fulfill({json:{available:false,reason:'no-longer-stored'}}));
 await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
 const card=page.locator(`article[data-op-id=${JSON.stringify(op.id)}]`);await card.scrollIntoViewIfNeeded();await card.press('Enter');
 const inspector=page.getByRole('region',{name:'Operation detail'});await expect(inspector).toContainText('no longer stored');await expect(inspector).toContainText('Available preview');await expect(inspector.getByRole('button',{name:'Copy original result',exact:true})).toHaveCount(0);
 await page.unroute('**/artifacts/*?byteStart=*');await page.route('**/artifacts/*?byteStart=*',route=>route.fulfill({status:503,json:{error:'synthetic temporary read failure'}}));await inspector.getByRole('button',{name:'Retry stored result',exact:true}).click();await expect(inspector).toContainText('Could not load stored result.');await page.unroute('**/artifacts/*?byteStart=*');await inspector.getByRole('button',{name:'Retry',exact:true}).click();await expect(inspector.locator('.stored-tool-result')).toContainText('Complete stored result');
});

for(const text of ['', 'Literal original result text'])test(`Claude separate structured siblings remain reachable with ${text?'mixed':'structured-only'} output`,async({page})=>{
 const structured={structuredContent:{finalField:'retained structured sibling',large:'x'.repeat(6000)},resources:[{uri:'fixture://retained',text:'retained resource sibling'}]};
 const {id,op}=await imported('claude-code',text,`separate-${text?'mixed':'only'}`,structured);
 await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
 const card=page.locator(`article[data-op-id=${JSON.stringify(op.id)}]`);await card.scrollIntoViewIfNeeded();await card.press('Enter');
 const full=page.getByRole('region',{name:'Operation detail'}).locator('.stored-tool-result');
 if(text){await expect(full.getByRole('combobox',{name:'Captured result field'})).toBeVisible();await full.getByRole('button',{name:'Show original result',exact:true}).click();expect(await full.locator('.stored-result-original').textContent()).toBe(text);await full.getByRole('combobox',{name:'Captured result field'}).selectOption('structured');}
 await expect(full).toContainText('Captured structured field · JSON formatting derived');
 const raw=full.getByRole('button',{name:'Show formatted structured field',exact:true});if(await raw.count())await raw.click();
 const serialized=await full.locator('.stored-result-original').textContent();expect(JSON.parse(serialized!)).toEqual(structured);await expect(full.getByRole('button',{name:'Copy original result',exact:true})).toHaveCount(0);
 await page.context().grantPermissions(['clipboard-read','clipboard-write']);await full.getByRole('button',{name:'Copy formatted structured field',exact:true}).click();expect(JSON.parse(await page.evaluate(()=>navigator.clipboard.readText()))).toEqual(structured);
});

test('reader invalidates replacement sources and unresolved revisions without replacing immutable reading',async({page})=>{
 const component=JSON.stringify(resolve('apps/ui/src/components/StoredToolResult.tsx').replaceAll('\\','/')),state=JSON.stringify(resolve('apps/ui/src/state.ts').replaceAll('\\','/'));
 const fixture=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import{StoredToolResult}from ${component};import{useApp}from ${state};
 const artifact={id:'art_op_out',kind:'output',blob:'a'.repeat(64),availability:'complete',provenance:{kind:'captured',observationIds:['receipt']}};
 const answer=text=>({artifact,available:true,text,start:0,next:text.length,totalBytes:text.length,hasMore:false});
 let calls=0,late=false;const first={kind:'daemon',artifactChunk:async()=>answer('First source captured text')};
 const second={kind:'daemon',artifactChunk:()=>{calls++;return new Promise(resolve=>{window.resolveSecond=()=>resolve(answer('Second source captured text'));});}};
 const third={kind:'daemon',artifactChunk:async()=>late?answer('Newly retained original bytes'):{available:false,reason:'not-captured'}};
 useApp.setState({source:first,recordingId:'rec_fixture',projection:{artifacts:[artifact]},renderedRevisions:{rec_fixture:1}});
 const op={id:'rec_fixture.op',detail:{kind:'mcp',resultPreview:'Preview'},artifactIds:[artifact.id],observationIds:['receipt'],status:'ok',endSequence:2};
 window.swap=()=>useApp.setState({source:second});window.append=()=>useApp.setState({renderedRevisions:{rec_fixture:2}});window.calls=()=>calls;
 window.unresolved=()=>useApp.setState({source:third});window.retain=()=>{late=true;useApp.setState({renderedRevisions:{rec_fixture:3}});};
 createRoot(document.getElementById('root')).render(<StoredToolResult op={op} full/>);`,loader:'tsx',resolveDir:resolve('apps/ui')},bundle:true,write:false,format:'iife',platform:'browser',loader:{'.css':'empty'},define:{'process.env.NODE_ENV':'"production"'}});
 await page.route('**/stored-source-fixture',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><div id="root"></div><script>${fixture.outputFiles[0]!.text}</script>`}));await page.goto(server.url+'/stored-source-fixture');
 const reading=page.getByRole('region',{name:'Stored captured result'});await expect(reading).toContainText('First source captured text');await page.evaluate(()=>{(window as any).swap();});await expect(reading).toContainText('Opening stored result');await expect(reading).not.toContainText('First source captured text');await page.evaluate(()=>{(window as any).resolveSecond();});await expect(reading).toContainText('Second source captured text');
 await reading.getByRole('button',{name:'Show original result',exact:true}).click();await reading.locator('pre').evaluate(el=>{const range=document.createRange();range.selectNodeContents(el);getSelection()?.removeAllRanges();getSelection()?.addRange(range);});
 const before=await page.evaluate(()=>(window as any).calls());await page.evaluate(()=>{(window as any).append();});await page.evaluate(()=>new Promise<void>(done=>requestAnimationFrame(()=>requestAnimationFrame(()=>done()))));expect(await page.evaluate(()=>(window as any).calls())).toBe(before);expect(await page.evaluate(()=>getSelection()?.toString())).toBe('Second source captured text');
 await page.evaluate(()=>{(window as any).unresolved();});await expect(reading).toContainText('Result bytes were not captured');await page.evaluate(()=>{(window as any).retain();});await expect(reading).toContainText('Newly retained original bytes');
});
