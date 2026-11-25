import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {expect,test,type Page} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from './browser-server.ts';
import {openChanges} from './git-navigation.ts';

// GIT-9: Changes carries what Git review had. A reviewed mark and its note belong to the exact patch shown, on every view;
// marks Git review stored still count; a changed patch drops its mark; the handoff packet is redacted and rechecked.
const git=(root:string,...args:string[])=>execFileSync('git',args,{cwd:root,windowsHide:true,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const remove=(dir:string)=>{if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe scratch directory');rmSync(dir,{recursive:true,force:true});};
const SECRET='sk-proj-abcdefghijklmnopqrstuvw0123456789';

let dir:string,root:string,app:App,server:RunningServer,id:string;
test.beforeAll(async()=>{
  dir=mkdtempSync(join(tmpdir(),'drishya-changes-marks-'));root=join(dir,'repo');mkdirSync(root);
  git(root,'init','-b','main');git(root,'config','user.name','Synthetic');git(root,'config','user.email','synthetic@example.invalid');git(root,'config','core.autocrlf','false');
  writeFileSync(join(root,'a.ts'),'export const a = 1;\n');writeFileSync(join(root,'c.ts'),'export const c = 1;\n');git(root,'add','.');git(root,'commit','-m','Base');
  git(root,'switch','-c','topic');writeFileSync(join(root,'a.ts'),'export const a = 2;\n');git(root,'add','.');git(root,'commit','-m','Topic work');
  git(root,'branch','topic2','topic');git(root,'switch','main');
  const journal=join(dir,'session.jsonl');
  writeFileSync(journal,JSON.stringify({type:'user',uuid:'u1',sessionId:'c0ffee00-0000-4000-8000-0000000000c9',cwd:root,gitBranch:'topic',timestamp:'2026-11-11T10:00:00.000Z',message:{role:'user',content:'Synthetic Changes marks'}})+'\n');
  app=new App(join(dir,'store'));id=(await app.ingest.importSource('claude-code',journal)).recordingId;server=await startServer({app,port:0,token:'synthetic-changes-marks'});
});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir)remove(dir);});

async function open(page:Page){
  await page.setViewportSize({width:1440,height:900});await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);await expect(page.locator('.history')).toBeVisible();
}
async function approved(page:Page,view:'Uncommitted'|'Branch'){
  const changes=await openChanges(page,view);
  const approve=changes.getByRole('button',{name:'Approve read-only Git',exact:true});
  await expect(approve.or(changes.locator('.compare-body'))).toBeVisible();if(await approve.isVisible())await approve.click();
  await expect(changes.locator('.compare-body')).toBeVisible();return changes;
}
async function branchTopic2(page:Page){
  const changes=await approved(page,'Branch');
  await changes.getByRole('button',{name:/^Compare side:/}).click();
  await changes.getByRole('textbox',{name:'Find a compare branch or tag'}).fill('topic2');
  await changes.getByRole('option',{name:/^topic2/}).getByRole('button').click();
  await expect(changes.getByRole('complementary',{name:'Changed files'})).toContainText('a.ts');
  return changes;
}

