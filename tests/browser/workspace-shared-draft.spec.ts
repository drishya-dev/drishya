import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {test,expect,type Locator,type Page} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
let dir:string,id:string,app:App,server:RunningServer;
const cases=[['shared.ts','\n'],['crlf.ts','\r\n'],['cr.ts','\r']] as const;
const original=(eol:string)=>`export const original = "界😀";${eol}`;
test.beforeAll(async()=>{
 dir=mkdtempSync(join(tmpdir(),'drishya-shared-draft-'));
 for(const [path,eol] of cases)writeFileSync(join(dir,path),original(eol));
 writeFileSync(join(dir,'empty.ts'),'');writeFileSync(join(dir,'long.ts'),Array.from({length:1200},(_,i)=>`export const line${i+1} = ${i+1}; // ${'long words '.repeat(14)}`).join('\n'));
 const journal=join(dir,'session.jsonl');writeFileSync(journal,[{type:'session_meta',payload:{id:'shared-draft',cwd:dir}},{type:'response_item',payload:{type:'message',role:'user',content:[{type:'input_text',text:'Inspect shared source'}]}}].map(x=>JSON.stringify(x)).join('\n')+'\n');
 app=new App(join(dir,'data'));id=(await app.ingest.importSource('codex',journal)).recordingId;server=await startServer({app,port:0});
});
test.afterAll(async()=>{await server?.close();await app?.close();if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});});
async function append(page:Page,editor:Locator,text:string){await editor.focus();await editor.press('Control+End');await page.keyboard.insertText(text);}
for(const [path,eol] of cases)test(`both panes retain ${JSON.stringify(eol)} draft changes, selection and undo for ${path}`,async({page})=>{
 await page.setViewportSize({width:1440,height:960});await page.route('**/v1/working-locations',route=>route.request().method()==='GET'?route.fulfill({json:{version:1,sessions:[]}}):route.continue());
 await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
 await page.getByRole('button',{name:'Open developer workspace',exact:true}).click();const desk=page.getByRole('region',{name:'Developer workspace',exact:true});const approve=desk.getByRole('button',{name:'Approve workspace reading',exact:true});await expect(approve.or(desk.getByRole('tablist'))).toBeVisible();if(await approve.isVisible())await approve.click();
 const find=page.getByRole('textbox',{name:'Find repository files',exact:true}),row=page.locator(`[data-spine-path="${path}"]`);await find.fill(path);await row.click();const first=desk.locator('.desk-pane').nth(0);
 await first.getByRole('button',{name:'Edit file',exact:true}).click();const a=first.getByRole('textbox',{name:`Local draft for ${path}`,exact:true});await expect(a).toContainText('original');await append(page,a,'// first draft');await a.evaluate(el=>el.setAttribute('data-editor-identity','first'));
 const layout=desk.getByLabel('Workspace layout actions',{exact:true});await layout.press('Enter');await desk.getByRole('button',{name:'Split view',exact:true}).press('Enter');const second=desk.locator('.desk-pane').nth(1);await second.focus();const showFiles=second.getByRole('button',{name:'Show files',exact:true});if(await showFiles.isVisible())await showFiles.click();await row.click();const b=second.getByRole('textbox',{name:`Local draft for ${path}`,exact:true});await expect(b).toContainText('first draft');
 await b.focus();await b.press('Control+Home');await b.press('Shift+End');const selection=await page.evaluate(()=>getSelection()?.toString());expect(selection).toContain('original');
 await append(page,a,'\n// newer first-pane work');await expect(b).toContainText('newer first-pane work');await expect(a).toBeFocused();await expect(a).toHaveAttribute('data-editor-identity','first');
 await b.focus();expect(await page.evaluate(()=>getSelection()?.toString())).toBe(selection);
 await append(page,b,'\n// second-pane addition');await expect(a).toContainText('second-pane addition');await expect(a).toContainText('newer first-pane work');
 // A remote synchronization is not an undo step, and local undo retains the other pane's work.
 await b.press('Control+z');await expect(a).not.toContainText('second-pane addition');await expect(b).toContainText('newer first-pane work');await b.press('Control+y');await expect(a).toContainText('second-pane addition');
 await first.getByRole('button',{name:'Compare draft',exact:true}).click();await append(page,b,'\n// while the other editor is hidden');await first.getByRole('button',{name:'Edit draft',exact:true}).click();await expect(a).toContainText('while the other editor is hidden');await expect(a).toHaveAttribute('data-editor-identity','first');
 const download=page.waitForEvent('download');await second.getByLabel(`File actions for ${path}`,{exact:true}).press('Enter');await second.getByRole('button',{name:'Download draft',exact:true}).press('Enter');const saved=await download;
 expect(readFileSync((await saved.path())!,'utf8')).toBe(original(eol)+['// first draft','// newer first-pane work','// second-pane addition','// while the other editor is hidden'].join(eol));
 expect(readFileSync(join(dir,path),'utf8')).toBe(original(eol));await page.screenshot({path:resolve(`.local/workspace-shared-${path}.png`)});
});

