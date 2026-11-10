import {execFileSync} from 'node:child_process';
import {appendFileSync,cpSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {expect,test,type Page} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';

let dir:string,root:string,app:App,server:RunningServer,id:string,operationId:string,materialsId:string;
const password='synthetic recovery passphrase';
test.beforeAll(async()=>{
  dir=mkdtempSync(join(tmpdir(),'drishya-investigation-'));root=join(dir,'shop');cpSync(resolve('fixtures/synthetic/workspace/shop'),root,{recursive:true});
  for(const args of [['init'],['config','user.name','Synthetic'],['config','user.email','synthetic@example.invalid'],['add','.'],['commit','-m','synthetic baseline']])execFileSync('git',args,{cwd:root,windowsHide:true});
  writeFileSync(join(root,'src/cart/total.ts'),readFileSync(join(root,'src/cart/total.ts'),'utf8')+'\n// Synthetic current worktree change\n');
  const journal=join(dir,'synthetic.jsonl');writeFileSync(journal,readFileSync(resolve('fixtures/synthetic/codex/rollout-checkout-review.jsonl'),'utf8').replaceAll('/home/dev/shop',root.replaceAll('\\','/')));
  app=new App(join(dir,'store'));id=(await app.ingest.importSource('codex',journal)).recordingId;
  const materials=join(dir,'claude-materials.jsonl');writeFileSync(materials,readFileSync(resolve('fixtures/synthetic/claude/checkout-fix.jsonl'),'utf8').replaceAll('/home/dev/shop',root.replaceAll('\\','/')));
  const base={cwd:root,sessionId:'synthetic-materials',timestamp:'2026-10-18T00:00:00Z'};
  for(const [index,[name,input,output]] of ([['Write',{file_path:join(root,'src/new.ts'),content:'export const sample = true;'},'Created synthetic material'],['WebFetch',{url:'https://example.invalid/synthetic',prompt:'Read the synthetic text'},'Synthetic web result'],['OpaqueTool',{query:'unrecognised synthetic input'},'Unknown tool output'],['Bash',{command:'npm test -- synthetic-failure'},'1 failed: SYNTHETIC_FAILURE_ASSERTION'],['Bash',{command:'printf synthetic-shell'},'Synthetic shell output']] as const).entries()) {
    appendFileSync(materials,JSON.stringify({...base,uuid:`material-call-${index}`,type:'assistant',message:{id:`material-${index}`,role:'assistant',content:[{type:'tool_use',id:`material-${index}`,name,input}]}})+'\n'+JSON.stringify({...base,uuid:`material-result-${index}`,type:'user',...(index===0?{toolUseResult:{type:'create',filePath:join(root,'src/new.ts'),originalFile:null,content:'export const sample = true;'}}:{}),message:{role:'user',content:[{type:'tool_result',tool_use_id:`material-${index}`,content:output,is_error:index===3}]}})+'\n');
  }
  materialsId=(await app.ingest.importSource('claude-code',materials)).recordingId;
  operationId=app.projection(id).operations.find(op=>op.detail.kind==='read'&&op.paths.some(path=>path.path==='src/checkout/guard.ts'))!.id;
  server=await startServer({app,port:0,token:'synthetic-investigation'});
});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary directory');rmSync(dir,{recursive:true,force:true});}});
test.beforeEach(async({page})=>{
  await page.route('**/v1/working-locations',route=>route.request().method()==='GET'?route.fulfill({json:{version:1,sessions:[]}}):route.fulfill({json:{saved:true,revisions:{}}}));
});
async function open(page:Page) {await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);await expect(page.locator('.history')).toBeVisible();}
async function command(page:Page,name:string) {await page.keyboard.press('Control+k');const nav=page.getByRole('dialog',{name:'Navigate workspace',exact:true});await nav.getByRole('combobox').fill(name);await nav.getByRole('option').filter({hasText:name}).click();}
// The history list re-mounts a card while it settles, which detaches the element between scroll and click: retry the whole gesture, and never click again once the detail is open (a second click would close it).
async function selectAction(page:Page) {
  const detail=page.getByRole('region',{name:'Operation detail',exact:true});
  await expect(async()=>{
    if(await detail.isVisible())return;
    const op=page.locator(`article[data-op-id="${operationId}"]`);await op.scrollIntoViewIfNeeded({timeout:3000});await op.locator('.op-head .op-kind').click({timeout:3000});
    await expect(detail).toBeVisible({timeout:2000});
  }).toPass({timeout:20_000});
}
async function desk(page:Page) {
  await page.getByRole('button',{name:'Open developer workspace',exact:true}).click();const workspace=page.getByRole('region',{name:'Developer workspace',exact:true});
  const grant=workspace.getByRole('button',{name:'Approve workspace reading',exact:true});await expect(grant.or(workspace.getByRole('tablist'))).toBeVisible();if(await grant.isVisible())await grant.click();
  await page.getByRole('textbox',{name:'Find repository files',exact:true}).fill('src/cart/total.ts');await page.locator('[data-spine-path="src/cart/total.ts"]').click();return workspace;
}

