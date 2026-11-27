import { readUncommitted } from './git-navigation.ts';
import { attachBrowserDiagnostics, installBrowserDiagnostics } from './ci-diagnostics.ts';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join,resolve,sep} from 'node:path';
import {test,expect,type Page} from '@playwright/test';import {expandCard} from './history-gestures.ts';import {App} from '../../apps/daemon/src/app.ts';import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
let dir:string,app:App,server:RunningServer;const ids=new Map<number,string>();
test.beforeAll(async()=>{
 dir=mkdtempSync(join(tmpdir(),'drishya-collections-'));app=new App(join(dir,'store'));
 for(const count of [3,300]){
  const root=join(dir,`repo-${count}`);mkdirSync(root);
  for(let n=0;n<count;n++)writeFileSync(join(root,`collection-${String(n).padStart(3,'0')}.ts`),`export const value${n} = ${n};\n`);
  const material=Array.from({length:count},(_,n)=>`import './collection-${String(n).padStart(3,'0')}.ts';`).join('\n');writeFileSync(join(root,'main.ts'),material);
  const rows:object[]=[],common={cwd:root,sessionId:`collections-${count}`,timestamp:'2026-10-20T10:00:00Z'};
  const add=(row:object)=>rows.push({...common,...row});
  add({type:'user',uuid:'u0',message:{role:'user',content:'Collection railfixture promptmarker0'}});
  add({type:'assistant',uuid:'read',message:{role:'assistant',content:[{type:'tool_use',id:'read-main',name:'Read',input:{file_path:join(root,'main.ts')}}]}});
  add({type:'user',uuid:'read-result',message:{role:'user',content:[{type:'tool_result',tool_use_id:'read-main',content:material}]}});
  for(let n=0;n<count;n++){
   add({type:'assistant',uuid:`call-${n}`,message:{role:'assistant',content:[{type:'tool_use',id:`shell-${n}`,name:'Bash',input:{command:`printf collection-${n}`}}]}});
   add({type:'user',uuid:`result-${n}`,message:{role:'user',content:[{type:'tool_result',tool_use_id:`shell-${n}`,content:n===0?Array.from({length:count},(_,i)=>`Collection output line ${i}`).join('\n'):'ok'}]}});
  }
  for(let n=1;n<count;n++){add({type:'user',uuid:`prompt-${n}`,message:{role:'user',content:`Collection railfixture promptmarker${n}`}});add({type:'assistant',uuid:`reply-${n}`,message:{role:'assistant',content:[{type:'text',text:`Recorded response ${n}`}]}});}
  const journal=join(dir,`session-${count}.jsonl`);writeFileSync(journal,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');ids.set(count,(await app.ingest.importSource('claude-code',journal)).recordingId);
 }
 server=await startServer({app,port:0});
});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary directory');rmSync(dir,{recursive:true,force:true});}});
test.beforeEach(async({page})=>{await installBrowserDiagnostics(page);let first=true;await page.route('**/v1/working-locations',async route=>{if(first&&route.request().method()==='GET'){first=false;await page.request.delete(route.request().url(),{headers:{'content-type':'application/json'}});}await route.continue();});});
test.afterEach(async ({ page }, info) => { await attachBrowserDiagnostics(page, info); });
async function open(page:Page,count:number){await page.goto(server.launchUrl);await page.locator('.home').waitFor();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${ids.get(count)}`);}
async function approve(page:Page){const grant=page.getByRole('button',{name:/^Enable workspace reading/});await expect(grant.or(page.locator('.folder-explorer[data-reading-access=current]'))).toBeVisible();if(await grant.isVisible())await grant.click();await expect(page.locator('.folder-explorer')).toHaveAttribute('data-reading-access','current');}

for(const count of [3,300]){
 test(`${count} files keep newer prompt focus during deferred tree navigation`,async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await open(page,count);await approve(page);
  const tree=page.getByRole('tree',{name:'Workspace files'});
  const lastFile=tree.getByRole('treeitem',{name:'main.ts'});
  await tree.getByRole('treeitem').first().press('End');
  await expect(lastFile).toBeFocused();

  // Delay only the frame requested by the tree's Home handler, so the next control can receive focus first.
  const pendingFocus=await lastFile.evaluateHandle(file=>{
   const requestFrame=window.requestAnimationFrame;
   const callbacks:FrameRequestCallback[]=[];
   window.requestAnimationFrame=callback=>callback.toString().includes('data-tree-index')
    ? callbacks.push(callback)
    : requestFrame.call(window,callback);
   try {
    if(file.dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true,cancelable:true})))throw new Error('Files tree did not handle Home');
   } finally { window.requestAnimationFrame=requestFrame; }
   if(callbacks.length!==1)throw new Error(`Expected one Files focus frame, got ${callbacks.length}`);
   return callbacks[0]!;
  });
  try {
   await expect(tree.getByRole('treeitem').first()).toHaveText('collection-000.ts');
   if(count===300)await expect(lastFile).toHaveCount(0);
   const rail=page.getByRole('navigation',{name:'Prompt positions in history'});
   const lastPrompt=rail.locator(`[data-prompt-ordinal="${count}"]`);
   await rail.press('End');
   await expect(lastPrompt).toBeFocused();
   await pendingFocus.evaluate(callback=>new Promise<void>(resolve=>requestAnimationFrame(time=>{
    callback(time);
    resolve();
   })));
   await expect(lastPrompt).toBeFocused();
  } finally { await pendingFocus.dispose(); }
 });
 test(`${count} output lines use a natural hover or bounded reading with complete stored pages`,async({page})=>{
  await open(page,count);const history=page.locator('.history');await history.focus();await page.keyboard.press('g');await page.keyboard.press('j');
  const card=history.locator('article.op-shell').first();await card.scrollIntoViewIfNeeded();await card.locator('.op-head').hover();await expect(card).toHaveAttribute('data-hover-reading','focused');
  const metrics=await card.evaluate(node=>{
   const box=node.getBoundingClientRect();let bottom=box.top;const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);
   for(let text=walker.nextNode();text;text=walker.nextNode()){
    if(!text.textContent?.trim()||text.parentElement?.closest('.op-info'))continue;
    const range=document.createRange();range.selectNodeContents(text);const clips:DOMRect[]=[];
    for(let el=text.parentElement;el&&el!==node;el=el.parentElement)if(getComputedStyle(el).overflowY!=='visible')clips.push(el.getBoundingClientRect());
    for(const rect of range.getClientRects()){const top=Math.max(rect.top,...clips.map(c=>c.top)),end=Math.min(rect.bottom,box.bottom,...clips.map(c=>c.bottom));if(rect.height&&end>top+1)bottom=Math.max(bottom,end);}
   }
   return {height:box.height,band:box.bottom-bottom};
  });expect(metrics.height).toBeLessThan(900);expect(metrics.band).toBeLessThanOrEqual(48);
  await page.screenshot({path:`.local/ui10-hover-${count}.png`});await page.keyboard.press('Escape');await page.mouse.move(0,0);
  await expandCard(card);await expect(card.locator('.op-expanded')).toContainText('Collection output line 0');
  if(count===300)await card.getByRole('button',{name:'Next lines',exact:true}).press('Enter');
  await expect(card.locator('.op-expanded')).toContainText(`Collection output line ${count-1}`);
 });
 test(`${count} files, prompts, search hits and ledger counts remain navigable`,async({page})=>{
  await open(page,count);await approve(page);const tree=page.getByRole('tree',{name:'Workspace files'});
  await tree.getByRole('treeitem').first().focus();await page.keyboard.press('End');await expect(tree.getByRole('treeitem').filter({hasText:'main.ts'})).toBeFocused();
  if(count===300)expect(await tree.getByRole('treeitem').count()).toBeLessThan(60);
  await page.keyboard.press('Home');await expect(tree.getByRole('treeitem').first()).toContainText('collection-000.ts');
  const rail=page.getByRole('navigation',{name:'Prompt positions in history'});await rail.focus();await page.keyboard.press('End');await expect(rail.locator(`[data-prompt-ordinal="${count}"]`)).toBeFocused();await page.keyboard.press('Home');await expect(rail.locator('[data-prompt-ordinal="1"]')).toBeFocused();
  for(let n=0;n<3;n++){await rail.press('End');await expect(rail.locator(`[data-prompt-ordinal="${count}"]`)).toBeFocused();await rail.press('Home');await expect(rail.locator('[data-prompt-ordinal="1"]')).toBeFocused();}
  if(count===300)expect(await rail.locator('button').count()).toBeLessThan(90);else expect((await rail.boundingBox())!.height).toBeLessThanOrEqual(50);
  const history=page.locator('.history');await history.focus();await page.keyboard.press('g');await expect(history.locator('.turn-ledger').first()).toContainText(`${count} commands`);
  await page.getByRole('button',{name:'Search',exact:true}).click();const search=page.getByRole('dialog',{name:'Search this recording'});await search.getByRole('textbox').fill('Collection');await expect(search.locator('.search-hit').first()).toBeVisible();
  const list=search.locator('.search-results');expect((await list.boundingBox())!.height).toBeLessThan(600);
  await search.getByRole('textbox').fill(`promptmarker${count-1}`);await expect(list).toContainText(`promptmarker${count-1}`);
  await search.getByRole('button',{name:'Close search',exact:true}).click();await page.evaluate(()=>window.dispatchEvent(new Event('drishya-search-library')));
  const library=page.getByRole('dialog',{name:'Search sessions',exact:true});await library.getByText('Filter by workspace, harness or date',{exact:true}).click();await library.getByLabel('Exact workspace path',{exact:true}).fill(join(dir,`repo-${count}`));await library.getByRole('searchbox',{name:'Search all imported sessions'}).fill('railfixture');await expect(library.locator('.library-search-results>button').first()).toBeVisible();
  const seen=new Set<string>();for(let n=0;n<7;n++){for(const text of await library.locator('.library-search-results>button>p').allTextContents()){const match=/promptmarker(\d+)/.exec(text);if(match)seen.add(match[1]!);}const next=library.getByRole('button',{name:'Next results',exact:true});if(await next.isDisabled())break;const previous=await library.locator('.library-search-results>button>p').first().textContent();await next.click();await expect(library.locator('.library-search-results>button>p').first()).not.toHaveText(previous!);}
  expect(seen.size).toBe(count);expect((await library.locator('.library-search-results').boundingBox())!.height).toBeLessThan(600);
  await page.screenshot({path:`.local/ui10-navigation-${count}.png`});
 });
 test(`${count} imports and changed files fit naturally or expose their complete pages`,async({page})=>{
  await open(page,count);await approve(page);await page.getByRole('button',{name:'Open developer workspace',exact:true}).click();
  await page.getByRole('textbox',{name:'Find repository files',exact:true}).fill('main.ts');await page.locator('[data-spine-path]').filter({has:page.getByText('main.ts',{exact:true})}).click();
  const desk=page.getByRole('region',{name:'Developer workspace',exact:true}),reader=desk.getByRole('region',{name:'Workspace file main.ts',exact:true});await expect(reader.locator('.desk-code')).toBeVisible();await reader.getByLabel('File actions for main.ts',{exact:true}).click();
  const imports=reader.locator('.import-context');await imports.locator('summary').click();await expect(imports).toHaveAttribute('data-size',count===3?'fit':'page');await expect(imports.locator('.import-destination')).toHaveCount(Math.min(count,8));
  if(count===300){const next=imports.getByRole('button',{name:'Next',exact:true});for(let n=0;n<37;n++)await next.click();await expect(next).toBeDisabled();await expect(imports.locator('.import-destination').last()).toContainText('collection-299.ts');await expect(imports.locator('.import-destination')).toHaveCount(4);}
  else await expect(imports.getByRole('navigation',{name:'Import connection pages'})).toHaveCount(0);
  const filesTrigger=desk.getByRole('button',{name:'Choose workspace file',exact:true});
  const explorer=page.locator('.folder-explorer');
  const actions=reader.getByLabel('File actions for main.ts',{exact:true});
  const options=reader.locator('.desk-options');
  const menu=options.locator('.desk-options-body');
  const lastAction=imports.getByRole('button',{name:/^Work on/}).last();
  for(const width of [600,1440]){
   await page.setViewportSize({width,height:900});
   if(width===600){
    await expect(filesTrigger).toBeVisible();
    if(await explorer.isVisible())await explorer.getByRole('button',{name:'Minimize files',exact:true}).click();
    await expect(explorer).toBeHidden();
   }else await expect(filesTrigger).toBeHidden();
   if(!await options.evaluate(node=>(node as HTMLDetailsElement).open))await actions.click();
   if(!await imports.evaluate(node=>(node as HTMLDetailsElement).open))await imports.locator('summary').click();
   await expect(async()=>{
    const box=await menu.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x+box!.width).toBeLessThanOrEqual(width+1);
   }).toPass({timeout:5000});
   await lastAction.focus();
   await expect(lastAction).toBeFocused();
   await expect(lastAction).toBeInViewport();
  }
  await page.screenshot({path:`.local/ui10-imports-${count}.png`});await page.keyboard.press('Escape');await desk.getByRole('button',{name:'Back to agent',exact:true}).click();
  // Normalize only current-Git DTOs: this matrix tests presentation, real Git/consent has separate coverage.
  await page.route('**/git',route=>route.fulfill({json:{approved:true,scope:'current-git'}}));
  let available=count;await page.route('**/git/snapshot?*',route=>{const start=Math.min(Math.floor((available-1)/50)*50,Number(new URL(route.request().url()).searchParams.get('start')??0));return route.fulfill({json:{scope:'current-git',head:'a'.repeat(40),branch:'fixture',sampledAt:'2026-10-20T10:00:00Z',fingerprint:`page-${start}`,files:Array.from({length:Math.min(50,available-start)},(_,n)=>({path:`collection-${String(start+n).padStart(3,'0')}.ts`,status:'M',fingerprint:`file-${start+n}`,patch:'@@ -1 +1 @@\n-old\n+new'})),omitted:Math.max(0,available-start-50),limit:50,pageStart:start,totalAllowed:available}});});
  // GIT-9: the working-tree list now lives in Changes, whose file column fills the window and scrolls inside it (no separate height cap).
  const git=await readUncommitted(page),files=git.getByRole('complementary',{name:'Changed files'});await expect(files.locator('.compare-file-main').first()).toBeVisible();
  if(count===300){expect(await files.evaluate(el=>el.scrollHeight>el.clientHeight)).toBe(true);for(let n=0;n<5;n++)await git.getByRole('button',{name:'Next files',exact:true}).click();await expect(files.locator('.compare-file-main').last()).toContainText('collection-299.ts');await files.locator('.compare-file-main').last().focus();await expect(files.locator('.compare-file-main').last()).toBeInViewport();}
  else{await expect(files.locator('.compare-file-main')).toHaveCount(3);expect(await files.evaluate(el=>el.scrollHeight-el.clientHeight)).toBeLessThanOrEqual(1);}
  for(const width of [1440,600]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);await page.evaluate(()=>new Promise<void>(done=>requestAnimationFrame(()=>requestAnimationFrame(()=>done()))));await page.screenshot({path:`.local/ui10-git-${count}-${width}.png`});}
  if(count===300){available=3;await git.getByRole('button',{name:'Refresh changes',exact:true}).click();await expect(files.locator('.compare-file-main')).toHaveCount(3);expect(await files.evaluate(el=>el.scrollHeight-el.clientHeight)).toBeLessThanOrEqual(1);}
 });
}

for (const cancel of ['Escape', 'control focus']) test('pending reading navigation yields to '+cancel+' before expanding a card', async ({page}) => {
 await open(page,3);
 let release!:()=>void,requested!:()=>void;
 const held=new Promise<void>(resolve=>{release=resolve;}),seen=new Promise<void>(resolve=>{requested=resolve;});
 await page.route('**/reading-target?*',async route=>{const response=await route.fetch();requested();await held;await route.fulfill({response});});
 const history=page.locator('.history');
 await history.focus();await page.keyboard.press('g');await seen;
 try {
  if(cancel==='Escape')await page.keyboard.press('Escape');
  const expand=history.locator('article.op-shell').first().locator('button.op-expand');
  await expand.press('Enter');await expect(expand).toHaveAttribute('aria-expanded','true');
  const arrived=page.waitForResponse(response=>response.url().includes('/reading-target?'));
  release();await (await arrived).finished();
  await page.evaluate(()=>new Promise<void>(done=>requestAnimationFrame(()=>requestAnimationFrame(()=>done()))));
  await expect(expand).toHaveAttribute('aria-expanded','true');await expect(expand).toBeFocused();
 } finally { release(); }
});
