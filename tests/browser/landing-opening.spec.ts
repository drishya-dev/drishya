import {test,expect} from '@playwright/test';
import {spawnSync} from 'node:child_process';
import {serveLanding} from '../../scripts/build-landing.ts';

let site:Awaited<ReturnType<typeof serveLanding>>;
test.beforeAll(async()=>{
  const built=spawnSync(process.execPath,['scripts/build-landing.ts'],{encoding:'utf8'});
  if(built.status!==0)throw Error(built.stderr);
  site=await serveLanding();
});
test.afterAll(async()=>{await site?.close();});

test('opening keeps navigation hidden from first paint and reuses its controls on replay',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.addInitScript(()=>{
    const seen:string[]=[];
    new MutationObserver(()=>{
      const header=document.querySelector('.site-header');
      if(header && document.documentElement.dataset.openingActive==='true') {
        seen.push(getComputedStyle(header).visibility);
      }
    }).observe(document,{subtree:true,attributes:true,childList:true});
    Object.defineProperty(window,'openingHeaderVisibility',{value:seen});
  });
  await page.goto(site.url);
  await expect(page.locator('[data-opening-overlay]')).toHaveAttribute('data-active','true');
  await expect(page.locator('.opening-name strong')).toHaveText('Drishya');
  await expect(page.getByRole('button',{name:'Enter Drishya'})).toBeVisible();
  await expect(page.locator('.site-header')).toBeHidden();
  expect(await page.evaluate(()=>{
    const seen=(window as Window & {openingHeaderVisibility:string[]}).openingHeaderVisibility;
    return seen.length>0 && seen.every(value=>value==='hidden');
  })).toBe(true);
  await page.getByRole('button',{name:'Enter Drishya'}).click();
  await expect(page.locator('[data-opening-overlay]')).toBeHidden();
  await expect(page.locator('.site-header')).toBeVisible();
  await expect(page.getByRole('button',{name:'Replay intro'})).toBeVisible();
  await page.getByRole('button',{name:'Replay intro'}).click();
  await expect(page.getByRole('button',{name:'Enter Drishya'})).toBeFocused();
  await expect(page.getByRole('button',{name:'Skip intro'})).toBeVisible();
  await page.getByRole('button',{name:'Enter Drishya'}).click();
  await expect(page.locator('[data-opening-overlay]')).toBeHidden();
  expect(await page.evaluate(()=>sessionStorage.getItem('drishya.landing.intro.v1'))).toBe('1');
});

test('opening interruption, direct links and repeat visits remain static and usable',async({browser})=>{
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  const page=await context.newPage();
  await page.goto(site.url);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-opening-overlay]')).toHaveAttribute('data-active','false');
  await page.goto(site.url+'/#session');
  await expect(page.locator('[data-opening-overlay]')).toHaveAttribute('data-active','false');
  await page.goto(site.url);
  await expect(page.locator('[data-opening-overlay]')).toHaveAttribute('data-active','false');
  await context.close();
});

for(const width of [600,1440]){
  test(`Escape before the main module dismisses the intro on repeat visits at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});
    const mainModule=/\/assets\/site-[^/]+\.js$/;
    const {promise:moduleGate,resolve:releaseModule}=Promise.withResolvers<void>();
    await page.route(mainModule,async route=>{
      await moduleGate;
      await route.continue();
    });
    const root=page.locator('html');
    const opening=page.locator('[data-opening-overlay]');
    try {
      await page.goto(site.url,{waitUntil:'commit'});
      await expect(root).toHaveAttribute('data-intro','pending');
      await expect(page.locator('.site-header')).toBeHidden();
      await page.keyboard.press('Escape');
      await expect(root).toHaveAttribute('data-intro','skip');
      await expect(page.locator('.site-header')).toBeVisible();
    } finally {
      releaseModule();
    }
    await page.waitForLoadState('load');
    await page.unroute(mainModule);
    await page.goto(site.url+'/#session');
    await expect(opening).toBeHidden();
    await page.goto(site.url);
    expect(await opening.getAttribute('data-active')).toBe('false');
    await expect(page.getByRole('button',{name:'Replay intro'})).toBeVisible();
  });
}

test('only a pending wheel entrance reverses and completed entry stays closed',async({browser})=>{
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  const page=await context.newPage();
  await page.goto(site.url);
  await page.mouse.wheel(0,500);
  await expect(page.locator('[data-opening-overlay]')).toHaveAttribute('data-exiting','true');
  await page.mouse.wheel(0,-500);
  await expect(page.locator('[data-opening-overlay]')).toHaveAttribute('data-exiting','false');
  await expect(page.locator('[data-opening-overlay]')).toHaveAttribute('data-active','true');
  await page.mouse.wheel(0,500);
  await expect(page.locator('[data-opening-overlay]')).toHaveAttribute('data-exiting','true');
  await expect(page.locator('[data-opening-overlay]')).toHaveAttribute('data-active','false');
  await page.mouse.wheel(0,500);
  await page.mouse.wheel(0,-500);
  await expect(page.locator('[data-opening-overlay]')).toBeHidden();

  await page.getByRole('button',{name:'Replay intro'}).click();
  await page.mouse.wheel(0,500);
  await expect(page.locator('[data-opening-overlay]')).toHaveAttribute('data-exiting','true');
  await page.keyboard.press('Escape');
  await page.mouse.wheel(0,-500);
  await expect(page.locator('[data-opening-overlay]')).toBeHidden();
  await expect(page.locator('.site-header')).toBeVisible();
  await context.close();
});

test('short window, reduced motion and motion off skip the intro without hiding content',async({page})=>{
  await page.setViewportSize({width:1440,height:600});
  await page.goto(site.url);
  await expect(page.locator('.hero-copy h1')).toBeVisible();
  await expect(page.locator('[data-opening-overlay]')).toHaveAttribute('data-active','false');
  await page.setViewportSize({width:1440,height:900});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(site.url+'/?motion=0');
  await expect(page.locator('.hero-copy h1')).toBeVisible();
  await expect(page.locator('[data-opening-overlay]')).toHaveAttribute('data-active','false');
});

test('no JavaScript retains the complete static hero and native navigation',async({browser})=>{
  const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:600,height:900}});
  const page=await context.newPage();
  await page.goto(site.url);
  await expect(page.locator('.hero-copy h1')).toBeVisible();
  await expect(page.locator('.identity-sculpture polygon')).toHaveCount(192);
  await context.close();
});

test('intro bootstrap is Home-only',async({browser})=>{
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  const page=await context.newPage();
  const requests:string[]=[];
  page.on('request',request=>requests.push(new URL(request.url()).pathname));
  await page.goto(`${site.url}/privacy/`);
  await expect(page.locator('.document-page h1')).toBeVisible();
  expect(requests.some(path=>path==='/intro-boot.js'||path==='/intro-boot.css')).toBe(false);
  await context.close();
});

test('first-paint guard reveals the page when the main module fails',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  const mainModule=/\/assets\/site-[^/]+\.js$/;
  await page.route(mainModule,route=>route.abort());
  await page.goto(site.url);
  await expect(page.locator('html')).toHaveAttribute('data-intro','pending');
  await expect(page.locator('.site-header')).toBeHidden();
  await expect(page.locator('html')).toHaveAttribute('data-intro','skip',{timeout:4000});
  await expect(page.locator('.site-header')).toBeVisible();
  await expect(page.locator('.hero-copy h1')).toBeVisible();
  await page.unroute(mainModule);
  await page.reload();
  await expect(page.locator('[data-opening-overlay]')).toHaveAttribute('data-active','true');
});