test('investigation finishing: captured action to draft, explicit synthetic submission, later review and exact return',async({page})=>{
  let submitted=0,status={available:true,state:'idle',harness:'codex',tools:[],inventory:'runtime',approvals:[],output:''} as Record<string,unknown>;
  await page.route('**/controller',route=>route.fulfill({json:status}));
  await page.route('**/controller/prompt',async route=>{submitted++;const body=route.request().postDataJSON();expect(body.exclusive).toBe(true);expect(body.prompt).toContain(operationId);const afterSequence=app.projection(id).lastSequence,timestamp='2026-10-18T00:00:00Z';const rows=[{timestamp,type:'response_item',payload:{type:'function_call',name:'exec_command',call_id:'synthetic-correction-check',arguments:JSON.stringify({cmd:'npm test -- SYNTHETIC_CORRECTION_CHECK'})}},{timestamp,type:'response_item',payload:{type:'function_call_output',call_id:'synthetic-correction-check',output:JSON.stringify({output:'1 passed',metadata:{exit_code:0}})}}];appendFileSync(join(dir,'synthetic.jsonl'),rows.map(row=>JSON.stringify(row)).join('\n')+'\n');await app.ingest.sync(id);status={...status,state:'completed',runId:'synthetic-run',afterSequence};return route.fulfill({json:status});});
  await open(page);await selectAction(page);const detail=page.getByRole('region',{name:'Operation detail',exact:true});
  await detail.getByRole('button',{name:'Open current file for correction',exact:true}).click();
  const workspace=page.getByRole('region',{name:'Developer workspace',exact:true});const grant=workspace.getByRole('button',{name:'Approve workspace reading',exact:true});await expect(grant.or(workspace.getByRole('tablist'))).toBeVisible();if(await grant.isVisible())await grant.click();
  const file=workspace.getByRole('region',{name:'Workspace file src/checkout/guard.ts',exact:true});await file.getByRole('button',{name:'Edit file',exact:true}).click();await file.getByRole('textbox',{name:'Local draft for src/checkout/guard.ts',exact:true}).fill('export const corrected = 43;\n');
  await file.getByRole('button',{name:'Review edit with harness',exact:true}).click();expect(submitted).toBe(0);
  const composer=page.getByRole('region',{name:'Harness prompt',exact:true});await expect(composer.getByRole('textbox',{name:'Prompt for selected harness session',exact:true})).toHaveValue(new RegExp(operationId));
  await composer.getByRole('button',{name:'Send prompt',exact:true}).click();await expect(composer.getByRole('group',{name:'Confirm session access',exact:true})).toBeVisible();
  await composer.locator('input[type=checkbox]').check();await composer.getByRole('button',{name:'Confirm and send',exact:true}).click();await expect.poll(()=>submitted).toBe(1);
  await page.getByLabel('More workspace options',{exact:true}).click();await expect(page.locator('.workspace-menu[open]')).toContainText('Request submitted to native controller');await page.getByRole('button',{name:'Review new activity',exact:true}).click();await expect(page.getByRole('dialog',{name:'Changes',exact:true})).toContainText('Since this turn began');await expect(page.getByRole('dialog',{name:'Changes',exact:true})).toContainText('SYNTHETIC_CORRECTION_CHECK');await page.keyboard.press('Escape');
  await page.getByLabel('More workspace options',{exact:true}).click();await page.getByRole('button',{name:'Back to reading',exact:true}).click();await expect(page.locator('article.selected')).toHaveAttribute('data-op-id',operationId);
  expect(readFileSync(join(root,'src/checkout/guard.ts'),'utf8')).not.toContain('corrected');
});

