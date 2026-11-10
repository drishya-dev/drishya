import {test,expect} from '@playwright/test';
import {spawnSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {serveLanding} from '../../scripts/build-landing.ts';

let site:Awaited<ReturnType<typeof serveLanding>>;
test.beforeAll(async()=>{
  const result=spawnSync(process.execPath,['scripts/build-landing.ts'],{cwd:resolve('.'),encoding:'utf8'});
  if(result.status!==0)throw Error(result.stderr);
  site=await serveLanding();mkdirSync('.local/landing-checks',{recursive:true});
});
test.afterAll(async()=>{await site?.close();});

for(const width of [600,1024,1440,1920])test(`public landing routes and readable composition at ${width}`,async({page})=>{
  await page.setViewportSize({width,height:1000});const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  for(const [path,title]of [['/','See what'],['/get-started/','From the example'],['/privacy/','A public example'],['/releases/','Release availability']]){
    await page.goto(site.url+path);
    if(path==='/')await page.keyboard.press('Escape');
    await expect(page.locator('h1')).toContainText(title!);await page.evaluate(()=>document.fonts.ready);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await expect(page.getByRole('link',{name:'Drishya home'})).toBeVisible();
    await page.screenshot({path:`.local/landing-checks/${path==='/'?'home':path.split('/')[1]}-${width}.png`,fullPage:true});
  }
  expect(errors).toEqual([]);const missing=await page.goto(site.url+'/does-not-exist');expect(missing?.status()).toBe(404);await expect(page.locator('h1')).toHaveText('Page not found.');
});

test('walkthrough chapters, keyboard, playback interruptions and browser return keep one state',async({page})=>{
  await page.goto(site.url+'/?moment=failure#session');const material=page.locator('#chapter-material'),range=page.getByRole('slider',{name:'Moment'}),play=page.locator('#play-sample');
  await expect(page.locator('#chapter-counter')).toHaveText('2 of 4');await expect(material).toContainText('5 passed · 1 failed');
  await range.focus();await range.press('End');await expect(page.locator('#chapter-counter')).toHaveText('4 of 4');await expect(range).toHaveAttribute('aria-valuetext','Check the next test run');
  await expect(page.locator('#full-replay')).toHaveAttribute('href','/demo/?demo&at=28');
  await page.getByRole('link',{name:/02 Inspect the failing test/}).click();await expect(range).toHaveValue('2');
  await play.click();await expect(play).toHaveAttribute('aria-pressed','true');await expect(range).toHaveValue('3',{timeout:3500});
  await range.press('Home');await expect(play).toHaveAttribute('aria-pressed','false');await expect(range).toHaveValue('1');
  await play.click();await page.keyboard.press('Escape');await expect(play).toHaveAttribute('aria-pressed','false');
  await page.getByRole('link',{name:/03 Review the guard edit/}).click();await page.locator('#full-replay').click();await expect(page.locator('.viewer')).toBeVisible();
  await page.goBack();await expect(page.locator('#chapter-counter')).toHaveText('3 of 4');await expect(page.locator('#play-sample')).toHaveAttribute('aria-pressed','false');
  await page.getByRole('link',{name:/01 Read the checkout guard/}).click();await play.click();await page.evaluate(()=>scrollTo(0,0));await expect(play).toHaveAttribute('aria-pressed','false');
});

test('finite playback completes once; visibility and motion preference changes interrupt it',async({page})=>{
  await page.goto(site.url+'/#session');const play=page.locator('#play-sample');await expect(play).toBeVisible();await play.click();
  await expect(page.locator('#chapter-counter')).toHaveText('4 of 4',{timeout:9000});await expect(play).toHaveText(/Replay sample/,{timeout:3000});await expect(play).toHaveAttribute('aria-pressed','false');
  await play.click();await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});await expect(play).toHaveAttribute('aria-pressed','false');await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});});await play.click();await page.emulateMedia({reducedMotion:'reduce'});await expect(play).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('#full-replay')).toHaveAttribute('href',/motion=0/);
  await page.getByRole('link',{name:/02 Inspect the failing test/}).click();expect(await page.locator('#chapter-material').evaluate(el=>el.getAnimations().length)).toBe(0);
});

test('no JavaScript and metadata failure retain the complete example and setup',async({browser,page})=>{
  const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:600,height:1000}}),plain=await context.newPage();
  await plain.goto(site.url);await plain.locator('.static-walkthrough summary').click();for(const title of ['Read the checkout guard','Inspect the failing test','Review the guard edit','Check the next test run'])await expect(plain.locator('.static-walkthrough')).toContainText(title);
  await expect(plain.locator('#play-sample')).toBeHidden();await plain.goto(site.url+'/get-started/');await expect(plain.locator('#setup-commands')).toContainText('pnpm serve');await context.close();
  await page.route('**/chapters.json',route=>route.abort());await page.goto(site.url+'/#session');await expect(page.locator('#sample-error')).toBeVisible();await expect(page.locator('#play-sample')).toBeHidden();
  await page.locator('.static-walkthrough summary').click();await expect(page.locator('#moment-edit')).toContainText('cart.total == null');
});

