// SITE-1 real footage (Yash, 12 Nov): the feature window shows Drishya on a real Drishya session and this repository's
// real Git history, captured as full screens. Frames go to .local/site-footage-real only; a builder reviews each frame
// before any is copied into the site. Nothing is written to the real Drishya home: the store is a temporary folder.
// Every click prints where it landed (as a fraction of the 1440x900 screen) so the site's cursor can click the same place.
//   SITE_FOOTAGE_JOURNAL=<Claude Code journal> node scripts/site-footage-real.ts
import {mkdirSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename,join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium,expect,type Locator,type Page} from '@playwright/test';
import {App} from '../apps/daemon/src/app.ts';
import {startServer} from '../apps/daemon/src/server.ts';

const repo=fileURLToPath(new URL('../',import.meta.url));
const harness=process.env.SITE_FOOTAGE_HARNESS??'claude-code';
let journal=process.env.SITE_FOOTAGE_JOURNAL;
const out=resolve(repo,'.local/site-footage-real',`${process.env.SITE_FOOTAGE_RECORDING??'selected'}-${Date.now()}`);mkdirSync(out,{recursive:true});
const reuse=process.env.SITE_FOOTAGE_REUSE==='1';
const dir=reuse?resolve(repo,'.local/site-2/capture-home'):mkdtempSync(join(tmpdir(),'drishya-site-real-'));mkdirSync(dir,{recursive:true});
const app=new App(join(dir,'store'));
if(!journal){
  const {recordingIdFor}=await import('../packages/capture-core/src/index.ts');
  const prefix=process.env.SITE_FOOTAGE_RECORDING;
  if(!prefix||prefix.length<12)throw Error('Set SITE_FOOTAGE_JOURNAL or a recording prefix of at least 12 characters.');
  journal=(await app.ingest.discover(harness)).find(source=>recordingIdFor(harness,source.path).startsWith(prefix))?.path;
}
if(!journal)throw Error('Recording not found.');
const id=(await app.ingest.importSource(harness,journal)).recordingId;
console.log(JSON.stringify({recording:id.slice(0,12),segmentOnly:false,operations:app.projection(id).operations.length}));
const server=await startServer({app,port:0,token:'site-footage-real'});
const browser=await chromium.launch({channel:process.env.DRISHYA_BROWSER_CHANNEL??'msedge'});
const W=1440,H=900;
const page:Page=await (await browser.newContext({viewport:{width:W,height:H},deviceScaleFactor:2,colorScheme:'dark'})).newPage();
await page.route('**/v1/working-locations',r=>r.request().method()==='GET'?r.fulfill({json:{version:1,sessions:[]}}):r.fulfill({json:{saved:true,revisions:{}}}));
let complete=false;
const shots:string[]=[],clicks:Record<string,[number,number]>={};
const failures:string[]=[];
let stageName='opening';
page.on('pageerror',()=>failures.push('Page runtime error'));
async function settled(){
  await page.waitForFunction(()=>![...document.querySelectorAll<HTMLElement>('.current-file-reader[open] [role=status], .file-workspace[open] [role=status], .developer-workspace [aria-busy=true], .developer-workspace [role=status]')].some(el=>el.getBoundingClientRect().height>0&&(el.getAttribute('aria-busy')==='true'||/^(Reading|Loading|Preparing|Connecting)[ .…]/.test(el.textContent?.trim()??''))),{},{timeout:30000});
  await page.evaluate(()=>document.fonts.ready);
  await page.evaluate(()=>Promise.all([...document.querySelectorAll<HTMLImageElement>('.current-file-reader[open] img, .file-workspace[open] img, .developer-workspace img')].filter(im=>im.getBoundingClientRect().height>0).map(im=>im.decode())));
  await page.evaluate(()=>new Promise<void>(resolve=>{let timer=0;const deadline=window.setTimeout(()=>done(),2000);const done=()=>{clearTimeout(timer);clearTimeout(deadline);observer.disconnect();resolve();};const observer=new MutationObserver(()=>{clearTimeout(timer);timer=window.setTimeout(done,300);});observer.observe(document.body,{childList:true,subtree:true,characterData:true});timer=window.setTimeout(done,300);}));
  if(failures.length)throw Error('Page runtime errors prevent capture.');
}
async function assertMaterial(name:string){
  if(name==='r-explorer')await expect(page.locator('.current-file-code').first()).toBeVisible({timeout:30000});
  if(name.startsWith('r-history'))await expect(page.locator('.file-evidence-columns').first()).toBeVisible({timeout:30000});
  if(name.startsWith('r-changes')&&!name.endsWith('pick'))await expect(page.locator('.compare-file-main').first()).toBeVisible({timeout:30000});
  if(name.endsWith('-pick'))await expect(page.getByRole('listbox').first()).toBeVisible({timeout:30000});
  if(name.startsWith('r-graph'))await expect(page.locator('.atlas-ref').first()).toBeVisible({timeout:30000});
}
const wait=(ms:number)=>page.waitForTimeout(ms);
async function shot(name:string,settle=700){stageName=name;await page.mouse.move(-10,-10);await wait(settle);await settled();await assertMaterial(name);await page.screenshot({path:join(out,`${name}.jpg`),type:'jpeg',quality:90});shots.push(name);console.log('captured',name);}
async function shotHover(name:string){stageName=name;await wait(800);await settled();await assertMaterial(name);await page.screenshot({path:join(out,`${name}.jpg`),type:'jpeg',quality:90});shots.push(name);console.log('captured',name);}
const visible=(l:Locator)=>l.isVisible().catch(()=>false);
// Click a control and record where it is, for the site's cursor.
async function click(name:string,l:Locator){stageName=`click:${name}`;const b=await l.boundingBox();if(b)clicks[name]=[+((b.x+b.width/2)/W).toFixed(5),+((b.y+b.height/2)/H).toFixed(5)];await l.click({timeout:15000});await settled();}
async function approve(){for(const name of ['Approve workspace reading','Approve read-only Git','Approve current-file reading']){const b=page.getByRole('button',{name,exact:true}).first();if(await visible(b)){await b.click();await wait(600);}}const e=page.locator('button.workspace-grant').first();if(await visible(e)){await e.click();await wait(1500);for(const name of ['Approve workspace reading','Approve current-file reading']){const b=page.getByRole('button',{name,exact:true}).first();if(await visible(b)){await b.click();await wait(800);}}}}
async function open(){const auth=await page.request.post(`${server.url}/v1/session`,{headers:{authorization:'Bearer site-footage-real'},data:{}});if(!auth.ok())throw Error('Capture authentication failed.');for(const route of ['workspace/approve','git/approve']){const response=await page.request.post(`${server.url}/v1/recordings/${id}/${route}`,{data:route==='workspace/approve'?{remember:true}:{}});if(!response.ok())throw Error(`Capture access unavailable: ${route}, HTTP ${response.status()}, ${String((await response.json()).error).replace(/[A-Z]:[^\n]+/gi,'[local path]')}`);}
await page.goto(`${server.url}/#/r/${id}`);await page.locator('.history').waitFor();await settled();await wait(600);}
async function goToPrompt(index:number){const ordinal=await page.locator('[data-prompt-ordinal]').nth(index).getAttribute('data-prompt-ordinal');if(ordinal){await page.locator(`[data-prompt-ordinal="${ordinal}"]`).click();await wait(700);await settled();}}
// Wait until a Changes view has finished reading.
async function loaded(){await settled();await page.locator('.compare-note[role=status]').filter({hasText:/Reading/}).first().waitFor({state:'hidden',timeout:30000});await wait(900);}
async function graphLoaded(){await page.getByText('Reading local history',{exact:false}).first().waitFor({state:'hidden',timeout:20000});for(let i=0;i<3;i++){const retry=page.getByRole('button',{name:'Retry history'}).first();if(!(await visible(retry)))break;await retry.click();await wait(3000);}await wait(1200);}