test('investigation finishing: encrypted recovery previews and restores exact drafts after reload without browser persistence',async({page})=>{
  let submissions=0;await page.route('**/controller/prompt',route=>{submissions++;return route.abort();});await open(page);const workspace=await desk(page);
  const file=workspace.getByRole('region',{name:'Workspace file src/cart/total.ts',exact:true});await file.getByRole('button',{name:'Edit file',exact:true}).click();const draft='export const recoveryOnly = 73;\n';await file.getByRole('textbox',{name:'Local draft for src/cart/total.ts',exact:true}).fill(draft);
  await workspace.getByLabel('Workspace layout actions',{exact:true}).click();await workspace.getByRole('button',{name:'Draft recovery',exact:true}).click();let dialog=page.getByRole('dialog',{name:'Draft recovery',exact:true});await dialog.getByLabel('Recovery passphrase',{exact:true}).fill(password);const downloading=page.waitForEvent('download');await dialog.getByRole('button',{name:'Download encrypted snapshot',exact:true}).click();const download=await downloading,raw=readFileSync((await download.path())!,'utf8');expect(raw).not.toContain('recoveryOnly');expect(raw).not.toContain('src/cart/total.ts');
  expect(await page.evaluate(()=>JSON.stringify(localStorage))).not.toContain('recoveryOnly');await page.keyboard.press('Escape');await page.reload();await expect(page.locator('.history')).toBeVisible();await page.getByRole('button',{name:'Open developer workspace',exact:true}).click();await workspace.getByLabel('Workspace layout actions',{exact:true}).click();await workspace.getByRole('button',{name:'Draft recovery',exact:true}).click();dialog=page.getByRole('dialog',{name:'Draft recovery',exact:true});
  await dialog.getByLabel('Choose recovery file',{exact:true}).setInputFiles({name:'drafts.json',mimeType:'application/json',buffer:Buffer.from(raw)});await dialog.getByLabel('Recovery passphrase',{exact:true}).fill(password);await dialog.getByRole('button',{name:'Unlock preview',exact:true}).click();await expect(dialog.getByRole('region',{name:'Recovery preview',exact:true})).toContainText('src/cart/total.ts');await dialog.getByRole('button',{name:'Restore drafts to memory',exact:true}).click();await expect(dialog).toContainText('Disk is unchanged');await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(workspace).toBeVisible();
  await page.getByRole('textbox',{name:'Find repository files',exact:true}).fill('src/cart/total.ts');await page.locator('[data-spine-path="src/cart/total.ts"]').click();await expect(file.getByRole('textbox',{name:'Local draft for src/cart/total.ts',exact:true})).toHaveText(draft);
  expect(readFileSync(join(root,'src/cart/total.ts'),'utf8')).not.toContain('recoveryOnly');expect(submissions).toBe(0);
});

test('empty Notes returns focus to the exact selected step', async ({ page }) => {
  await open(page);
  const notes = page.getByRole('dialog', { name: 'Notes', exact: true });
  const returnToStep = notes.getByRole('button', { name: 'Return to selected step', exact: true });
  await command(page, 'Notes');
  await expect(notes).toContainText('No notes yet. Open a step and add one.');
  await expect(returnToStep).toHaveCount(0);
  await page.keyboard.press('Escape');
  await selectAction(page);
  const card = page.locator(`article[data-op-id="${operationId}"]`);
  await expect(card).toHaveClass(/\bselected\b/);
  await command(page, 'Notes');
  await returnToStep.press('Enter');
  await expect(notes).toHaveCount(0);
  await expect(card).toBeFocused();
  await expect(card).toBeInViewport();
  await expect(card.getByText('Add a note', { exact: true })).toBeVisible();
});

