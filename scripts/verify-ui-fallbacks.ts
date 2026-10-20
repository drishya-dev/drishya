// Synthetic browser fallback probe. OS assistive technology and physical hardware remain manual.
import {cpSync,mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {chromium,expect} from '@playwright/test';
import {App} from '../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../apps/daemon/src/server.ts';

const dir=mkdtempSync(join(tmpdir(),'drishya-ui-fallbacks-')),app=new App(join(dir,'store'));
let server:RunningServer|undefined,browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
try {
  cpSync(resolve('fixtures/synthetic/codex/rollout-checkout-review.jsonl'),join(dir,'synthetic.jsonl'));
  const {recordingId}=await app.ingest.importSource('codex',join(dir,'synthetic.jsonl'));
  server=await startServer({app,port:0,token:'synthetic-ui-fallback'});
  browser=await chromium.launch({headless:true,channel:process.env.DRISHYA_BROWSER_CHANNEL||undefined});
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',forcedColors:'active'});
  await context.addInitScript(()=>localStorage.setItem('drishya.lowResource','1'));
  const page=await context.newPage(),errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  const cdp=await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern#/r/${recordingId}`);await expect(page.locator('.history')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-low-resource','');
  await expect(page.locator('.map canvas')).toHaveCount(0);
  const trigger=page.getByRole('button',{name:'Workspace settings',exact:true});await trigger.click();
  const settings=page.getByRole('dialog',{name:'Workspace settings',exact:true});await settings.getByRole('tab',{name:'Reading',exact:true}).click();
  const toggle=settings.getByRole('checkbox',{name:/Relationship motion/});await page.keyboard.press('Tab');await toggle.focus();
  expect(await toggle.evaluate(node=>getComputedStyle(node).appearance)).toBe('auto');
  expect(await toggle.evaluate(node=>getComputedStyle(node).outlineStyle)).not.toBe('none');
  const before=await toggle.isChecked();await page.keyboard.press('Space');expect(await toggle.isChecked()).toBe(!before);await page.keyboard.press('Space');
  await page.keyboard.press('Escape');await expect(settings).toHaveCount(0);await expect(trigger).toBeFocused();
  await page.keyboard.press('Control+k');const navigation=page.getByRole('dialog',{name:'Navigate workspace',exact:true});
  await expect(navigation.getByRole('combobox')).toBeFocused();await page.keyboard.press('ArrowDown');await page.keyboard.press('Escape');await expect(navigation).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  const heap=await cdp.send('Runtime.getHeapUsage') as {usedSize:number};
  const nodes=await page.evaluate(()=>document.querySelectorAll('*').length);
  expect(errors).toEqual([]);mkdirSync(resolve('.local'),{recursive:true});await page.screenshot({path:resolve('.local/finishing-forced-colors.png')});
  console.log(JSON.stringify({syntheticFallbacks:{browser:process.env.DRISHYA_BROWSER_CHANNEL||'chromium',viewport:'390x844',reducedMotion:true,forcedColors:true,lowResource:true,cpuThrottle:4,keyboard:'settings switch, Escape/focus return, command navigation',domNodes:nodes,browserJsHeapMiB:heap.usedSize/1048576,errors:errors.length},limits:'CPU throttling is not physical low-core/low-RAM, actual touch, screen-reader or browser-zoom certification.'}));
} finally {
  await browser?.close();await server?.close();await app.close();
  if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary directory');
  rmSync(dir,{recursive:true,force:true});
}
