import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,sep} from 'node:path';
import {test,expect} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
let dir:string,app:App,server:RunningServer;
test.beforeAll(async()=>{dir=mkdtempSync(join(tmpdir(),'drishya-home-type-'));app=new App(dir);server=await startServer({app,port:0});});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});}});
test.beforeEach(async({page})=>{
 const today=new Date().toISOString();
 const recordings=Array.from({length:300},(_,n)=>({id:`r-${n}`,title:`Session ${n}: long project name — 日本語 🧭 ${'review '.repeat(12)}`,harness:n%2?'codex':'claude-code',workspaceRoot:n%2?'C:/projects/workspace-with-a-very-long-name':'C:/projects/研究-project',createdAt:today,updatedAt:today,lastSourceTime:today,observationCount:2490,live:false,pinned:false}));
 await page.route('**/v1/recordings',route=>route.fulfill({json:{recordings}}));
 await page.route('**/v1/sources',route=>route.fulfill({json:{sources:[],errors:[]}}));
});
async function readableText(page:import('@playwright/test').Page){
 return page.locator('.mh-home').evaluate(home=>[...home.querySelectorAll<HTMLElement>('*')].filter(el=>[...el.childNodes].some(node=>node.nodeType===3&&node.textContent?.trim())&&el.getClientRects().length&&el.getAttribute('aria-hidden')!=='true'&&parseFloat(getComputedStyle(el).fontSize)>0&&parseFloat(getComputedStyle(el).fontSize)<11).map(el=>({text:el.textContent?.slice(0,50),font:getComputedStyle(el).fontSize})));
}
test('Home metadata and controls meet the type floor across seven palette contrasts',async({page})=>{
 await page.goto(`${server.url}/?experience=modern#token=${server.token}`);await expect(page.locator('.mh-session').first()).toBeVisible();
 expect(await readableText(page)).toEqual([]);
 for(const selector of ['.mh-about span','.mh-refresh','.mh-filters select','.home-github-star'])for(const el of await page.locator(selector).all())expect(await el.evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(12);
 for(const palette of ['jet','paper','midnight','mocha','tokyo','nord','gruvbox']){
  await page.evaluate(p=>document.documentElement.setAttribute('data-palette',p),palette);
  const ratio=await page.locator('.mh-harness-icon.claude-code').first().evaluate(el=>{
    const color=(text:string)=>{const context=document.createElement('canvas').getContext('2d')!;context.fillStyle=text;context.fillRect(0,0,1,1);return [...context.getImageData(0,0,1,1).data].slice(0,3);};
    const luma=(rgb:number[])=>rgb.map(v=>{const c=v/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i]!,0);
    const style=getComputedStyle(el),a=luma(color(style.color)),b=luma(color(style.backgroundColor));return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  });expect(ratio,`${palette} Claude mark`).toBeGreaterThanOrEqual(4.5);
 }
});
test('larger Home text stays contained and virtualized keyboard navigation reaches session 300',async({page})=>{
 await page.goto(`${server.url}/?experience=modern#token=${server.token}`);await expect(page.locator('.mh-session').first()).toBeVisible();
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:844});expect(await readableText(page)).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect(page.getByRole('link',{name:'Star on GitHub'})).toBeInViewport();
  const list=page.locator('.mh-session-list');await list.focus();await page.keyboard.press('End');
  await expect(page.locator('[data-session-index="299"] .mh-session-open')).toBeFocused();
  expect(await page.locator('.mh-session').count()).toBeLessThan(50);
  await page.keyboard.press('Home');await expect(page.locator('[data-session-index="0"] .mh-session-open')).toBeFocused();
  await page.screenshot({path:`.local/ui2-home-${width}.png`});
 }
});
