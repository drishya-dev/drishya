import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {test,expect} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
let dir:string,app:App,server:RunningServer;
test.beforeAll(async()=>{dir=mkdtempSync(join(tmpdir(),'drishya-web-accept-'));app=new App(join(dir,'data'));server=await startServer({app,port:0});});
test.afterAll(async()=>{await server?.close();await app?.close();if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});});
const title='A long recorded result title that must stay readable after expanding the card: '+ 'full title words '.repeat(7);
for(const width of [600,1440])test(`expanded recorded web results show full supplied titles and original output at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 const links=Array.from({length:9},(_,i)=>({title:i===0?title:`Recorded result ${i}`,url:`https://example.invalid/result/${i}`}));
 const output=`Web search results for query: "synthetic result acceptance"\n\nLinks: ${JSON.stringify(links)}\n\nA literal recorded sibling.`;
 const base={timestamp:'2026-10-25T00:00:00Z',sessionId:`web-${width}`,cwd:dir};
 const rows=[{...base,type:'user',uuid:'p',message:{role:'user',content:'Look at the recorded web results'}},{...base,type:'assistant',uuid:'a',message:{id:'m',role:'assistant',content:[{type:'tool_use',id:'w',name:'WebSearch',input:{query:'synthetic result acceptance'}}]}},{...base,type:'user',uuid:'r',message:{role:'user',content:[{type:'tool_result',tool_use_id:'w',content:output}]}}];
 const source=join(dir,`web-${width}.jsonl`);writeFileSync(source,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');const id=(await app.ingest.importSource('claude-code',source)).recordingId;
 let fetched=0;await page.context().route('https://example.invalid/**',route=>{fetched++;return route.fulfill({body:'Explicit current page'});});
 await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
 const card=page.locator('article.op').filter({hasText:'synthetic result acceptance'}).first();await expect(card.locator('.web-results li')).toHaveCount(5);await expect(card.locator('.web-more')).toContainText('4 more in preview');
 const expand=card.locator('button.op-expand');await expand.focus();await expand.press('Enter');const full=card.locator('.op-expanded .web-results');await expect(full.locator('li')).toHaveCount(9);
 await expect(card.locator('.web-reading-meta')).toContainText('9 recorded results');
 const first=full.locator('.web-title').first();await expect(first).toHaveText(title);expect(await first.evaluate(el=>el.scrollWidth>el.clientWidth+1 || el.scrollHeight>el.clientHeight+1)).toBe(false);
 await expect(card.locator('.op-expanded')).toContainText('A literal recorded sibling.');
 expect(await full.evaluate(el=>el.scrollWidth>el.clientWidth+1)).toBe(false);expect(fetched).toBe(0);
 const link=full.locator('a').first();await expect(link).toHaveAttribute('rel','noopener noreferrer');await link.focus();await expect(link).toBeFocused();
 const popup=page.waitForEvent('popup');await link.press('Enter');const opened=await popup;await expect(opened).toHaveURL('https://example.invalid/result/0');expect(fetched).toBe(1);await opened.close();
});

