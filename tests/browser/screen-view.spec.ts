import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,sep} from 'node:path';
import {crc32,deflateSync} from 'node:zlib';
import {test,expect,type Page} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';

// SCREEN-1: a synthetic computer-use run with known coordinates. The demo is a regression guard only; real sessions are checked with check:real.
let dir:string,app:App,server:RunningServer,id:string;
const chunk=(type:string,data:Buffer)=>{const body=Buffer.concat([Buffer.from(type),data]),out=Buffer.alloc(body.length+8);out.writeUInt32BE(data.length,0);body.copy(out,4);out.writeUInt32BE(crc32(body),body.length+4);return out;};
/** A real solid-colour PNG of the given size. */
const png=(width:number,height:number,rgb:[number,number,number])=>{
 const row=Buffer.concat([Buffer.from([0]),Buffer.from(Array.from({length:width},()=>rgb).flat())]);
 const header=Buffer.alloc(13);header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);header[8]=8;header[9]=2;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(Buffer.concat(Array.from({length:height},()=>row)))),chunk('IEND',Buffer.alloc(0))]).toString('base64');
};
const context='\n\nTab Context:\n- Executed on tabId: 7\n- Available tabs:\n  • tabId 7: "Pharma board" ("http://localhost:3000/board")';
test.beforeAll(async()=>{
 dir=mkdtempSync(join(tmpdir(),'drishya-screen-'));app=new App(join(dir,'data'));server=await startServer({app,port:0});
 const base={sessionId:'screen-story',cwd:dir};let clock=0;
 const time=()=>new Date(Date.UTC(2026,9,30,10,0,clock++ * 20)).toISOString();
 const image=(data:string)=>({type:'image',source:{type:'base64',media_type:'image/png',data}});
 const tool='mcp__Claude_Browser__computer';
 const steps:{id:string;input:Record<string,unknown>;text:string;image?:string}[]=[
  {id:'s1',input:{action:'screenshot',tabId:7},text:'Screenshot size: 400x200'+context,image:png(400,200,[30,60,120])},
  {id:'c1',input:{action:'left_click',coordinate:[100,50],tabId:7},text:'left_click at (100, 50)'+context},
  {id:'d1',input:{action:'left_click_drag',start_coordinate:[40,40],coordinate:[300,150],tabId:7},text:'dragged'+context},
  {id:'t1',input:{action:'type',text:'metformin 500',tabId:7},text:'typed'+context},
  {id:'r1',input:{action:'left_click',ref:'ref_9',tabId:7},text:'left_click at (10, 10) [ref_9]'+context},
  {id:'s2',input:{action:'screenshot',tabId:7},text:'Screenshot size: 400x200'+context,image:png(400,200,[120,60,30])},
  {id:'k1',input:{action:'scroll',coordinate:[200,100],scroll_direction:'down',scroll_amount:3,tabId:7},text:'scrolled'+context},
 ];
 const rows:unknown[]=[{...base,timestamp:time(),type:'user',uuid:'p',message:{role:'user',content:'Check the board on screen'}}];
 for(const s of steps){
  rows.push({...base,timestamp:time(),type:'assistant',uuid:`a-${s.id}`,message:{id:`m-${s.id}`,role:'assistant',content:[{type:'tool_use',id:s.id,name:tool,input:s.input}]}});
  rows.push({...base,timestamp:time(),type:'user',uuid:`r-${s.id}`,message:{role:'user',content:[{type:'tool_result',tool_use_id:s.id,content:[{type:'text',text:s.text},...(s.image?[image(s.image)]:[])]}]}});
 }
 const path=join(dir,'screen.jsonl');writeFileSync(path,rows.map(r=>JSON.stringify(r)).join('\n')+'\n');id=(await app.ingest.importSource('claude-code',path)).recordingId;
});
test.beforeEach(async({page})=>{await page.route('**/v1/working-locations',route=>route.request().method()==='GET'?route.fulfill({json:{version:1,sessions:[]}}):route.continue());});
test.afterAll(async()=>{await server?.close();await app?.close();if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});});
async function open(page:Page){await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);}
/** Where the marker's centre sits on the frame, as fractions of the displayed image. */
async function markAt(page:Page,selector='.screen-mark:not(.start)'){
 const frame=(await page.locator('.screen-image').boundingBox())!,mark=(await page.locator(selector).first().boundingBox())!;
 return {x:(mark.x+mark.width/2-frame.x)/frame.width,y:(mark.y+mark.height/2-frame.y)/frame.height};
}

