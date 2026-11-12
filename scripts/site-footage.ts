// SITE-1 footage: the website shows the real product, so this script runs the real Drishya on the committed synthetic
// sessions and a throwaway Git repository built from the synthetic workspace, then captures each surface as a still.
// Nothing real is read: the repository, both sessions and the store live in a temporary folder that is removed after.
//   node scripts/site-footage.ts            -> apps/site/public/footage/*.webp|png
import {execFileSync} from 'node:child_process';
import {cpSync,mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium,type Page} from '@playwright/test';
import {App} from '../apps/daemon/src/app.ts';
import {startServer} from '../apps/daemon/src/server.ts';

const repo=fileURLToPath(new URL('../',import.meta.url));
// Real mode (Yash, 12 Nov): SITE_FOOTAGE_JOURNAL=<a Claude Code journal> captures a real session on its own public
// repository instead. Its frames go to .local/site-footage only; a builder reviews each frame before any is published.
const real=process.env.SITE_FOOTAGE_JOURNAL;
const out=real?resolve(repo,'.local/site-footage'):resolve(repo,'apps/site/public/footage');
const only=process.argv.slice(2);
const dir=mkdtempSync(join(tmpdir(),'drishya-site-footage-')),root=join(dir,'shop');
const git=(...args:string[])=>execFileSync('git',args,{cwd:root,windowsHide:true,encoding:'utf8'});
let claude:string,codex:string|undefined;
const app=new App(join(dir,'store'));
if(real){claude=(await app.ingest.importSource('claude-code',real)).recordingId;}else{

// A repository with real history: main before the fix, then the agent's fix on fix/free-orders.
cpSync(resolve(repo,'fixtures/synthetic/workspace/shop'),root,{recursive:true});
const guard=join(root,'src/checkout/guard.ts'),fixed=readFileSync(guard,'utf8');
const bundle=JSON.parse(readFileSync(resolve(repo,'apps/ui/public/demo/bundle.json'),'utf8'));
const read=bundle.artifactText[bundle.projection.operations.find((o:any)=>o.detail.kind==='read'&&o.detail.path==='src/checkout/guard.ts').detail.excerptArtifactId];
writeFileSync(guard,read.endsWith('\n')?read:read+'\n');
git('init','-q','-b','main');git('config','user.name','Synthetic');git('config','user.email','synthetic@example.invalid');
git('add','.');git('commit','-qm','Add the checkout guard');
git('checkout','-qb','fix/free-orders');writeFileSync(guard,fixed);git('add','.');git('commit','-qm','Let fully discounted orders reach checkout');
git('checkout','-q','main');git('checkout','-qb','feature/refunds');writeFileSync(join(root,'src/payments/refund.ts'),readFileSync(join(root,'src/payments/refund.ts'),'utf8')+'\n// Partial refunds keep the original currency.\n');git('add','.');git('commit','-qm','Keep the currency on partial refunds');
git('checkout','-q','fix/free-orders');
const journal=(from:string,name:string)=>{const file=join(dir,name);writeFileSync(file,readFileSync(resolve(repo,from),'utf8').replaceAll('/home/dev/shop',root.replaceAll('\\','/')));return file;};
claude=(await app.ingest.importSource('claude-code',journal('fixtures/synthetic/claude/checkout-fix.jsonl','claude.jsonl'))).recordingId;
codex=(await app.ingest.importSource('codex',journal('fixtures/synthetic/codex/rollout-checkout-review.jsonl','codex.jsonl'))).recordingId;
}
const server=await startServer({app,port:0,token:'site-footage'});
const browser=await chromium.launch({channel:process.env.DRISHYA_BROWSER_CHANNEL??'msedge'});
const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:2,colorScheme:'dark'});
const page=await context.newPage();
await page.route('**/v1/working-locations',route=>route.request().method()==='GET'?route.fulfill({json:{version:1,sessions:[]}}):route.fulfill({json:{saved:true,revisions:{}}}));

mkdirSync(out,{recursive:true});
const shots:string[]=[];
async function shot(name:string,settle=700){
  if(only.length&&!only.includes(name))return;
  await page.mouse.move(-10,-10).catch(()=>{});await page.waitForTimeout(settle);
  await page.screenshot({path:join(out,`${name}.jpg`),type:'jpeg',quality:86});shots.push(name);console.log('captured',name);
}
async function approve(){for(const name of ['Enable workspace reading','Approve workspace reading','Approve read-only Git','Approve current-file reading']){const b=page.getByRole('button',{name,exact:true}).first();if(await b.isVisible().catch(()=>false)){await b.click();await page.waitForTimeout(400);}}}
async function openRecording(id:string){await page.goto(server.launchUrl);await page.locator('.home').waitFor();await page.goto(`${server.url}/?experience=modern#/r/${id}`);await page.locator('.history').waitFor();await page.waitForTimeout(1500);}

