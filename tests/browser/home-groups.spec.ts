import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from './legacy-test.ts';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from './browser-server.ts';

let dir: string, app: App, server: RunningServer;
test.beforeAll(async () => { dir = mkdtempSync(join(tmpdir(), 'drishya-home-')); app = new App(dir); server = await startServer({ app, port: 0, token: 'synthetic-home' }); });
test.afterAll(async () => { await server.close(); await app.close(); if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); });

test('Modern discovery shows pending state and refresh recovers a source failure', async ({ page }) => {
  let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});let failed=true;
  await page.route('**/v1/sources',async route=>{await gate;await route.fulfill(failed?{status:503,json:{error:'Synthetic discovery temporarily unavailable'}}:{json:{sources:[],errors:[]}});});
  await page.goto(server.launchUrl);
  const sources=page.locator('.mh-results');
  await expect(sources).toContainText('discovering local sessions');release();
  await expect(page.getByRole('alert')).toContainText('Synthetic discovery temporarily unavailable');
  failed=false;await page.getByRole('button',{name:'Refresh sessions',exact:true}).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(sources).toContainText('0 sessions');
  await expect(sources).not.toContainText('discovering local sessions');
});

test('Modern groups complete metadata and bounds rows with keyboard and narrow access',async({page})=>{
  const today=new Date().toISOString(),yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
  const rows=Array.from({length:105},(_,n)=>({id:`r-${n}`,title:`Synthetic session ${n}`,harness:n%2?'codex':'claude-code',workspaceRoot:n===104?undefined:n===103?'/two/shop':'/one/shop',createdAt:today,updatedAt:today,lastSourceTime:n===104?undefined:n===1?yesterday.toISOString():today,observationCount:2,live:false,pinned:false}));
  await page.route('**/v1/recordings',route=>route.fulfill({json:{recordings:rows}}));
  await page.route('**/v1/sources',route=>route.fulfill({json:{sources:[],errors:[]}}));
  await page.goto(server.launchUrl);
  const results=page.locator('.mh-results'),groups=page.locator('.mh-workspace-list .mh-workspace'),list=page.locator('.mh-session-list');
  await expect(results.locator(':scope > header')).toContainText('105 sessions');
  await expect(groups).toHaveCount(3);
  expect(await page.locator('.mh-session').count()).toBeLessThan(70);
  await list.focus();await page.keyboard.press('End');
  await expect(page.locator('.mh-session-open:focus')).toContainText('Synthetic session 104');
  await expect(results).toContainText('Time unavailable');
  await list.focus();await page.keyboard.press('Home');
  await expect(page.locator('.mh-session-open:focus')).not.toContainText('Synthetic session 104');
  const search=page.getByRole('textbox',{name:'Find sessions'});
  await search.fill('no-match');await expect(results).toContainText('No matching sessions');await search.fill('');
  await page.getByRole('combobox',{name:'Harness',exact:true}).selectOption('codex');
  await expect(results.locator(':scope > header')).toContainText('52 sessions');
  await page.getByRole('combobox',{name:'Harness',exact:true}).selectOption('all');
  const workspace=page.locator('.mh-workspace-list button[title="/two/shop"]');
  await workspace.focus();await page.keyboard.press('Enter');
  await expect(page.locator('.mh-session')).toHaveCount(1);
  await expect(page.locator('.mh-session')).toContainText('Synthetic session 103');
  await page.setViewportSize({width:600,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect(search).toBeVisible();
});