for(const width of [600,1440])test(`the screen reader draws each recorded action at its recorded position at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 const external:string[]=[];page.on('request',request=>{const url=new URL(request.url());if(url.origin!==new URL(server.url).origin&&!url.protocol.startsWith('data'))external.push(request.url());});
 await open(page);
 const open1=page.locator('.browser-screen-open').first();await expect(open1).toBeVisible();
 await open1.click();
 const reader=page.locator('dialog.screen-view');await expect(reader).toBeVisible();
 await expect(reader.locator('.screen-count')).toContainText('of 7');
 // Opened on a step of the run; Home goes to the first, a screenshot with its tab recorded.
 await page.keyboard.press('Home');
 await expect(reader.locator('.screen-caption strong')).toHaveText('Screenshot');
 await expect(reader.locator('.screen-meta')).toContainText('Pharma board');
 await expect(reader.locator('.screen-meta')).toContainText('http://localhost:3000/board');
 await expect.poll(()=>page.locator('.screen-image').evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBe(400);
 expect(await page.locator('.screen-mark').count()).toBe(0);
 // The click sits at (100,50) of a 400x200 frame, checked against the raw input.
 await page.keyboard.press('ArrowRight');
 await expect(reader.locator('.screen-caption strong')).toHaveText('Click at 100, 50');
 await expect(reader.locator('.screen-meta')).toContainText('No new frame recorded · showing step 1');
 const click=await markAt(page);expect(click.x).toBeCloseTo(0.25,2);expect(click.y).toBeCloseTo(0.25,2);
 // A drag runs from its recorded start to its recorded end.
 await page.keyboard.press('ArrowRight');
 await expect(reader.locator('.screen-caption strong')).toHaveText('Drag 40, 40 to 300, 150');
 const end=await markAt(page);expect(end.x).toBeCloseTo(0.75,2);expect(end.y).toBeCloseTo(0.75,2);
 const start=await markAt(page,'.screen-mark.start');expect(start.x).toBeCloseTo(0.1,2);expect(start.y).toBeCloseTo(0.2,2);
 await expect(page.locator('.screen-drag line')).toHaveCount(1);
 if(process.env.SCREEN_SHOT)await reader.screenshot({path:resolve(`.local/screen-view-${width}.png`)});
 // Typed text is shown as recorded and nothing is drawn on the frame.
 await page.keyboard.press('ArrowRight');
 await expect(reader.locator('.screen-caption strong')).toHaveText('Type “metformin 500”');
 expect(await page.locator('.screen-mark').count()).toBe(0);
 // A step that names an element but no usable position draws nothing and says so.
 await page.keyboard.press('ArrowRight');
 await expect(reader.locator('.screen-caption strong')).toContainText('Click');
 expect(await page.locator('.screen-mark').count()).toBe(0);
 // The next screenshot replaces the frame; the scroll lands at the middle of it.
 await page.keyboard.press('ArrowRight');
 await expect(reader.locator('.screen-meta')).toContainText('Frame returned by this step');
 await page.keyboard.press('ArrowRight');
 await expect(reader.locator('.screen-caption strong')).toHaveText('Scroll down 3 at 200, 100');
 const scroll=await markAt(page);expect(scroll.x).toBeCloseTo(0.5,2);expect(scroll.y).toBeCloseTo(0.5,2);
 expect(await page.locator('.screen-mark').first().getAttribute('data-direction')).toBe('down');
 await page.keyboard.press('Home');await expect(reader.locator('.screen-count')).toContainText('Step 1 of 7');
 await page.keyboard.press('End');await expect(reader.locator('.screen-count')).toContainText('Step 7 of 7');
 // The strip is the same run: every step is reachable and the current one is marked.
 await expect(reader.locator('.screen-cell')).toHaveCount(7);
 await reader.locator('.screen-cell').nth(2).click();await expect(reader.locator('.screen-caption strong')).toContainText('Drag');
 // The dialog stays inside the window.
 const box=(await reader.boundingBox())!;expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);expect(box.y+box.height).toBeLessThanOrEqual(900);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
 await page.keyboard.press('f');await expect(reader).toHaveClass(/full/);
 const full=(await reader.boundingBox())!;expect(full.width).toBe(width);
 await page.keyboard.press('f');await expect(reader).not.toHaveClass(/full/);
 await page.keyboard.press('Escape');await expect(reader).toHaveCount(0);
 expect(external).toEqual([]);
});

test('the session menu opens the same reader, and reduced motion keeps the swap without the zoom',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.setViewportSize({width:1440,height:900});
 await open(page);
 await page.locator('summary[aria-label="More workspace options"]').click();
 const entry=page.locator('.screen-entry');await expect(entry).toContainText('Screen · 2 frames');
 await entry.click();
 const reader=page.locator('dialog.screen-view');await expect(reader).toBeVisible();
 // Opened without a step: the newest frame.
 await expect(reader.locator('.screen-meta')).toContainText('Frame returned by this step');
 await expect(page.locator('.screen-image')).toHaveCSS('animation-name','none');
 await page.keyboard.press('Home');await page.keyboard.press('End');
 await expect(reader.locator('.screen-leaving')).toHaveCount(0);
 await reader.getByRole('button',{name:'Open operation'}).click();
 await expect(reader).toHaveCount(0);
 await expect(page.getByRole('region',{name:'Operation detail'})).toBeVisible();
});

test('playback advances through steps and stops at the end',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await open(page);
 await page.locator('summary[aria-label="More workspace options"]').click();
 await page.locator('.screen-entry').click();
 const reader=page.locator('dialog.screen-view');await expect(reader).toBeVisible();await expect(reader.locator('.screen-count')).toContainText('of 7');
 await page.keyboard.press('Home');
 await reader.getByRole('button',{name:'Play'}).click();
 await expect(reader.locator('.screen-count')).toContainText('Step 2 of 7',{timeout:4000});
 await reader.getByRole('button',{name:'Pause'}).click();
 await expect(reader.getByRole('button',{name:'Play'})).toBeVisible();
});

test('replay never reveals a step the replay position has not reached',async()=>{
 const full=await app.history.screen(id);
 expect(full.steps).toHaveLength(7);expect(full.frames).toBe(2);
 const early=await app.history.screen(id,3);
 expect(early.steps.length).toBeGreaterThan(0);expect(early.steps.length).toBeLessThan(full.steps.length);
 expect(early.frames).toBeLessThan(full.frames);
 expect(early.steps.map(step=>step.id)).toEqual(full.steps.slice(0,early.steps.length).map(step=>step.id));
 expect((await app.history.screen(id,0)).steps).toHaveLength(0);
});

test('computer actions inside a browser batch become steps with their images matched in order',async({page})=>{
 const batchDir=mkdtempSync(join(tmpdir(),'drishya-screen-batch-'));
 try{
  const base={sessionId:'screen-batch',cwd:batchDir};let clock=0;
  const time=()=>new Date(Date.UTC(2026,9,30,12,0,clock++)).toISOString();
  const image=(data:string)=>({type:'image',source:{type:'base64',media_type:'image/png',data}});
  const actions=[{name:'computer',input:{action:'screenshot',tabId:7}},{name:'computer',input:{action:'left_click',coordinate:[100,50],tabId:7}},{name:'computer',input:{action:'screenshot',tabId:7}}];
  const rows:unknown[]=[
   {...base,timestamp:time(),type:'user',uuid:'p',message:{role:'user',content:'Batch it'}},
   {...base,timestamp:time(),type:'assistant',uuid:'a',message:{id:'m',role:'assistant',content:[{type:'tool_use',id:'b1',name:'mcp__Claude_Browser__browser_batch',input:{actions}}]}},
   {...base,timestamp:time(),type:'user',uuid:'r',message:{role:'user',content:[{type:'tool_result',tool_use_id:'b1',content:[{type:'text',text:'Screenshot size: 400x200'},image(png(400,200,[30,60,120])),{type:'text',text:'left_click at (100, 50)'},{type:'text',text:'Screenshot size: 400x200'},image(png(400,200,[120,60,30]))]}]}},
  ];
  const path=join(batchDir,'batch.jsonl');writeFileSync(path,rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
  const batchId=(await app.ingest.importSource('claude-code',path)).recordingId;
  await page.setViewportSize({width:1440,height:900});
  await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${batchId}`);
  await page.locator('summary[aria-label="More workspace options"]').click();
  const entry=page.locator('.screen-entry');await expect(entry).toContainText('Screen · 2 frames');await entry.click();
  const reader=page.locator('dialog.screen-view');await expect(reader.locator('.screen-count')).toContainText('of 3');
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await expect(reader.locator('.screen-caption strong')).toHaveText('Click at 100, 50');
  const click=await markAt(page);expect(click.x).toBeCloseTo(0.25,2);expect(click.y).toBeCloseTo(0.25,2);
  await page.keyboard.press('ArrowRight');
  await expect(reader.locator('.screen-meta')).toContainText('Frame returned by this step');
  // Both frames are different images, matched to their own screenshot actions.
  const shas=await reader.locator('.screen-cell img').evaluateAll(images=>images.map(img=>(img as HTMLImageElement).src));
  expect(new Set(shas).size).toBe(2);
 }finally{if(resolve(batchDir).startsWith(resolve(tmpdir())+sep))rmSync(batchDir,{recursive:true,force:true});}
});

