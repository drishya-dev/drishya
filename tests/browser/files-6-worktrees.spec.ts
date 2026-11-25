import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {test,expect} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from './browser-server.ts';
import {fileTreeOrigin} from '../../apps/ui/src/lib/file-tree-origin.ts';
let dir:string,id:string,app:App,server:RunningServer;
test.beforeAll(async()=>{
 dir=mkdtempSync(join(tmpdir(),'drishya-worktree-files-'));const main=join(dir,'repo'),child=join(dir,'worker');mkdirSync(main);mkdirSync(child);mkdirSync(join(main,'src'));writeFileSync(join(main,'src','same.ts'),'// current main source');
 const journal=join(dir,'session.jsonl');const rows=[main,child].flatMap((cwd,i)=>[
  {type:'user',uuid:`prompt${i}`,sessionId:'worktree-files',cwd,message:{role:'user',content:'Read the source.'}},
  {type:'assistant',uuid:`a${i}`,sessionId:'worktree-files',cwd,message:{content:[{type:'tool_use',id:`c${i}`,name:'Read',input:{file_path:join(cwd,'src','same.ts')}}]}},
  {type:'user',uuid:`r${i}`,sessionId:'worktree-files',cwd,message:{content:[{type:'tool_result',tool_use_id:`c${i}`,content:'     1\t// captured source'}]}}
 ]);writeFileSync(journal,rows.map((row,i)=>JSON.stringify({...row,timestamp:`2026-10-28T00:00:0${i}Z`})).join('\n')+'\n');app=new App(join(dir,'data'));id=(await app.ingest.importSource('claude-code',journal)).recordingId;server=await startServer({app,port:0});
});
test.afterAll(async()=>{await server?.close();await app?.close();if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});});
for(const width of [600,1440])test(`recorded worktrees are separate, searchable and retain visible origins at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.route('**/v1/working-locations',route=>route.request().method()==='GET'?route.fulfill({json:{version:1,sessions:[]}}):route.continue());await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?motion=0#/r/${id}`);
 const files=page.getByRole('button',{name:'Show files',exact:true});if(await files.getAttribute('aria-pressed')!=='true')await files.click();
 const tree=page.getByRole('tree',{name:'Workspace files'}),group=tree.getByRole('treeitem',{name:'Other working directories',exact:true});
 await expect(group).toHaveAttribute('aria-expanded','false');await expect(tree.getByRole('treeitem').first()).toHaveAttribute('aria-label','src');
 const response=await page.request.get(`${server.url}/v1/recordings/${id}/file-roots`);expect(response.ok()).toBe(true);const metadata=await response.json();expect(metadata.roots).toHaveLength(2);expect(metadata.truncated).toBe(false);
 const unknown=await page.request.get(`${server.url}/v1/recordings/missing/file-roots`);expect(unknown.status()).toBe(404);
 const search=page.getByRole('textbox',{name:'Find repository files'});await search.fill('same.ts');await expect(tree.locator('[data-spine-path]')).toHaveCount(2);const identities=await tree.locator('[data-spine-path]').evaluateAll(rows=>rows.map(row=>row.getAttribute('data-spine-path')));expect(new Set(identities).size).toBe(2);await search.fill('');
 await group.click();const worker=tree.getByRole('treeitem',{name:'worker',exact:true});await worker.click();const childSrc=tree.getByRole('treeitem',{name:'src',exact:true}).last();await childSrc.click();const leaf=tree.getByRole('treeitem',{name:'same.ts',exact:true});await expect(leaf).toBeVisible();const path=await leaf.getAttribute('data-spine-path');expect(path).toBeTruthy();
 const origin=await page.evaluate(({path,fn})=>{const containsOrigin=(row:any,b:any)=>row.width>0&&row.height>0&&row.left>=b.left&&row.top>=b.top&&row.right<=b.right&&row.bottom<=b.bottom;return !!eval(`(${fn})`)(document.querySelector('.viewer'),path);},{path,fn:fileTreeOrigin.toString()});expect(origin).toBe(true);
 await leaf.click();const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await expect(dialog).toHaveAccessibleName(/worker[/\\]src\/same.ts/);await expect(dialog.getByRole('button',{name:'Read file on disk',exact:true})).toHaveCount(0);await expect(dialog).toContainText('captured source');
 await dialog.getByRole('button',{name:/^Close Work on/}).click();if(await files.getAttribute('aria-pressed')!=='true')await files.click();const grant=page.locator('.workspace-grant');if(await grant.isVisible())await grant.click();await tree.getByRole('treeitem',{name:'src',exact:true}).first().click();const mainRoot=metadata.roots.find((root:any)=>root.root.endsWith('repo'));await tree.locator(`[data-spine-path="${mainRoot.prefix}/src/same.ts"]`).click();await expect(page.locator('.current-file-reader .current-file-code')).toContainText('current main source');await expect(page.locator('.file-workspace')).toHaveCount(0);
});