test('a mark and note survive reopening on a branch comparison and a changed patch drops its mark',async({page})=>{
  await open(page);
  let changes=await branchTopic2(page);
  const row=changes.locator('.compare-file').filter({hasText:'a.ts'});
  await row.getByRole('button',{name:/a\.ts/}).click();
  await expect(changes.locator('.compare-patch .git-patch-reader')).toContainText('a = 2');
  await changes.getByRole('checkbox',{name:'Reviewed',exact:true}).check();
  await changes.getByRole('button',{name:'Note',exact:true}).click();
  await changes.getByRole('textbox',{name:'Local review note'}).fill('Checked the constant');
  await expect(row.locator('.compare-mark')).toHaveText('reviewed');
  // Reopening (a reload keeps only what the browser stored): the mark and note are still on this exact patch.
  await page.reload();await expect(page.locator('.history')).toBeVisible();
  changes=await branchTopic2(page);
  await changes.locator('.compare-file').filter({hasText:'a.ts'}).getByRole('button',{name:/a\.ts/}).click();
  await expect(changes.getByRole('checkbox',{name:'Reviewed',exact:true})).toBeChecked();
  await expect(changes.getByRole('textbox',{name:'Local review note'})).toHaveValue('Checked the constant');
  // The handoff: the reviewed patch with the note, read again from the repository, and redacted.
  await changes.getByRole('textbox',{name:'Local review note'}).fill(`Checked the constant, key ${SECRET}`);
  await changes.getByLabel('Changes actions',{exact:true}).click();
  await changes.getByRole('button',{name:'Preview handoff',exact:true}).click();
  const packet=changes.getByRole('textbox',{name:'Handoff preview'});
  await expect(packet).toHaveValue(/^# Local Git changes handoff/);
  await expect(packet).toHaveValue(/Comparing: main ← topic2/);
  await expect(packet).toHaveValue(/## a\.ts\nContent fingerprint: [a-f0-9]{64}\nReview note: Checked the constant/);
  await expect(packet).toHaveValue(/\+export const a = 2;/);
  expect(await packet.inputValue()).not.toContain(SECRET);
  expect(await packet.inputValue()).not.toMatch(/Git review/);
  await changes.getByRole('button',{name:'Close preview',exact:true}).click();
  // The branch moves on with a different change to the same file: the old mark no longer counts.
  git(root,'switch','topic2');writeFileSync(join(root,'a.ts'),'export const a = 3;\n');git(root,'commit','-am','Topic two moves on');git(root,'switch','main');
  await changes.getByRole('button',{name:'Refresh changes',exact:true}).click();
  await expect(changes.locator('.compare-patch .git-patch-reader')).toContainText('a = 3');
  await expect(changes.getByRole('checkbox',{name:'Reviewed',exact:true})).not.toBeChecked();
  await expect(changes.locator('.compare-file').filter({hasText:'a.ts'}).locator('.compare-mark')).toHaveText('re-review');
  await expect(changes.getByText('Previous note · changed patch',{exact:true})).toBeVisible();
  await changes.getByLabel('Changes actions',{exact:true}).click();
  await expect(changes.getByRole('button',{name:'Preview handoff',exact:true})).toBeDisabled();
  await page.keyboard.press('Escape');
});

test('a mark Git review stored still counts on Uncommitted while its fingerprint matches',async({page})=>{
  writeFileSync(join(root,'c.ts'),'export const c = "uncommitted";\n');
  await open(page);
  let changes=await approved(page,'Uncommitted');
  await expect(changes.locator('.compare-patch')).toContainText('uncommitted');
  const response=await page.request.get(`${server.url}/v1/recordings/${id}/git/snapshot?start=0`,{headers:{authorization:`Bearer ${server.token}`}});
  const snapshot=await response.json() as {files:{path:string;fingerprint:string}[]};
  const fingerprint=snapshot.files.find(file=>file.path==='c.ts')!.fingerprint;
  // The key and shape are exactly what Git review wrote: the bare path, a fingerprint, a note and the reviewed flag.
  await page.evaluate(([key,value])=>localStorage.setItem(key!,value!),[`drishya-git-review-v1:${id}`,JSON.stringify({'c.ts':{fingerprint,note:'from Git review',reviewed:true}})]);
  await page.reload();await expect(page.locator('.history')).toBeVisible();
  changes=await approved(page,'Uncommitted');
  await expect(changes.getByRole('checkbox',{name:'Reviewed',exact:true})).toBeChecked();
  await expect(changes.getByRole('textbox',{name:'Local review note'})).toHaveValue('from Git review');
  await expect(changes.locator('.compare-file').filter({hasText:'c.ts'}).locator('.compare-mark')).toHaveText('reviewed');
  writeFileSync(join(root,'c.ts'),'export const c = "changed again";\n');
  await changes.getByRole('button',{name:'Refresh changes',exact:true}).click();
  await expect(changes.locator('.compare-patch')).toContainText('changed again');
  await expect(changes.getByRole('checkbox',{name:'Reviewed',exact:true})).not.toBeChecked();
  git(root,'checkout','--','c.ts');
});
