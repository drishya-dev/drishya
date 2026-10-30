import {appendFileSync,mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,sep} from 'node:path';
import {test,expect} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
import {Store} from '../../packages/store/src/index.ts';
import {defaultAdapters,Ingestor} from '../../packages/ingest/src/index.ts';
import {sinceSnapshot} from '../../packages/scene/src/since.ts';
let dir:string,app:App,server:RunningServer,id:string,journal:string;
const change=(n:number,changes:Record<string,object>,status='completed')=>({timestamp:`2026-10-25T10:00:${String(n).padStart(2,'0')}Z`,type:'event_msg',payload:{type:'item_completed',item:{type:'FileChange',id:'change-'+n,status,changes,stdout:'Recorded fixture outcome',stderr:''}}});
const append=async(row:object)=>{appendFileSync(journal,JSON.stringify(row)+'\n');await app.ingest.sync(id);};
test.beforeAll(async()=>{
 dir=mkdtempSync(join(tmpdir(),'drishya-file-deletion-'));mkdirSync(join(dir,'src'));for(const name of ['existing','empty','untouched'])writeFileSync(join(dir,'src',name+'.ts'),'export const value = 1;');
 journal=join(dir,'source.jsonl');writeFileSync(journal,[{timestamp:'2026-10-25T10:00:00Z',type:'session_meta',payload:{id:'file-deletion',cwd:dir,cli_version:'0.162.0-alpha.2'}},change(1,{'src/gone.ts':{type:'add',content:'export const gone = 1;\n'},'src/existing.ts':{type:'update',unified_diff:'@@ -1 +1 @@\n-old\n+new'},'src/empty.ts':{type:'update',unified_diff:'@@ -1 +0,0 @@\n-old'}})].map(r=>JSON.stringify(r)).join('\n')+'\n');
 app=new App(join(dir,'data'));id=(await app.ingest.importSource('codex',journal)).recordingId;server=await startServer({app,port:0});
});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});}});
test('explicit deletions update live, survive missing disk files, and never leak backwards in replay',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setViewportSize({width:1440,height:960});await page.emulateMedia({reducedMotion:'reduce'});await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
 await expect(page.locator('.viewer')).toBeVisible();
 const explorer=page.locator('.folder-explorer');if(!await explorer.isVisible())await page.getByRole('button',{name:'Show files',exact:true}).click();
 const find=explorer.getByRole('textbox',{name:'Find repository files'});await find.fill('src/',{timeout:10000});const gone=explorer.locator('[data-spine-path="src/gone.ts"]');await expect(gone.locator('.file-change')).toHaveText('A');await expect(explorer.locator('[data-spine-path="src/empty.ts"] .file-change')).toHaveText('E');
 const before=app.projection(id).timeline.length;
 await append(change(2,{'src/gone.ts':{type:'delete'},'src/failed.ts':{type:'delete'}},'failed'));
 await expect(gone.locator('.file-change')).toHaveText('A');await expect(explorer.locator('[data-spine-path="src/failed.ts"] .file-change')).toHaveCount(0);
 await append(change(3,{'src/gone.ts':{type:'delete'}}));await expect(gone.locator('.file-change')).toHaveText('D');await expect(gone.getByLabel('Captured deletion',{exact:true})).toBeVisible();
 const deleted=app.projection(id).timeline.length;
 const evidence=async(step?:number)=>{const q=new URLSearchParams({path:'src/gone.ts',...(step===undefined?{}:{step:String(step)})});const r=await page.request.get(`${server.url}/v1/recordings/${id}/file-evidence?${q}`);expect(r.ok()).toBe(true);return r.json();};
 expect((await evidence(before))[0].change).toBe('A');expect((await evidence(deleted))[0].change).toBe('D');
 await append(change(4,{'src/gone.ts':{type:'add',content:'export const restored = 2;\n'}}));await expect(gone.locator('.file-change')).toHaveText('A');expect((await evidence(deleted))[0].change).toBe('D');
 const p=app.projection(id),paths=p.files.map(f=>f.path),all=await app.history.fileEvidence(id,paths);expect(all.filter(f=>f.change).map(f=>f.path).sort()).toEqual(sinceSnapshot(p,-1).editedFiles.sort());
 expect((await app.ingest.sync(id)).added).toBe(0);await find.fill('');await expect(explorer.locator('[aria-description="4 files with captured activity"]')).toBeVisible();
 await find.fill('src/gone.ts');await explorer.getByLabel('File filters',{exact:true}).click();await explorer.getByRole('button',{name:'Touched',exact:true}).click();await expect(gone).toBeVisible();
 for(const width of [390,320]){await page.setViewportSize({width,height:844});if(!await explorer.isVisible())await page.getByRole('button',{name:'Show files',exact:true}).click();await expect(gone).toBeVisible();await expect(gone.locator('.file-change')).toHaveText('A');expect(await gone.evaluate(e=>e.scrollWidth-e.clientWidth)).toBeLessThanOrEqual(1);}
 expect(errors).toEqual([]);
});


test('explicit rescan enriches legacy deletion evidence in the same recording without duplicates',async()=>{
 const source=join(dir,'legacy.jsonl'),data=join(dir,'legacy-data');
 writeFileSync(source,[{timestamp:'2026-10-25T10:00:00Z',type:'session_meta',payload:{id:'legacy-file-deletion',cwd:dir}},change(1,{'src/legacy.ts':{type:'add',content:'created\n'}}),change(2,{'src/legacy.ts':{type:'delete'}})].map(r=>JSON.stringify(r)).join('\n')+'\n');
 const store=new Store(data),adapters=defaultAdapters().map(adapter=>({...adapter,createParser(context:Parameters<typeof adapter.createParser>[0]){const parser=adapter.createParser(context);return {prime:parser.prime,parse:(record:unknown)=>parser.parse(record).filter(o=>o.kind!=='item.completed')};}}));
 const legacy=new Ingestor(store,adapters),imported=await legacy.importSource('codex',source),before=store.observations(imported.recordingId);
 // HOME-1b rescans every Codex recording without turn details once at startup. This one stands for a recording that already had that pass, so only the explicit rescan enriches it.
 await legacy.close();store.db.prepare('INSERT OR IGNORE INTO meta(key,value) VALUES (?,?)').run('codex-turn-details-rescan-v1:'+imported.recordingId,'1');store.close();
 const current=new App(data),local=await startServer({app:current,port:0});
 try{
  expect(await current.history.fileEvidence(imported.recordingId,['src/legacy.ts'])).toEqual([]);
  expect((await current.ingest.sync(imported.recordingId)).added).toBe(0);
  const url=`${local.url}/v1/recordings/${imported.recordingId}/rescan`,options={method:'POST',headers:{authorization:`Bearer ${local.token}`,'content-type':'application/json'},body:'{}'};
  const enriched=await fetch(url,options);expect(enriched.ok).toBe(true);expect((await enriched.json()).added).toBe(2);
  expect(await current.history.fileEvidence(imported.recordingId,['src/legacy.ts'])).toMatchObject([{path:'src/legacy.ts',change:'D',changeStatus:'ok'}]);
  const oldIds=new Set(before.map(o=>o.id));expect(current.store.observations(imported.recordingId).filter(o=>oldIds.has(o.id))).toEqual(before);
  expect((await (await fetch(url,options)).json()).added).toBe(0);
 }finally{await local.close();await current.close();}
});
