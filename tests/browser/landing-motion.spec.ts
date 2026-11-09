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

for(const width of [600,1024,1440,1920])test(`dimensional home remains readable at ${width}`,async({page})=>{
  await page.setViewportSize({width,height:900});
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(site.url);await expect(page.locator('h1')).toContainText('See what');
  await expect(page.locator('.hero-copy .primary')).toBeVisible();
  await expect(page.locator('.identity-sculpture polygon')).toHaveCount(192);
  expect(await page.evaluate(()=>getComputedStyle(document.documentElement).backgroundColor)).toBe('rgb(0, 0, 0)');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const action=await page.locator('.hero-copy .primary').boundingBox();expect(action!.y+action!.height).toBeLessThanOrEqual(900);
  expect(errors).toEqual([]);
});

test('hero reverses with scrolling and has no idle animation',async({page})=>{
  await page.setViewportSize({width:1440,height:900});await page.goto(site.url);
  const track=page.locator('[data-identity-track]'),mesh=page.locator('.identity-sculpture');
  await expect(track).toHaveAttribute('data-motion','active');
  const first=await mesh.locator('polygon').first().getAttribute('points');
  await page.evaluate(()=>scrollTo(0,380));await expect.poll(()=>track.getAttribute('data-progress')).not.toBe('0.000');
  expect(await mesh.locator('polygon').first().getAttribute('points')).not.toBe(first);
  await page.evaluate(()=>scrollTo(0,0));await expect(track).toHaveAttribute('data-progress','0.000');
  expect(await mesh.locator('polygon').first().getAttribute('points')).toBe(first);
  // The existing finite evidence-tether arrival may still be settling on a fast run.
  await expect.poll(()=>page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length)).toBe(0);
});

test('reduced motion, explicit motion off and short windows keep a static composition',async({page})=>{
  await page.setViewportSize({width:1440,height:900});await page.goto(site.url);
  const track=page.locator('[data-identity-track]');await expect(track).toHaveAttribute('data-motion','active');
  await page.emulateMedia({reducedMotion:'reduce'});await expect(track).toHaveAttribute('data-motion','static');
  await expect(page.locator('.hero-copy .primary')).toBeVisible();
  await page.emulateMedia({reducedMotion:'no-preference'});await expect(track).toHaveAttribute('data-motion','active');
  await page.goto(site.url+'/?motion=0');await expect(track).toHaveAttribute('data-motion','static');
  await page.goto(site.url);await page.setViewportSize({width:1440,height:600});await expect(track).toHaveAttribute('data-motion','static');
});

test('no JavaScript retains original identity, source and navigation',async({browser})=>{
  const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:600,height:900}}),page=await context.newPage();
  await page.goto(site.url);await expect(page.locator('.identity-sculpture polygon')).toHaveCount(192);
  await expect(page.locator('.hero-copy .primary')).toBeVisible();
  await page.locator('.hero-copy .primary').click();await expect(page).toHaveURL(/#session$/);
  await context.close();
});
