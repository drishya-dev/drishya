import {mkdtempSync,mkdirSync,writeFileSync,rmSync,realpathSync,renameSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {execFileSync} from 'node:child_process';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {App} from '../src/app.ts';
import {WorkspaceAccess} from '../src/workspace.ts';
import {GitReview} from '../src/git-review.ts';
import {startServer,type RunningServer} from '../src/server.ts';
let dir:string,main:string,worker:string,cwdOnly:string,id:string,app:App,workspace:WorkspaceAccess;
const git=(root:string,...args:string[])=>execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true}).trim();
beforeEach(async()=>{
 dir=realpathSync.native(mkdtempSync(join(realpathSync.native(tmpdir()),'drishya-checkout-choice-')));main=join(dir,'main');worker=join(dir,'worker');cwdOnly=join(dir,'cwd-only');mkdirSync(main);mkdirSync(cwdOnly);
 git(main,'init','-q','-b','main');git(main,'config','user.name','Synthetic');git(main,'config','user.email','synthetic@example.invalid');writeFileSync(join(main,'seed.ts'),'export const seed=1;\n');git(main,'add','.');git(main,'commit','-qm','Synthetic base');git(main,'worktree','add','-q','-b','feature/worker',worker);writeFileSync(join(worker,'worker.ts'),'export const worker=2;\n');writeFileSync(join(worker,'.env'),'PROTECTED_SYNTHETIC=never-readable');
 const rows=[main,worker].flatMap((cwd,i)=>[{type:'assistant',uuid:'a'+i,sessionId:'checkout-choice',cwd,gitBranch:i?'feature/worker':'main',message:{content:[{type:'tool_use',id:'read'+i,name:'Read',input:{file_path:join(cwd,i?'worker.ts':'seed.ts')}}]}},{type:'user',uuid:'r'+i,sessionId:'checkout-choice',cwd,message:{content:[{type:'tool_result',tool_use_id:'read'+i,content:'     1\texport const captured=1;'}]}}]);rows.push({type:'assistant',uuid:'cwd-only',sessionId:'checkout-choice',cwd:cwdOnly,message:{content:[{type:'text',text:'Synthetic finished'}]}} as never);
 const source=join(dir,'source.jsonl');writeFileSync(source,rows.map((r,i)=>JSON.stringify({...r,timestamp:new Date(Date.UTC(2026,0,1,0,0,i)).toISOString()})).join('\n')+'\n');app=new App(join(dir,'home'));id=(await app.ingest.importSource('claude-code',source)).recordingId;workspace=new WorkspaceAccess(app);
});
afterEach(async()=>{await app?.close();if(!resolve(dir).startsWith(realpathSync.native(tmpdir())+sep))throw Error('Unsafe scratch fixture');rmSync(dir,{recursive:true,force:true});});
async function prefix(root:string){const {recordedFileRoots}=await import('../src/file-roots.ts');const metadata=await recordedFileRoots(app.store,[id]);return metadata.roots.find(r=>r.root===root)!.prefix;}
it('selects only a recorded checkout with file evidence, never an arbitrary or cwd-only root',async()=>{
 await expect(app.chooseCheckout(id,await prefix(cwdOnly))).rejects.toMatchObject({status:404});await expect(app.chooseCheckout(id,'../../outside')).rejects.toMatchObject({status:400});await expect(app.chooseCheckout(id,'worktree-0000000000')).rejects.toMatchObject({status:404});
 const choice=await app.chooseCheckout(id,await prefix(worker));expect(choice.root).toBe(worker);expect(choice.recordingId).toBe(id);expect(app.recording(id).workspaceRoot).toBe(main);expect(()=>app.recording(choice.id)).toThrow('recording not found');expect(app.readingId(choice.id)).toBe(id);expect(app.workspaceRecording(choice.id).workspaceRoot).toBe(worker);
});
it('keeps consent and graph identity separate and returns to the unchanged session checkout',async()=>{
 const choice=await app.chooseCheckout(id,await prefix(worker));expect(workspace.status(choice.id).approved).toBe(false);expect((await app.graph(choice.id)).approvalNeeded?.root).toBe(worker);
 await workspace.approve(choice.id);expect(workspace.status(id).approved).toBe(false);expect(await workspace.root(choice.id)).toBe(worker);await expect(workspace.root(id)).rejects.toMatchObject({status:403});
 expect((await app.graph(choice.id)).nodes.some(n=>n.path===choice.prefix+'/worker.ts')).toBe(true);expect(app.recording(id).graphRoot).toBeFalsy();expect((await workspace.read(choice.id,'worker.ts')).text).toContain('worker=2');await expect(workspace.read(choice.id,'.env')).rejects.toMatchObject({status:403});
 const review=new GitReview(workspace);await review.approve(choice.id);expect((await review.snapshot(choice.id)).branch).toBe('feature/worker');expect(review.status(id).approved).toBe(false);
 const original=await app.chooseCheckout(id);expect(original.id).toBe(id);expect(original.root).toBe(main);workspace.revoke(choice.id);await expect(workspace.root(choice.id)).rejects.toMatchObject({status:403});expect(app.recording(id).workspaceRoot).toBe(main);
});
it('rejects removed roots without silently substituting the main checkout',async()=>{
 const selected=await prefix(worker);rmSync(worker,{recursive:true,force:true});await expect(app.chooseCheckout(id,selected)).rejects.toMatchObject({status:409});expect(app.recording(id).workspaceRoot).toBe(main);
});
it('rejects checkout keys on native controller and captured-recording routes',async()=>{
 let server:RunningServer|undefined;try{server=await startServer({app,port:0});const choice=await app.chooseCheckout(id,await prefix(worker));const headers={authorization:`Bearer ${server.token}`,'content-type':'application/json'};
 for(const suffix of ['controller','history','projection','export']){const response=await fetch(`${server.url}/v1/recordings/${encodeURIComponent(choice.id)}/${suffix}`,{headers});expect(response.status,suffix).toBe(400);}
 const approved=await fetch(`${server.url}/v1/recordings/${encodeURIComponent(choice.id)}/workspace/approve`,{method:'POST',headers,body:'{}'});expect(approved.status).toBe(200);const original=await fetch(`${server.url}/v1/recordings/${id}/workspace`,{headers});expect(((await original.json()) as {approved:boolean}).approved).toBe(false);
 }finally{await server?.close();}
});

