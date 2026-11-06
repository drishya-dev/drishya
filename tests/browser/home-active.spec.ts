import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,sep} from 'node:path';
import {test,expect} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
let dir:string,app:App,server:RunningServer;
test.beforeAll(async()=>{dir=mkdtempSync(join(tmpdir(),'drishya-home-active-'));app=new App(dir);server=await startServer({app,port:0});});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});}});

test('sub-agent threads leave the main list, stay reachable, and scratch folders fold into one group',async({page})=>{
 const now=new Date().toISOString(),source=(path:string,cwd:string,extra:object)=>({path,harness:'codex',adapterId:'codex',cwd,modifiedAt:now,bytes:10,companions:[],...extra});
 const sources=[
  source('C:/x/parent.jsonl','C:/projects/shop',{title:'Fix the cart',sessionId:'parent'}),
  source('C:/x/child.jsonl','C:/projects/shop',{sessionId:'child',parentSessionId:'parent',agentName:'Reviewer'}),
  source('C:/x/orphan.jsonl','C:/projects/shop',{sessionId:'orphan',parentSessionId:'gone',agentName:'Lost'}),
  source('C:/x/a.jsonl','C:/Users/me/AppData/Local/Temp/probe-a',{title:'Probe one'}),
  source('C:/x/b.jsonl','/tmp/probe-b',{title:'Probe two'}),
 ];
 await page.route('**/v1/recordings',route=>route.fulfill({json:{recordings:[]}}));
 await page.route('**/v1/sources',route=>route.fulfill({json:{sources,errors:[]}}));
 await page.goto(server.launchUrl);
 const rows=page.locator('.mh-session'),rail=page.getByRole('complementary',{name:'Workspaces'});
 await expect(rows).toHaveCount(4);await expect(page.locator('.mh-results')).not.toContainText('Sub-agent Reviewer');
 await expect(rows.filter({hasText:'Fix the cart'})).toContainText('1 sub-agent');await expect(rows.filter({hasText:'Sub-agent Lost'})).toHaveCount(1);
 await expect(rail.getByRole('button',{name:/Temporary folders/})).toContainText('2 folders');
 await rail.getByRole('button',{name:/^Sub-agents/}).click();await expect(rows).toHaveCount(1);await expect(rows).toContainText('Sub-agent Reviewer');
 await expect(page.locator('.mh-results h2')).toHaveText('Sub-agents');
});

test('Home rows drop the per-row availability tag, clean titles, and list followed sessions once',async({page})=>{
 const now=new Date().toISOString(),base={harness:'codex',workspaceRoot:'C:/projects/shop',createdAt:now,updatedAt:now,lastSourceTime:now,observationCount:12,pinned:false};
 const recordings=[
  {...base,id:'r-following',title:'Fix the cart total',live:true,health:{state:'following',live:true}},
  {...base,id:'r-boiler',title:'This session is being continued from a previous conversation that ran out of context. Tidy the checkout https://example.com/x',harness:'claude-code',live:false,health:{state:'stopped',live:false}},
 ];
 await page.route('**/v1/recordings',route=>route.fulfill({json:{recordings}}));
 await page.route('**/v1/sources',route=>route.fulfill({json:{sources:[{path:'C:/x/local.jsonl',harness:'codex',cwd:'C:/projects/shop',modifiedAt:now,bytes:10,title:'Local only session'}],errors:[]}}));
 await page.goto(server.launchUrl);
 const active=page.getByRole('region',{name:'Running now'});
 await expect(active).toBeVisible();await expect(active.getByRole('button')).toHaveCount(2);await expect(active).toContainText('Fix the cart total');await expect(active).toContainText('Local only session');
 await expect(page.locator('.mh-home')).not.toContainText('Available locally');
 await expect(page.locator('.mh-session').filter({hasText:'Tidy the checkout'})).toBeVisible();
 await expect(page.locator('.mh-home')).not.toContainText('being continued from a previous conversation');
 await expect(page.locator('.mh-home')).not.toContainText('https://example.com');
 await page.setViewportSize({width:600,height:900});await expect(active).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});

test('Home sessions and journal updates render while storage is pending, preserving independent errors',async({page})=>{
 const now=new Date().toISOString(),recording={id:'held-storage',title:'Held storage session',harness:'codex',workspaceRoot:'C:/projects/held',createdAt:now,updatedAt:now,lastSourceTime:now,observationCount:12,pinned:false,sourceBytes:10,live:false};
 await page.route('**/v1/recordings',route=>route.fulfill({json:{recordings:[recording]}}));
 await page.route('**/v1/sources',route=>route.fulfill({json:{sources:[{path:'C:/journals/held.jsonl',adapterId:'codex',harness:'codex',cwd:recording.workspaceRoot,title:recording.title,modifiedAt:now,bytes:20,importedRecordingId:recording.id,companions:[]}],errors:[{adapterId:'claude-code',code:'permission-denied',message:'Discovery warning fixture'}]}}));
 let release!:()=>void,requested=false,settled=false;const pending=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/v1/storage',async route=>{requested=true;await pending;settled=true;await route.fulfill({status:500,json:{error:'Storage failure fixture'}});});
 try{
  await page.goto(server.launchUrl);
  await expect.poll(()=>requested).toBe(true);
  await expect(page.locator('.mh-session').filter({hasText:recording.title})).toBeVisible();
  await expect(page.locator('.mh-session em')).toHaveText('Journal updated');
  await expect(page.locator('.mh-home')).toContainText('Discovery warning fixture');
  expect(settled).toBe(false);
  release();
  await expect(page.locator('.mh-home')).toContainText('Storage information: Storage failure fixture');
  await expect(page.locator('.mh-home')).toContainText('Discovery warning fixture');
  await expect(page.locator('.mh-session em')).toHaveText('Journal updated');
 }finally{release();}
});
