import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,sep} from 'node:path';
import {test,expect} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
import {openSessionReview} from './session-review.ts';
// READ-5 slice 1: the Changes view lists each file's captured edits as `turn N · +a −b → next test run ✓/✗`.
let dir:string,app:App,server:RunningServer;
test.beforeAll(async()=>{dir=mkdtempSync(join(tmpdir(),'drishya-edit-turns-'));app=new App(dir);server=await startServer({app,port:0});});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});}});

// A synthetic two-turn Claude session: turn 1 edits twice around a failing test run, turn 2 edits once and never runs a test.
function journal(){
 const base={cwd:'/home/dev/shop',sessionId:'c0ffee00-0000-4000-8000-0000000000e1',version:'2.1.0',userType:'external',entrypoint:'cli',isSidechain:false};
 let n=0,parent:string|null=null;const rows:string[]=[];
 const push=(type:'user'|'assistant',message:object)=>{const uuid=`00000000-0000-4000-8000-${String(++n).padStart(12,'0')}`;rows.push(JSON.stringify({...base,parentUuid:parent,type,message,uuid,timestamp:`2026-09-21T10:00:${String(n).padStart(2,'0')}.000Z`}));parent=uuid;};
 const prompt=(text:string)=>push('user',{role:'user',content:text});
 const use=(name:string,input:object,result:string,isError=false)=>{const id=`toolu_e${n}`;push('assistant',{id:`msg_${n}`,type:'message',role:'assistant',model:'claude-opus-5',content:[{type:'tool_use',id,name,input}],stop_reason:'tool_use'});push('user',{role:'user',content:[{type:'tool_result',tool_use_id:id,content:result,...(isError?{is_error:true}:{})}]});};
 const edit=(oldText:string,newText:string)=>use('Edit',{file_path:'/home/dev/shop/src/guard.ts',old_string:oldText,new_string:newText},'The file has been edited.');
 prompt('Fix the guard.');
 edit('const a = 1;','const a = 2;\nconst b = 3;');
 use('Bash',{command:'npm test',description:'Run the suite'},'Exit code 1\n1 failed',true);
 edit('const b = 3;','const b = 4;');
 prompt('Tidy the guard.');
 edit('const a = 2;','const a = 5;');
 return rows.join('\n')+'\n';
}

test('the Changes view lists each edit with its turn, +/- and next test run, and opens the edit',async({page})=>{
 const file=join(dir,'two-turns.jsonl');writeFileSync(file,journal());
 const id=(await app.ingest.importSource('claude-code',file)).recordingId;
 await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
 await expect(page.locator('article.op-edit').first()).toBeVisible();
 await openSessionReview(page);
 const dialog=page.getByRole('dialog',{name:'Session review',exact:true});
 await dialog.locator('.review-file-more>summary').first().click();
 const edits=dialog.getByRole('list',{name:'Edits of this file'}).getByRole('listitem');
 await expect(edits).toHaveCount(3);
 // Turn 1 edit before the failing run links it; the next edit has no later run in turn 1; turn 2 never ran a test.
 await expect(edits.nth(0)).toContainText('turn 1');await expect(edits.nth(0)).toContainText('+2');await expect(edits.nth(0)).toContainText('−1');
 await expect(edits.nth(0).getByRole('button',{name:'Next test run in this turn: failed'})).toBeVisible();
 await expect(edits.nth(1)).toContainText('turn 1');await expect(edits.nth(1).getByRole('button',{name:/Next test run/})).toHaveCount(0);
 await expect(edits.nth(2)).toContainText('turn 2');await expect(edits.nth(2).getByRole('button',{name:/Next test run/})).toHaveCount(0);
 await expect(dialog).not.toContainText('unattributed');
 // Each entry opens its captured edit.
 await edits.nth(2).getByRole('button',{name:/turn 2/}).click();
 await expect(dialog).toBeHidden();
 await expect(page.locator('article.op-edit.selected')).toHaveAttribute('data-op-id',/.toolu_e8$/);
});
