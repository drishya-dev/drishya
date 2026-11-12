// SITE-1 real footage (Yash, 12 Nov): the feature window shows Drishya on a real Drishya session and this repository's
// real Git history, captured as full screens. Frames go to .local/site-footage-real only; a builder reviews each frame
// before any is copied into the site. Nothing is written to the real Drishya home: the store is a temporary folder.
//   SITE_FOOTAGE_JOURNAL=<Claude Code journal> node scripts/site-footage-real.ts
import {mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium,type Page} from '@playwright/test';
import {App} from '../apps/daemon/src/app.ts';
import {startServer} from '../apps/daemon/src/server.ts';

const repo=fileURLToPath(new URL('../',import.meta.url));
const journal=process.env.SITE_FOOTAGE_JOURNAL;if(!journal)throw Error('Set SITE_FOOTAGE_JOURNAL.');
const out=resolve(repo,'.local/site-footage-real');mkdirSync(out,{recursive:true});
const dir=mkdtempSync(join(tmpdir(),'drishya-site-real-'));
const app=new App(join(dir,'store'));
const id=(await app.ingest.importSource('claude-code',journal)).recordingId;
const server=await startServer({app,port:0,token:'site-footage-real'});
const browser=await chromium.launch({channel:process.env.DRISHYA_BROWSER_CHANNEL??'msedge'});
const page:Page=await (await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:2,colorScheme:'dark'})).newPage();
await page.route('**/v1/working-locations',r=>r.request().method()==='GET'?r.fulfill({json:{version:1,sessions:[]}}):r.fulfill({json:{saved:true,revisions:{}}}));
const shots:string[]=[];
const wait=(ms:number)=>page.waitForTimeout(ms);
async function shot(name:string,settle=700){await page.mouse.move(-10,-10).catch(()=>{});await wait(settle);await page.screenshot({path:join(out,`${name}.jpg`),type:'jpeg',quality:88});shots.push(name);console.log('captured',name);}
async function shotHover(name:string){await wait(800);await page.screenshot({path:join(out,`${name}.jpg`),type:'jpeg',quality:88});shots.push(name);console.log('captured',name);}
const visible=(l:ReturnType<Page['locator']>)=>l.isVisible().catch(()=>false);
async function approve(){for(const name of ['Approve workspace reading','Approve read-only Git','Approve current-file reading']){const b=page.getByRole('button',{name,exact:true}).first();if(await visible(b)){await b.click();await wait(500);}}const e=page.getByText('Enable workspace reading',{exact:true}).first();if(await visible(e)){await e.click();await wait(800);}}
async function open(){await page.goto(server.launchUrl);await page.locator('.home').waitFor();await page.goto(`${server.url}/?experience=modern#/r/${id}`);await page.locator('.history').waitFor();await wait(2500);}
async function goToPrompt(index:number){const tag=await page.addStyleTag({content:'.toolbox-rail,.toolbox-rail *{pointer-events:none!important}'});const t=page.locator('.prompt-rail-tick').nth(index);if(await t.count()){await t.click({force:true}).catch(()=>{});await wait(2200);}await tag.evaluate(el=>el.remove());}
async function scrollHistory(fraction:number){await page.evaluate(f=>{const h=document.querySelector('.history');if(h)h.scrollTop=(h.scrollHeight-h.clientHeight)*f;},fraction);await wait(1200);}
// Files the session edited, in tree order, read from the tree's own marks.
async function editedFiles(){return page.evaluate(()=>[...document.querySelectorAll<HTMLElement>('[data-tree-path]')].filter(r=>!r.hasAttribute('aria-expanded')&&[...r.querySelectorAll('*')].some(n=>n.childElementCount===0&&/^E$/.test((n.textContent??'').trim()))).map(r=>r.dataset.treePath!).slice(0,6));}