for(const harness of ['claude-code','codex'] as const)for(const width of [600,1440])test(`${harness} all recorded search results are readable beyond projection limits at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:950});
 const longTitle='Literal long title '+ 'recognizable title words '.repeat(35);
 const links=Array.from({length:160},(_,index)=>({title:index===0?longTitle:`Recorded result ${index}`,url:`https://example.invalid/result/${index}`,snippet:`Captured snippet ${index}`}));
 const output=`Web search results for query: "deep synthetic search"\n\nLinks: ${JSON.stringify(links.slice(0,80))}\n\nExact captured middle paragraph.\n\nLinks: ${JSON.stringify(links.slice(80))}\n\nExact captured final paragraph.`;
 const base={timestamp:'2026-10-30T00:00:00Z',sessionId:`depth-${harness}-${width}`,cwd:dir};
 const rows=harness==='claude-code'?[
  {...base,type:'user',uuid:'p',message:{role:'user',content:'Look up the synthetic reference'}},
  {...base,type:'assistant',uuid:'a',message:{role:'assistant',content:[{type:'tool_use',id:'web-depth',name:'WebSearch',input:{query:'deep synthetic search'}}]}},
  {...base,type:'user',uuid:'r',message:{role:'user',content:[{type:'tool_result',tool_use_id:'web-depth',content:output}]}}
 ]:[{type:'session_meta',payload:{id:base.sessionId,cwd:dir}},
  {timestamp:base.timestamp,type:'response_item',payload:{type:'message',role:'user',content:[{type:'input_text',text:'Look up the synthetic reference'}]}},
  {timestamp:base.timestamp,type:'response_item',payload:{type:'function_call',call_id:'web-depth',name:'web_search',arguments:JSON.stringify({query:'deep synthetic search'})}},
  {timestamp:base.timestamp,type:'response_item',payload:{type:'function_call_output',call_id:'web-depth',output}}
 ];
 const source=join(dir,`depth-${harness}-${width}.jsonl`);writeFileSync(source,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');const id=(await app.ingest.importSource(harness,source)).recordingId;
 const projection=app.projection(id),op=projection.operations.find(op=>op.detail.kind==='web')!;expect(op).toBeTruthy();
 expect(op.detail.kind==='web'&&(op.detail.results?.length??0)).toBeLessThanOrEqual(20);
 let external=0;await page.context().route('https://example.invalid/**',route=>{external++;return route.abort();});
 await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
 const card=page.locator(`article[data-op-id=${JSON.stringify(op.id)}]`);await card.scrollIntoViewIfNeeded();
 await card.locator('button.web-more').press('Enter');
 const inspector=page.getByRole('complementary',{name:'Operation detail'});await expect(inspector).toBeVisible();
 await expect(inspector.locator('.web-reading-meta')).toContainText('160 recorded results');
 await expect(inspector.locator('.web-results li')).toHaveCount(100);
 await expect(inspector.locator('.web-title').first()).toHaveText(longTitle);
 await expect(inspector.locator('.web-domain').first()).toHaveText('example.invalid');
 await expect(inspector.locator('.web-response')).toContainText('Exact captured middle paragraph.');
 await expect(inspector.locator('.web-response')).toContainText('Exact captured final paragraph.');
 await expect(inspector.locator('.web-response')).not.toContainText('Links: [');
 await page.screenshot({path:resolve(`.local/web-fixture-${harness}-${width}.png`)});
 await inspector.getByRole('button',{name:'Next results',exact:true}).press('Enter');
 await expect(inspector.locator('.web-results li')).toHaveCount(60);await expect(inspector.locator('.web-title').last()).toHaveText('Recorded result 159');
 const filter=inspector.getByRole('searchbox',{name:'Find result'});await filter.pressSequentially('result 159');await expect(filter).toBeFocused();
 await expect(inspector.locator('.web-results li')).toHaveCount(1);await expect(inspector.locator('.web-address')).toHaveText('https://example.invalid/result/159');
 await inspector.getByText('Original captured result',{exact:true}).click();await expect(inspector.locator('.web-original')).toContainText(output);
 expect(await inspector.locator('.web-original-text').evaluate(el=>el.textContent)).toBe(output);
 expect(external).toBe(0);expect(await inspector.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
 // The same Inspector survives a seek before its result; cached future material must disappear.
 const end=projection.timeline.findIndex(item=>item.type==='op-end'&&item.operationId===op.id);
 await page.goto(`${server.url}/?experience=modern&motion=0&at=${end+1}#/r/${id}`);
 const replayCard=page.locator(`article[data-op-id=${JSON.stringify(op.id)}]`);await replayCard.scrollIntoViewIfNeeded();await replayCard.press('Enter');
 const replayInspector=page.getByRole('complementary',{name:'Operation detail'});await expect(replayInspector.locator('.web-reading-meta')).toContainText('160 recorded results');
 const timeline=page.getByRole('slider',{name:'Timeline',exact:true});await timeline.press('ArrowLeft');await expect(timeline).toHaveAttribute('aria-valuenow',String(end));
 await expect(replayInspector.locator('.web-results li')).toHaveCount(0);await expect(replayInspector).toContainText('Waiting for result');await expect(replayInspector).not.toContainText('Exact captured final paragraph.');
 await timeline.press('ArrowRight');await expect(replayInspector.locator('.web-reading-meta')).toContainText('160 recorded results');
 const api=`/v1/recordings/${id}/web-result/${encodeURIComponent(op.id)}`;
 expect((await fetch(server.url+api)).status).toBe(401);
 expect((await page.request.get(server.url+api+'?count=NaN')).status()).toBe(400);
 const bounded=await page.request.get(server.url+api+'?count=999999');expect(bounded.status()).toBe(200);expect((await bounded.json()).results.length).toBeLessThanOrEqual(200);
 expect((await page.request.get(server.url+api+'?result=unrelated-observation')).status()).toBe(404);
});
test('offline result URLs outside valid HTTP(S) stay literal and inert',async({page})=>{
 const sample=JSON.parse(readFileSync(resolve('apps/ui/public/demo/bundle.json'),'utf8'));const op=sample.projection.operations.find((x:{kind:string})=>x.kind==='mcp');sample.projection.operations=[op];sample.projection.prose=[];sample.projection.timeline=sample.projection.timeline.filter((t:{operationId?:string})=>t.operationId===op.id);sample.projection.passages=[{id:'web-only',agentId:op.agentId,operationIds:[op.id],proseIds:[],firstStep:1,lastStep:2}];op.kind='web';op.origin={type:'native',tool:'web'};op.artifactIds=[];
 op.detail={kind:'web',query:'synthetic offline link validation',resultPreview:'Exact recorded output remains available',results:['javascript:alert(1)','data:text/html,<h1>wrong</h1>','file:///private.txt','//example.invalid/relative','https://','https://example.invalid/good'].map((url,i)=>({url,title:`Recorded reference ${i}`,domain:'captured domain'}))};
 await page.route('**/demo/bundle.json',route=>route.fulfill({json:sample}));await page.goto(new URL('/?demo&experience=modern&motion=0',server.launchUrl).href);
 const card=page.locator(`article[data-op-id="${op.id}"]`);await card.scrollIntoViewIfNeeded();await card.locator('button.op-expand').click();const full=card.locator('.op-expanded .web-results');await expect(full.locator('li')).toHaveCount(6);await expect(full.locator('a')).toHaveCount(1);await expect(full).toContainText('Recorded reference 0');await expect(full).toContainText('javascript:alert(1)');
});
