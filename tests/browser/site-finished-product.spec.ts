import {createServer, type Server} from 'node:http';
import {readFileSync, existsSync, statSync} from 'node:fs';
import {resolve, sep, extname} from 'node:path';
import {test, expect} from '@playwright/test';
import {FEATURES} from '../../apps/site/src/footage.ts';

if(process.env.DRISHYA_SITE_BROWSER==='firefox')test.use({browserName:'firefox',launchOptions:{channel:undefined}});
let server:Server, base:string;
const root=resolve('apps/site/dist');
const mime:Record<string,string>={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
test.beforeAll(async()=>{
  server=createServer((req,res)=>{
    const path=resolve(root,'.'+new URL(req.url??'/', 'http://localhost').pathname.replace(/\/$/,'/index.html'));
    if(!path.startsWith(root+sep)||!existsSync(path)||!statSync(path).isFile()){res.writeHead(404).end();return;}
    res.writeHead(200,{'content-type':mime[extname(path)]??'application/octet-stream'}).end(readFileSync(path));
  });
  await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
  base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
});
test.afterAll(async()=>{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));});

for(const width of [600,1440]){
  test(`finished feature stills and truthful product content @${width}`,async({page})=>{
    await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce'});
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base);await page.locator('html[data-app-ready]').waitFor();
    await expect(page.locator('.hero-facts')).toContainText('Antigravity');
    await expect(page.locator('#workflow')).toContainText('Work and Conversation');
    await expect(page.locator('.feat-steps')).toContainText('Antigravity stays read-only');
    const images=page.locator('.feature-stills img');await expect(images).toHaveCount(FEATURES.flat().length);
    for(const image of await images.all()){
      await image.scrollIntoViewIfNeeded();
      await expect.poll(()=>image.evaluate((im:HTMLImageElement)=>im.complete&&im.naturalWidth===2880)).toBe(true);
    }
    const tops=await page.locator('.feat-steps>li').evaluateAll(rows=>rows.map(row=>row.getBoundingClientRect().top));
    expect(tops.every((top,i)=>i===0||top>tops[i-1]!)).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });

  test(`scroll reverses the laptop and resize never reloads it @${width}`,async({page})=>{
    test.setTimeout(120000);await page.setViewportSize({width,height:900});
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    let loads=0;page.on('framenavigated',frame=>{if(frame.url().includes('/demo.html'))loads++;});
    await page.goto(base);await page.locator('html[data-app-ready]').waitFor();
    const laptop=page.locator('[data-frame]');
    async function progress(fraction:number){
      await page.evaluate(f=>{const el=document.querySelector('.tour')!;scrollTo(0,scrollY+el.getBoundingClientRect().top+(el.getBoundingClientRect().height-innerHeight)*f);},fraction);
      await page.waitForTimeout(250);
    }
    await progress(.94);await expect.poll(()=>laptop.getAttribute('data-step'),{timeout:45000}).toBe('45');
    await progress(.43);await expect.poll(async()=>Number(await laptop.getAttribute('data-step')),{timeout:30000}).toBeLessThan(20);
    const before=await laptop.getAttribute('data-step');
    await page.evaluate(()=>dispatchEvent(new MessageEvent('message',{origin:location.origin,source:window,data:{type:'drishya-seeked',requestId:999,step:999}})));
    expect(await laptop.getAttribute('data-step')).toBe(before);
    await page.setViewportSize({width:width===600?1440:600,height:900});await page.waitForTimeout(500);
    await page.setViewportSize({width,height:900});await page.waitForTimeout(500);
    expect(loads).toBe(1);
    await progress(.94);await expect.poll(()=>laptop.getAttribute('data-step'),{timeout:30000}).toBe('45');
    const box=await page.locator('.laptop-screen').boundingBox();expect(box!.width).toBeGreaterThan(200);
    expect(box!.x).toBeGreaterThanOrEqual(-2);expect(box!.x+box!.width).toBeLessThanOrEqual(width+2);
    expect(errors).toEqual([]);
  });

  test(`all footage decodes and each sequence follows the preserved order @${width}`,async({page})=>{
    await page.setViewportSize({width,height:900});await page.goto(base);
    await page.locator('html[data-app-ready]').waitFor();
    const names=FEATURES.flat().map(frame=>frame.img);
    await expect(page.locator('[data-frame-name]')).toHaveCount(names.length);
    await expect.poll(()=>page.locator('[data-frame-name][data-ready=true]').count()).toBe(names.length);
    const frames=await page.locator('[data-frame-name]').evaluateAll(els=>els.map(el=>el.getAttribute('data-frame-name')));
    expect(frames).toEqual(names);
    await page.locator('#features').scrollIntoViewIfNeeded();await page.waitForTimeout(250);
    await expect(page.locator('.feat-loading')).toBeHidden();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}

test('slow or unavailable footage has a readable loading/failure state',async({page})=>{
  let release:()=>void=()=>{};const held=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/footage/explorer.jpg',async route=>{await held;await route.abort();});
  await page.goto(base);await page.locator('html[data-app-ready]').waitFor();
  await expect(page.locator('.feat-loading')).toContainText('Loading demonstration');
  release();await expect(page.locator('.feat-loading')).toContainText('unavailable');
});
