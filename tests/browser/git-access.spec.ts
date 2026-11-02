import {openGitDestination} from './git-navigation.ts';
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

for(const [first,firstTitle,second,secondTitle] of [['Git review','Git review','Git graph','Git history'],['Git graph','Git history','Git review','Git review']] as const){
  test(`one approval in ${firstTitle} opens ${secondTitle} and the workspace without asking again`,async({page})=>{
    const recording=await session(first.replace(' ','-'),first==='Git review'?'77777777-7777-4777-8777-777777777772':'77777777-7777-4777-8777-777777777773');
    await page.request.get(`${server.url}/v1/recordings/${recording}/git`,{headers:{authorization:`Bearer ${server.token}`}});
    await open(page,recording);
    await openGitDestination(page,first);
    const dialog=page.getByRole('dialog',{name:firstTitle,exact:true});
    await expect(grant(dialog)).toBeVisible();
    await expect(dialog.locator('.git-access')).toContainText('Nothing is written to the repository');
    await expect(dialog.locator('.git-access')).toContainText('deleted files and other branches');
    await expect(dialog.locator('.git-access')).toContainText('read the files in this workspace');
    await expect(dialog.getByRole('button',{name:/Approve/})).toHaveCount(1);
    await grant(dialog).click();
    await expect(grant(dialog)).toHaveCount(0);
    await dialog.getByRole('button',{name:`Close ${firstTitle}`,exact:true}).click();
    await openGitDestination(page,second);
    const next=page.getByRole('dialog',{name:secondTitle,exact:true});
    await expect(next).toBeVisible();
    await expect(next.locator('.git-access')).toHaveCount(0);
    await expect(second==='Git review'?next.locator('.git-patch'):next.locator('.atlas-layout')).toBeVisible();
  });
}

test('a held status read shows no approval to click',async({page})=>{
  let release=()=>{};const held=new Promise<void>(done=>{release=done;});
  await page.route(`**/v1/recordings/*/git`,async route=>{await held;await route.continue();});
  await open(page,id);
  for(const [destination,title] of [['Git review','Git review'],['Git graph','Git history']] as const){
    await openGitDestination(page,destination);
    const dialog=page.getByRole('dialog',{name:title,exact:true});
    await expect(dialog.getByText('Checking Git access…')).toBeVisible();
    await expect(grant(dialog)).toHaveCount(0);
    await dialog.getByRole('button',{name:`Close ${title}`,exact:true}).click();
  }
  release();
});
