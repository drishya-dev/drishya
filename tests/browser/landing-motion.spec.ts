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

test('scroll story follows recorded stops and explicit reading keeps ownership',async({page})=>{
  await page.setViewportSize({width:1440,height:900});await page.goto(site.url);
  await page.keyboard.press('Escape');
  await page.locator('.desktop-nav').getByRole('link',{name:'Demo',exact:true}).click();
  const section=page.locator('#session'),follow=page.getByRole('button',{name:'Follow scroll',exact:true});
  await expect(section).toHaveAttribute('data-story','scroll');
  await expect(section).toHaveAttribute('data-story-owner','scroll');
  const stop=page.locator('[data-story-stop]').nth(2);
  await stop.evaluate(el=>scrollTo(0,el.getBoundingClientRect().top+scrollY-200));
  await expect(page.locator('#chapter-counter')).toHaveText('3 of 4');
  await expect(page.locator('#full-replay')).toHaveAttribute('href','/demo/?demo&at=26');
  expect(new URL(page.url()).searchParams.has('moment')).toBe(false);
  await page.getByRole('link',{name:/02 Inspect the failing test/}).click();
  await expect(section).toHaveAttribute('data-story-owner','manual');
  await page.locator('[data-story-stop]').nth(3).evaluate(el=>scrollTo(0,el.getBoundingClientRect().top+scrollY-200));
  await expect(page.locator('#chapter-counter')).toHaveText('2 of 4');
  await follow.click();await expect(page.locator('#chapter-counter')).toHaveText('4 of 4');
  await page.locator('[data-story-stop]').first().evaluate(el=>scrollTo(0,el.getBoundingClientRect().top+scrollY-200));
  await expect(page.locator('#chapter-counter')).toHaveText('1 of 4');
  await page.getByRole('slider',{name:'Moment'}).press('End');
  await expect(section).toHaveAttribute('data-story-owner','manual');
  await expect(page.locator('#chapter-counter')).toHaveText('4 of 4');
});

test('scroll story degrades to manual reading for motion preferences and missing metadata',async({page})=>{
  await page.setViewportSize({width:1440,height:900});await page.goto(site.url+'/?moment=edit#session');
  await expect(page.locator('#session')).toHaveAttribute('data-story-owner','manual');
  await expect(page.locator('#chapter-counter')).toHaveText('3 of 4');
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect(page.locator('#session')).toHaveAttribute('data-story','manual');
  await expect(page.locator('#follow-scroll')).toBeHidden();
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.setViewportSize({width:600,height:900});await expect(page.locator('#session')).toHaveAttribute('data-story','manual');
  await page.route('**/chapters.json',route=>route.abort());await page.goto(site.url+'/#session');
  await expect(page.locator('#sample-error')).toBeVisible();await expect(page.locator('#follow-scroll')).toBeHidden();
  await page.locator('.static-walkthrough summary').click();await expect(page.locator('#moment-retest')).toContainText('6 passed');
});

test('motion off disables hover choreography and hiding the page preserves story layout',async({page})=>{
  await page.setViewportSize({width:1440,height:900});await page.goto(site.url+'/?motion=0');
  const cta=page.locator('.hero-copy .primary');await cta.hover();
  expect(await cta.locator('svg').evaluate(el=>getComputedStyle(el).transform)).toBe('none');
  await page.goto(site.url+'/#session');await expect(page.locator('#session')).toHaveAttribute('data-story','scroll');
  const before=await page.locator('#session').evaluate(el=>el.getBoundingClientRect().height);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  expect(await page.locator('#session').evaluate(el=>el.getBoundingClientRect().height)).toBe(before);
  expect(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length)).toBe(0);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
  await expect(page.locator('#session')).toHaveAttribute('data-story','scroll');
  await page.getByRole('link',{name:/02 Inspect the failing test/}).evaluate(el=>{
    el.dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1}));
    dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));
  });
  expect(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length)).toBe(0);
  await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
  await expect(page.locator('html')).toHaveAttribute('data-landing-motion','on');
});

test('save-data uses the same static policy for the hero, chapters and menu',async({page})=>{
  await page.addInitScript(()=>Object.defineProperty(navigator,'connection',{configurable:true,value:{saveData:true}}));
  await page.setViewportSize({width:600,height:900});await page.goto(site.url+'/#session');
  await expect(page.locator('html')).toHaveAttribute('data-landing-motion','off');
  await expect(page.locator('[data-identity-track]')).toHaveAttribute('data-motion','static');
  await page.getByRole('link',{name:/02 Inspect the failing test/}).click();
  expect(await page.locator('#chapter-material').evaluate(el=>el.getAnimations().length)).toBe(0);
  await page.locator('.compact-nav summary').click();
  expect(await page.locator('.compact-nav nav').evaluate(el=>el.getAnimations().length)).toBe(0);
});
