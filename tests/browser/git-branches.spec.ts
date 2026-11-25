import { openGitDestination } from './git-navigation.ts';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {expect,test,type Page} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from './browser-server.ts';
import type {GitHistoryPage} from '../../apps/daemon/src/git-types.ts';

const git=(root:string,...args:string[])=>execFileSync('git',args,{cwd:root,windowsHide:true,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const remove=(dir:string)=>{if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe scratch directory');rmSync(dir,{recursive:true,force:true});};
async function open(page:Page,server:RunningServer,id:string,width:number){
  await page.setViewportSize({width,height:900});await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
  await openGitDestination(page, 'Git graph');
  const dialog=page.getByRole('dialog',{name:'Git graph',exact:true});
  const approve=dialog.getByRole('button',{name:'Approve read-only Git',exact:true});
  await expect(approve.or(dialog.locator('.atlas-layout'))).toBeVisible();if(await approve.isVisible())await approve.click();
  try{await expect(dialog.getByRole('combobox',{name:'Read local Git branch'})).toBeEnabled({timeout:40_000});}
  catch(error){if(process.env.DRISHYA_GIT_BRANCH_SESSIONS)await page.screenshot({path:resolve(`.local/git5-open-failure-${id.slice(0,12)}-${width}.png`)});throw error;}
  return dialog;
}

test.describe('branch selection fixture',()=>{
  let dir:string,root:string,app:App,server:RunningServer,id:string,tip:string;
  test.beforeAll(async()=>{
    dir=mkdtempSync(join(tmpdir(),'drishya-branches-ui-'));root=join(dir,'repo');mkdirSync(root);
    git(root,'init','-b','main');git(root,'config','user.name','Synthetic');git(root,'config','user.email','synthetic@example.invalid');git(root,'config','core.autocrlf','false');
    writeFileSync(join(root,'base.ts'),'export const base = true;\n');git(root,'add','.');git(root,'commit','-m','Base');
    git(root,'switch','-c','topic');writeFileSync(join(root,'topic.ts'),'export const topic = true;\n');git(root,'add','.');git(root,'commit','-m','Topic changes');git(root,'commit','--allow-empty','-m','Topic tip');tip=git(root,'rev-parse','HEAD');
    git(root,'switch','main');git(root,'commit','--allow-empty','-m','Main work');
    const common={cwd:root,sessionId:'branches-ui',timestamp:'2026-10-29T10:00:00Z'},journal=join(dir,'synthetic.jsonl');
    writeFileSync(journal,[{...common,type:'user',uuid:'u',message:{role:'user',content:'Review local branch'}},{...common,type:'assistant',uuid:'a',message:{role:'assistant',content:[{type:'tool_use',id:'g',name:'Bash',input:{command:'git log --oneline topic'}}]}},{...common,type:'user',uuid:'r',message:{role:'user',content:[{type:'tool_result',tool_use_id:'g',content:tip}]}}].map(row=>JSON.stringify(row)).join('\n')+'\n');
    app=new App(join(dir,'store'));id=(await app.ingest.importSource('claude-code',journal)).recordingId;server=await startServer({app,port:0,token:'synthetic-branches-ui'});
  });
  test.afterAll(async()=>{await server?.close();await app?.close();if(dir)remove(dir);});
  for(const width of [1440,600])test(`reads topic commits and keeps links at ${width}px`,async({page})=>{
    const before=git(root,'rev-parse','HEAD'),dialog=await open(page,server,id,width),picker=dialog.getByRole('combobox',{name:'Read local Git branch'});
    expect(await picker.locator('option').first().textContent()).toBe('main · checked out');
    if(width===600)await dialog.locator('.atlas-references>summary').click();
    await dialog.getByRole('textbox',{name:'Find Git branches and tags'}).fill('absent-reference');
    await expect(dialog.getByText('No matching references.',{exact:true})).toBeVisible();
    expect(await picker.locator('option').first().textContent()).toBe('main · checked out');
    const topic=await picker.locator('option').filter({hasText:/^topic$/}).getAttribute('value');expect(!!topic).toBe(true);await picker.selectOption(topic!);
    await expect(dialog.getByLabel('Local branch details')).toContainText('Current · main: ahead 2 · behind 1');
    await expect(dialog.getByLabel('Local branch details')).toContainText('Default · main (local convention): ahead 2 · behind 1');
    await expect(dialog.getByLabel('Local branch details')).toContainText('Checked out · main');await expect(dialog.getByLabel('Local branch details')).toContainText('No upstream configured');
    await expect(dialog.getByLabel('Local branch details')).toContainText('Last commit');
    await dialog.locator(`[data-row-hash="${git(root,'rev-parse','topic^')}"]`).click();
    await expect(dialog.getByLabel('Commit changed files')).toContainText('topic.ts');
    await expect(dialog.locator('.git-patch-reader')).toContainText('export const topic = true;');
    await dialog.getByRole('button',{name:'Back to Git graph',exact:true}).click();
    const row=dialog.locator(`[data-row-hash="${tip}"]`);await expect(row).toBeVisible();
    // Clicking tip may hit the cached commit detail if auto-selection completed before selecting topic^; wait until detail mounts before closing.
    await row.click();await expect(dialog.locator('.atlas-message pre')).toContainText('Topic tip');
    await expect(dialog.locator('.atlas-detail')).toContainText(tip.slice(0,12));
    const link=dialog.getByRole('button',{name:'Seen in turn 1',exact:true});await expect(link).toBeVisible();await link.click();
    await expect(dialog).toHaveCount(0);await expect(page.getByRole('article',{name:'Run git log --oneline topic',exact:true})).toBeVisible();
    expect(git(root,'rev-parse','HEAD')).toBe(before);expect(git(root,'status','--porcelain')).toBe('');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
});

// Real journals are opt-in local paths, never fixtures. Failures expose booleans/counts, not journal text.
const manifest=process.env.DRISHYA_GIT_BRANCH_SESSIONS;
const sources: {adapterId:'codex'|'claude-code';path:string;case?:'unrelated'|'shallow'|'many'}[]=manifest?JSON.parse(readFileSync(manifest,'utf8')):[];
for(const [index,source] of sources.entries())for(const width of [1440,600])test(`real local branch acceptance ${source.adapterId} ${index} at ${width}px`,async({page})=>{
  const dir=mkdtempSync(join(tmpdir(),'drishya-real-branches-')),app=new App(join(dir,'store'));let server:RunningServer|undefined;
  try {
    const {recordingId:id}=await app.ingest.importSource(source.adapterId,source.path),recording=app.recording(id),root=recording.workspaceRoot!;
    expect(!!root).toBe(true);const before=git(root,'rev-parse','HEAD');server=await startServer({app,port:0,token:'local-real-branches'});
    const firstPage=page.waitForResponse(response=>response.url().includes('/git/history')&&response.status()===200);
    const dialog=await open(page,server,id,width),initial=await (await firstPage).json() as GitHistoryPage;
    const branches=initial.references.filter(ref=>ref.kind==='branch');expect(branches.length>0).toBe(true);
    if(source.case==='unrelated'){
      const topic=branches.find(ref=>ref.name==='topic')!;expect(!!topic).toBe(true);
      const topicPage=page.waitForResponse(response=>response.url().includes('/git/history')&&response.status()===200);
      await dialog.getByRole('combobox',{name:'Read local Git branch'}).selectOption(topic.id);
      const result=await (await topicPage).json() as GitHistoryPage;
      const [behind,ahead]=git(root,'rev-list','--left-right','--count',`${before}...${topic.tip}`).split(/\s+/).map(Number);
      expect(result.branchComparison?.current?.ahead===ahead&&result.branchComparison.current.behind===behind).toBe(true);
      expect(result.branchComparison?.default?.ahead===ahead&&result.branchComparison.default.behind===behind).toBe(true);
      await expect(dialog.getByLabel('Local branch details')).toContainText('ahead 2 · behind 1');
      await expect(dialog.getByRole('combobox',{name:'Read local Git branch'})).toBeEnabled();
    }
    const branch=source.case==='unrelated'?branches.find(ref=>ref.name==='unrelated'):source.case==='shallow'?branches.find(ref=>ref.name==='other'):branches.find(ref=>!ref.current&&ref.tip!==before)??branches.find(ref=>!ref.current)??branches[0]!;
    expect(!!branch).toBe(true);const selectedPage=page.waitForResponse(response=>response.url().includes('/git/history')&&response.status()===200);
    await dialog.getByRole('combobox',{name:'Read local Git branch'}).selectOption(branch!.id);
    await expect(dialog.getByRole('combobox',{name:'Read local Git branch'})).toBeEnabled();
    const selected=await (await selectedPage).json() as GitHistoryPage;
    expect(selected.commits[0]?.hash===branch!.tip).toBe(true);
    for(const [kind,comparison] of Object.entries(selected.branchComparison??{})){
      if(comparison.state!=='known')continue;
      const base=kind==='current'?before:initial.references.find(ref=>ref.name===comparison.name)?.tip;
      expect(!!base).toBe(true);const [behind,ahead]=git(root,'rev-list','--left-right','--count',`${base}...${branch!.tip}`).split(/\s+/).map(Number);
      expect(comparison.ahead===ahead&&comparison.behind===behind).toBe(true);
    }
    const facts=dialog.getByLabel('Local branch details');
    if(source.case==='unrelated'){expect(selected.branchComparison?.current?.state==='unrelated').toBe(true);await expect(facts).toContainText('no merge-base');await expect(facts).toContainText('No upstream configured');}
    if(source.case==='shallow'){expect(selected.shallow&&selected.branch==='Detached HEAD').toBe(true);expect(selected.branchComparison?.current?.state==='shallow').toBe(true);await expect(facts).toContainText('unavailable in shallow history');await expect(facts).toContainText('Detached HEAD');}
    const rect=await dialog.boundingBox();expect(!!rect&&rect.x>=0&&rect.x+rect.width<=width+1).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:resolve(`.local/git5-real-${index}-${width}.png`)});
    expect(git(root,'rev-parse','HEAD')===before).toBe(true);
    console.log(`${source.adapterId} ${id.slice(0,12)} bytes=${statSync(source.path).size} observations=${recording.observationCount} refs=${initial.referenceTotal} comparisons=${Object.keys(selected.branchComparison??{}).length} width=${width}`);
  }finally{await server?.close();await app.close();remove(dir);}
});
