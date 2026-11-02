import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {execFileSync} from 'node:child_process';
import {test,expect,type Page} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
import {openGitDestination} from './git-navigation.ts';
let dir:string,app:App,server:RunningServer;
const samples=new Map<string,{id:string;ops:{id:string;path:string;kind:string;location:string}[]}>();
test.beforeAll(async()=>{
  dir=mkdtempSync(join(tmpdir(),'drishya-file-reading-'));app=new App(join(dir,'data'));server=await startServer({app,port:0});
  for(const harness of ['claude-code','codex'] as const){
    const root=join(dir,harness),outside=join(dir,'scratchpad-'+harness);mkdirSync(root);mkdirSync(outside);
    const rows:unknown[]=harness==='codex'?[{type:'session_meta',payload:{id:harness,cwd:root}}]:[];
    let sequence=0;
    for(const location of ['inside','outside','missing'])for(const kind of (harness==='claude-code'?['read','write','edit']:['write','edit'])){
      const path=join(location==='outside'?outside:root,`${location}-${kind}.ts`),marker=`CAPTURED_${location}_${kind}`,before=`export const value = '${marker}_before';\n`,after=`export const value = '${marker}_after';\n`,call=`call-${sequence++}`,time=new Date(Date.UTC(2026,9,31,0,0,sequence)).toISOString();
      if(location!=='missing')writeFileSync(path,after);
      if(harness==='claude-code'){
        const name={read:'Read',write:'Write',edit:'Edit'}[kind]!,input=kind==='read'?{file_path:path}:kind==='write'?{file_path:path,content:after}:{file_path:path,old_string:before,new_string:after};
        rows.push({type:'assistant',uuid:call,sessionId:harness,cwd:root,timestamp:time,message:{content:[{type:'tool_use',id:call,name,input}]}},
          {type:'user',uuid:call+'-result',sessionId:harness,cwd:root,timestamp:time,message:{content:[{type:'tool_result',tool_use_id:call,content:kind==='read'?`     1\t${after}`:'File changed.'}]},toolUseResult:kind==='read'?{file:{filePath:path,content:after,startLine:1,numLines:1,totalLines:1}}:{filePath:path,type:kind==='write'?'create':'update',originalFile:kind==='write'?null:before,content:kind==='write'?after:undefined,structuredPatch:kind==='edit'?[{oldStart:1,oldLines:1,newStart:1,newLines:1,lines:['-'+before.trimEnd(),'+'+after.trimEnd()]}]:undefined}});
      }else{
        const patch=`*** Begin Patch\n*** ${kind==='write'?'Add':'Update'} File: ${path.replaceAll('\\','/')}\n${kind==='write'?'+'+after.trimEnd():'@@\n-'+before.trimEnd()+'\n+'+after.trimEnd()}\n*** End Patch`;
        rows.push({type:'response_item',timestamp:time,payload:{type:'custom_tool_call',call_id:call,name:'apply_patch',input:patch}},{type:'response_item',timestamp:time,payload:{type:'custom_tool_call_output',call_id:call,output:'Success. Updated the following files.'}});
      }
    }
    const git=(...args:string[])=>execFileSync('git',['-c','core.hooksPath=','-c','commit.gpgsign=false','-c','user.name=Synthetic','-c','user.email=synthetic@example.invalid',...args],{cwd:root,windowsHide:true,stdio:'ignore'});
    git('init');git('add','.');git('commit','-m','synthetic captured-file fixture');
    writeFileSync(join(root,'inside-write.ts'),"export const value = 'CURRENT_WORKTREE_CHANGE';\n");
    const source=join(dir,harness+'.jsonl');writeFileSync(source,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');
    const id=(await app.ingest.importSource(harness,source)).recordingId,projection=app.projection(id);
    samples.set(harness,{id,ops:projection.operations.filter(op=>op.detail.kind==='read'||op.detail.kind==='edit').map(op=>({id:op.id,path:(op.detail as {path:string}).path,kind:op.kind,location:op.title.includes('outside-')?'outside':op.title.includes('missing-')?'missing':'inside'}))});
  }
});
test.afterAll(async()=>{await server?.close();await app?.close();if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('Unsafe scratch path');rmSync(dir,{recursive:true,force:true});});
async function open(page:Page,id:string,entries:[string,unknown][]){
  await page.route('**/v1/working-locations',route=>route.request().method()==='GET'?route.fulfill({json:{version:1,sessions:[{id,entries}]}}):route.continue());
  await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
}
for(const width of [600,1440])test(`Workspace, Changes and Git review find captured files outside the resident file list at ${width}`,async({page})=>{
  await page.setViewportSize({width,height:950});const sample=samples.get('claude-code')!,op=sample.ops.find(op=>op.location==='inside'&&op.kind==='write')!;
  // A paged History projection is not the whole recording's file index. Changes
  // owns a global path receipt; current-file/Git actions must check the bounded trail.
  await page.route('**/v1/recordings/*/history?**',async route=>{
    const response=await route.fetch(),body=await response.json();body.projection.files=[];
    await route.fulfill({response,json:body});
  });
  await open(page,sample.id,[['location',{selectedOp:op.id,follow:false,held:true}]]);
  const inspector=page.getByRole('region',{name:'Operation detail'});await expect(inspector).toBeVisible();
  await inspector.getByRole('button',{name:'Open current file for correction',exact:true}).click();
  const desk=page.locator('.developer-workspace'),approval=desk.getByRole('button',{name:'Approve workspace reading',exact:true});await expect(approval.or(desk.getByRole('tablist'))).toBeVisible();if(await approval.isVisible())await approval.click();
  await expect(desk.locator('.desk-code')).toContainText('CURRENT_WORKTREE_CHANGE');
  await desk.getByLabel(`File actions for ${op.path}`,{exact:true}).press('Enter');await desk.getByRole('button',{name:'View captured file',exact:true}).click();
  const captured=page.locator('.file-workspace');await expect(captured.locator('.file-evidence-material')).toContainText('CAPTURED_inside_write');await expect(captured).not.toContainText('CURRENT_WORKTREE_CHANGE');
  await captured.getByRole('button',{name:'Read file on disk',exact:true}).click();
  const peek=page.locator('.current-file-reader');await expect(peek.locator('.current-file-code')).toBeVisible();
  await peek.getByLabel('Reading options',{exact:true}).or(peek.getByLabel(`File reading actions for ${op.path}`,{exact:true})).press('Enter');
  await peek.getByRole('button',{name:'Show in Files',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Find repository files',exact:true})).toHaveValue(op.path);
  await page.getByRole('button',{name:'Changes',exact:true}).click();const changes=page.locator('.evidence-review');await expect(changes).toBeVisible();await changes.getByLabel(`File reading actions for ${op.path}`,{exact:true}).press('Enter');await changes.getByRole('button',{name:'View captured file',exact:true}).click();
  await expect(changes).toHaveCount(0);await expect(captured.locator('.file-evidence-material')).toContainText('CAPTURED_inside_write');await captured.getByRole('button',{name:/^Close Work on/}).click();
  const statusResponse=page.waitForResponse(response=>response.request().method()==='GET'&&response.url().endsWith(`/recordings/${sample.id}/git`));
  await openGitDestination(page,'Git review');const git=page.getByRole('dialog',{name:'Git review',exact:true}),consent=git.getByRole('button',{name:'Approve read-only Git',exact:true}),refresh=git.getByRole('button',{name:'Refresh changes',exact:true});
  // Consent is shared by the daemon across these viewport cases. Wait for its
  // actual receipt, not the reader's provisional unapproved first frame.
  const status=await (await statusResponse).json();if(status.approved)await expect(refresh).toBeVisible();else await consent.click();
  await expect(git.locator('.git-selected-file-header')).toContainText(op.path);await git.getByLabel(`File reading actions for ${op.path}`,{exact:true}).press('Enter');await git.getByRole('button',{name:'View captured file',exact:true}).click();await expect(git).toHaveCount(0);await expect(captured.locator('.file-evidence-material')).toContainText('CAPTURED_inside_write');
});

test('an off-page captured version is selected exactly and cached later bytes do not leak across replay',async({page})=>{
  const root=join(dir,'versioned');mkdirSync(root);const path=join(root,'file.ts'),rows:unknown[]=[];
  for(let n=0;n<30;n++){const call='version-'+n,content=`export const revision = 'VERSION_${n}';\n`,timestamp=new Date(Date.UTC(2026,9,31,0,n)).toISOString();rows.push({type:'assistant',uuid:call,sessionId:'versions',cwd:root,timestamp,message:{content:[{type:'tool_use',id:call,name:'Write',input:{file_path:path,content}}]}},{type:'user',uuid:call+'-result',sessionId:'versions',cwd:root,timestamp,message:{content:[{type:'tool_result',tool_use_id:call,content:'Written.'}]},toolUseResult:{type:n?'update':'create',originalFile:n?`export const revision = 'VERSION_${n-1}';\n`:null,content}});}
  const source=join(dir,'versions.jsonl');writeFileSync(source,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');const id=(await app.ingest.importSource('claude-code',source)).recordingId,p=app.projection(id),op=p.operations.at(-1)!;
  await open(page,id,[['location',{selectedOp:op.id,follow:false,held:true}]]);await page.getByRole('region',{name:'Operation detail'}).getByRole('button',{name:'View captured file',exact:true}).click();const captured=page.locator('.file-workspace');await expect(captured.locator('.file-evidence-material')).toContainText('VERSION_29');await expect(captured.getByLabel('First evidence',{exact:true})).toHaveValue(`${op.id}/after`);
  await captured.getByRole('button',{name:/^Close Work on/}).click();await page.goto(`${server.url}/?experience=modern&motion=0&at=end#/r/${id}`);const card=page.locator(`article[data-op-id="${op.id}"]`);await card.scrollIntoViewIfNeeded();await card.getByRole('button',{name:'Open captured work for file.ts',exact:true}).click();await expect(captured).toContainText('VERSION_29');await captured.getByRole('button',{name:/^Close Work on/}).click();
  await page.getByRole('slider',{name:'Timeline',exact:true}).press('ArrowLeft');await card.getByRole('button',{name:'Open captured work for file.ts',exact:true}).click();await expect(captured).toBeVisible();await expect(captured.locator('.file-evidence-material')).toBeVisible();await expect(captured).not.toContainText('VERSION_29');
});
for(const harness of ['claude-code','codex'])for(const width of [600,1440]){
  test(`captured file actions keep full source and outside refusal ${harness} ${width}`,async({page})=>{
    await page.setViewportSize({width,height:950});const sample=samples.get(harness)!;
    for(const op of sample.ops){
      await page.unroute('**/v1/working-locations');await open(page,sample.id,[['location',{selectedOp:op.id,follow:false,held:true}]]);
      const inspector=page.getByRole('region',{name:'Operation detail'});await expect(inspector).toBeVisible();await page.keyboard.press('Escape');
      const card=page.locator(`article[data-op-id="${op.id}"]`);await card.scrollIntoViewIfNeeded();await card.getByRole('button',{name:`Open captured work for ${op.path}`,exact:true}).click();
      const file=page.locator('.file-workspace');await expect(file.locator('.file-evidence-material')).toContainText('CAPTURED_');
      if(op.location==='outside'){
        await expect(file).toContainText('Outside this workspace');await expect(file.getByRole('button',{name:'Open in Workspace',exact:true})).toBeDisabled();
        await expect(file.getByRole('button',{name:'Read file on disk',exact:true})).toHaveCount(0);
      }else{
        await expect(file.getByRole('button',{name:'Open in Workspace',exact:true})).toBeEnabled();
        if(op.location==='inside'){
          await file.getByRole('button',{name:'Show in Files',exact:true}).click();await expect(page.getByRole('textbox',{name:'Find repository files',exact:true})).toHaveValue(op.path);
          await expect(page.locator(`[data-spine-path="${op.path}"]`)).toBeVisible();
        }
      }
      await expect(page.getByRole('button',{name:'Retry source',exact:true})).toHaveCount(0);
    }
  });
  test(`restored Workspace and peek retain captured files instead of dead retries ${harness} ${width}`,async({page})=>{
    await page.setViewportSize({width,height:950});const sample=samples.get(harness)!;
    for(const location of ['outside','missing'])for(const surface of ['workspace','peek']){
      const op=sample.ops.find(op=>op.location===location&&op.kind==='write')!;await page.unroute('**/v1/working-locations');
      const entries:[string,unknown][]=[['location',surface==='workspace'?{developerWorkspace:true,follow:false,held:true}:{currentFile:op.path,follow:false,held:true}],['desk/files',[op.path]],['desk/primary',op.path]];
      await open(page,sample.id,entries);
      const area=page.locator(surface==='workspace'?'.developer-workspace':'.current-file-reader');
      const approval=area.getByRole('button',{name:surface==='workspace'?'Approve workspace reading':'Approve current-file reading',exact:true});await expect(approval.or(area.getByRole('region',{name:'Captured file fallback'}))).toBeVisible();if(await approval.isVisible())await approval.click();
      const fallback=area.getByRole('region',{name:'Captured file fallback'});await expect(fallback).toBeVisible();await expect(fallback.locator('.file-evidence-material')).toContainText('CAPTURED_');
      await expect(fallback).toContainText(location==='outside'?'Outside this workspace':'no longer on disk');await expect(fallback.getByRole('button',{name:'Open in Workspace',exact:true})).toBeDisabled();
      await expect(area.getByRole('button',{name:/Retry (current )?source/})).toHaveCount(0);await expect(area.getByText(/Reading current (source|file)…/)).toHaveCount(0);
      expect(await area.evaluate(node=>node.scrollWidth-node.clientWidth)).toBeLessThanOrEqual(1);
    }
  });
}
