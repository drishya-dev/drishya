import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,sep} from 'node:path';
import {test,expect} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
let dir:string,app:App,server:RunningServer,id:string;
test.beforeAll(async()=>{
 dir=mkdtempSync(join(tmpdir(),'drishya-prose-links-'));const root=join(dir,'captured-root').replaceAll('\\','/');
 const common={cwd:root,sessionId:'prose-link-fixture',timestamp:'2026-10-20T10:00:00Z'};
 const rows=[
  {...common,type:'user',uuid:'u1',message:{role:'user',content:'Read the captured source and explain the change'}},
  {...common,type:'assistant',uuid:'a1',message:{role:'assistant',content:[{type:'tool_use',id:'r1',name:'Read',input:{file_path:`${root}/src/source.ts`}}]}},
  {...common,type:'user',uuid:'u2',message:{role:'user',content:[{type:'tool_result',tool_use_id:'r1',content:'1→export const capturedValue = 42;\n2→export const retainedEvidence = true;'}]}},
  {...common,type:'assistant',uuid:'a2',message:{role:'assistant',content:[{type:'text',text:`See **[source](${root.startsWith('/')?'':'/'}${root}/src/source.ts#L2)**, [relative](src/source.ts:1), and \`src/source.ts:2\`. [web](https://example.invalid/src/source.ts) and [outside](${root}-other/secret.txt) stay separate.`}]}},
 ];
 const journal=join(dir,'session.jsonl');writeFileSync(journal,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');
 app=new App(join(dir,'store'));id=(await app.ingest.importSource('claude-code',journal)).recordingId;server=await startServer({app,port:0});
});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});}});

test('local prose links open exact captured source without current-file IO or browser navigation',async({page})=>{
 const diskRequests:string[]=[];page.on('request',request=>{if(/\/workspace\/(?:file|document|approve)/.test(request.url()))diskRequests.push(request.url());});
 await page.goto(server.launchUrl);await page.locator('.home').waitFor();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
 const local=page.locator('.prose button.md-path');await expect(local).toHaveCount(3);
 const url=page.url();
 for(const index of [0,1,2]){
  const link=local.nth(index);await link.focus();await page.keyboard.press('Enter');
  const reader=page.getByRole('dialog',{name:'Work on src/source.ts',exact:true});await expect(reader).toBeVisible();
  await expect(reader).toContainText('src/source.ts');
  await expect(reader).toContainText('capturedValue');
  await expect(reader.getByRole('button',{name:'Enable workspace reading',exact:true})).toBeVisible();
  expect(page.url()).toBe(url);expect(diskRequests).toEqual([]);
  await reader.getByRole('button',{name:'Close Work on src/source.ts',exact:true}).click();await expect(reader).toHaveCount(0);
 }
 for(const title of ['web','outside']){
  const inert=page.locator('.prose span.md-link').filter({hasText:title});await expect(inert).toHaveCount(1);await inert.click();expect(page.url()).toBe(url);
 }
 await page.setViewportSize({width:320,height:568});await local.first().click();
 await expect(page.getByRole('dialog',{name:'Work on src/source.ts',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(diskRequests).toEqual([]);
});
