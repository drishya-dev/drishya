// SITE-1 real footage (Yash, 12 Nov): the feature window shows Drishya on a real Drishya session and this repository's
// real Git history, captured as full screens. Frames go to .local/site-footage-real only; a builder reviews each frame
// before any is copied into the site. Nothing is written to the real Drishya home: the store is a temporary folder.
// Every click prints where it landed (as a fraction of the 1440x900 screen) so the site's cursor can click the same place.
//   SITE_FOOTAGE_JOURNAL=<Claude Code journal> node scripts/site-footage-real.ts
import {mkdirSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium,type Locator,type Page} from '@playwright/test';
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
const W=1440,H=900;
const page:Page=await (await browser.newContext({viewport:{width:W,height:H},deviceScaleFactor:2,colorScheme:'dark'})).newPage();
await page.route('**/v1/working-locations',r=>r.request().method()==='GET'?r.fulfill({json:{version:1,sessions:[]}}):r.fulfill({json:{saved:true,revisions:{}}}));
const shots:string[]=[],clicks:Record<string,[number,number]>={};
const wait=(ms:number)=>page.waitForTimeout(ms);
async function shot(name:string,settle=700){await page.mouse.move(-10,-10).catch(()=>{});await wait(settle);await page.screenshot({path:join(out,`${name}.jpg`),type:'jpeg',quality:90});shots.push(name);console.log('captured',name);}
async function shotHover(name:string){await wait(800);await page.screenshot({path:join(out,`${name}.jpg`),type:'jpeg',quality:90});shots.push(name);console.log('captured',name);}
const visible=(l:Locator)=>l.isVisible().catch(()=>false);
// Click a control and record where it is, for the site's cursor.
async function click(name:string,l:Locator){const b=await l.boundingBox();if(b)clicks[name]=[+((b.x+b.width/2)/W).toFixed(3),+((b.y+b.height/2)/H).toFixed(3)];await l.click({timeout:8000}).catch(()=>console.log('click failed:',name));}
async function approve(){for(const name of ['Approve workspace reading','Approve read-only Git','Approve current-file reading']){const b=page.getByRole('button',{name,exact:true}).first();if(await visible(b)){await b.click();await wait(600);}}const e=page.locator('button.workspace-grant').first();if(await visible(e)){await e.click();await wait(1500);for(const name of ['Approve workspace reading','Approve current-file reading']){const b=page.getByRole('button',{name,exact:true}).first();if(await visible(b)){await b.click();await wait(800);}}}}
async function open(){await page.goto(server.launchUrl);await page.locator('.home').waitFor();await page.goto(`${server.url}/?experience=modern#/r/${id}`);await page.locator('.history').waitFor();await wait(2500);}
async function goToPrompt(index:number){const tag=await page.addStyleTag({content:'.toolbox-rail,.toolbox-rail *{pointer-events:none!important}'});const t=page.locator('.prompt-rail-tick').nth(index);if(await t.count()){await t.click({force:true}).catch(()=>{});await wait(2200);}await tag.evaluate(el=>el.remove());}
// Wait until a Changes view has finished reading.
async function loaded(){await page.locator('.compare-note[role=status]').filter({hasText:/Reading/}).first().waitFor({state:'hidden',timeout:30000}).catch(()=>console.log('changes: still reading'));await wait(900);}
async function graphLoaded(){await page.getByText('Reading local history',{exact:false}).first().waitFor({state:'hidden',timeout:20000}).catch(()=>{});for(let i=0;i<3;i++){const retry=page.getByRole('button',{name:'Retry history'}).first();if(!(await visible(retry)))break;await retry.click();await wait(3000);}await wait(1200);}
// Files the session edited or added, in tree order, read from the tree's own marks.
async function editedFiles(){return page.evaluate(()=>[...document.querySelectorAll<HTMLElement>('[data-tree-path]')].filter(r=>!r.hasAttribute('aria-expanded')&&[...r.querySelectorAll('*')].some(n=>n.childElementCount===0&&/^[EA]$/.test((n.textContent??'').trim()))).map(r=>r.dataset.treePath!));}
const expandTree=()=>page.evaluate(()=>{for(const r of document.querySelectorAll<HTMLElement>('[data-tree-path][aria-expanded="false"]'))r.click();});