test('compact menu, copy fallback, setup anchors and public availability work without dead actions',async({page})=>{
  await page.setViewportSize({width:600,height:1000});await page.goto(site.url);const menu=page.locator('.compact-nav');
  await page.keyboard.press('Escape');
  await menu.locator('summary').click();await expect(menu).toHaveAttribute('open','');await page.keyboard.press('Escape');await expect(menu).not.toHaveAttribute('open');await expect(menu.locator('summary')).toBeFocused();
  await menu.locator('summary').click();await page.locator('h1').click();await expect(menu).not.toHaveAttribute('open');
  await menu.locator('summary').click();await menu.getByRole('link',{name:'Privacy',exact:true}).click();await expect(page).toHaveURL(/\/privacy\/$/);
  await page.goto(site.url+'/get-started/#requirements');await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{value:{writeText:()=>Promise.reject(Error('Unavailable'))},configurable:true});});
  await page.getByRole('button',{name:'Copy commands'}).click();await expect(page.locator('.copy-feedback')).toContainText('commands are selected');expect(await page.evaluate(()=>getSelection()?.toString())).toContain('pnpm install --frozen-lockfile\npnpm ui:build\npnpm serve');
  await page.goto(site.url+'/releases/');await expect(page.locator('main')).toContainText('no public installer');expect(await page.locator('a[href*="github.com"]').count()).toBe(0);
});

test('all advertised site links resolve and no public resources call a daemon or third party',async({page})=>{
  const requests:string[]=[];page.on('request',r=>requests.push(r.url()));const links=new Set<string>();
  for(const path of ['/','/get-started/','/privacy/','/releases/','/404.html']){await page.goto(site.url+path);for(const href of await page.locator('a[href]').evaluateAll(nodes=>nodes.map(n=>(n as HTMLAnchorElement).href)))links.add(href);}
  for(const href of links){const url=new URL(href);expect(url.origin).toBe(site.url);const response=await page.request.get(href);expect(response.status(),url.pathname).toBeLessThan(400);}
  expect(requests.every(raw=>{const u=new URL(raw);return u.origin===site.url&&!u.pathname.startsWith('/v1');})).toBe(true);
});

test('public replay ignores hostile data/auth/server selectors and keeps real replay controls',async({page})=>{
  const requests:string[]=[],errors:string[]=[];page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));
  await page.goto(site.url+'/demo/?bundle=http://127.0.0.1:7878/private&demo=local&at=26&server=http://localhost:7878#token=not-a-real-token');
  await expect(page.locator('.viewer')).toBeVisible();await expect(page.locator('.public-demo-nav')).toContainText('Synthetic sample');expect(page.url()).not.toMatch(/private|token|localhost|server=/);
  await expect(page.getByRole('region',{name:'Harness prompt'})).toHaveCount(0);await expect(page.locator('input[type=file]')).toHaveCount(0);
  const timeline=page.getByRole('slider',{name:'Timeline',exact:true});await expect(timeline).toHaveValue('26');
  await page.locator('.t-controls').getByRole('button',{name:/Play|Resume/i}).first().click();await expect.poll(async()=>Number(await timeline.inputValue()),{timeout:11000}).toBeGreaterThan(26);
  await page.keyboard.press('Space');
  expect(requests.every(raw=>{const u=new URL(raw);return u.origin===site.url&&!u.pathname.startsWith('/v1');})).toBe(true);expect(errors).toEqual([]);
});

test('public replay has bundle retry recovery and invalid bookmarks fall back honestly',async({page})=>{
  await page.route('**/demo/demo/bundle.json',route=>route.abort());await page.goto(site.url+'/demo/?demo&at=26');await expect(page.getByRole('button',{name:'Retry sample'})).toBeVisible();
  await page.unroute('**/demo/demo/bundle.json');await page.getByRole('button',{name:'Retry sample'}).click();await expect(page.locator('.viewer')).toBeVisible();
  await page.goto(site.url+'/demo/?demo&at=999');await expect(page.locator('.viewer')).toBeVisible();expect(new URL(page.url()).searchParams.has('at')).toBe(false);
});


test('keyboard, rapid reversal, compact desktop reflow and lightweight home assets remain usable',async({page})=>{
  const resources:string[]=[];page.on('request',r=>resources.push(new URL(r.url()).pathname));
  await page.setViewportSize({width:720,height:800});await page.goto(site.url+'/#session');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const range=page.getByRole('slider',{name:'Moment'}),play=page.locator('#play-sample');
  await expect(play).toBeVisible();
  for(const value of [4,1,3,2]){await range.evaluate((el,value)=>{(el as HTMLInputElement).value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));},value);await expect(page.locator('#chapter-counter')).toHaveText(`${value} of 4`);}
  await play.click();await page.setViewportSize({width:1440,height:900});await expect(play).toHaveAttribute('aria-pressed','false');
  expect(resources.filter(p=>p.startsWith('/demo/assets/'))).toEqual([]);
  await page.goto(site.url);await page.keyboard.press('Escape');await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'Skip to content'})).toBeFocused();
  await page.keyboard.press('Enter');await expect(page).toHaveURL(/#main$/);
});


test('each full replay bookmark opens at both supported desktop extremes with readable controls',async({page})=>{
  for(const width of [600,1440]){
    await page.setViewportSize({width,height:1000});
    for(const step of [4,24,26,28]){
      await page.goto(`${site.url}/demo/?demo&at=${step}`);
      await expect(page.getByRole('slider',{name:'Timeline',exact:true})).toHaveValue(String(step));
      await expect(page.getByRole('navigation',{name:'Public sample'})).toBeVisible();
      await expect(page.locator('.t-controls').getByRole('button',{name:'Play',exact:true})).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    }
    await page.screenshot({path:`.local/landing-checks/full-replay-${width}.png`});
  }
});
