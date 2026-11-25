import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,sep} from 'node:path';
import {test,expect,type Page} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from './browser-server.ts';

let dir:string,app:App,server:RunningServer;
const sections=['Appearance','Reading','Playback','Privacy','Keyboard'];
test.beforeAll(async()=>{dir=mkdtempSync(join(tmpdir(),'drishya-settings-type-'));app=new App(dir);server=await startServer({app,port:0});});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});}});

async function openSettings(page:Page){
 await page.goto(`${server.url}/?experience=modern#token=${server.token}`);
 await page.getByRole('button',{name:'Workspace settings',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Workspace settings'})).toBeVisible();
}

test('all Settings sections meet text and control floors on every palette',async({page})=>{
 await openSettings(page);const dialog=page.getByRole('dialog',{name:'Workspace settings'});
 for(const palette of ['jet','paper','midnight']){
  await page.evaluate(value=>document.documentElement.dataset.palette=value,palette);
  for(const section of sections){
   await dialog.getByRole('tab',{name:section,exact:true}).click();
   // Controls transition their colours (120 ms); measure the settled palette, not a frame between two of them.
   await page.evaluate(()=>Promise.all(document.getAnimations().map(animation=>animation.finished.catch(()=>undefined))));
   const failures=await dialog.evaluate(root=>{
    const result:string[]=[];
    // Compute the actual inherited/composited background, not just a token pair.
    const rgba=(value:string)=>{const c=document.createElement('canvas').getContext('2d')!;c.clearRect(0,0,1,1);c.fillStyle=value;c.fillRect(0,0,1,1);return [...c.getImageData(0,0,1,1).data].map((v,i)=>i===3?v/255:v);};
    const over=(front:number[],back:number[])=>front.slice(0,3).map((v,i)=>v*front[3]!+back[i]!*(1-front[3]!)).concat(1);
    const luma=(rgb:number[])=>rgb.slice(0,3).map(v=>{const c=v/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i]!,0);
    for(const el of root.querySelectorAll<HTMLElement>('*')){
     if(!el.getClientRects().length||!el.checkVisibility()||el.closest('[aria-hidden=true]')||el.matches('option,:disabled'))continue;
     const ownText=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent?.trim());
     if(!ownText)continue;
     const style=getComputedStyle(el),label=el.textContent?.trim().slice(0,45),floor=el.matches('button,summary,select,dt,dd')?12:11;
     if(parseFloat(style.fontSize)<floor)result.push(`${label}: ${style.fontSize} < ${floor}px`);
     const parents:Element[]=[];for(let p:Element|null=el;p;p=p.parentElement)parents.unshift(p);
     let background=[255,255,255,1];for(const p of parents)background=over(rgba(getComputedStyle(p).backgroundColor),background);
     const a=luma(over(rgba(style.color),background)),b=luma(background),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
     if(ratio<4.5)result.push(`${label}: contrast ${ratio.toFixed(2)}`);
    }
    return result;
   });
   expect(failures,`${palette} / ${section}`).toEqual([]);
  }
 }
});

test('Settings descriptions, keyboard rows and controls remain reachable at narrow and short sizes',async({page})=>{
 await openSettings(page);const dialog=page.getByRole('dialog',{name:'Workspace settings'});
 for(const size of [{width:1440,height:900},{width:600,height:500},{width:390,height:844},{width:320,height:568}]){
  await page.setViewportSize(size);
  for(const section of sections){
   const tab=dialog.getByRole('tab',{name:section,exact:true});await tab.click();
   const panel=dialog.locator('.modern-settings-content');
   expect(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth+1),`${size.width} / ${section}`).toBe(true);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   if(section==='Appearance'){
    await expect(dialog.locator('.theme-option small').first()).toBeVisible();
    const last=dialog.getByRole('button',{name:'Midnight',exact:true});await last.scrollIntoViewIfNeeded();await expect(last).toBeInViewport();
   }
   if(section==='Reading'){
    const select=dialog.getByRole('combobox',{name:'Exposed reasoning detail'});await select.scrollIntoViewIfNeeded();await select.selectOption('collapsed');await expect(select).toHaveValue('collapsed');
   }
   if(section==='Keyboard'){
    const last=dialog.locator('.shortcut-list div').last();await last.scrollIntoViewIfNeeded();await expect(last).toBeInViewport();
   }
  }
  await dialog.getByRole('tab',{name:'Appearance',exact:true}).click();
  await page.screenshot({path:`.local/ui2-settings-${size.width}.png`});
 }
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
});
