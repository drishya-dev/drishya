import { openGitDestination } from './git-navigation.ts';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,sep} from 'node:path';
import {test,expect,type Page} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
let dir:string,app:App,server:RunningServer,id:string,tip:string;
test.beforeAll(async()=>{
 dir=mkdtempSync(join(tmpdir(),'drishya-git-type-'));const root=join(dir,'repo');mkdirSync(root);
 const git=(...args:string[])=>execFileSync('git',args,{cwd:root,windowsHide:true,encoding:'utf8'}).trim();
 git('init');git('config','user.name','A developer with a very long name');git('config','user.email','synthetic@example.invalid');
 for(let i=0;i<3;i++){writeFileSync(join(root,'source.ts'),`export const value = ${i};\n`);git('add','.');git('commit','-m',`Change ${i}: preserve source detail and parent relationships`);}
 tip=git('rev-parse','HEAD');git('branch','feature/a-very-long-branch-name-for-source-review');git('tag','v1');git('tag','v2');git('tag','v3');
 const journal=join(dir,'session.jsonl');writeFileSync(journal,JSON.stringify({type:'user',uuid:'u1',sessionId:'git-type-fixture',cwd:root,message:{role:'user',content:'Review these changes'}})+'\n');
 app=new App(join(dir,'store'));id=(await app.ingest.importSource('claude-code',journal)).recordingId;server=await startServer({app,port:0});
});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});}});
async function openGraph(page:Page){
 await page.goto(server.launchUrl);await page.locator('.home').waitFor();await page.goto(`${server.url}/?experience=modern#/r/${id}`);
 await openGitDestination(page, 'Git graph');const atlas=page.getByRole('dialog',{name:'Git graph',exact:true});
 const approve=atlas.getByRole('button',{name:'Approve read-only Git',exact:true});await expect(approve.or(atlas.locator('.atlas-layout'))).toBeVisible();if(await approve.isVisible())await approve.click();
 await expect(atlas.locator('.thread-commit')).toHaveCount(3);
 const rows=atlas.getByRole('button',{name:/Commits ·/});if(await rows.getAttribute('aria-expanded')!=='true')await rows.click();
 await expect(atlas.locator('.commit-row')).toHaveCount(3);return atlas;
}

test('Git graph, reference filters and commit badges meet metadata and control floors',async({page})=>{
 const atlas=await openGraph(page);
 for(const palette of ['jet','paper','midnight','mocha','tokyo','nord','gruvbox']){
  await page.evaluate(p=>document.documentElement.dataset.palette=p,palette);
  await atlas.locator(`[data-row-hash="${tip}"]`).focus();await expect(atlas.locator('.thread-peek')).toBeVisible();
  expect(await atlas.evaluate(root=>[...root.querySelectorAll<HTMLElement>('*')].filter(el=>el.getClientRects().length&&el.checkVisibility()&&[...el.childNodes].some(n=>n.nodeType===3&&n.textContent?.trim())&&parseFloat(getComputedStyle(el).fontSize)<11).map(el=>({text:el.textContent?.slice(0,45),font:getComputedStyle(el).fontSize})))).toEqual([]);
  for(const selector of ['.btn','.atlas-ref strong','.atlas-ref-content input','.atlas-ref-scope button','.thread-caption select']){
   for(const el of await atlas.locator(selector).all())if(await el.isVisible())expect(await el.evaluate(node=>parseFloat(getComputedStyle(node).fontSize)),`${palette} / ${selector}`).toBeGreaterThanOrEqual(12);
  }
 }
});

test('larger Git text keeps refs, rows and commit-file navigation inside desktop and phone bounds',async({page})=>{
 const atlas=await openGraph(page);
 for(const width of [1440,900,390,320]){
  await page.setViewportSize({width,height:844});
  if(width<=820){const refs=atlas.locator('.atlas-references');if(await refs.getAttribute('open')===null)await refs.locator('summary').click();}
  await atlas.getByRole('button',{name:/All \d+/,exact:true}).click();
  await expect(atlas.getByRole('textbox',{name:'Find Git branches and tags'})).toBeInViewport();
  const scope=atlas.getByRole('group',{name:'Reference scope'});await expect(scope).toBeInViewport();
  expect(await atlas.evaluate(el=>el.scrollWidth<=el.clientWidth+1),`${width} dialog`).toBe(true);
  expect(await atlas.locator('.atlas-ref-content').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  if(width<=820)await atlas.locator('.atlas-references>summary').click();
  const row=atlas.locator(`[data-row-hash="${tip}"]`);await row.scrollIntoViewIfNeeded();await row.click();
  await expect(atlas.locator('.atlas-message pre')).toContainText('Change 2');
  await expect(atlas.getByRole('combobox',{name:'Commit comparison parent'})).toBeInViewport();
  await expect(atlas.locator('.atlas-files>button')).toContainText('source.ts');
  expect(await atlas.locator('.atlas-detail-content').evaluate(el=>el.scrollWidth<=el.clientWidth+1),`${width} detail`).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`.local/ui2-git-${width}.png`});
  await atlas.getByRole('button',{name:'Back to Git graph',exact:true}).click();
 }
});
