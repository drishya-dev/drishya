import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {test,expect} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
let dir:string,id:string,app:App,server:RunningServer;
const base='export const original = 1;\n';
test.beforeAll(async()=>{dir=mkdtempSync(join(tmpdir(),'drishya-shared-draft-'));writeFileSync(join(dir,'shared.ts'),base);const journal=join(dir,'session.jsonl');writeFileSync(journal,[{type:'session_meta',payload:{id:'shared-draft',cwd:dir}},{type:'response_item',payload:{type:'message',role:'user',content:[{type:'input_text',text:'Inspect shared source'}]}}].map(x=>JSON.stringify(x)).join('\n')+'\n');app=new App(join(dir,'data'));id=(await app.ingest.importSource('codex',journal)).recordingId;server=await startServer({app,port:0});});
test.afterAll(async()=>{await server?.close();await app?.close();if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});});
test('both panes edit the same retained draft without overwriting each other',async({page})=>{
 await page.setViewportSize({width:1440,height:960});await page.route('**/v1/working-locations',route=>route.request().method()==='GET'?route.fulfill({json:{version:1,sessions:[]}}):route.continue());
 await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);await page.getByRole('button',{name:'Open developer workspace',exact:true}).click();const desk=page.getByRole('region',{name:'Developer workspace',exact:true});await desk.getByRole('button',{name:'Approve workspace reading',exact:true}).click();
 const find=page.getByRole('textbox',{name:'Find repository files',exact:true}),row=page.locator('[data-spine-path="shared.ts"]');await find.fill('shared.ts');await row.click();let first=desk.locator('.desk-pane').nth(0);await first.getByRole('button',{name:'Edit file',exact:true}).click();const a=first.getByRole('textbox',{name:'Local draft for shared.ts',exact:true});await expect(a).toContainText('original');await a.fill(base+'// first draft');
 const layout=desk.getByLabel('Workspace layout actions',{exact:true});await layout.press('Enter');await desk.getByRole('button',{name:'Split view',exact:true}).press('Enter');const second=desk.locator('.desk-pane').nth(1);await second.getByRole('button',{name:'Show files',exact:true}).click();await row.click();const b=second.getByRole('textbox',{name:'Local draft for shared.ts',exact:true});await expect(b).toContainText('first draft');
 await a.fill(base+'// first draft\n// newer first-pane work');await expect(b).toContainText('newer first-pane work');
 await b.focus();await page.keyboard.press('Control+End');await page.keyboard.insertText('\n// second-pane addition');await expect(a).toContainText('second-pane addition');await expect(a).toContainText('newer first-pane work');
 // Returning from comparison must reveal the same editable DOM and its newest draft.
 await first.getByRole('button',{name:'Compare draft',exact:true}).click();await b.focus();await page.keyboard.press('Control+End');await page.keyboard.insertText('\n// while the other editor is hidden');await first.getByRole('button',{name:'Edit draft',exact:true}).click();await expect(a).toContainText('while the other editor is hidden');
 expect(readFileSync(join(dir,'shared.ts'),'utf8')).toBe(base);await page.screenshot({path:resolve('.local/workspace-shared-draft.png')});
});
