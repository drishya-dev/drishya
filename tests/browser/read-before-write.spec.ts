import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,sep} from 'node:path';
import {test,expect} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
let dir:string,app:App,server:RunningServer;
test.beforeAll(async()=>{dir=mkdtempSync(join(tmpdir(),'drishya-readbefore-'));app=new App(dir);server=await startServer({app,port:0});});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});}});

test('an expanded edit says which lines of the file were read before it, as recorded',async({page})=>{
 const id=(await app.ingest.importSource('claude-code',resolve('fixtures/synthetic/claude/checkout-fix.jsonl'))).recordingId;
 await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
 const edit=page.locator('article.op-edit').first();await expect(edit).toBeVisible();
 // Keyboard, not a pointer: moving the pointer over the card can start hover reading, which moves it under the click.
 const expand=edit.locator('button.op-expand');await expand.focus();await page.keyboard.press('Enter');await expect(expand).toHaveAttribute('aria-expanded','true');
 const facts=page.getByRole('region',{name:'Reads of this file before this edit'});
 await expect(facts).toBeVisible();
 // The fixture reads the guard file before editing it, so the line names that read; it never says "safe" or "risky".
 await expect(facts).toContainText('Read before this edit');
 await expect(facts).not.toContainText(/safe|risk/i);
});