try{
  await open();await approve();await wait(800);await approve();
  const ticks=page.locator('.prompt-rail-tick');const n=await ticks.count();console.log('prompt ticks:',n);
  await goToPrompt(Math.min(Number(process.env.SITE_FOOTAGE_PROMPT??1),Math.max(0,n-1)));
  // 1. Files: the tree beside the agent's work, with files opened from it in the reader beside the history (tabs).
  // Files on disk in the session's own checkout open in the reader beside the history, one tab each. The tree renders
  // only the rows near the view, so each folder is opened in turn and each file scrolled to before it is clicked.
  const find=page.getByPlaceholder(/Find files/i).first();
  async function expand(path:string){const row=page.locator(`[data-tree-path="${path}"]`).first();if(await visible(row)){await row.scrollIntoViewIfNeeded();if(await row.getAttribute('aria-expanded')==='false'){await row.click();await wait(2000);}}}
  const opened:string[]=[];
  for(const p of ['apps','apps/daemon','apps/daemon/src'])await expand(p);
  const rendered=await page.evaluate(()=>[...document.querySelectorAll<HTMLElement>('[data-tree-path^="apps/daemon/src/"]')].map(r=>r.dataset.treePath!).filter(x=>x.endsWith('.ts')));
  const wanted=[...['controller.ts','delegation-thread.ts','checkout-grants.ts'].map(n=>`apps/daemon/src/${n}`).filter(x=>rendered.includes(x)),...rendered].filter((x,i,a)=>a.indexOf(x)===i).slice(0,3);
  for(const want of wanted){
    if(await visible(page.locator('dialog.file-workspace'))){await page.keyboard.press('Escape');await wait(500);}
    const row=page.locator(`[data-tree-path="${want}"]`).first();
    if(await visible(row)){await row.scrollIntoViewIfNeeded();if(opened.length<2){const b=await row.boundingBox();if(b)clicks[`explorer-open-${opened.length}`]=[+((b.x+b.width/2)/W).toFixed(3),+((b.y+b.height/2)/H).toFixed(3)];await row.dblclick({timeout:8000}).catch(()=>console.log('dblclick failed'));}else await click(`explorer-open-${opened.length}`,row);opened.push(want);await wait(1600);await approve();}
  }
  console.log('files opened:',opened.length);
  await shot('r-explorer');
  // 2. A file's history: the file the agent edited most, then another edit chosen and its change shown.
  if(await visible(find)){await find.fill('STATUS.md');await wait(1000);}
  // Open each STATUS.md's history, keep the one with the most actions, and reopen it.
  async function openHistory(path:string){const row=page.locator(`[data-tree-path="${path}"]`).first();if(!(await visible(row)))return 0;await row.click();await wait(1500);
    const work=page.getByRole('button',{name:'Agent work on this file'}).first();if(await visible(work)){await work.click();await wait(1500);}
    const text=await page.locator('dialog.file-workspace').first().innerText().catch(()=>'');return (text.match(/\n(Edit|Write|Read)\n/g)??[]).length;}
  {const paths=await page.evaluate(()=>[...document.querySelectorAll<HTMLElement>('[data-tree-path$="STATUS.md"]')].map(r=>r.dataset.treePath!));
   let best='',most=0;for(const path of paths){const n=await openHistory(path);if(n>most){most=n;best=path;}await page.keyboard.press('Escape');await wait(600);}
   console.log('history actions on the chosen file:',most);if(best)await openHistory(best);}
  if(await visible(page.locator('dialog.file-workspace'))){
    await shot('r-history-a');
    const rows=page.locator('dialog.file-workspace').first().getByText('Edit',{exact:true});
    const count=await rows.count();console.log('history edit rows:',count);
    if(count>3){await click('history-step',rows.nth(Math.min(count-1,6)));await wait(1500);await shot('r-history-b');}
    await page.keyboard.press('Escape');await wait(600);
  } else console.log('history: no file history opened');
  if(await visible(find)){await find.fill('');await wait(600);}
  // 3. Workspace with two of the edited files open as tabs.
  await page.getByRole('button',{name:'Open developer workspace',exact:true}).click().catch(()=>{});await approve();await wait(900);
  for(const path of opened.slice(0,2)){const search=page.getByRole('textbox',{name:'Find repository files',exact:true});if(await visible(search)){await search.fill(path);await page.locator(`[data-spine-path$="${path}"]`).first().click().catch(()=>{});await wait(900);}}
  await shot('r-workspace');await page.keyboard.press('Escape');await wait(600);
  // 4. Changes: this session; the branch against main, its picker, another branch chosen; a pull request chosen.
  await page.getByRole('button',{name:'Changes',exact:true}).first().click().catch(()=>{});await approve();await wait(1200);
  const tab=(name:string)=>page.getByRole('button',{name,exact:true}).first();
  if(await visible(tab('This session'))){await click('changes-session',tab('This session'));await loaded();await shot('r-changes-session');}
  if(await visible(tab('Branch'))){
    await click('changes-branch',tab('Branch'));await loaded();await shot('r-changes-branch');
    const head=page.locator('.compare-side').nth(1);
    if(await visible(head)){await click('changes-branch-picker',head);await wait(900);await shotHover('r-changes-branch-pick');
      const option=page.getByRole('listbox').getByRole('button').filter({hasText:/^gemini\/files-17|^gemini\/ui-31|^claude\/site-1/}).first();
      if(await visible(option)){await click('changes-branch-choose',option);await loaded();await shot('r-changes-branch-picked');}else{console.log('branch: no option');await page.keyboard.press('Escape');}}
  }
  if(await visible(tab('Pull request'))){
    await click('changes-pr',tab('Pull request'));await wait(1500);
    const allow=page.getByRole('button',{name:'Allow GitHub lookups'}).first();if(await visible(allow)){await allow.click();await wait(4000);}
    const picker=page.locator('.compare-side').filter({hasText:/Choose a pull request|^#\d+/}).first();
    if(await visible(picker)){await click('changes-pr-picker',picker);await wait(900);await shotHover('r-changes-pr-pick');
      const option=page.getByRole('listbox',{name:'Open pull requests'}).getByRole('button').filter({hasText:/^#421\b/}).first();
      const chosen=await visible(option)?option:page.getByRole('listbox',{name:'Open pull requests'}).getByRole('button').first();
      if(await visible(chosen)){await click('changes-pr-choose',chosen);await loaded();await shot('r-changes-pr');}else console.log('pull request: no options listed');}
  }
  await page.keyboard.press('Escape');await wait(600);
  // 5. Git graph: the whole history, then one branch chosen from the graph's own list.
  await page.getByRole('button',{name:'Git',exact:true}).first().click().catch(()=>{});await approve();await graphLoaded();await shot('r-graph');
  const ref=page.locator('.atlas-ref').filter({hasText:/^\W*claude\/site-1/}).first();
  if(await visible(ref)){await click('graph-branch',ref);await graphLoaded();await shot('r-graph-branch');}else console.log('graph: no branch row');
  await page.keyboard.press('Escape');await wait(600);
  // 6. Toolbox: one tool chosen, then the next use of it.
  await open();await goToPrompt(Math.min(Number(process.env.SITE_FOOTAGE_PROMPT??1),Math.max(0,n-1)));
  const tool=page.getByRole('button',{name:/^Edit\b/}).last();
  if(await visible(tool)){await click('tool',tool);await wait(1500);await shot('r-tool');const next=page.getByRole('button',{name:/^Next/}).first();if(await visible(next)){await click('tool-next',next);await wait(1500);await shot('r-tool-next');}await page.keyboard.press('Escape');await wait(500);}
  // 7. Prompt rail: hover three prompts to choose one that reads well (the Toolbox's focus cleared first).
  {const clear=page.getByText('Clear focus',{exact:false}).first();if(await visible(clear)){await clear.click();await wait(700);}const min=page.getByRole('button',{name:'Minimize toolbox'}).first();if(await visible(min)){await min.click();await wait(900);}}
  if(n){const tag=await page.addStyleTag({content:'.toolbox-rail,.toolbox-rail *{pointer-events:none!important}'});for(const [k,f] of [['a',.12],['b',.3],['c',.45],['d',.6],['e',.75],['f',.9]] as const){const t=ticks.nth(Math.min(n-1,Math.floor(n*f)));const box=await t.boundingBox();if(box){clicks[`prompt-${k}`]=[+((box.x+box.width/2)/W).toFixed(3),+((box.y+box.height/2)/H).toFixed(3)];await page.mouse.move(box.x+box.width/2,box.y+box.height/2,{steps:6});await shotHover(`r-prompt-${k}`);await page.mouse.move(10,10);await wait(500);}}await tag.evaluate(el=>el.remove());}
  // 8. Composer: a follow-up typed, not sent.
  const ask=page.getByText('Ask your agent',{exact:false}).first();
  if(await visible(ask)){await click('composer',ask);await wait(900);const box=page.getByRole('textbox',{name:'Prompt for selected harness session'}).first();if(await visible(box))await box.fill('Add a browser spec for the hover cards and run it at 600 and 1440.');await wait(500);await shot('r-composer',200);}
}finally{
  writeFileSync(join(out,'clicks.json'),JSON.stringify(clicks,null,1));
  await browser.close();await server.close();await app.close();
  if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('Unsafe temporary folder');rmSync(dir,{recursive:true,force:true});
}
console.log(`Real footage: ${shots.length} frames in ${out} (review before publishing).`);
console.log(JSON.stringify(clicks));
