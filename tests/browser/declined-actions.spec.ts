import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,sep} from 'node:path';
import {test,expect} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
let dir:string,app:App,server:RunningServer;
test.beforeAll(async()=>{dir=mkdtempSync(join(tmpdir(),'drishya-declined-'));app=new App(dir);server=await startServer({app,port:0});});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});}});

// The two result wordings are copied from real Claude Code journals.
const PERSON="The user doesn't want to proceed with this tool use. The tool use was rejected (eg. if it was a file edit, the new_string was NOT written to the file). STOP what you are doing and wait for the user to tell you how to proceed.";
const AUTO="Permission for this action was denied by the Claude Code auto mode classifier. Reason: [PII Data Handling]. If you have other tasks that don't depend on this action, continue working on those.";

test('declined and blocked actions say they did not run and are not counted as failures',async({page})=>{
 const timestamp='2026-10-22T00:00:00Z',session='declined-actions',source=join(dir,session+'.jsonl');
 const base={timestamp,cwd:dir,sessionId:session};
 const call=(n:number,name:string,input:object)=>({...base,type:'assistant',uuid:`a${n}`,message:{id:`m${n}`,role:'assistant',content:[{type:'tool_use',id:`t${n}`,name,input}]}});
 const result=(n:number,content:string)=>({...base,type:'user',uuid:`r${n}`,message:{role:'user',content:[{type:'tool_result',tool_use_id:`t${n}`,content,is_error:true}]}});
 const rows:object[]=[{...base,type:'user',uuid:'p',message:{role:'user',content:'Clean up the build'}},
  call(1,'Bash',{command:'rm -rf build'}),result(1,PERSON),
  call(2,'Edit',{file_path:join(dir,'src','a.ts'),old_string:'a',new_string:'b'}),result(2,AUTO),
  call(3,'Bash',{command:'false'}),result(3,'Exit code 1'),
  {...base,type:'assistant',uuid:'a9',message:{id:'m9',role:'assistant',content:[{type:'text',text:'Understood.'}]}}];
 writeFileSync(source,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');const id=(await app.ingest.importSource('claude-code',source)).recordingId;
 await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
 if(process.env.IMG_SHOT){await page.waitForTimeout(2500);await page.screenshot({path:resolve('.local/declined-dbg.png')});}
 const lines=page.locator('.declined-line');await expect(lines).toHaveCount(2);
 await expect(lines.nth(0)).toContainText('You declined this action');await expect(lines.nth(0)).toContainText('it did not run');
 await expect(lines.nth(1)).toContainText('auto mode blocked this action');await expect(lines.nth(1)).toContainText('reason: PII Data Handling');
 // Only the command that ran and failed is red.
 await expect(page.locator('article.op.st-error')).toHaveCount(1);
 await expect(page.locator('article.op.st-declined')).toHaveCount(2);
 await expect(page.locator('.state-declined')).toHaveCount(2);
 await expect(page.locator('.state-error')).toHaveCount(1);
 await expect(page.locator('.turn-ledger').first()).toContainText('1 failed');await expect(page.locator('.turn-ledger').first()).toContainText('2 declined');
 if(process.env.IMG_SHOT)await page.getByRole('region',{name:'Captured work'}).screenshot({path:resolve('.local/declined.png')});
});