test('a 150-step run stays responsive and keeps at most two frame images mounted',async({page})=>{
 const long=mkdtempSync(join(tmpdir(),'drishya-screen-long-'));
 try{
  const base={sessionId:'screen-long',cwd:long};let clock=0;
  const time=()=>new Date(Date.UTC(2026,9,30,11,0,clock++)).toISOString();
  const tool='mcp__Claude_Browser__computer',frame=png(64,32,[20,90,60]);
  const rows:unknown[]=[{...base,timestamp:time(),type:'user',uuid:'p',message:{role:'user',content:'Walk the board'}}];
  for(let n=0;n<150;n++){
   const input=n%3===0?{action:'screenshot',tabId:7}:{action:'left_click',coordinate:[n%64,n%32],tabId:7};
   rows.push({...base,timestamp:time(),type:'assistant',uuid:`a${n}`,message:{id:`m${n}`,role:'assistant',content:[{type:'tool_use',id:`t${n}`,name:tool,input}]}});
   rows.push({...base,timestamp:time(),type:'user',uuid:`r${n}`,message:{role:'user',content:[{type:'tool_result',tool_use_id:`t${n}`,content:[{type:'text',text:n%3===0?'Screenshot size: 64x32':'clicked'},...(n%3===0?[{type:'image',source:{type:'base64',media_type:'image/png',data:frame}}]:[])]}]}});
  }
  const path=join(long,'long.jsonl');writeFileSync(path,rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
  const longId=(await app.ingest.importSource('claude-code',path)).recordingId;
  await page.setViewportSize({width:1440,height:900});
  await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${longId}`);
  await page.locator('summary[aria-label="More workspace options"]').click();await page.locator('.screen-entry').click();
  const reader=page.locator('dialog.screen-view');await expect(reader.locator('.screen-count')).toContainText('of 150');
  await page.keyboard.press('Home');
  const started=Date.now();let most=0;
  for(let n=1;n<150;n++){await page.keyboard.press('ArrowRight');if(n%10===0)most=Math.max(most,await page.locator('.screen-frame img').count());}
  await expect(reader.locator('.screen-count')).toContainText('Step 150 of 150');
  expect(Date.now()-started).toBeLessThan(20000);
  expect(most).toBeLessThanOrEqual(2);
  expect(await reader.locator('.screen-cell').count()).toBe(150);
 }finally{if(resolve(long).startsWith(resolve(tmpdir())+sep))rmSync(long,{recursive:true,force:true});}
});
