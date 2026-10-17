import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {expect,test} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
let dir:string,app:App,server:RunningServer,id:string;
test.beforeAll(async()=>{
  dir=mkdtempSync(join(tmpdir(),'drishya-markdown-reference-'));const journal=join(dir,'reading.jsonl');
  const base={sessionId:'markdown-reference',cwd:dir,timestamp:'2026-10-17T02:00:00Z'};
  const rows=[
    {...base,type:'user',uuid:'prompt',message:{role:'user',content:'Inspect the implementation'}},
    {...base,type:'assistant',uuid:'read',message:{role:'assistant',content:[{type:'tool_use',id:'read1',name:'Read',input:{file_path:join(dir,'src','actual.ts')}}]}},
    {...base,type:'user',uuid:'result',message:{role:'user',content:[{type:'tool_result',tool_use_id:'read1',content:Array.from({length:300},(_,i)=>`${i+1}\tconst captured${i+1} = ${i+1};`).join('\n')}]}},
    {...base,type:'assistant',uuid:'answer',message:{role:'assistant',content:[{type:'text',text:'Inspect `src/actual.ts:250` and compare with `src/actual.ts:400`.'}]}},
  ];
  writeFileSync(journal,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');app=new App(join(dir,'store'));id=(await app.ingest.importSource('claude-code',journal)).recordingId;server=await startServer({app,port:0,token:'synthetic-markdown-reference'});
});
test.afterAll(async()=>{if(server)await server.close();if(app)await app.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary directory');rmSync(dir,{recursive:true,force:true});}});

test('keyboard references open exact stored lines without inventing unavailable source',async({page})=>{
  await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
  const reference=page.getByRole('button',{name:'Open captured work for src/actual.ts at line 250',exact:true});
  await expect(reference).toBeVisible();await reference.focus();await page.keyboard.press('Enter');
  const reader=page.getByRole('dialog',{name:'Work on src/actual.ts',exact:true});await expect(reader).toBeVisible();
  await expect(reader.locator('[data-source-line="250"]')).toHaveAttribute('aria-current','location');
  await expect(reader.locator('[data-source-line="250"]')).toContainText('const captured250 = 250;');
  await page.keyboard.press('Escape');await expect(reader).toHaveCount(0);
  const absent=page.getByRole('button',{name:'Open captured work for src/actual.ts at line 400',exact:true});await absent.focus();await page.keyboard.press('Space');
  await expect(reader).toBeVisible();await expect(reader).toContainText('Referenced line 400 is outside this stored range (1–300).');
  await expect(reader.locator('[data-source-line="400"]')).toHaveCount(0);
});