try{
  await open();await approve();
  await goToPrompt(4);await shot('r-history');
  // Explorer: expand to the edited files, open one beside the work, then step to an earlier edit, then a second file.
  await page.evaluate(()=>{for(const r of document.querySelectorAll<HTMLElement>('[data-tree-path][aria-expanded="false"]'))r.click();});await wait(900);
  const edited=await editedFiles();console.log('edited files in tree:',edited.length);
  await shot('r-explorer');
  if(edited[0]){
    const row=page.locator(`[data-tree-path="${edited[0]}"]`).first();await row.hover();await shotHover('r-explorer-hover');
    await row.click();await wait(1500);await approve();await shot('r-peek');
    const edit=page.locator('.file-evidence-reading, [aria-label="File history"]').getByText(/^Edit\b/).first();
    if(await visible(edit)){await edit.click();await wait(1200);await shot('r-peek-edit');}
    if(edited[1]){await page.keyboard.press('Escape');await wait(400);const second=page.locator(`[data-tree-path="${edited[1]}"]`).first();if(await visible(second)){await second.click();await wait(1500);await shot('r-peek-2');}}
    await page.keyboard.press('Escape');await wait(500);
  }
  // Workspace with two of the edited files open as tabs.
  await page.getByRole('button',{name:'Open developer workspace',exact:true}).click().catch(()=>{});await approve();await wait(900);
  for(const path of edited.slice(0,2)){const find=page.getByRole('textbox',{name:'Find repository files',exact:true});if(await visible(find)){await find.fill(path);await page.locator(`[data-spine-path="${path}"]`).first().click().catch(()=>{});await wait(900);}}
  await shot('r-workspace');await page.keyboard.press('Escape');await wait(500);
  // Changes: each view of the same repository.
  await page.getByRole('button',{name:'Changes',exact:true}).first().click().catch(()=>{});await approve();await wait(1200);
  for(const [tab,name] of [['This session','r-changes-session'],['Branch','r-changes-branch'],['Pull request','r-changes-pr']] as const){
    const b=page.getByRole('button',{name:tab,exact:true}).first();if(!(await visible(b)))continue;await b.click();await wait(1800);
    if(tab==='Pull request'){const enable=page.getByRole('button',{name:/GitHub|Enable|Allow/i}).first();if(await visible(enable)){await enable.click();await wait(3000);}const picker=page.getByText('Choose a pull request',{exact:false}).first();if(await visible(picker)){await picker.click();await wait(1500);const option=page.getByRole('option').first().or(page.locator('[role=menu] button, [role=listbox] [role=option]').first());if(await visible(option)){await option.click();await wait(4000);}else console.log('pull request: no options listed');}}
    await shot(name,600);
  }
  await page.keyboard.press('Escape');await wait(500);
  // Git graph: the whole history, then one branch chosen.
  await page.getByRole('button',{name:'Git',exact:true}).first().click().catch(()=>{});await approve();
  await page.getByText('Reading local history',{exact:false}).first().waitFor({state:'hidden',timeout:20000}).catch(()=>{});
  for(let i=0;i<3;i++){const retry=page.getByRole('button',{name:'Retry history'}).first();if(!(await visible(retry)))break;await retry.click();await wait(3000);}
  await wait(1200);await shot('r-graph');
  // The branch picker in the graph's own header: read one agent branch instead of all local history.
  const pick=page.getByRole('combobox',{name:'Read local Git branch'}).first();let picked=false;
  if(await visible(pick)){const labels=await pick.locator('option').allTextContents();console.log('graph branches:',labels.length);
    const want=labels.find(l=>/^claude\/site-1/.test(l))??labels.find(l=>/^(gemini|codex|claude)\//.test(l));
    if(want){await pick.selectOption({label:want});picked=true;}}
  if(picked){await page.getByText('Reading local history',{exact:false}).first().waitFor({state:'hidden',timeout:20000}).catch(()=>{});for(let i=0;i<3;i++){const retry=page.getByRole('button',{name:'Retry history'}).first();if(!(await visible(retry)))break;await retry.click();await wait(3000);}await wait(1500);await shot('r-graph-branch');}else console.log('graph: no branch row');
  await page.keyboard.press('Escape');await wait(600);
  // Toolbox: one tool chosen, then the next use of it.
  await open();await goToPrompt(4);
  const tool=page.getByRole('button',{name:/^Edit\b/}).last();
  if(await visible(tool)){await tool.click();await wait(1500);await shot('r-tool');const next=page.getByRole('button',{name:/^Next/}).first();if(await visible(next)){await next.click();await wait(1500);await shot('r-tool-next');}await page.keyboard.press('Escape');await wait(500);}
  // Prompt rail: hover a later prompt.
  const ticks=page.locator('.prompt-rail-tick');const n=await ticks.count();console.log('prompt ticks:',n);
  if(n){await page.addStyleTag({content:'.toolbox-rail,.toolbox-rail *{pointer-events:none!important}'});for(const [k,i] of [['a',2],['b',5],['c',11]] as const){const t=ticks.nth(Math.min(n-1,i));const box=await t.boundingBox();if(box){await page.mouse.move(box.x+box.width/2,box.y+box.height/2,{steps:6});await shotHover(`r-prompt-${k}`);await page.mouse.move(10,10);await wait(500);}}}
  // Composer: a follow-up typed, not sent.
  const ask=page.getByText('Ask your agent',{exact:false}).first();
  if(await visible(ask)){await ask.click();await wait(900);const box=page.getByRole('textbox',{name:'Prompt for selected harness session'}).first();if(await visible(box))await box.fill('Add a browser spec for the new picker and run it at 600 and 1440.');await wait(500);await shot('r-composer',200);}
}finally{
  await browser.close();await server.close();await app.close();
  if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('Unsafe temporary folder');rmSync(dir,{recursive:true,force:true});
}
console.log(`Real footage: ${shots.length} frames in ${out} (review before publishing).`);
