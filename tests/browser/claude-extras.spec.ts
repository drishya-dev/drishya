import {mkdirSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,sep} from 'node:path';
import {test,expect} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
let dir:string,app:App,server:RunningServer;
test.beforeAll(async()=>{dir=mkdtempSync(join(tmpdir(),'drishya-extras-'));app=new App(join(dir,'data'));server=await startServer({app,port:0});});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});}});

test('Claude extras: permission mode changes, command notes, saved output on request, fetch facts',async({page})=>{
 const session='extras',project=join(dir,'projects','C--work'),results=join(project,session,'tool-results'),base={timestamp:'2026-10-21T00:00:00Z',cwd:dir,sessionId:session};
 mkdirSync(results,{recursive:true});writeFileSync(join(results,'build.txt'),'compiled 412 modules\nTAIL OF THE SAVED OUTPUT\n');
 const call=(id:string,name:string,input:unknown)=>({...base,type:'assistant',uuid:`a-${id}`,message:{id:`m-${id}`,role:'assistant',content:[{type:'tool_use',id,name,input}]}});
 const result=(id:string,toolUseResult:unknown)=>({...base,type:'user',uuid:`r-${id}`,toolUseResult,message:{role:'user',content:[{type:'tool_result',tool_use_id:id,content:'output'}]}});
 const shell=(extra:object)=>({stdout:'compiled 412 modules',stderr:'',interrupted:false,isImage:false,noOutputExpected:false,...extra});
 const rows=[
  {...base,type:'user',uuid:'p1',permissionMode:'acceptEdits',message:{role:'user',content:'Build it'}},
  call('b1','Bash',{command:'pnpm build'}),result('b1',shell({persistedOutputPath:join(results,'build.txt'),persistedOutputSize:45})),
  {...base,type:'user',uuid:'p2',permissionMode:'acceptEdits',message:{role:'user',content:'Fetch the docs'}},
  call('w1','WebFetch',{url:'https://example.com/docs',prompt:'read'}),result('w1',{url:'https://example.com/docs',code:200,codeText:'OK',bytes:52465,durationMs:1840,result:'Docs text'}),
  {...base,type:'user',uuid:'p3',permissionMode:'auto',message:{role:'user',content:'Carry on alone'}},
  call('b2','Bash',{command:'pnpm dev'}),result('b2',shell({backgroundTaskId:'task9',timedOutAfterMs:600000})),
 ];
 const journal=join(project,`${session}.jsonl`);writeFileSync(journal,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');
 const id=(await app.ingest.importSource('claude-code',journal)).recordingId;
 await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
 await expect(page.locator('.turn-mode')).toHaveText(['Accepts edits','Auto mode']);
 const build=page.locator('article.op').filter({hasText:'pnpm build'}).first();
 await build.locator('button.op-expand').focus();await page.keyboard.press('Enter');
 await expect(build.locator('.command-run-note').first()).toContainText('Full output saved by Claude Code (45 B)');
 await build.getByRole('button',{name:'Read full output'}).click();
 await expect(build.locator('.command-run-full')).toContainText('TAIL OF THE SAVED OUTPUT');
 await expect(build.locator('.command-run-full')).toContainText('not part of the recording');
 if(process.env.EXTRAS_SHOT){await build.screenshot({path:resolve('.local/extras-build.png')});await page.locator('.turn').last().screenshot({path:resolve('.local/extras-turn.png')});}
 const fetch=page.locator('article.op').filter({hasText:'example.com/docs'}).first();
 await fetch.locator('button.op-expand').focus();await page.keyboard.press('Enter');
 await expect(fetch).toContainText('200 OK · 51.2 KB · 1.8 s');
 const dev=page.locator('article.op').filter({hasText:'pnpm dev'}).first();
 await dev.locator('button.op-expand').focus();await page.keyboard.press('Enter');
 await expect(dev.locator('.command-run-note')).toHaveText('Moved to the background after 10 min');
});