try{
  await page.goto(server.launchUrl);await page.locator('.home').waitFor();await page.waitForTimeout(800);await shot('home');
  await openRecording(claude);await shot('history',1500);
  await page.evaluate(()=>{const h=document.querySelector('.history');if(h)h.scrollTop=0;});await page.waitForTimeout(1000);await shot('history-start');
  await approve();await page.waitForTimeout(900);
  // Files: reveal the edited file through the tree's own find box, hover it, then open it to read its history.
  const enable=page.getByText('Enable workspace reading',{exact:true}).first();if(await enable.isVisible().catch(()=>false)){await enable.click();await page.waitForTimeout(900);}
  const findFiles=page.getByPlaceholder('Find files…').or(page.getByPlaceholder('Find files...')).first();
  if(await findFiles.isVisible().catch(()=>false)){await findFiles.fill('guard');await page.waitForTimeout(700);}
  await shot('files');
  const file=page.locator('[data-tree-path="src/checkout/guard.ts"]').first();
  if(await file.isVisible().catch(()=>false)){
    await file.hover();await page.waitForTimeout(900);
    if(!only.length||only.includes('files-hover')){await page.screenshot({path:join(out,'files-hover.jpg'),type:'jpeg',quality:86});shots.push('files-hover');}
    await file.click();await page.waitForTimeout(1400);await approve();await page.waitForTimeout(600);
    const history=page.getByRole('region',{name:'File history'}).first();
    if(!(await history.isVisible().catch(()=>false))){const tab=page.getByRole('button',{name:/history/i}).first();if(await tab.isVisible().catch(()=>false))await tab.click();await page.waitForTimeout(900);}
    await shot('peek',300);
  }else console.log('files: guard.ts row not visible');
  await page.keyboard.press('Escape');await page.waitForTimeout(300);
  await page.evaluate(()=>{const h=document.querySelector('.history');if(h)h.scrollTop=0;});await page.waitForTimeout(900);
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Open developer workspace',exact:true}).click().catch(()=>{});await approve();await page.waitForTimeout(800);
  const find=page.getByRole('textbox',{name:'Find repository files',exact:true});if(await find.isVisible().catch(()=>false)){await find.fill('src/checkout/guard.ts');await page.locator('[data-spine-path="src/checkout/guard.ts"]').first().click().catch(()=>{});}
  await page.waitForTimeout(1200);await shot('workspace');
  await page.keyboard.press('Escape');await page.waitForTimeout(400);
  await page.getByRole('button',{name:'Changes',exact:true}).first().click().catch(()=>{});await approve();await page.waitForTimeout(800);
  await page.getByRole('button',{name:'Branch',exact:true}).first().click().catch(()=>{});await page.waitForTimeout(1500);await shot('changes');
  await page.keyboard.press('Escape');await page.waitForTimeout(400);
  await page.getByRole('button',{name:'Git',exact:true}).first().click().catch(()=>{});await approve();await page.waitForTimeout(1800);await shot('git-graph');
  const branch=page.getByText('feature/refunds',{exact:true}).first();if(await branch.isVisible().catch(()=>false)){await branch.click();await page.waitForTimeout(1500);await shot('graph-branch');}
  await page.keyboard.press('Escape');

  await openRecording(claude);
  const tool=page.getByRole('button',{name:/^Read\b/}).last();
  if(await tool.isVisible().catch(()=>false)){await tool.click();await page.waitForTimeout(1200);await shot('tool-read',300);await page.keyboard.press('Escape');await page.waitForTimeout(400);}else console.log('toolbox: Read row not found');
  const tick=page.locator('.prompt-rail-tick').first();
  if(await tick.isVisible().catch(()=>false)){await tick.hover();await page.waitForTimeout(900);if(!only.length||only.includes('prompt-rail')){await page.screenshot({path:join(out,'prompt-rail.jpg'),type:'jpeg',quality:86});shots.push('prompt-rail');}}else console.log('prompt rail: no tick visible');
  const ask=page.getByText('Ask your agent',{exact:false}).first();
  if(await ask.isVisible().catch(()=>false)){await ask.click();await page.waitForTimeout(900);const box=page.getByRole('textbox',{name:'Prompt for selected harness session'}).first();if(await box.isVisible().catch(()=>false))await box.fill('Also handle charge() for free orders, and add a test for it.');await page.waitForTimeout(500);await shot('composer',200);}
  if(codex){await openRecording(codex);await shot('codex-history',1500);}
}finally{
  await browser.close();await server.close();await app.close();
  if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('Unsafe temporary folder');rmSync(dir,{recursive:true,force:true});
}
console.log(`Footage: ${shots.length} stills in ${out}`);
