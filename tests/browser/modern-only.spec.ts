import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string, app: App, server: RunningServer;
test.beforeAll(async () => { dir = mkdtempSync(join(tmpdir(), 'drishya-modern-only-')); app = new App(dir); server = await startServer({ app, port: 0, token: 'synthetic-modern-only' }); });
test.afterAll(async () => { await server?.close(); await app?.close(); if (dir) { if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); } });

// SHIP-1: every product entry uses Modern, including retired URLs and stored preferences.
const url=(query='')=>new URL(`/?demo&motion=0${query}`,server.launchUrl).href;
for(const width of [600,1440])test(`no version chooser or developer bypass at ${width}`,async({page})=>{
  await page.setViewportSize({width,height:1000});
  await page.goto(url());
  for(const version of ['classic','legacy','canvas','clarity','fresh','studio','modern','unknown']){
    await page.evaluate(value=>{localStorage.setItem('drishya-ui-version',value);localStorage.setItem('drishya-experience-v4',value);localStorage.setItem('drishya-dev-ui-versions','1');},version);
    await page.goto(url(`&experience=${version}&versions=all`));
    await expect(page.locator('html')).toHaveAttribute('data-ui-version','modern');
    await expect(page.locator('html')).toHaveAttribute('data-ui-skin','modern');
    await page.getByRole('button',{name:'Workspace settings',exact:true}).click();
    const settings=page.getByRole('dialog',{name:'Workspace settings'});await expect(settings.getByRole('tab')).toHaveText(['Appearance','Reading','Playback','Privacy','Keyboard']);
    await expect(settings).not.toContainText(/UI versions|Clarity|Legacy|Choose your workspace/);
    await page.keyboard.press('Escape');await expect(settings).toHaveCount(0);
  }
});
test('fresh browser opens Modern and preserves the selected session on reload',async({page})=>{
  await page.goto(url());await expect(page.locator('.history')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-ui-skin','modern');
  const before=page.url();await page.reload();await expect(page.locator('.history')).toBeVisible();expect(page.url()).toBe(before);
});
