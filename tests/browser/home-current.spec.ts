import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,sep} from 'node:path';
import {test,expect} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from './browser-server.ts';

let dir:string,app:App,server:RunningServer;
test.beforeAll(async()=>{dir=mkdtempSync(join(tmpdir(),'drishya-home-current-'));app=new App(dir);server=await startServer({app,port:0});});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});}});

const now=new Date().toISOString();
const source=(name:string,cwd:string,extra:object={})=>({path:`C:/x/${name}.jsonl`,harness:'codex',adapterId:'codex',cwd,modifiedAt:now,bytes:1000,companions:[],title:name,...extra});

test('a new journal appears without Refresh',async({page})=>{
 const sources=[source('First session','C:/projects/shop')];
 await page.route('**/v1/recordings',route=>route.fulfill({json:{recordings:[]}}));
 await page.route('**/v1/sources',route=>route.fulfill({json:{sources,errors:[]}}));
 await page.goto(server.launchUrl);
 const rows=page.locator('.mh-session');await expect(rows).toHaveCount(1);
 sources.push(source('Second session','C:/projects/shop'));
 await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
 await expect(rows).toHaveCount(2);await expect(rows.filter({hasText:'Second session'})).toHaveCount(1);
});

test('an import shows progress, leaves the list usable, and the last row chosen is the one opened',async({page})=>{
 const first=source('Long journal','C:/projects/shop'),second=source('Short journal','C:/projects/shop');
 let release=()=>{};const held=new Promise<void>(done=>{release=done;});
 const opened:string[]=[];
 await page.route('**/v1/recordings',route=>route.fulfill({json:{recordings:[]}}));
 await page.route('**/v1/sources',route=>route.fulfill({json:{sources:[first,second],errors:[]}}));
 await page.route('**/v1/imports',route=>route.fulfill({json:{imports:[{path:first.path,bytes:420,total:1000}]}}));
 await page.route('**/v1/import',async route=>{
  const body=route.request().postDataJSON();opened.push(body.path);
  await held;await route.fulfill({status:400,json:{error:'Synthetic journal'}});
 });
 await page.goto(server.launchUrl);
 const rows=page.locator('.mh-session'),long=rows.filter({hasText:'Long journal'}),short=rows.filter({hasText:'Short journal'});
 await long.locator('.mh-session-open').click();
 await expect(long.locator('.mh-importing')).toHaveText('Reading 42%');
 await expect(long.locator('.mh-import-bar')).toHaveCount(1);
 await expect(short.locator('.mh-session-open')).toBeEnabled();
 const search=page.locator('.mh-search input');await search.fill('Short');await expect(rows).toHaveCount(1);await search.fill('');await expect(rows).toHaveCount(2);
 await short.locator('.mh-session-open').click();
 await expect.poll(()=>opened.length).toBe(2);
 release();
 await expect(page.locator('.mh-importing')).toHaveCount(0);
});

test('a worktree sits under its repository and its sessions name the worktree',async({page})=>{
 const repository='C:/projects/shop',worktree=`${repository}/.claude/worktrees/feature-1a2b3c`;
 await page.route('**/v1/recordings',route=>route.fulfill({json:{recordings:[]}}));
 await page.route('**/v1/sources',route=>route.fulfill({json:{sources:[source('On main',repository),source('On a branch',worktree,{repositoryRoot:repository}),source('Elsewhere','C:/projects/other')],errors:[]}}));
 await page.goto(server.launchUrl);
 const rail=page.getByRole('complementary',{name:'Workspaces'}),rows=page.locator('.mh-session');
 await expect(rows).toHaveCount(3);
 await expect(rail.getByRole('button',{name:/feature-1a2b3c/})).toHaveCount(0);
 await rail.getByRole('button',{name:/shop/}).click();
 await expect(rows).toHaveCount(2);
 await expect(rows.filter({hasText:'On a branch'})).toContainText('feature-1a2b3c');
 await expect(rows.filter({hasText:'On main'})).not.toContainText('·\u00a0shop');
});
