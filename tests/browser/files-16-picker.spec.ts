import {mkdtempSync,mkdirSync,writeFileSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join,resolve,sep} from 'node:path';import {execFileSync} from 'node:child_process';
import {test,expect} from '@playwright/test';import {App} from '../../apps/daemon/src/app.ts';import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';import {openGitDestination} from './git-navigation.ts';
let dir:string,main:string,worker:string,app:App,server:RunningServer;const ids:Record<string,string>={};
const git=(root:string,...args:string[])=>execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true});
test.beforeAll(async()=>{
 dir=realpathSync.native(mkdtempSync(join(realpathSync.native(tmpdir()),'drishya-files16-browser-')));main=join(dir,'main');worker=join(dir,'worker');mkdirSync(main);git(main,'init','-q','-b','main');git(main,'config','user.name','Synthetic');git(main,'config','user.email','synthetic@example.invalid');writeFileSync(join(main,'shared.ts'),'export const checkout = "main";\n'+Array.from({length:80},(_,i)=>`// main line ${i+1}`).join('\n'));git(main,'add','.');git(main,'commit','-qm','Synthetic base');git(main,'worktree','add','-q','-b','feature/worker',worker);writeFileSync(join(worker,'shared.ts'),'export const checkout = "worker";\n');writeFileSync(join(worker,'worker-only.ts'),'export const onlyHere = true;\n');
 app=new App(join(dir,'home'));
 for(const harness of ['claude-code','codex']){
 const rows:object[]=harness==='codex'?[{type:'session_meta',payload:{id:'files16-codex',cwd:main}}]:[];
 for(const [i,cwd]of [main,worker].entries()){
 if(harness==='claude-code')rows.push({type:'assistant',uuid:'a'+i,sessionId:'files16-claude',cwd,gitBranch:i?'feature/worker':'main',message:{content:[{type:'tool_use',id:'read'+i,name:'Read',input:{file_path:join(cwd,'shared.ts')}}]}},{type:'user',uuid:'r'+i,sessionId:'files16-claude',cwd,message:{content:[{type:'tool_result',tool_use_id:'read'+i,content:'     1\texport const captured = true;'}]}});
 else rows.push({type:'response_item',payload:{type:'function_call',name:'exec_command',call_id:'read'+i,arguments:JSON.stringify({cmd:'cat shared.ts',workdir:cwd})}},{type:'response_item',payload:{type:'function_call_output',call_id:'read'+i,output:'export const captured = true;'}});
 }
 const source=join(dir,harness+'.jsonl');writeFileSync(source,rows.map((row,i)=>JSON.stringify({...row,timestamp:new Date(Date.UTC(2026,0,1,0,0,i)).toISOString()})).join('\n')+'\n');ids[harness]=(await app.ingest.importSource(harness,source)).recordingId;
 }
 server=await startServer({app,port:0});
});
test.afterAll(async()=>{await server?.close();await app?.close();if(!resolve(dir).startsWith(realpathSync.native(tmpdir())+sep))throw Error('Unsafe fixture');rmSync(dir,{recursive:true,force:true});});
for(const harness of ['claude-code','codex'])for(const width of [600,1440])test(`${harness} checkout picker keeps Files, Git, map and consent on the chosen root at ${width}`,async({page})=>{
 await page.setViewportSize({width,height:950});await page.route('**/v1/working-locations',r=>r.request().method()==='GET'?r.fulfill({json:{version:1,sessions:[]}}):r.continue());await page.goto(server.launchUrl);await page.locator('.home').waitFor();const id=ids[harness]!;
 const roots=await (await page.request.get(`${server.url}/v1/recordings/${id}/file-roots`)).json();
 const prefix=roots.roots.find((root:{root:string})=>root.root===worker).prefix;
 const chosen=await (await page.request.post(`${server.url}/v1/recordings/${id}/checkout`,{data:{prefix}})).json();
 await page.request.post(`${server.url}/v1/recordings/${encodeURIComponent(chosen.id)}/workspace/revoke`,{data:{}});
 await page.request.post(`${server.url}/v1/recordings/${id}/workspace/revoke`,{data:{}});
 await page.goto(`${server.url}/?motion=0#/r/${id}`);
 const show=page.getByRole('button',{name:'Show files',exact:true});if(await show.getAttribute('aria-pressed')!=='true')await show.click();const files=page.getByRole('complementary',{name:'Repository files'});await expect(files.getByLabel('Choose browsing checkout',{exact:true})).toBeVisible();
 await files.getByRole('button',{name:/Enable workspace reading/}).click();await expect(files).toHaveAttribute('data-reading-access','current');const query=files.getByRole('textbox',{name:'Find repository files'});await query.fill('shared');
 await files.getByTitle(`${main}/shared.ts`,{exact:true}).click();
 await expect(page.locator('.current-file-reader')).toContainText('checkout = "main"');
 if(await show.getAttribute('aria-pressed')!=='true')await show.click();await files.getByLabel('Choose browsing checkout',{exact:true}).click();const choices=files.getByRole('group',{name:'Recorded checkouts'});await choices.getByRole('button',{name:/feature\/worker|^worker$/}).click();
 await expect(files).toHaveAttribute('data-reading-access','captured');await expect(query).toHaveValue('');const status=await page.request.get(`${server.url}/v1/recordings/${id}/workspace`);expect((await status.json()).root).toBe(main);
 await files.getByRole('button',{name:/Enable workspace reading/}).click();await expect(files).toHaveAttribute('data-reading-access','current');await expect(files.getByRole('treeitem',{name:'worker-only.ts',exact:true})).toBeVisible();
 await files.getByTitle(`${worker}/shared.ts`,{exact:true}).click();await expect(page.locator('.current-file-reader')).toContainText('checkout = "worker"');if(width===600)await page.getByLabel('Reading options',{exact:true}).click();
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('drishya-preview-file',{detail:{path:'shared.ts',pin:true}})));
 const peekTabs=page.getByRole('tablist',{name:'Open file previews'});
 await expect(peekTabs.locator('.file-peek-tab:not(.preview)')).toHaveAttribute('data-peek-path',`${prefix}/shared.ts`);
 await expect(peekTabs.getByRole('tab')).toHaveCount(1);
 const selectedMap=await (await page.request.get(`${server.url}/v1/recordings/${encodeURIComponent(chosen.id)}/graph`)).json();
 expect(selectedMap.root).toBe(worker);expect(selectedMap.nodes.every((node:{path:string})=>node.path.startsWith(prefix+'/'))).toBe(true);
 await expect(page.getByRole('button',{name:'Open in Workspace',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Agent work on this file',exact:true}).click();
 const captured=page.getByRole('dialog').filter({has:page.getByRole('region',{name:'File history',exact:true})});
 await expect(captured).toContainText('captured = true');await captured.getByLabel('File actions',{exact:true}).click();
 await captured.getByRole('button',{name:'Read file on disk',exact:true}).click();
 await expect(page.locator('.current-file-reader')).toContainText('checkout = "worker"');
 await openGitDestination(page,'Git review');const review=page.getByRole('dialog',{name:'Git review',exact:true});const gitStatus=await (await page.request.get(`${server.url}/v1/recordings/${encodeURIComponent(chosen.id)}/git`)).json();
 if(!gitStatus.approved)await review.getByRole('button',{name:'Approve read-only Git',exact:true}).click();
 await expect(review).toContainText('feature/worker');await expect(review).toContainText('worker-only.ts');await page.keyboard.press('Escape');
 if(await show.getAttribute('aria-pressed')!=='true')await show.click();await files.getByLabel('Choose browsing checkout',{exact:true}).click();await choices.getByRole('button',{name:'Session checkout',exact:true}).click();await expect(page.locator('.current-file-reader')).toContainText('checkout = "main"');
 if(await show.getAttribute('aria-pressed')!=='true')await show.click();await expect(query).toHaveValue('shared');
 const graphs=await page.request.get(`${server.url}/v1/recordings/${id}/graph`);expect((await graphs.json()).root).toBe(main);expect(app.recording(id).workspaceRoot).toBe(main);await page.screenshot({path:`.local/files16-${harness}-${width}.png`});
});
