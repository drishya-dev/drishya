import { resolve } from 'node:path';
import { expect,test } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer,type RunningServer } from '../../apps/daemon/src/server.ts';

// Explicit opt-in to an existing local redacted store. No new journal import or native turn.
const store=process.env.DRISHYA_REVIEW_STORE;
const ids=(process.env.DRISHYA_REVIEW_IDS ?? '').split(',').filter(Boolean);
let app:App,server:RunningServer;
test.skip(!store || !ids.length,'Opt in with a local redacted store and explicit recording IDs.');
test.beforeAll(async()=>{if(!store || !ids.length)return;app=new App(store);server=await startServer({app,port:0});});
test.afterAll(async()=>{if(server)await server.close();if(app)await app.close();});
test('actual command keeps balanced input and output reading space',async({page})=>{
  await page.route('**/v1/working-locations',route=>route.request().method()==='GET'?route.fulfill({json:{version:1,sessions:[]}}):route.continue());
  await page.setViewportSize({width:1440,height:960});await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${encodeURIComponent(ids[0]!)}`);
  const follow=page.getByRole('switch',{name:'Automatically follow new work',exact:true});await expect(follow).toBeVisible();if(await follow.getAttribute('aria-checked')==='true')await follow.click();
  const card=page.locator('.op[data-tool-exchange]').filter({has:page.locator('.command-request')}).last();
  await expect(card).toBeVisible();await card.evaluate(el=>el.scrollIntoView({block:'center'}));
  const input=card.locator('.command-request'),output=card.locator('.result-content');
  expect(await input.evaluate(el=>parseFloat(getComputedStyle(el).maxHeight))).toBe(88);
  expect(await output.evaluate(el=>parseFloat(getComputedStyle(el).maxHeight))).toBe(142);
  await card.locator('.op-title').hover();await expect(card).toHaveAttribute('data-hover-reading','focused');
  expect(await input.evaluate(el=>parseFloat(getComputedStyle(el).maxHeight))).toBe(180);
  await page.screenshot({path:resolve('.local/actual-balanced-command.png'),animations:'disabled'});
});
