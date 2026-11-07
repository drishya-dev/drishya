import{mkdtempSync,mkdirSync,writeFileSync,appendFileSync,rmSync}from'node:fs';
import{tmpdir}from'node:os';import{join,resolve,sep}from'node:path';
import{test,expect}from'@playwright/test';import{App}from'../../apps/daemon/src/app.ts';import{startServer}from'../../apps/daemon/src/server.ts';
for(const width of[600,1440])test(`search paths keep their identity and worktree arrivals keep folders open at ${width}`,async({page})=>{
 const dir=mkdtempSync(join(tmpdir(),'drishya-files13-')),main=join(dir,'main','drishya'),journal=join(dir,'session.jsonl'),app=new App(join(dir,'home'));let server:Awaited<ReturnType<typeof startServer>>|undefined;
 const names=['App.tsx','ArtifactReader.tsx','BeforeTurn.tsx','CapturedCommands.tsx'];let seq=0;
 const row=(cwd:string,message:object)=>({sessionId:'files13-synthetic',cwd,timestamp:new Date(Date.UTC(2026,10,7,0,0,seq++)).toISOString(),...message});
 const read=(cwd:string,id:string)=>[row(cwd,{type:'assistant',uuid:'a'+id,message:{content:[{type:'tool_use',id,name:'Read',input:{file_path:join(cwd,'src','a.ts')}}]}}),row(cwd,{type:'user',uuid:'r'+id,message:{content:[{type:'tool_result',tool_use_id:id,content:'1\texport const capturedEvidence = true;'}]}})];
 try{
  mkdirSync(join(main,'src'),{recursive:true});writeFileSync(join(main,'src','a.ts'),'export const currentSource = true;\n');mkdirSync(join(main,'apps','ui','src','components'),{recursive:true});for(const name of names)writeFileSync(join(main,'apps','ui','src','components',name),'export const nestedSource = true;\n');
  const rows=[...read(main,'main'),row(main,{type:'assistant',uuid:'glob',message:{content:[{type:'tool_use',id:'glob',name:'Glob',input:{pattern:'**/*.tsx',path:main}}]}}),row(main,{type:'user',uuid:'glob-result',message:{content:[{type:'tool_result',tool_use_id:'glob',content:names.join('\n')}]}})];writeFileSync(journal,rows.map(r=>JSON.stringify(r)).join('\n')+'\n');const id=(await app.ingest.importSource('claude-code',journal)).recordingId;server=await startServer({app,port:0});
  await page.setViewportSize({width,height:1000});await page.route('**/v1/working-locations',r=>r.request().method()==='GET'?r.fulfill({json:{version:1,sessions:[]}}):r.continue());await page.goto(server.launchUrl);await page.locator('.home').waitFor();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
  const trigger=page.getByRole('button',{name:'Show files',exact:true});const open=async()=>{if(await trigger.getAttribute('aria-pressed')!=='true')await trigger.click();await expect(page.locator('.folder-tree')).toBeVisible()};await open();const tree=page.getByRole('tree',{name:'Workspace files'}),unplaced=tree.getByRole('treeitem',{name:'Unplaced paths',exact:true});await expect(unplaced).toBeVisible();await unplaced.click();
  for(const name of names)await expect(tree.getByRole('treeitem',{name,exact:true})).toHaveAttribute('aria-level','2');
  await tree.getByRole('treeitem',{name:'App.tsx',exact:true}).click();await expect(page.locator('.file-workspace')).toBeVisible();await expect(page.locator('.current-file-reader')).toHaveCount(0);await page.locator('.file-workspace').getByRole('button',{name:/^Close Work on/}).click();await open();
  await page.locator('.workspace-grant').click();await expect(page.locator('.folder-explorer')).toHaveAttribute('data-reading-access','current');
  await expect(tree.getByRole('treeitem',{name:'App.tsx',exact:true})).toHaveAttribute('aria-level','2');
  const src=tree.getByRole('treeitem',{name:'src',exact:true}).first();await src.click();await expect(src).toHaveAttribute('aria-expanded','true');
  await page.request.post(`${server.url}/v1/recordings/${id}/live`,{data:{on:true}});
  for(const name of['alpha','beta']){const cwd=join(dir,'.codex','worktrees',name,'drishya');mkdirSync(join(cwd,'src'),{recursive:true});writeFileSync(join(cwd,'src','a.ts'),'// synthetic worker\n');appendFileSync(journal,read(cwd,name).map(r=>JSON.stringify(r)).join('\n')+'\n');await app.ingest.sync(id);}
  const others=tree.getByRole('treeitem',{name:'Other working directories',exact:true});await expect(others).toBeVisible();await expect(src).toHaveAttribute('aria-expanded','true');await expect(tree.getByRole('treeitem',{name:'a.ts',exact:true})).toHaveCount(1);
  await others.click();await expect(tree.getByRole('treeitem',{name:'alpha/drishya',exact:true})).toBeVisible();await expect(tree.getByRole('treeitem',{name:'beta/drishya',exact:true})).toBeVisible();await expect(tree.getByRole('treeitem',{name:'App.tsx',exact:true})).toHaveAttribute('aria-level','2');
 }finally{await server?.close();await app.close();if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('Unsafe scratch cleanup');rmSync(dir,{recursive:true,force:true});}
});
