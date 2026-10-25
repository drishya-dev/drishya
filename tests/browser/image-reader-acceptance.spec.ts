import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,sep} from 'node:path';
import {deflateSync} from 'node:zlib';
import {test,expect,type Page} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';

// Invented raster, large enough that actual-size reading must scroll in both axes.
function png(width:number,height:number){
 const chunk=(name:string,data:Buffer)=>{const bytes=Buffer.concat([Buffer.from(name),data]);let crc=0xffffffff;for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}const out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);bytes.copy(out,4);out.writeUInt32BE((crc^0xffffffff)>>>0,out.length-4);return out;};
 const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
 return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',header),chunk('IDAT',deflateSync(Buffer.alloc((width*4+1)*height))),chunk('IEND',Buffer.alloc(0))]).toString('base64');
}
let dir:string,app:App,server:RunningServer;
const ids:Record<string,string>={};
test.beforeAll(async()=>{
 dir=mkdtempSync(join(tmpdir(),'drishya-image-reader-'));app=new App(join(dir,'data'));server=await startServer({app,port:0});
 const data=png(1600,1200),timestamp='2026-10-25T00:00:00Z';
 for(const harness of ['claude-code','codex']){
  const source=join(dir,harness+'.jsonl');
  const rows=harness==='claude-code'?[{type:'user',uuid:'image-prompt',sessionId:'image-reader',timestamp,cwd:dir,message:{role:'user',content:[{type:'text',text:'Inspect the captured diagram'},{type:'image',source:{type:'base64',media_type:'image/png',data}}]}}]:[
   {type:'session_meta',timestamp,payload:{id:'image-reader',cwd:dir}},
   {type:'response_item',timestamp,payload:{type:'message',role:'user',content:[{type:'input_text',text:'Inspect the captured diagram'},{type:'input_image',image_url:'data:image/png;base64,'+data},{type:'input_image',image_url:'https://example.invalid/never-fetch.png'}]}},
  ];
  writeFileSync(source,rows.map(r=>JSON.stringify(r)).join('\n')+'\n');ids[harness]=(await app.ingest.importSource(harness,source)).recordingId;
 }
});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe test path');rmSync(dir,{recursive:true,force:true});}});
async function open(page:Page,harness:string,width=390,height=844){
 await page.setViewportSize({width,height});await page.emulateMedia({reducedMotion:'reduce'});await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${ids[harness]}`);
 const thumb=page.locator('.turn-images .op-image').first();await expect(thumb).toBeVisible();return thumb;
}
for(const harness of ['claude-code','codex']){
 for(const [width,height] of [[320,640],[390,844],[844,390]])test(`${harness} captured image fits, scrolls at actual size and restores focus at ${width}x${height}`,async({page})=>{
  const remote:string[]=[];page.on('request',r=>{if(r.url().includes('example.invalid'))remote.push(r.url());});
  const thumb=await open(page,harness,width,height);await expect.poll(()=>thumb.locator('img').evaluate((i:HTMLImageElement)=>i.naturalWidth)).toBe(1600);
  await thumb.focus();await thumb.press('Enter');const reader=page.locator('dialog.image-reader');await expect(reader).toBeVisible();
  const bounds=(await reader.boundingBox())!;expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.y).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(width+1);expect(bounds.y+bounds.height).toBeLessThanOrEqual(height+1);
  await expect(reader.getByRole('button',{name:'Close',exact:true})).toBeInViewport();const stage=reader.locator('.image-reader-stage');
  await expect.poll(()=>stage.locator('img').evaluate((i:HTMLImageElement)=>i.naturalWidth)).toBe(1600);
  expect(await stage.evaluate(e=>e.scrollWidth-e.clientWidth)).toBeLessThanOrEqual(1);
  await reader.getByRole('button',{name:'Actual size',exact:true}).click();await expect(stage).toHaveClass(/actual/);
  expect(await stage.evaluate(e=>e.scrollWidth-e.clientWidth)).toBeGreaterThan(10);expect(await stage.evaluate(e=>e.scrollHeight-e.clientHeight)).toBeGreaterThan(10);
  await stage.evaluate(e=>{e.scrollTop=e.scrollHeight;e.scrollLeft=e.scrollWidth;});
  const edges=await stage.evaluate(e=>{const s=e.getBoundingClientRect(),i=e.querySelector('img')!.getBoundingClientRect();return {right:i.right-s.right,bottom:i.bottom-s.bottom};});
  expect(edges.right).toBeLessThanOrEqual(1);expect(edges.bottom).toBeLessThanOrEqual(1);
  await reader.getByRole('button',{name:'Fit',exact:true}).click();await page.keyboard.press('Escape');await expect(reader).toHaveCount(0);await expect(thumb).toBeFocused();expect(remote).toEqual([]);
 });
 test(`${harness} unavailable bytes explain the failure and retry only on request`,async({page})=>{
  let available=false,requests=0;await page.route('**/images/*',async route=>{requests++;if(available)await route.continue();else await route.fulfill({status:404,contentType:'text/plain',body:'not available'});});
  const thumb=await open(page,harness);await expect(thumb).toContainText('could not be loaded');await thumb.press('Enter');const reader=page.getByRole('dialog',{name:'Captured image reader'});await expect(reader).toBeVisible();
  await expect(reader.getByRole('status')).toContainText('could not be loaded');const before=requests;await page.waitForTimeout(150);expect(requests).toBe(before);
  available=true;await reader.getByRole('button',{name:'Retry image'}).click();await expect.poll(()=>reader.locator('img').evaluate((i:HTMLImageElement)=>i.naturalWidth)).toBe(1600);await expect(reader.getByRole('status')).toHaveCount(0);
  await reader.getByRole('button',{name:'Close',exact:true}).click();await expect(reader).toHaveCount(0);await expect(thumb).toBeFocused();
 });
}
