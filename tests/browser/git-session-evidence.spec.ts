import { openGitDestination } from './git-navigation.ts';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {expect,test} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';

let dir:string,app:App,server:RunningServer,id:string,tip:string;
test.beforeEach(async()=>{
  dir=mkdtempSync(join(tmpdir(),'drishya-session-git-ui-'));const root=join(dir,'repo');mkdirSync(root);
  const t=(n:number)=>`2026-10-28T10:00:0${n}Z`;
  const git=(...args:string[])=>execFileSync('git',args,{cwd:root,windowsHide:true,encoding:'utf8',env:{...process.env,GIT_AUTHOR_DATE:t(2),GIT_COMMITTER_DATE:t(args.includes('Base')?0:2)}}).trim();
  git('init','-b','main');git('config','user.name','Synthetic');git('config','user.email','synthetic@example.invalid');git('config','core.autocrlf','false');
  writeFileSync(join(root,'committed.ts'),'export const committedValue = 1;\n');git('add','.');git('commit','-m','Base');
  writeFileSync(join(root,'committed.ts'),'export const committedValue = 2;\n');git('commit','-m','Commit','--','committed.ts');tip=git('rev-parse','HEAD');
  writeFileSync(join(root,'new.ts'),'export const newValue = true;\n');
  const common={cwd:root,sessionId:'session-git-ui'},rows:unknown[]=[{...common,type:'user',uuid:'prompt',timestamp:t(0),message:{role:'user',content:'Commit the change and create a new file'}}];
  for(const call of [{id:'commit',name:'Bash',input:{command:'git commit -m "Commit" -- committed.ts'},result:'Commit completed',at:1},
    {id:'write',name:'Write',input:{file_path:join(root,'new.ts'),content:'export const newValue = true;\n'},result:'File created successfully',at:4}]){
    rows.push({...common,type:'assistant',uuid:'a-'+call.id,timestamp:t(call.at),message:{role:'assistant',content:[{type:'tool_use',id:call.id,name:call.name,input:call.input}]}});
    rows.push({...common,type:'user',uuid:'r-'+call.id,timestamp:t(call.id==='commit'?3:4),message:{role:'user',content:[{type:'tool_result',tool_use_id:call.id,content:call.result}]},...(call.id==='commit'?{toolUseResult:{stdout:call.result,stderr:'',interrupted:false}}:{})});
  }
  const path=join(dir,'claude.jsonl');writeFileSync(path,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');app=new App(join(dir,'store'));id=(await app.ingest.importSource('claude-code',path)).recordingId;server=await startServer({app,port:0,token:'synthetic-git-session-ui'});
});
test.afterEach(async()=>{await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe test directory');rmSync(dir,{recursive:true,force:true});}});

for(const width of [1440,600])test(`Git evidence opens commands and newly written files at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});await page.goto(server.launchUrl);await page.locator('.home').waitFor();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
  const open=async()=>{
    await openGitDestination(page, 'Git graph');
    const dialog=page.getByRole('dialog',{name:'Git graph',exact:true});
    const approve=dialog.getByRole('button',{name:'Approve read-only Git',exact:true});
    await expect(approve.or(dialog.locator('.atlas-layout'))).toBeVisible();if(await approve.isVisible())await approve.click();
    return dialog;
  };
  let dialog=await open();
  const working=dialog.locator('.atlas-working');await expect(working).toBeVisible();await working.locator('summary').click();
  await expect(working).toContainText('not proof of who last changed');await working.getByRole('button',{name:/new.ts/}).click();
  await expect(page.getByRole('dialog',{name:'Work on new.ts',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');dialog=await open();
  const rows=dialog.getByRole('button',{name:/Commits ·/});await expect(rows).toBeVisible();if(await rows.getAttribute('aria-expanded')!=='true')await rows.click();
  await dialog.locator(`[data-row-hash="${tip}"]`).click();
  const command=dialog.getByRole('button',{name:'Command matches turn 1',exact:true});await expect(command).toBeVisible();await expect(command).toHaveAttribute('title',/not proof of authorship/);
  await command.click();await expect(dialog).toHaveCount(0);await expect(page.getByRole('region',{name:'Operation detail'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
