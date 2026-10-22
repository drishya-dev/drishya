import {mkdirSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,sep} from 'node:path';
import {test,expect} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
let dir:string,app:App,server:RunningServer;
test.beforeAll(async()=>{dir=mkdtempSync(join(tmpdir(),'drishya-checkpoints-'));app=new App(join(dir,'data'));server=await startServer({app,port:0});});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});}});

test('an edit offers its file before the turn, read from the checkpoint only after workspace approval',async({page})=>{
 const session='checkpoints',work=join(dir,'work'),project=join(dir,'projects','C--work'),history=join(dir,'file-history',session),t='2026-10-21T00:00:00Z',base={timestamp:t,cwd:work,sessionId:session};
 mkdirSync(join(work,'src'),{recursive:true});mkdirSync(project,{recursive:true});mkdirSync(history,{recursive:true});
 writeFileSync(join(work,'src','cart.ts'),'export const total = 2;\n');
 writeFileSync(join(history,'aaaaaaaaaaaaaaaa@v2'),'export const total = 1; // BEFORE THE TURN\n');
 const rows=[
  {type:'file-history-snapshot',messageId:'p1',isSnapshotUpdate:false,snapshot:{messageId:'p1',timestamp:t,trackedFileBackups:{'src\\cart.ts':{backupFileName:'aaaaaaaaaaaaaaaa@v2',version:2,backupTime:t,realParentDir:join(work,'src')}}}},
  {...base,type:'user',uuid:'p1',message:{role:'user',content:'Fix the cart total'}},
  {...base,type:'assistant',uuid:'a1',message:{id:'m1',role:'assistant',content:[{type:'tool_use',id:'e1',name:'Edit',input:{file_path:join(work,'src','cart.ts'),old_string:'total = 1',new_string:'total = 2'}}]}},
  {...base,type:'user',uuid:'r1',toolUseResult:{filePath:join(work,'src','cart.ts'),oldString:'total = 1',newString:'total = 2',originalFile:'',structuredPatch:[],userModified:false,replaceAll:false},message:{role:'user',content:[{type:'tool_result',tool_use_id:'e1',content:'ok'}]}},
 ];
 const journal=join(project,`${session}.jsonl`);writeFileSync(journal,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');
 const id=(await app.ingest.importSource('claude-code',journal)).recordingId;
 await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
 const edit=page.locator('article.op').filter({hasText:'cart.ts'}).first();
 await edit.locator('button.op-expand').focus();await page.keyboard.press('Enter');
 await expect(edit.locator('.before-turn-line').first()).toContainText('kept a checkpoint of this file from when this turn began');
 await edit.getByRole('button',{name:'Show file before this turn'}).click();
 await expect(edit.locator('.before-turn-line').last()).toContainText('Allow workspace reading');
 await expect(edit.locator('.before-turn-file')).toHaveCount(0);
 const approve=await page.request.post(`${server.url}/v1/recordings/${id}/workspace/approve`,{headers:{authorization:`Bearer ${server.token}`,'content-type':'application/json'},data:{}});
 expect(approve.ok()).toBe(true);
 await edit.locator('button.op-expand').focus();await page.keyboard.press('Enter');await edit.locator('button.op-expand').focus();await page.keyboard.press('Enter');
 await edit.getByRole('button',{name:'Show file before this turn'}).click();
 await expect(edit.locator('.before-turn-file')).toContainText('BEFORE THE TURN');
 await expect(edit.locator('.before-turn-file')).toContainText('not part of the recording');
 if(process.env.CP_SHOT)await edit.screenshot({path:resolve('.local/checkpoint-edit.png')});
});
