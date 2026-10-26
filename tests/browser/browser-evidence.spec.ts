import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,sep} from 'node:path';
import {test,expect} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
// These integrated journeys deliberately wait for the shared History owner. Helpers remain independently tested.
test.skip(!readFileSync(resolve('apps/ui/src/components/History.tsx'),'utf8').includes("from './BrowserEvidence.tsx'"), 'Requires Claude CONTENT-2 History integration');
let dir:string,app:App,server:RunningServer,id:string;
test.beforeAll(async()=>{
 dir=mkdtempSync(join(tmpdir(),'drishya-browser-evidence-'));app=new App(join(dir,'data'));server=await startServer({app,port:0});
 const base={timestamp:'2026-10-26T00:00:00Z',sessionId:'browser-story',cwd:dir};
 const uses=[
  {id:'b1',name:'mcp__Claude_Browser__navigate',input:{url:'https://example.invalid/recorded'}},
  {id:'b2',name:'mcp__Claude_Browser__computer',input:{action:'scroll',direction:'down'}},
  {id:'b3',name:'mcp__Claude_Browser__read_page',input:{filter:'all'}},
  {id:'shell',name:'Bash',input:{command:'echo separate action'}},
  {id:'b4',name:'mcp__Claude_Browser__find',input:{query:'recorded needle',tabId:7}},
  {id:'b5',name:'mcp__Claude_Browser__browser_batch',input:{actions:[{name:'navigate',input:{url:'javascript:alert(1)'}},{name:'computer',input:{action:'click'}}]}},
  {id:'fetch',name:'WebFetch',input:{url:'https://example.invalid/fetch',prompt:'Read this page'}},
  {id:'missing',name:'WebFetch',input:{url:'https://example.invalid/no-metadata',prompt:'Read another page'}}
 ];
 const rows:unknown[]=[{...base,type:'user',uuid:'p',message:{role:'user',content:'Inspect the recorded browsing story'}}, {...base,type:'assistant',uuid:'a',message:{id:'m',role:'assistant',content:uses.map(u=>({type:'tool_use',...u}))}}];
 for(const u of uses) rows.push({...base,type:'user',uuid:`r-${u.id}`,message:{role:'user',content:[{type:'tool_result',tool_use_id:u.id,is_error:u.id==='b4',content:u.id==='b3'?[{type:'text',text:'Exact captured b3 page excerpt.'},{type:'image',source:{type:'base64',media_type:'image/png',data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='}}]:`Exact captured ${u.id} page excerpt.\nA selectable result line.`}]},...(u.id==='fetch'?{toolUseResult:{url:'https://example.invalid/fetch',code:200,codeText:'OK',bytes:2048,durationMs:125,result:'Exact captured fetch page excerpt.'}}:{})});
 const path=join(dir,'browser.jsonl');writeFileSync(path,rows.map(r=>JSON.stringify(r)).join('\n')+'\n');id=(await app.ingest.importSource('claude-code',path)).recordingId;
});
test.beforeEach(async({page})=>{await page.route('**/v1/working-locations',route=>route.request().method()==='GET'?route.fulfill({json:{version:1,sessions:[]}}):route.continue());});
test.afterAll(async()=>{await server?.close();await app?.close();if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});});
async function open(page:import('@playwright/test').Page){await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);}
for(const width of [600,1024,1440])test(`browser story preserves steps, exact inputs and geometry at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});let remote=0;page.on('request',request=>{if(new URL(request.url()).origin!==server.url)remote++;});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await open(page);
 const strips=page.locator('.browser-strip');await expect(strips).toHaveCount(2);const first=strips.first();await first.scrollIntoViewIfNeeded();await expect(first).toHaveAttribute('data-browser-steps','3');
 const slider=first.getByRole('slider',{name:'Browser step'});await slider.focus();await slider.press('Home');await expect(first.locator('.browser-address a')).toHaveText('https://example.invalid/recorded');
 await slider.press('ArrowRight');await expect(first.locator('.browser-action')).toContainText('scroll');await expect(first.locator('.browser-address')).toContainText('No URL in captured input');await expect(first).toContainText('Exact captured b2');
 await first.locator('.op-expand').click();await expect(first.locator('.op-expanded')).toBeVisible();await first.getByText('Captured browser input',{exact:true}).click();await expect(first.locator('.tool-input')).toContainText('direction');await expect(first.locator('.tool-input')).toContainText('down');await first.locator('.op-expand').click();
 await slider.focus();await slider.press('End');await expect(first.locator('.op-images .op-image')).toHaveCount(1);await first.locator('.op-images .op-image').click();await expect(page.getByRole('dialog',{name:'Captured image reader'})).toBeVisible();await page.getByRole('dialog',{name:'Captured image reader'}).getByRole('button',{name:'Close',exact:true}).click();
 const second=strips.nth(1);await second.scrollIntoViewIfNeeded();await second.getByRole('slider').focus();await second.getByRole('slider').press('Home');await expect(second.locator('.browser-action')).toContainText('Failed');await second.getByRole('button',{name:'Next browser step'}).click();await expect(second.locator('.browser-batch')).toContainText('computer · click');await expect(second.locator('.browser-batch a')).toHaveCount(0);await expect(second.locator('.browser-batch')).toContainText('javascript:alert(1)');
 const duplicate=await page.locator('.op[data-op-id]').evaluateAll(nodes=>{const ids=nodes.map(n=>(n as HTMLElement).dataset.opId);return ids.length!==new Set(ids).size});expect(duplicate).toBe(false);
 expect(await first.evaluate(el=>el.scrollWidth>el.clientWidth+1)).toBe(false);expect(await second.evaluate(el=>el.scrollWidth>el.clientWidth+1)).toBe(false);
 await expect.poll(()=>page.evaluate(()=>{const ids=new Set([...document.querySelectorAll<HTMLElement>('.op[data-op-id]')].map(el=>el.dataset.opId));return [...document.querySelectorAll('[data-flow-link]')].every(el=>el.getAttribute('data-flow-link')!.split('/').every(id=>ids.has(id)));})).toBe(true);
 expect(remote).toBe(0);expect(errors).toEqual([]);if(width===1440)await page.screenshot({path:resolve('.local/browser-story-1440.png')});
});
test('WebFetch displays only captured metadata and retains the exact page excerpt',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await open(page);
 const captured=page.locator('article.op').filter({hasText:'https://example.invalid/fetch'}).first();await expect(captured.locator('.web-evidence')).toContainText('200 OK · 2.0 KB · 125 ms');await expect(captured).toContainText('Exact captured fetch page excerpt.');
 const missing=page.locator('article.op').filter({hasText:'https://example.invalid/no-metadata'}).first();await expect(missing.locator('.browser-action')).toHaveCount(0);await expect(missing).toContainText('Exact captured missing page excerpt.');await missing.locator('.op-expand').click();await expect(missing.locator('.op-expanded')).toContainText('Exact captured missing page excerpt.');
});
test('restored exact operation selection chooses its browser step',async({page})=>{
 const op=app.projection(id).operations.find(o=>o.tool.endsWith('__computer'))!;
 await page.route('**/v1/working-locations',route=>route.request().method()==='GET'?route.fulfill({json:{version:1,sessions:[{id,entries:[['location',{selectedOp:op.id}]]}]}}):route.continue());await open(page);
 await expect(page.locator(`.browser-strip article[data-op-id="${op.id}"]`)).toBeAttached();await expect(page.locator('.browser-strip').first().getByRole('slider')).toHaveValue('2');
});
test('replay follows arriving browser steps until the reader scrubs the strip',async({page})=>{
 const p=app.projection(id),third=p.operations.find(o=>o.tool.endsWith('__read_page'))!,beforeThird=p.timeline.findIndex(t=>t.type==='op-start'&&t.operationId===third.id);
 await page.setViewportSize({width:1440,height:1000});await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern&motion=0&at=${beforeThird}#/r/${id}`);
 const strip=page.locator('.browser-strip').first(),slider=strip.getByRole('slider');await expect(slider).toHaveValue('2');await page.getByRole('button',{name:'Step forward',exact:true}).click();await expect(slider).toHaveValue('3');await expect(strip).toHaveAttribute('data-browser-steps','3');
 await slider.focus();await slider.press('Home');await expect(slider).toHaveValue('1');await expect(strip.locator('.browser-action')).toContainText('navigate');await page.getByRole('button',{name:'Step forward',exact:true}).click();await expect(slider).toHaveValue('1');
});
test('hover reading leaves no placeholder after replacing a browser step',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await open(page);const strip=page.locator('.browser-strip').first();await strip.scrollIntoViewIfNeeded();await strip.getByRole('slider').focus();await strip.getByRole('slider').press('Home');const card=strip.locator('article.op');await card.locator('.op-title').hover();await expect(card).toHaveAttribute('data-hover-reading','focused');await strip.getByRole('slider').focus();await strip.getByRole('slider').press('ArrowRight');await expect(strip.locator('.hover-reading-slot')).toHaveCount(0);await expect(strip.locator('article.op')).toHaveCount(1);await expect(strip.locator('.browser-action')).toContainText('scroll');
});
