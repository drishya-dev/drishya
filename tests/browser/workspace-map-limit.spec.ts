import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {test,expect} from '@playwright/test';
import {buildGraph} from '../../packages/indexer/src/index.ts';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
let dir:string,id:string,app:App,server:RunningServer;
test.beforeAll(async()=>{
 dir=mkdtempSync(join(tmpdir(),'drishya-map-limit-'));const root=join(dir,'repo');mkdirSync(root);writeFileSync(join(root,'aaa.txt'),'First indexed file');writeFileSync(join(root,'README.md'),'# Current README\n\nThe file exists outside the bounded graph.');
 const base={timestamp:'2026-10-25T00:00:00Z',sessionId:'map-limit',cwd:root};const journal=join(dir,'session.jsonl');writeFileSync(journal,[{...base,type:'user',uuid:'u',message:{role:'user',content:'Inspect README.md'}},{...base,type:'assistant',uuid:'a',message:{id:'m',role:'assistant',content:[{type:'tool_use',id:'read',name:'Read',input:{file_path:join(root,'README.md')}}]}},{...base,type:'user',uuid:'r',message:{role:'user',content:[{type:'tool_result',tool_use_id:'read',content:'README text, not current disk.'}]}}].map(x=>JSON.stringify(x)).join('\n')+'\n');
 app=new App(join(dir,'data'));id=(await app.ingest.importSource('claude-code',journal)).recordingId;const bounded=await buildGraph(root,{maxFiles:1});expect(bounded.truncated).toBe(true);expect(bounded.nodes.some(n=>n.path==='README.md')).toBe(false);app.graph=async()=>bounded;server=await startServer({app,port:0});
});
test.afterAll(async()=>{await server?.close();await app?.close();if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});});
test('Files opens an eligible file beyond the map cap in both Workspace and peek',async({page})=>{
 await page.route('**/v1/working-locations',route=>route.request().method()==='GET'?route.fulfill({json:{version:1,sessions:[]}}):route.continue());await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
 await page.getByRole('button',{name:'Open developer workspace',exact:true}).click();const desk=page.getByRole('region',{name:'Developer workspace',exact:true});await desk.getByRole('button',{name:'Approve workspace reading',exact:true}).click();await page.getByRole('textbox',{name:'Find repository files',exact:true}).fill('README.md');await page.locator('[data-spine-path="README.md"]').click();await expect(desk.locator('.desk-markdown')).toContainText('The file exists outside the bounded graph.');await expect(desk.getByRole('button',{name:'Edit file',exact:true})).toBeEnabled();await desk.getByRole('button',{name:'Back to agent',exact:true}).click();
 await page.locator('[data-spine-path="README.md"]').click();const reader=page.locator('.current-file-reader');await expect(reader).toBeVisible();await expect(reader).toContainText('The file exists outside the bounded graph.');await expect(reader.getByRole('alert')).toHaveCount(0);
 await page.setViewportSize({width:390,height:844});expect(await reader.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);expect((await app.graph(id)).nodes.some(n=>n.path==='README.md')).toBe(false);
});