test('empty and long current source retain reading controls and a closed-tab draft',async({page})=>{
 await page.setViewportSize({width:1440,height:960});await page.route('**/v1/working-locations',route=>route.request().method()==='GET'?route.fulfill({json:{version:1,sessions:[]}}):route.continue());await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);await page.getByRole('button',{name:'Open developer workspace',exact:true}).click();const desk=page.getByRole('region',{name:'Developer workspace',exact:true}),approve=desk.getByRole('button',{name:'Approve workspace reading',exact:true});await expect(approve.or(desk.getByRole('tablist'))).toBeVisible();if(await approve.isVisible())await approve.click();
 const find=page.getByRole('textbox',{name:'Find repository files',exact:true});await find.fill('empty.ts');await page.locator('[data-spine-path="empty.ts"]').click();const empty=desk.getByRole('region',{name:'Workspace file empty.ts',exact:true});await expect(empty.locator('[data-source-line="1"] .ln-tx')).toHaveText('');await empty.getByRole('button',{name:'Edit file',exact:true}).click();await empty.getByRole('textbox',{name:'Local draft for empty.ts',exact:true}).fill('export const emptyWasEditable = true;');await desk.getByRole('button',{name:'Close workspace tab empty.ts',exact:true}).click();await page.locator('[data-spine-path="empty.ts"]').click();await expect(empty.getByRole('textbox',{name:'Local draft for empty.ts',exact:true})).toContainText('emptyWasEditable');
 await find.fill('long.ts');await page.locator('[data-spine-path="long.ts"]').click();const long=desk.getByRole('region',{name:'Workspace file long.ts',exact:true}),line=long.getByRole('textbox',{name:'Go to line in long.ts',exact:true});await line.fill('1200');await expect(long.getByRole('button',{name:'Go',exact:true})).toBeEnabled();await line.press('Enter');await expect(long.locator('[data-source-line="1200"]')).toContainText('line1200');expect(await long.locator('[data-source-line]').count()).toBeLessThan(150);
 await long.getByRole('searchbox',{name:'Find in long.ts',exact:true}).fill('line1200');await long.getByRole('searchbox',{name:'Find in long.ts',exact:true}).press('Enter');await expect(long.locator('.source-find [role=status]')).toHaveText('1/1');await long.getByRole('button',{name:'Wrap',exact:true}).press('Enter');await expect(long.getByRole('button',{name:'Wrap',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.setViewportSize({width:390,height:844});const minimize=page.getByRole('button',{name:'Minimize files',exact:true});if(await minimize.isVisible())await minimize.click();expect(await desk.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);expect(readFileSync(join(dir,'empty.ts'),'utf8')).toBe('');expect(readFileSync(join(dir,'long.ts'),'utf8')).toContain('line1200');
});