test('investigation finishing: selected saved moments produce an exact portable packet and survive reload',async({page})=>{
  await open(page);await selectAction(page);const detail=page.getByRole('region',{name:'Operation detail',exact:true});await detail.getByText('Add a note',{exact:true}).click();await detail.getByRole('textbox',{name:'Note on this step',exact:true}).fill('Check the boundary before accepting');await detail.getByRole('button',{name:'Save note',exact:true}).click();await expect(detail).toContainText('Saved locally');await page.keyboard.press('Escape');
  await page.reload();await expect(page.locator('.history')).toBeVisible();await command(page,'Prepare review packet');const packet=page.getByRole('dialog',{name:'Review packet',exact:true});
  await packet.getByLabel('Recording samples:',{exact:false}).uncheck();await packet.getByLabel('Open local reviewer questions',{exact:true}).uncheck();await packet.locator('details>summary').click();await packet.locator('details input[type=checkbox]').check();await packet.getByRole('button',{name:'Prepare packet preview',exact:true}).click();const text=await packet.getByRole('textbox',{name:'Review packet preview',exact:true}).inputValue();expect(text).toContain(operationId);expect(text).toContain('Check the boundary');expect(text).not.toContain('## Prompt windows');expect(text).toContain('"recordingId"');
  for (const choice of await packet.locator('.packet-choice').all()) {
    await expect(choice).toHaveCSS('flex-direction', 'row');
    await expect(choice).toHaveCSS('align-items', 'flex-start');
  }
  const downloadPromise=page.waitForEvent('download');await packet.getByRole('button',{name:'Download Markdown',exact:true}).click();const download=await downloadPromise;expect(readFileSync((await download.path())!,'utf8')).toBe(text);
  await page.screenshot({path:resolve('.local/finishing-packet.png')});
});

test('investigation finishing: palettes, keyboard switches, phone overlays and reduced motion retain usable surfaces',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await open(page);
  for(const theme of ['Jet Black','Midnight','Daylight','Orchid','Royal','Emerald','Ember']){
    await page.getByRole('button',{name:'Workspace settings',exact:true}).click();const settings=page.getByRole('dialog',{name:'Workspace settings',exact:true});await settings.getByRole('button',{name:theme,exact:true}).click();await settings.getByRole('tab',{name:'Reading',exact:true}).click();const toggle=settings.getByRole('checkbox',{name:/Relationship motion/});await toggle.focus();const previous=await toggle.isChecked();await page.keyboard.press('Space');expect(await toggle.isChecked()).toBe(!previous);await page.keyboard.press('Space');
    await page.screenshot({path:resolve(`.local/finishing-theme-${theme.replaceAll(' ','-')}.png`)});await page.keyboard.press('Escape');await command(page,'Prepare review packet');const packet=page.getByRole('dialog',{name:'Review packet',exact:true});await packet.getByRole('button',{name:'Prepare packet preview',exact:true}).click();await expect(packet.getByRole('textbox',{name:'Review packet preview',exact:true})).toBeVisible();expect(await packet.evaluate(node=>node.scrollWidth-node.clientWidth)).toBeLessThanOrEqual(1);await page.keyboard.press('Escape');
  }
  await page.emulateMedia({reducedMotion:'reduce'});for(const width of [320,390,900,1440]){await page.setViewportSize({width,height:900});await page.getByRole('button',{name:'Explore repository map',exact:true}).click();await page.getByRole('button',{name:'Show files',exact:true}).click();await expect(page.locator('.folder-explorer')).toBeVisible();await expect(page.getByRole('button',{name:'Explore repository map',exact:true})).toHaveAttribute('aria-pressed','false');const folder=(await page.locator('.folder-explorer').boundingBox())!,composer=(await page.locator('.prompt-composer').boundingBox())!;expect(folder.y+folder.height).toBeLessThanOrEqual(composer.y+1);expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);await page.screenshot({path:resolve(`.local/finishing-surfaces-${width}.png`)});}
  expect(errors).toEqual([]);
});

test('investigation finishing: earlier saved reading notes page without inventing exact action links',async({page})=>{
  for(let n=0;n<70;n++)app.store.addBookmark(id,n,`EARLIER_READING_NOTE_${n}`);
  await open(page);await command(page,'Notes');const dialog=page.getByRole('dialog',{name:'Notes',exact:true});await dialog.getByRole('button',{name:'Earlier reading notes',exact:true}).click();await expect(dialog).toContainText('70 notes');await expect(dialog.locator('.earlier-reading-notes article')).toHaveCount(25);await expect(dialog).toContainText('not exact action identifiers');await dialog.getByRole('button',{name:'Next notes',exact:true}).click();await expect(dialog).toContainText('EARLIER_READING_NOTE_25');await dialog.getByRole('button',{name:'Next notes',exact:true}).click();await expect(dialog.locator('.earlier-reading-notes article')).toHaveCount(20);await expect(dialog.getByRole('button',{name:'Next notes',exact:true})).toBeDisabled();await dialog.getByRole('button',{name:'Open saved replay position',exact:true}).first().click();await expect(dialog).toHaveCount(0);await expect(page.locator('.t-controls')).toBeVisible();
});

