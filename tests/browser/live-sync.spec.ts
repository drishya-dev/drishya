import { appendFileSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer } from '../../apps/daemon/src/server.ts';

test('Follow starts stopped capture and keeps refreshing while notices arrive continuously', async ({ page }) => {
  const dir=mkdtempSync(join(tmpdir(),'drishya-live-sync-')),journal=join(dir,'session.jsonl');
  copyFileSync(resolve('fixtures/synthetic/claude/checkout-fix.jsonl'),journal);
  const app=new App(join(dir,'store'));
  const {recordingId}=await app.ingest.importSource('claude-code',journal);
  const server=await startServer({app,port:0,token:'synthetic-live-sync'});
  try {
    await page.goto(server.launchUrl);
    await expect(page.locator('.home')).toBeVisible();
    await page.goto(`${server.url}/?experience=modern&motion=0#/r/${recordingId}`);
    const follow=page.getByRole('switch',{name:'Automatically follow new work'});
    await expect(follow).toHaveAttribute('aria-checked','false');
    await follow.click();
    await expect(follow).toHaveAttribute('aria-checked','true');
    expect(app.store.getRecording(recordingId)?.live).toBe(true);
    const steps=page.locator('.reading-status');
    const before=Number((await steps.innerText()).match(/\d+/)?.[0]);
    let finished=false;
    const producer=(async()=>{
      for(let i=0;i<35;i++) {
        appendFileSync(journal,JSON.stringify({type:'assistant',uuid:`continuous-${i}`,cwd:'/home/dev/shop',timestamp:new Date().toISOString(),message:{id:`continuous-${i}`,role:'assistant',content:[{type:'text',text:`Continuous captured update ${i}`} ]}})+'\n');
        await app.ingest.sync(recordingId);
        await new Promise(r=>setTimeout(r,50));
      }
      finished=true;
    })();
    await expect.poll(async()=>Number((await steps.innerText()).match(/\d+/)?.[0]),{timeout:1400}).toBeGreaterThan(before);
    expect(finished).toBe(false);
    await producer;
    await expect(steps).toContainText(`${before+35} recorded steps`);
    // No direct sync here: the real passive watcher must notice this append.
    appendFileSync(journal,JSON.stringify({type:'assistant',uuid:'passive-final',timestamp:new Date().toISOString(),message:{id:'passive-final',role:'assistant',content:[{type:'text',text:'Passive final update'}]}})+'\n');
    await expect(steps).toContainText(`${before+36} recorded steps`);
  } finally {
    await server.close();await app.close();
    if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary directory');
    rmSync(dir,{recursive:true,force:true});
  }
});
