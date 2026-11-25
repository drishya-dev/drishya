import { test, expect } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer } from './browser-server.ts';

// Opt-in real redacted store: no native session is imported or resumed by this check.
const store=process.env.DRISHYA_REVIEW_STORE;
test.describe('Home GitHub footer',()=>{
  test.skip(!store,'Set DRISHYA_REVIEW_STORE to an existing redacted local store.');
  let app:App; let server:Awaited<ReturnType<typeof startServer>>;
  test.beforeAll(async()=>{app=new App(store!);server=await startServer({app,port:0});});
  test.afterAll(async()=>{await server?.close();await app?.close();});
  test('keeps sessions and navigation clear at desktop and phone widths, without external requests',async({page})=>{
    const external:string[]=[];
    page.on('request',r=>{if(new URL(r.url()).origin!==new URL(server.launchUrl).origin)external.push(r.url());});
    await page.goto(server.launchUrl);
    const link=page.getByRole('link',{name:'Star on GitHub'});
    await expect(link).toBeVisible();
    const clear=page.getByRole('button',{name:'Clear filters'});
    if(await clear.isVisible())await clear.click();
    await expect(page.locator('.mh-session').first()).toBeVisible();
    await expect(page.locator('.mh-header').getByRole('link',{name:'Star on GitHub'})).toHaveCount(0);
    for(const width of [1440,390,320]){
      await page.setViewportSize({width,height:960});
      await expect(link).toBeInViewport();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await expect(page.getByRole('button',{name:'Workspace settings'})).toBeVisible();
      await page.screenshot({path:`.local/ui3-home-${width}.png`});
    }
    await expect(link).toHaveAttribute('rel','noopener noreferrer');
    expect(external).toEqual([]);
  });
  test('has static keyboard focus and disables the sweep for reduced motion, low resources and forced colors',async({page})=>{
    await page.goto(server.launchUrl);
    const link=page.getByRole('link',{name:'Star on GitHub'});await expect(link).toBeVisible();
    await page.keyboard.press('Tab');await link.focus();
    expect(await link.evaluate(el=>getComputedStyle(el).outlineStyle)).toBe('solid');
    await link.hover();
    expect(await link.evaluate(el=>getComputedStyle(el,'::before').transitionDuration)).toBe('1s');
    await page.emulateMedia({reducedMotion:'reduce'});
    expect(await link.evaluate(el=>getComputedStyle(el,'::before').display)).toBe('none');
    await page.emulateMedia({reducedMotion:'no-preference',forcedColors:'active'});
    expect(await link.evaluate(el=>getComputedStyle(el,'::before').display)).toBe('none');
    await page.emulateMedia({forcedColors:'none'});
    await page.evaluate(()=>document.documentElement.setAttribute('data-low-resource',''));
    expect(await link.evaluate(el=>getComputedStyle(el,'::before').display)).toBe('none');
    await page.evaluate(()=>{document.documentElement.removeAttribute('data-low-resource');document.documentElement.removeAttribute('data-ui-motion');});
    expect(await link.evaluate(el=>getComputedStyle(el,'::before').display)).toBe('none');
  });
});
