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

test('fresh home visit resolves the branded opening into the same hero mark',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto(site.url);
  await expect(page.locator('[data-opening-overlay]')).toHaveAttribute('data-active','true');
  await expect(page.locator('.opening-name strong')).toHaveText('Drishya');
  const mark=page.locator('.identity-sculpture');
  await expect.poll(()=>mark.getAttribute('data-opening-stage'),{timeout:2200}).toBe('ready');
  await expect(page.locator('[data-opening-overlay]')).toHaveAttribute('data-active','false');
  await expect(page.getByRole('button',{name:'Replay intro'})).toBeVisible();
  await page.getByRole('button',{name:'Replay intro'}).click();
  await expect(page.locator('[data-opening-overlay]')).toHaveAttribute('data-active','true');
  await page.keyboard.press('Escape');
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
