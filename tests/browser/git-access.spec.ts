import {openChanges,openGitDestination} from './git-navigation.ts';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {expect,test} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';

let dir:string,root:string,id:string,app:App,server:RunningServer;
const session=async(name:string,uuid:string)=>{
  const journal=join(dir,`${name}.jsonl`);
  writeFileSync(journal,JSON.stringify({type:'user',uuid:`${name}-1`,sessionId:uuid,cwd:root,message:{role:'user',content:'Synthetic Git access acceptance'}})+'\n');
  return (await app.ingest.importSource('claude-code',journal)).recordingId;
};
test.beforeAll(async()=>{
  dir=mkdtempSync(join(tmpdir(),'drishya-git-access-'));root=join(dir,'repo');mkdirSync(root);
  const git=(...args:string[])=>execFileSync('git',args,{cwd:root,windowsHide:true});
  git('init');git('config','user.name','Synthetic');git('config','user.email','fixture@example.invalid');
  writeFileSync(join(root,'source.ts'),'export const value = 1;\n');git('add','.');git('commit','-m','fixture');
  writeFileSync(join(root,'source.ts'),'export const value = 2;\n');
  app=new App(join(dir,'store'));id=await session('session','77777777-7777-4777-8777-777777777771');
  server=await startServer({app,port:0});
});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});}});

const open=async(page:import('@playwright/test').Page,recording:string)=>{
  await page.goto(`${server.url}/?experience=modern#token=${server.token}`);
  await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern#/r/${recording}`);
};
const grant=(scope:import('@playwright/test').Locator)=>scope.getByRole('button',{name:'Approve read-only Git',exact:true});

/** Changes is a window with its own way back; Git graph is a dialog. Both ask for the one Git approval. */
const reader=(page:import('@playwright/test').Page,destination:'Changes'|'Git graph')=>destination==='Changes'?page.getByRole('region',{name:'Changes',exact:true}):page.getByRole('dialog',{name:'Git graph',exact:true});
const show=async(page:import('@playwright/test').Page,destination:'Changes'|'Git graph')=>{if(destination==='Changes')await openChanges(page,'Uncommitted');else await openGitDestination(page);};
const leave=async(page:import('@playwright/test').Page,destination:'Changes'|'Git graph')=>{
  if(destination==='Changes')await reader(page,destination).getByRole('button',{name:'Back to agent',exact:true}).click();
  else await reader(page,destination).getByRole('button',{name:'Close Git graph',exact:true}).click();
};

for(const [first,second] of [['Changes','Git graph'],['Git graph','Changes']] as const){
  test(`one approval in ${first} opens ${second} and the workspace without asking again`,async({page})=>{
    const recording=await session(first.replace(' ','-'),first==='Changes'?'77777777-7777-4777-8777-777777777772':'77777777-7777-4777-8777-777777777773');
    await page.request.get(`${server.url}/v1/recordings/${recording}/git`,{headers:{authorization:`Bearer ${server.token}`}});
    await open(page,recording);
    await show(page,first);
    const dialog=reader(page,first);
    await expect(grant(dialog)).toBeVisible();
    await expect(dialog.locator('.git-access')).toContainText('Nothing is written to the repository');
    await expect(dialog.locator('.git-access')).toContainText('deleted files and other branches');
    await expect(dialog.locator('.git-access')).toContainText('read the files in this workspace');
    await expect(dialog.getByRole('button',{name:/Approve/})).toHaveCount(1);
    await grant(dialog).click();
    await expect(grant(dialog)).toHaveCount(0);
    // The approval button changes its name while the shared grant is still pending.
    await expect(first==='Changes'?dialog.locator('.compare-body'):dialog.locator('.atlas-layout')).toBeVisible();
    await leave(page,first);
    await show(page,second);
    const next=reader(page,second);
    await expect(next).toBeVisible();
    await expect(next.locator('.git-access')).toHaveCount(0);
    await expect(second==='Changes'?next.locator('.compare-patch'):next.locator('.atlas-layout')).toBeVisible();
  });
}

test('a held status read shows no approval to click',async({page})=>{
  let release=()=>{};const held=new Promise<void>(done=>{release=done;});
  await page.route(`**/v1/recordings/*/git`,async route=>{await held;await route.continue();});
  await open(page,id);
  for(const destination of ['Changes','Git graph'] as const){
    await show(page,destination);
    const dialog=reader(page,destination);
    await expect(dialog.getByText('Checking Git access…')).toBeVisible();
    await expect(grant(dialog)).toHaveCount(0);
    await leave(page,destination);
  }
  release();
});
