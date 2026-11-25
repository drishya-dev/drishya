import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,sep} from 'node:path';
import {test,expect} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from './browser-server.ts';
let dir:string,app:App,server:RunningServer;
test.beforeAll(async()=>{dir=mkdtempSync(join(tmpdir(),'drishya-gap-'));app=new App(dir);server=await startServer({app,port:0});});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});}});

test('reasoning saved without text reads as one quiet line per turn; saved thinking stays',async({page})=>{
 const timestamp='2026-10-21T00:00:00Z',session='reasoning-gap',source=join(dir,session+'.jsonl'),base={timestamp,cwd:dir,sessionId:session};
 const say=(uuid:string,content:unknown[])=>({...base,type:'assistant',uuid,message:{id:uuid,role:'assistant',model:'m',content}});
 const rows=[
  {...base,type:'user',uuid:'p',message:{role:'user',content:'Tidy the cart module'}},
  say('a1',[{type:'thinking',thinking:'',signature:'s1'}]),
  say('a2',[{type:'thinking',thinking:'Check the cart total first.',signature:'s2'}]),
  say('a3',[{type:'thinking',thinking:'',signature:'s3'},{type:'text',text:'The cart total is correct.'}]),
 ];
 writeFileSync(source,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');const id=(await app.ingest.importSource('claude-code',source)).recordingId;
 await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
 const line=page.locator('.reasoning-gap-line');await expect(line).toHaveCount(1);
 await expect(line).toContainText('Reasoning not recorded by Claude Code');await expect(line).toContainText('2 blocks');
 await expect(page.locator('.history .prose').filter({hasText:'Check the cart total first.'})).toBeVisible();
 await expect(page.locator('.reasoning-gap-why')).toHaveCount(0);
 await line.focus();await page.keyboard.press('Enter');
 await expect(page.locator('.reasoning-gap-why')).toContainText('with a signature and no text');
 if(process.env.GAP_SHOT)await page.locator('.passage').first().screenshot({path:resolve('.local/reasoning-gap.png')});
});