it('keeps a remembered alternate checkout separate after restart',async()=>{
 const choice=await app.chooseCheckout(id,await prefix(worker));await workspace.approve(choice.id,true);
 await app.close();app=new App(join(dir,'home'));workspace=new WorkspaceAccess(app);
 const restored=await app.chooseCheckout(id,choice.prefix);expect((await workspace.restoreStatus(restored.id)).approved).toBe(true);expect((await workspace.restoreStatus(id)).approved).toBe(false);expect(app.recording(id).workspaceRoot).toBe(main);
});
it('does not let a replacement directory borrow a temporary checkout grant',async()=>{
 const choice=await app.chooseCheckout(id,await prefix(worker));await workspace.approve(choice.id);
 const old=join(dir,'previous-worker');if(!resolve(old).startsWith(dir+sep)||!resolve(worker).startsWith(dir+sep))throw Error('Unsafe move fixture');renameSync(worker,old);mkdirSync(worker);writeFileSync(join(worker,'worker.ts'),'export const replacement=1;');
 await expect(workspace.read(choice.id,'worker.ts')).rejects.toMatchObject({status:403});
});

it('uses the real history identity for a paged checkout map',async()=>{
 const choice=await app.chooseCheckout(id,await prefix(worker)),projection=app.projection(id);
 const paged=vi.spyOn(app,'paged').mockReturnValue(true);
 const page=vi.spyOn(app.history,'page').mockResolvedValue({projection} as never);
 try{expect((await app.graph(choice.id)).approvalNeeded?.root).toBe(worker);expect(page).toHaveBeenCalledWith(id,{count:1,loadingOk:true});}
 finally{page.mockRestore();paged.mockRestore();}
});
