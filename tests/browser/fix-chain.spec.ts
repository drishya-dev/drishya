import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,sep} from 'node:path';
import {test,expect} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
let dir:string,app:App,server:RunningServer;
test.beforeAll(async()=>{dir=mkdtempSync(join(tmpdir(),'drishya-fixchain-'));app=new App(dir);server=await startServer({app,port:0});});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});}});

test('an expanded test run links back to the failed run of the same command, with the edits between',async({page})=>{
 const id=(await app.ingest.importSource('claude-code',resolve('fixtures/synthetic/claude/checkout-fix.jsonl'))).recordingId;
 await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
 const failed=page.locator('article.op-test').last();await expect(failed).toBeVisible();
 await failed.getByRole('button',{name:/Expand/}).click();
 const chain=page.getByRole('region',{name:'Same command, later run'});
 await expect(chain).toContainText('failed');await expect(chain).toContainText('1 edit');await expect(chain).toContainText('passed');
 await expect(chain).toContainText('recorded order');
});