test('investigation finishing: every material and core reader remains usable across all palettes',async({page})=>{
  test.setTimeout(180000);await open(page);
  const operations=app.projection(materialsId).operations,representatives=[...new Set(operations.map(op=>op.kind))].map(kind=>operations.find(op=>op.kind===kind)!);
  for(const expected of ['read','write','edit','search','shell','test','web','mcp','spawn','other'])expect(representatives.some(op=>op.kind===expected),expected).toBe(true);
  await page.evaluate(({id,items})=>localStorage.setItem(`drishya-moments-v1:daemon:${id}`,JSON.stringify(items)),{id:materialsId,items:representatives.map(op=>({operationId:op.id,sequence:op.startSequence,title:op.title,note:''}))});
  for(const theme of ['Jet Black','Midnight','Daylight','Orchid','Royal','Emerald','Ember']) {
    await page.goto(`${server.url}/?experience=modern&motion=0#/r/${materialsId}`);await expect(page.locator('.history')).toBeVisible();await page.getByRole('button',{name:'Workspace settings',exact:true}).click();const settings=page.getByRole('dialog',{name:'Workspace settings',exact:true});await settings.getByRole('button',{name:theme,exact:true}).click();await page.keyboard.press('Escape');
    for(const op of representatives){await command(page,'Notes');await page.getByRole('dialog',{name:'Notes',exact:true}).getByRole('button',{name:`${op.title} ↗`,exact:true}).click();const inspector=page.getByRole('region',{name:'Operation detail',exact:true});await expect(inspector).toBeVisible();await expect(inspector).not.toBeEmpty();expect(await inspector.evaluate(node=>node.scrollWidth-node.clientWidth),`${theme}/${op.kind}`).toBeLessThanOrEqual(1);await page.keyboard.press('Escape');}
    await command(page,'Open developer workspace');const workspace=page.getByRole('region',{name:'Developer workspace',exact:true}),grant=workspace.getByRole('button',{name:'Approve workspace reading',exact:true});await expect(grant.or(workspace.getByRole('tablist'))).toBeVisible();if(await grant.isVisible())await grant.click();await page.getByRole('textbox',{name:'Find repository files',exact:true}).fill('src/cart/total.ts');await page.locator('[data-spine-path="src/cart/total.ts"]').click();const file=workspace.getByRole('region',{name:'Workspace file src/cart/total.ts',exact:true});await file.getByRole('button',{name:'Edit file',exact:true}).click();await file.getByRole('textbox',{name:'Local draft for src/cart/total.ts',exact:true}).fill('export const paletteDraft = 71;\n');await file.getByRole('button',{name:'Compare draft',exact:true}).click();await expect(file.getByRole('region',{name:'Draft comparison for src/cart/total.ts',exact:true})).toContainText('paletteDraft');await page.screenshot({path:resolve(`.local/finishing-reading-${theme.replaceAll(' ','-')}.png`)});await file.getByLabel('File actions for src/cart/total.ts',{exact:true}).click();await file.getByRole('button',{name:'Discard draft',exact:true}).click();await workspace.getByRole('button',{name:'Back to agent',exact:true}).click();
    await command(page,'Review current Git changes');const git=page.getByRole('dialog',{name:'Git review',exact:true}),gitGrant=git.getByRole('button',{name:'Approve read-only Git',exact:true});await expect(gitGrant.or(git.locator('.git-review-layout'))).toBeVisible();if(await gitGrant.isVisible())await gitGrant.click();await expect(git.locator('.git-selected-file-header strong')).toHaveAttribute('title','src/cart/total.ts');expect(await git.evaluate(node=>node.scrollWidth-node.clientWidth)).toBeLessThanOrEqual(1);await page.screenshot({path:resolve(`.local/finishing-git-${theme.replaceAll(' ','-')}.png`)});await git.getByRole('button',{name:'Close Git review',exact:true}).click();
    for(const name of ['Find commands','Review findings','Prompt overview']){await command(page,name);const dialog=page.locator('dialog[open]');await expect(dialog).toBeVisible();await expect(dialog.locator('[role=alert]')).toHaveCount(0);expect(await dialog.evaluate(node=>node.scrollWidth-node.clientWidth)).toBeLessThanOrEqual(1);await page.keyboard.press('Escape');}
    await command(page,'Choose a session');await expect(page.locator('.home')).toBeVisible();await page.screenshot({path:resolve(`.local/finishing-home-${theme.replaceAll(' ','-')}.png`)});
  }
});