try{
  await open();await approve();await wait(800);await approve();
  const earlyMinimize=page.getByRole('button',{name:'Minimize toolbox',exact:true});if(await visible(earlyMinimize)){await earlyMinimize.click();await wait(400);}
  const ticks=page.locator('[data-prompt-ordinal]');const n=await ticks.count();console.log('prompt ticks:',n);
  if(process.env.SITE_FOOTAGE_PROMPT)await goToPrompt(Math.min(Number(process.env.SITE_FOOTAGE_PROMPT),Math.max(0,n-1)));
  const minimizeTools=page.getByRole('button',{name:'Minimize toolbox',exact:true});
  if(await visible(minimizeTools)){await minimizeTools.click();await wait(500);}
  // 1. Files: the tree beside the agent's work, with files opened from it in the reader beside the history (tabs).
  // Files on disk in the session's own checkout open in the reader beside the history, one tab each. The tree renders
  // only the rows near the view, so each folder is opened in turn and each file scrolled to before it is clicked.
  const find=page.getByPlaceholder(/Find files/i).first();
  const opened:string[]=[];
  const wanted=['controller.ts','server.ts','commands.ts'].map(name=>`apps/daemon/src/${name}`);
  for(const want of wanted){
    stageName='opening current file';await find.fill(basename(want));await wait(400);
    if(await visible(page.locator('.file-workspace'))){await page.keyboard.press('Escape');await wait(500);}
    const row=page.locator(`[data-tree-path="${want}"]`).first();
    if(await visible(row)){await row.scrollIntoViewIfNeeded();if(opened.length<2){const b=await row.boundingBox();if(b)clicks[`explorer-open-${opened.length}`]=[+((b.x+b.width/2)/W).toFixed(5),+((b.y+b.height/2)/H).toFixed(5)];await row.dblclick({timeout:8000});}else await click(`explorer-open-${opened.length}`,row);opened.push(want);await wait(1600);await approve();}
  }
  if(opened.length<2)throw Error('Explorer capture requires two actual open files.');
  console.log('files opened:',opened.length);
  const readerEdge=page.getByRole('separator',{name:'Resize File reader window left',exact:true});
  if(await visible(readerEdge)){for(let step=0;step<6;step++)await readerEdge.press('ArrowLeft');await settled();}
  await find.fill('');await settled();
  await shot('r-explorer');
  // 2. A file's history: the file the agent edited most, then another edit chosen and its change shown.
  stageName='file-history selection';
  const frequencies=new Map<string,number>();
  for(const op of app.projection(id).operations){const path='path' in op.detail?op.detail.path:undefined;if(typeof path==='string')frequencies.set(path,(frequencies.get(path)??0)+1);}
  console.log(JSON.stringify({recordedPaths:frequencies.size,repeatedPaths:[...frequencies.values()].filter(n=>n>1).length}));
  const historyPath=[...frequencies].sort((a,b)=>Number(/^(apps|docs)\//.test(b[0]))-Number(/^(apps|docs)\//.test(a[0]))||b[1]-a[1]).find(([,count])=>count>1)?.[0];
  if(!historyPath)throw Error('No repeated recorded file work in this segment.');
  if(await visible(find)){await find.fill(basename(historyPath));await wait(1000);}
  // Open a genuinely recorded path through the same context action a developer uses.
  async function openHistory(path:string){
    stageName='opening recorded file history';
    const row=page.locator(`[data-tree-path="${path}"]`).first();
    await row.click({button:'right'});
    const item=page.getByRole('menuitem',{name:'View what the agent saw',exact:true});
    await expect(item).toBeEnabled({timeout:30000});await item.click();
    await expect(page.locator('.file-workspace[open]')).toBeVisible({timeout:30000});await settled();
    return await page.locator('.file-op').count();
  }
  {const paths=[historyPath];
   let best='',most=0;for(const path of paths){const n=await openHistory(path);if(n>most){most=n;best=path;}await page.keyboard.press('Escape');await wait(600);}
   console.log('history actions on the chosen file:',most);if(best)await openHistory(best);}
  if(await visible(page.locator('.file-workspace'))){
    const edge=page.getByRole('separator',{name:'Resize File reader window left',exact:true});if(await visible(edge)){await edge.press('End');await settled();}
    await shot('r-history-a');
    const previous=page.getByRole('button',{name:'Previous change',exact:true}).first();
    await expect(previous).toBeEnabled({timeout:30000});
    await click('history-step',previous);await wait(500);await shot('r-history-b');
    await page.keyboard.press('Escape');await wait(600);
  } else throw Error('File history did not open.');
  if(await visible(find)){await find.fill('');await wait(600);}
  // 3. Workspace with two of the edited files open as tabs.
  await page.getByRole('button',{name:'Open developer workspace',exact:true}).click();await approve();await wait(900);
  for(const path of opened.slice(0,2)){const search=page.getByRole('textbox',{name:'Find repository files',exact:true});if(await visible(search)){await search.fill(path);await page.locator(`[data-spine-path$="${path}"]`).first().click();await wait(900);}}
  await shot('r-workspace');await page.getByRole('button',{name:'Back to agent',exact:true}).first().click();await wait(600);
  // 4. Changes: this session; the branch against main, its picker, another branch chosen; a pull request chosen.
  await page.getByRole('button',{name:'Changes',exact:true}).first().click();await approve();await wait(1200);
  const tab=(name:string)=>page.getByRole('button',{name,exact:true}).first();
  if(await visible(tab('This session'))){await click('changes-session',tab('This session'));await loaded();await shot('r-changes-session');}
  if(await visible(tab('Branch'))){
    await click('changes-branch',tab('Branch'));await loaded();await shot('r-changes-branch');
    const head=page.locator('.compare-side').nth(1);
    if(await visible(head)){await click('changes-branch-picker',head);await wait(900);await shotHover('r-changes-branch-pick');
      const option=page.getByRole('listbox').getByRole('button').filter({hasText:/^codex\/site-2|^claude\/site-1|^codex\/embed-2a/}).first();
      if(await visible(option)){await click('changes-branch-choose',option);await loaded();await shot('r-changes-branch-picked');}else{throw Error('Branch picker has no alternate branch.');}}
  }
  if(await visible(tab('Pull request'))){
    await click('changes-pr',tab('Pull request'));await wait(1500);
    const allow=page.getByRole('button',{name:'Allow GitHub lookups'}).first();if(await visible(allow)){await allow.click();await wait(4000);}
    const picker=page.locator('.compare-side').filter({hasText:/Choose a pull request|^#\d+/}).first();
    if(await visible(picker)){await click('changes-pr-picker',picker);await wait(900);await shotHover('r-changes-pr-pick');
      const option=page.getByRole('listbox',{name:'Open pull requests'}).getByRole('button').filter({hasText:/^#498\b/}).first();
      const chosen=await visible(option)?option:page.getByRole('listbox',{name:'Open pull requests'}).getByRole('button').first();
      if(await visible(chosen)){await click('changes-pr-choose',chosen);await loaded();await shot('r-changes-pr');}else throw Error('Pull-request picker has no captured candidate.');}
  }
  await page.keyboard.press('Escape');await wait(600);
  // 5. Git graph: the whole history, then one branch chosen from the graph's own list.
  await page.getByRole('button',{name:'Git',exact:true}).first().click();await approve();await graphLoaded();await shot('r-graph');
  const ref=page.locator('.atlas-ref').filter({hasText:/codex\/site-2/}).first();
  if(await visible(ref)){await click('graph-branch',ref);await graphLoaded();await shot('r-graph-branch');}else throw Error('Git graph has no branch to focus.');
  await page.keyboard.press('Escape');await wait(600);
  // 6. Toolbox: one tool chosen, then the next use of it.
  await open();if(process.env.SITE_FOOTAGE_PROMPT)await goToPrompt(Math.min(Number(process.env.SITE_FOOTAGE_PROMPT),Math.max(0,n-1)));
  const tool=page.getByRole('button',{name:/^Edit\b/}).last();
  if(await visible(tool)){await click('tool',tool);await wait(1500);await shot('r-tool');const next=page.getByRole('button',{name:/^Next/}).first();if(await visible(next)){await click('tool-next',next);await wait(1500);await shot('r-tool-next');}await page.keyboard.press('Escape');await wait(500);}
  // 7. Prompt rail: hover three prompts to choose one that reads well (the Toolbox's focus cleared first).
  {const clear=page.getByText('Clear focus',{exact:false}).first();if(await visible(clear)){await clear.click();await wait(700);}const min=page.getByRole('button',{name:'Minimize toolbox'}).first();if(await visible(min)){await min.click();await wait(900);}}
  if(n){for(const [k,f] of [['a',.12],['b',.3],['c',.45],['d',.6],['e',.75],['f',.9]] as const){const t=ticks.nth(Math.min(n-1,Math.floor(n*f)));const box=await t.boundingBox();if(box){clicks[`prompt-${k}`]=[+((box.x+box.width/2)/W).toFixed(5),+((box.y+box.height/2)/H).toFixed(5)];await page.mouse.move(box.x+box.width/2,box.y+box.height/2,{steps:6});await shotHover(`r-prompt-${k}`);await page.mouse.move(10,10);await wait(500);}}}
  // 8. Composer: a follow-up typed, not sent.
  const ask=page.getByText('Ask your agent',{exact:false}).first();
  if(await visible(ask)){await click('composer',ask);await wait(900);const box=page.getByRole('textbox',{name:'Prompt for selected harness session'}).first();if(await visible(box))await box.fill('Add a browser spec for the hover cards and run it at 600 and 1440.');await wait(500);await shot('r-composer',200);}
  const required=['r-explorer','r-history-a','r-history-b','r-workspace','r-changes-session','r-changes-branch','r-changes-branch-pick','r-changes-branch-picked','r-changes-pr-pick','r-changes-pr','r-graph','r-graph-branch','r-tool','r-tool-next','r-prompt-a','r-composer'];
  if(required.some(name=>!shots.includes(name)))throw Error('Required footage is missing; partial captures cannot be published.');
  complete=true;
}catch{
  await page.screenshot({path:join(out,'capture-stopped.png')});
  console.log(JSON.stringify({geometry:await page.locator('.current-file-reader,.current-file-code').evaluateAll(els=>els.map(el=>{const b=el.getBoundingClientRect(),css=getComputedStyle(el);return {width:b.width,height:b.height,top:b.top,display:css.display,visibility:css.visibility,open:el.hasAttribute('open')};}))}));
  console.log(JSON.stringify({comparison:await page.evaluate(()=>({window:document.querySelectorAll('.compare-window').length,consent:document.querySelectorAll('.git-access').length,rows:document.querySelectorAll('.compare-file-main').length,notices:[...document.querySelectorAll('.compare-note')].map(el=>({length:el.textContent?.length,baseline:/baseline|starting point|start commit/i.test(el.textContent??''),empty:/no changes|nothing|no matching/i.test(el.textContent??''),unavailable:/unavailable|not recorded|choose one|not captured/i.test(el.textContent??'')}))}))}));
  console.log(JSON.stringify({surfaces:await page.evaluate(()=>Object.fromEntries(['.current-file-reader','.current-file-code','.file-workspace','.developer-workspace','.current-reader-access','[role=alert]'].map(selector=>[selector,document.querySelectorAll(selector).length])))}));
  failures.push(stageName);process.exitCode=1;console.error(`Capture stopped at ${stageName}; missing material is not publishable.`);
}finally{
  writeFileSync(join(out,'clicks.json'),JSON.stringify(clicks,null,1));
  writeFileSync(join(out,'capture.json'),JSON.stringify({recording:id.slice(0,12),harness,viewport:[W,H],frames:shots,clicks,failures,complete,reviewed:false},null,2));
  await browser.close();await server.close();await app.close();
  if(!reuse){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('Unsafe temporary folder');rmSync(dir,{recursive:true,force:true});}
}
console.log(`${complete?'Complete':'Incomplete'} real footage: ${shots.length} frames; review locally before publishing.`);
console.log(JSON.stringify({recording:id.slice(0,12),frames:shots.length,clicks:Object.keys(clicks).length}));
