import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,sep} from 'node:path';
import {test,expect} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from './browser-server.ts';
let dir:string,app:App,server:RunningServer;
test.beforeAll(async()=>{dir=mkdtempSync(join(tmpdir(),'drishya-outside-'));app=new App(dir);server=await startServer({app,port:0});});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});}});

test('a file changed outside Claude Code reads as one muted line, never attributed, snippet on request',async({page})=>{
 const timestamp='2026-10-21T00:00:00Z',session='outside',source=join(dir,session+'.jsonl'),base={timestamp,cwd:dir,sessionId:session};
 const notice=(uuid:string)=>({...base,type:'attachment',uuid,attachment:{type:'edited_text_file',filename:join(dir,'src','cart.ts'),snippet:'3\texport const total = 3; // CHANGED OUTSIDE'}});
 const rows=[
  {...base,type:'user',uuid:'p',message:{role:'user',content:'Check the cart'}},
  notice('n1'),notice('n2'),
  {...base,type:'assistant',uuid:'a1',message:{id:'m1',role:'assistant',content:[{type:'tool_use',id:'r1',name:'Read',input:{file_path:join(dir,'src','cart.ts')}}]}},
  {...base,type:'user',uuid:'r1r',toolUseResult:{type:'text',file:{filePath:join(dir,'src','cart.ts'),content:'export const total = 3;',numLines:1,startLine:1,totalLines:1}},message:{role:'user',content:[{type:'tool_result',tool_use_id:'r1',content:'1\texport const total = 3;'}]}},
 ];
 writeFileSync(source,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');const id=(await app.ingest.importSource('claude-code',source)).recordingId;
 await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
 const line=page.locator('.notice-line');await expect(line).toHaveCount(1);
 await expect(line).toContainText('src/cart.ts');await expect(line).toContainText('changed outside Claude Code’s edits · noticed 2 times');
 await expect(line).not.toContainText(/you changed|by you\b/i);
 await expect(line.locator('.notice-line-snippet')).toHaveCount(0);
 // Recorded before the read, so it reads above the read card.
 const read=page.locator('article.op').filter({hasText:'cart.ts'}).first();
 expect((await line.boundingBox())!.y).toBeLessThan((await read.boundingBox())!.y);
 await line.locator('.notice-line-head').focus();await page.keyboard.press('Enter');
 await expect(line.locator('.notice-line-snippet')).toContainText('CHANGED OUTSIDE');
 if(process.env.NOTICE_SHOT)await page.locator('.passage').first().screenshot({path:resolve('.local/outside-notice.png')});
});
