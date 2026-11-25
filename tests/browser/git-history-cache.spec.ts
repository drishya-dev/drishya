import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {expect,test,type Page} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from './browser-server.ts';
import {openGitDestination} from './git-navigation.ts';

const git=(root:string,...args:string[])=>execFileSync('git',args,{cwd:root,windowsHide:true,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const remove=(dir:string)=>{if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe scratch directory');rmSync(dir,{recursive:true,force:true});};

async function approveAndOpen(page:Page,server:RunningServer,id:string,width:number){
  await page.setViewportSize({width,height:900});
  await page.goto(server.launchUrl);
  await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
  await expect(page.locator('.history')).toBeVisible();
  await openGitDestination(page,'Git graph');
  const dialog=page.getByRole('dialog',{name:'Git graph',exact:true});
  const approve=dialog.getByRole('button',{name:'Approve read-only Git',exact:true});
  await expect(approve.or(dialog.locator('.network-commit').first())).toBeVisible();
  if(await approve.isVisible())await approve.click();
  await expect(dialog.locator('.network-commit').first()).toBeVisible({timeout:20_000});
  return dialog;
}

for(const width of [1440,600])test(`keeps graph cached across close/reopen and updates quietly on git change at ${width}px`,async({page})=>{
  const dir=mkdtempSync(join(tmpdir(),'drishya-git10-ui-'));
  const root=join(dir,'repo');mkdirSync(root);
  git(root,'init','-b','main');git(root,'config','user.name','Synthetic');git(root,'config','user.email','synthetic@example.invalid');git(root,'config','core.autocrlf','false');
  for(let n=1;n<=24;n++){
    writeFileSync(join(root,`file-${n}.ts`),`export const n${n} = ${n};\n`);
    git(root,'add','.');
    git(root,'commit','-m',`Commit ${n}`);
  }
  const fifth=git(root,'rev-parse','HEAD~4');
  git(root,'branch','temp-topic',fifth);
  const journal=join(dir,'synthetic.jsonl');
  writeFileSync(journal,JSON.stringify({type:'user',uuid:'u1',sessionId:`git10-${width}`,cwd:root,message:{role:'user',content:'Inspect git cache'}})+'\n');

  const app=new App(join(dir,'store'));
  let server:RunningServer|undefined;
  try{
    const {recordingId:id}=await app.ingest.importSource('claude-code',journal);
    server=await startServer({app,port:0,token:`git10-${width}`});

    const dialog=await approveAndOpen(page,server,id,width);
    // Select non-tip commit, zoom in and pan away from the right edge.
    const commitLoad=page.waitForResponse(r=>r.url().includes('/git/commit')&&r.url().includes(fifth)&&r.status()===200);
    await dialog.locator(`[data-row-hash="${fifth}"]`).click();
    await commitLoad;
    await expect(dialog.locator('.atlas-detail')).toContainText(fifth.slice(0,12));
    if(width===600)await dialog.getByRole('button',{name:'Back to Git graph',exact:true}).click();

    await dialog.getByRole('button',{name:'Zoom in Git graph',exact:true}).click();
    await expect(dialog.locator('.thread-zoom output')).toHaveText('125%');
    const targetScrollLeft=await dialog.locator('.network-viewport').evaluate(el=>{
      el.scrollLeft=Math.max(12,Math.floor(el.scrollWidth/3));
      return el.scrollLeft;
    });
    expect(targetScrollLeft).toBeGreaterThan(0);

    await dialog.getByRole('button',{name:'Close Git graph',exact:true}).click();
    await expect(dialog).toHaveCount(0);

    // Warm reopen with unchanged generation: 0 /git/history or /git/commit requests, <150ms paint, preserved state.
    let historyCalls=0,commitCalls=0,genCalls=0;
    const onReq=(req:{url:()=>string})=>{
      const url=req.url();
      if(url.includes('/git/history'))historyCalls++;
      if(url.includes('/git/commit'))commitCalls++;
      if(url.includes('/git/generation'))genCalls++;
    };
    page.on('request',onReq);
    const genResponse=page.waitForResponse(r=>r.url().includes('/git/generation')&&r.status()===200);
    await page.evaluate(()=>{
      (window as unknown as {__warmPaintMs?:number}).__warmPaintMs=0;
      const btn=document.querySelector<HTMLButtonElement>('button.git-open[aria-label="Git"]')!;
      const t0=performance.now();
      const poll=()=>{
        if(document.querySelector('.git-atlas .network-commit')){
          requestAnimationFrame(()=>{(window as unknown as {__warmPaintMs?:number}).__warmPaintMs=performance.now()-t0;});
        }else requestAnimationFrame(poll);
      };
      requestAnimationFrame(poll);
      btn.click();
    });
    const warmDialog=page.getByRole('dialog',{name:'Git graph',exact:true});
    await expect(warmDialog.locator('.network-commit').first()).toBeVisible();
    await page.waitForFunction(()=>(window as unknown as {__warmPaintMs?:number}).__warmPaintMs!>0);
    const warmPaintMs=await page.evaluate(()=>(window as unknown as {__warmPaintMs:number}).__warmPaintMs);
    await genResponse;
    await page.waitForTimeout(100);
    page.off('request',onReq);

    expect(warmPaintMs).toBeLessThan(150);
    expect(genCalls).toBe(1);
    expect(historyCalls).toBe(0);
    expect(commitCalls).toBe(0);
    await expect(warmDialog.locator('.thread-zoom output')).toHaveText('125%');
    await expect(warmDialog.locator(`[data-row-hash="${fifth}"]`)).toHaveAttribute('aria-pressed','true');
    const restoredScroll=await warmDialog.locator('.network-viewport').evaluate(el=>el.scrollLeft);
    expect(Math.abs(restoredScroll-targetScrollLeft)).toBeLessThanOrEqual(2);

    // Modal semantics under modeless + scrim: scrim blocks background clicks, aria-hidden protects background, Tab wraps cleanly, Escape closes even from search input.
    await expect(warmDialog).toHaveAttribute('aria-modal','true');
    await expect(page.locator('#root')).toHaveAttribute('aria-hidden','true');
    await expect(page.locator('.atlas-scrim')).toBeVisible();
    await page.keyboard.press('Shift+Tab');
    const inDialog=await page.evaluate(()=>!!document.activeElement?.closest('dialog.git-atlas'));
    expect(inDialog).toBe(true);
    if(width===600)await warmDialog.locator('.atlas-references>summary').click();
    const branchFind=warmDialog.getByRole('textbox',{name:'Find Git branches and tags'});
    await branchFind.focus();
    await page.keyboard.press('Escape');
    await expect(warmDialog).toHaveCount(0);
    await expect(page.locator('#root')).not.toHaveAttribute('aria-hidden','true');
    await expect(page.locator('button.git-open[aria-label="Git"]')).toBeFocused();

    // New commit and branch while closed: reopen paints cache first, then updates quietly without spinner flash.
    writeFileSync(join(root,'file-25.ts'),'export const n25 = 25;\n');
    git(root,'add','.');
    git(root,'commit','-m','Commit 25 live update');
    const tip25=git(root,'rev-parse','HEAD');
    git(root,'branch','fresh-branch',tip25);

    const bgHistory=page.waitForResponse(r=>r.url().includes('/git/history')&&r.status()===200);
    await openGitDestination(page,'Git graph');
    const updatedDialog=page.getByRole('dialog',{name:'Git graph',exact:true});
    // Cached content appears immediately with no "Reading local history..." spinner.
    await expect(updatedDialog.locator('.network-commit').first()).toBeVisible();
    await expect(updatedDialog.getByText('Reading local history…')).toHaveCount(0);
    await bgHistory;
    await expect(updatedDialog.locator(`[data-row-hash="${tip25}"]`)).toBeVisible();
    await expect(updatedDialog.locator(`[data-row-hash="${tip25}"]`)).toContainText('fresh-branch');
    await expect(updatedDialog.locator('.network-label[title*="fresh-branch"]')).toBeVisible();
    // Previously selected commit remains selected after quiet background update.
    await expect(updatedDialog.locator(`[data-row-hash="${fifth}"]`)).toHaveAttribute('aria-pressed','true');

    // Switch to temp-topic branch, close, delete temp-topic externally, reopen -> graceful fallback to All refs.
    const picker=updatedDialog.getByRole('combobox',{name:'Read local Git branch'});
    const tempId=await picker.locator('option').filter({hasText:'temp-topic'}).getAttribute('value');
    expect(!!tempId).toBe(true);
    const branchPage=page.waitForResponse(r=>r.url().includes('/git/history')&&r.status()===200);
    await picker.selectOption(tempId!);
    await branchPage;
    await expect(updatedDialog.locator(`[data-row-hash="${fifth}"]`)).toBeVisible();

    await updatedDialog.getByRole('button',{name:'Close Git graph',exact:true}).click();
    await expect(updatedDialog).toHaveCount(0);
    git(root,'branch','-D','temp-topic');

    const fallbackHistory=page.waitForResponse(r=>r.url().includes('/git/history')&&!r.url().includes(tempId!)&&r.status()===200);
    await openGitDestination(page,'Git graph');
    const recovered=page.getByRole('dialog',{name:'Git graph',exact:true});
    await fallbackHistory;
    await expect(recovered.getByRole('combobox',{name:'Read local Git branch'})).toHaveValue('all');
    await expect(recovered.locator(`[data-row-hash="${tip25}"]`)).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }finally{
    await server?.close();
    await app.close();
    remove(dir);
  }
});
