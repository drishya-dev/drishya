import {constants} from 'node:fs';
import {mkdtemp,mkdir,writeFile,rename,rm,symlink,realpath,open} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn,spawnSync,execFileSync} from 'node:child_process';
import {afterEach,expect,it,vi} from 'vitest';
import {App} from '../src/app.ts';
import {checkoutIdentity,checkoutGrantKey} from '../src/checkout-grants.ts';
import {WorkspaceAccess} from '../src/workspace.ts';
import {nativeReadiness} from '../src/native-readiness.ts';
import {startServer} from '../src/server.ts';

vi.mock('node:fs/promises',async(importOriginal)=>{
  const fs=await importOriginal<typeof import('node:fs/promises')>();
  return {...fs,open:vi.fn(fs.open)};
});

const cleanups:(()=>Promise<unknown>)[]=[];
afterEach(async()=>{for(const cleanup of cleanups.splice(0).reverse())await cleanup();});
async function fixture() {
  const dir=await mkdtemp(join(tmpdir(),'drishya-grants-'));cleanups.push(()=>rm(dir,{recursive:true,force:true}));
  const root=join(dir,'checkout');await mkdir(root);await writeFile(join(root,'file.ts'),'export const a=1;');
  const home=join(dir,'home'),app=new App(home);cleanups.push(()=>app.close());
  const journal=join(dir,'source.jsonl');
  await writeFile(journal,JSON.stringify({type:'user',uuid:'u',sessionId:'11111111-1111-4111-8111-111111111111',cwd:root,message:{role:'user',content:'Synthetic checkout grant'}})+'\n');
  const id=(await app.ingest.importSource('claude-code',journal)).recordingId;
  return {dir,root,home,app,id,access:new WorkspaceAccess(app)};
}
it('opens a regular checkout marker with read-only platform protections',async()=>{
  const f=await fixture(),git=join(f.root,'.git'),head=join(git,'HEAD');
  await mkdir(git);
  await writeFile(head,'ref: refs/heads/main\n');
  vi.mocked(open).mockClear();

  expect(await checkoutIdentity(f.root)).toMatchObject({repository:{kind:'git'}});
  expect(open).toHaveBeenCalledWith(join(await realpath(git),'HEAD'),
    constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
});

it('restores only explicit remembered grants after a new App and clears them on revoke',async()=>{
  const f=await fixture();await f.access.approve(f.id);
  expect((await new WorkspaceAccess(f.app).restoreStatus(f.id)).approved).toBe(false);
  await f.access.approve(f.id,true);
  const app2=new App(f.home);cleanups.push(()=>app2.close());const restarted=new WorkspaceAccess(app2);
  expect(await restarted.restoreStatus(f.id)).toMatchObject({approved:true,remembered:true});
  expect((await restarted.read(f.id,'file.ts')).text).toContain('export const a');
  restarted.revoke(f.id);
  expect(await new WorkspaceAccess(f.app).restoreStatus(f.id)).toMatchObject({approved:false,remembered:false});
  expect((await restarted.remembered.list()).length).toBe(0);
});
it('changing remembered to temporary approval removes the saved grant',async()=>{
  const f=await fixture();await f.access.approve(f.id,true);await f.access.approve(f.id,false);
  expect(f.access.status(f.id)).toMatchObject({approved:true,remembered:false});
  expect((await new WorkspaceAccess(f.app).restoreStatus(f.id)).approved).toBe(false);
});
it('restores one exact checkout through a directory alias and its canonical spelling, including revocation',async()=>{
  const f=await fixture(),canonical=await realpath(f.root),alias=join(f.dir,'checkout-alias');
  await symlink(canonical,alias,process.platform==='win32'?'junction':'dir');
  expect(await checkoutIdentity(alias)).toEqual(await checkoutIdentity(canonical));
  expect(checkoutGrantKey(alias)).toBe(checkoutGrantKey(canonical));
  const journal=join(f.dir,'alias-source.jsonl');
  await writeFile(journal,JSON.stringify({type:'user',uuid:'alias-user',sessionId:'33333333-3333-4333-8333-333333333333',cwd:alias,message:{role:'user',content:'Synthetic aliased checkout'}})+'\n');
  const aliasId=(await f.app.ingest.importSource('claude-code',journal)).recordingId;
  await f.access.approve(aliasId,true);
  const restarted=new WorkspaceAccess(f.app);
  expect(await restarted.restoreStatus(aliasId)).toMatchObject({approved:true,remembered:true});
  expect(await restarted.restoreStatus(f.id)).toMatchObject({approved:true,remembered:true});
  expect((await restarted.read(aliasId,'file.ts')).text).toContain('export const a');
  expect(await restarted.remembered.list()).toHaveLength(1);
  restarted.revoke(aliasId);
  expect((await restarted.restoreStatus(f.id)).approved).toBe(false);
  expect(await restarted.remembered.list()).toEqual([]);
});
it('does not transfer a remembered grant when an alias is retargeted',async()=>{
  const f=await fixture(),canonical=await realpath(f.root),alias=join(f.dir,'alias'),other=join(f.dir,'other');
  await mkdir(other);await symlink(canonical,alias,process.platform==='win32'?'junction':'dir');
  await f.access.remembered.remember(alias,await checkoutIdentity(alias));
  await rm(alias);await symlink(other,alias,process.platform==='win32'?'junction':'dir');
  expect(await f.access.remembered.restore(alias)).toBeUndefined();
  expect(await f.access.remembered.restore(other)).toBeUndefined();
  expect(await f.access.remembered.restore(canonical)).toBeUndefined();
});
it('revokes a missing checkout beneath an aliased parent and never resurrects it on return',async()=>{
  const f=await fixture(),parent=join(f.dir,'aliased-parent'),child=join(f.root,'child');await mkdir(child);
  await symlink(await realpath(f.root),parent,process.platform==='win32'?'junction':'dir');
  const spelling=join(parent,'child');await f.access.remembered.remember(spelling,await checkoutIdentity(spelling));
  await rename(child,child+'-away');expect(await f.access.remembered.restore(spelling)).toBeUndefined();
  await rename(child+'-away',child);expect(await f.access.remembered.restore(spelling)).toBeUndefined();
  expect(await f.access.remembered.restore(child)).toBeUndefined();
});
it('a fresh explicit approval after retargeting leaves only the latest spelling receipt',async()=>{
  const f=await fixture(),alias=join(f.dir,'alias'),other=join(f.dir,'new-checkout');await mkdir(other);
  await symlink(await realpath(f.root),alias,process.platform==='win32'?'junction':'dir');await f.access.remembered.remember(alias,await checkoutIdentity(alias));
  await rm(alias);await symlink(other,alias,process.platform==='win32'?'junction':'dir');await f.access.remembered.remember(alias,await checkoutIdentity(alias));
  expect(await f.access.remembered.list()).toHaveLength(1);
  await rm(alias);expect(await f.access.remembered.restore(alias)).toBeUndefined();
  await symlink(other,alias,process.platform==='win32'?'junction':'dir');expect(await f.access.remembered.restore(alias)).toBeUndefined();
  expect(await f.access.remembered.list()).toEqual([]);
});
it('never transfers an observed alias to an independently approved checkout after retargeting',async()=>{
  const f=await fixture(),alias=join(f.dir,'alias'),other=join(f.dir,'independently-approved');await mkdir(other);
  await f.access.remembered.remember(f.root,await checkoutIdentity(f.root));await f.access.remembered.remember(other,await checkoutIdentity(other));
  await symlink(await realpath(f.root),alias,process.platform==='win32'?'junction':'dir');expect(await f.access.remembered.restore(alias)).toEqual(await checkoutIdentity(f.root));
  await rm(alias);await symlink(other,alias,process.platform==='win32'?'junction':'dir');
  expect(await f.access.remembered.restore(alias)).toBeUndefined();expect(await f.access.remembered.restore(alias)).toBeUndefined();
  expect(await f.access.remembered.restore(other)).toEqual(await checkoutIdentity(other));
});
it.runIf(process.platform==='win32')('restores a real Windows 8.3 path as the same checkout',async context=>{
  const f=await fixture(),long=join(f.dir,'Long Checkout Name');await mkdir(long);
  // A fixed read-only command, with no interpolated filesystem or prompt text.
  const command=spawnSync('cmd.exe',['/d','/s','/c','for %I in ("Long Checkout Name") do @echo %~fsI'],{cwd:f.dir,encoding:'utf8',windowsHide:true,windowsVerbatimArguments:true});
  expect(command.status).toBe(0);const short=command.stdout.trim();
  if(!short.includes('~')||short.toLowerCase()===long.toLowerCase()){context.skip();return;}
  expect(await realpath(short)).toBe(await realpath(long));
  expect(checkoutGrantKey(short)).toBe(checkoutGrantKey(long));
  await f.access.remembered.remember(short,await checkoutIdentity(short));
  expect(await f.access.remembered.restore(long)).toEqual(await checkoutIdentity(long));
  expect(await f.access.remembered.restore(short)).toEqual(await checkoutIdentity(long));
  await rename(long,long+'-moved');
  expect(await f.access.remembered.restore(long+'-moved')).toBeUndefined();
  expect(await f.access.remembered.restore(short)).toBeUndefined();
  await rename(long+'-moved',long);
  expect(await f.access.remembered.restore(long)).toBeUndefined();
});
it('canonicalises a worktree administration pointer through an aliased ancestor, not a redirected metadata directory',async()=>{
  const f=await fixture();execFileSync('git',['init','--quiet',f.root]);execFileSync('git',['-C',f.root,'-c','user.name=Synthetic','-c','user.email=synthetic@example.invalid','commit','--allow-empty','-qm','Synthetic']);
  const sibling=join(f.dir,'linked'),alias=join(f.dir,'repo-alias');execFileSync('git',['-C',f.root,'worktree','add','--quiet','-b','alias-check',sibling]);
  const original=await checkoutIdentity(sibling);await symlink(await realpath(f.root),alias,process.platform==='win32'?'junction':'dir');
  // Git marks this file hidden on Windows; opening it with 'w' fails there.
  const handle=await open(join(sibling,'.git'),'r+');try{await handle.truncate(0);await handle.writeFile('gitdir: '+join(alias,'.git','worktrees','linked')+'\n');}finally{await handle.close();}
  expect(await checkoutIdentity(sibling)).toEqual(original);
  await f.access.remembered.remember(sibling,original);
  expect(await f.access.remembered.restore(sibling)).toEqual(original);
});
it('approving another session of the same checkout preserves existing temporary readers',async()=>{
  const f=await fixture();await f.access.approve(f.id);
  const journal=join(f.dir,'second.jsonl');await writeFile(journal,JSON.stringify({type:'user',uuid:'second',sessionId:'22222222-2222-4222-8222-222222222222',cwd:f.root,message:{role:'user',content:'Synthetic second connection'}})+'\n');
  const other=(await f.app.ingest.importSource('claude-code',journal)).recordingId;
  await f.access.approve(other);
  expect((await f.access.read(f.id,'file.ts')).text).toContain('export const a');
  expect((await f.access.read(other,'file.ts')).text).toContain('export const a');
  f.access.revoke(other);expect(f.access.status(f.id).approved).toBe(false);
});
it.each(['missing','replaced','redirected'] as const)('never restores a %s root',async mode=>{
  const f=await fixture();await f.access.approve(f.id,true);await rename(f.root,f.root+'-old');
  if(mode==='replaced')await mkdir(f.root);
  if(mode==='redirected')await symlink(f.root+'-old',f.root,process.platform==='win32'?'junction':'dir');
  expect((await new WorkspaceAccess(f.app).restoreStatus(f.id)).approved).toBe(false);
  expect(await f.access.remembered.list()).toEqual([]);
});
it('does not resurrect a missing grant when the original directory returns',async()=>{
  const f=await fixture();await f.access.approve(f.id,true);await rename(f.root,f.root+'-old');
  await new WorkspaceAccess(f.app).restoreStatus(f.id);await rename(f.root+'-old',f.root);
  expect((await new WorkspaceAccess(f.app).restoreStatus(f.id)).approved).toBe(false);
});
it('detects replaced Git identity and leaves sibling worktrees unapproved with prefill only',async()=>{
  const f=await fixture();execFileSync('git',['init','--quiet',f.root]);execFileSync('git',['-C',f.root,'-c','user.name=Synthetic','-c','user.email=synthetic@example.invalid','commit','--allow-empty','-qm','Synthetic']);
  const sibling=join(f.dir,'sibling');execFileSync('git',['-C',f.root,'worktree','add','--quiet','-b','synthetic',sibling]);
  await f.access.approve(f.id,true);
  const other=await checkoutIdentity(sibling);
  expect(await f.access.remembered.sibling(other)).toBe(true);expect(await f.access.remembered.restore(sibling)).toBeUndefined();
  await rename(join(f.root,'.git'),join(f.root,'.git-old'));execFileSync('git',['init','--quiet',f.root]);
  expect((await new WorkspaceAccess(f.app).restoreStatus(f.id)).approved).toBe(false);
});
it('rejects redacted identities and malformed persisted metadata',async()=>{
  const f=await fixture(),secret=join(f.dir,'sk-proj-abcdefghijklmnopqrstuvw0123456789');await mkdir(secret);
  await expect(checkoutIdentity(secret)).rejects.toThrow('Redaction');
  f.app.store.db.prepare('INSERT INTO meta(key,value) VALUES (?,?)').run('checkout-read-grant-v1:'+checkoutGrantKey(f.root),'{"version":1}');
  expect(await f.access.remembered.restore(f.root)).toBeUndefined();expect(await f.access.remembered.list()).toEqual([]);
});
it('revoking during approval prevents the asynchronous approval from saving a grant',async()=>{
  const f=await fixture(),original=f.app.approveGraphRoot.bind(f.app);let entered!:()=>void,release!:()=>void;
  const started=new Promise<void>(r=>entered=r),wait=new Promise<void>(r=>release=r);
  vi.spyOn(f.app,'approveGraphRoot').mockImplementation(async id=>{entered();await wait;return original(id);});
  const pending=f.access.approve(f.id,true);await started;f.access.revoke(f.id);release();
  await expect(pending).rejects.toMatchObject({status:409});expect(await f.access.remembered.list()).toEqual([]);
});
it('revocation invalidates an in-flight read even if the checkout is approved again',async()=>{
  const f=await fixture();await f.access.approve(f.id,true);
  const original=f.access.root.bind(f.access);let entered!:()=>void,release!:()=>void;
  const started=new Promise<void>(r=>entered=r),wait=new Promise<void>(r=>release=r);
  vi.spyOn(f.access,'root').mockImplementationOnce(async id=>{const root=await original(id);entered();await wait;return root;});
  const read=f.access.read(f.id,'file.ts');await started;f.access.revoke(f.id);await f.access.approve(f.id,true);release();
  await expect(read).rejects.toMatchObject({status:403});
});
it('a different worktree administration identity never restores the original grant',async()=>{
  const f=await fixture();execFileSync('git',['init','--quiet',f.root]);execFileSync('git',['-C',f.root,'-c','user.name=Synthetic','-c','user.email=synthetic@example.invalid','commit','--allow-empty','-qm','Synthetic']);
  const sibling=join(f.dir,'sibling');execFileSync('git',['-C',f.root,'worktree','add','--quiet','-b','synthetic',sibling]);
  const identity=await checkoutIdentity(sibling);await f.access.remembered.remember(sibling,identity);
  const metadata=identity.checkout.gitDirectory!.root;await rename(metadata,metadata+'-old');await mkdir(metadata);await writeFile(join(metadata,'commondir'),'../..\n');
  expect(await f.access.remembered.restore(sibling)).toBeUndefined();
});
it('the authenticated API reports setup without submitting and lists/revokes exact grants',async()=>{
  const f=await fixture();const server=await startServer({app:f.app,port:0,uiDir:f.dir,controllerFactory:(app,access)=>{
    // The fixture supplies no CLI so setup is independent of local account state.
    const controller=new HarnessController(app,access,{resolveExecutable:()=>undefined});return controller;
  }});cleanups.push(()=>server.close());
  const headers={authorization:'Bearer '+server.token,'content-type':'application/json'};
  const request=async(path:string,method='GET',body?:unknown)=>fetch(server.url+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  const setup=await (await request(`/v1/recordings/${f.id}/workspace/setup`)).json();
  expect(setup).toMatchObject({approved:false,siblingApproved:false,native:{state:'missing'}});
  expect((await request(`/v1/recordings/${f.id}/workspace/approve`,'POST',{remember:'yes'})).status).toBe(400);
  expect((await request(`/v1/recordings/${f.id}/workspace/approve`,'POST',{remember:true})).status).toBe(200);
  const grants=await (await request('/v1/checkout-grants')).json() as {items:{id:string}[]};expect(grants.items).toHaveLength(1);
  expect((await request('/v1/checkout-grants/'+grants.items[0]!.id,'DELETE')).status).toBe(200);
  expect(((await (await request(`/v1/recordings/${f.id}/workspace`)).json()) as {approved:boolean}).approved).toBe(false);
});
import {HarnessController} from '../src/controller.ts';

it.each(['codex','claude-code'])('checks %s metadata only and never returns account output',async harness=>{
  const f=await fixture();const calls:string[][]=[];
  const launch=((_bin:string,args:string[])=>{
    calls.push(args);
    const output=args.includes('status')?(harness==='codex'?'Logged in using ChatGPT':'{"loggedIn":true,"email":"private@example.invalid"}'):(harness==='codex'?'app-server --listen':'--input-format --output-format --permission-prompt-tool --replay-user-messages');
    return spawn(process.execPath,['-e','process.stdout.write('+JSON.stringify(output)+')'],{stdio:['ignore','pipe','pipe'],windowsHide:true});
  }) as typeof spawn;
  expect(await nativeReadiness(harness,f.dir,{resolveExecutable:()=>process.execPath,launch})).toEqual({available:true,signedIn:true,supported:true,state:'ready'});
  expect(calls).toEqual(harness==='codex'?[['app-server','--help'],['login','status']]:[['--help'],['auth','status','--json']]);
});
for(const harness of ['codex','claude-code'])it.each(['signed-out','unsupported','unavailable'] as const)(`${harness} reports %s without starting a turn`,async state=>{
  const f=await fixture();const output=(args:string[])=>state==='unsupported'?'old CLI':args.includes('status')?harness==='codex'?'Not logged in':'{"loggedIn":false}':harness==='codex'?'app-server --listen':'--input-format --output-format --permission-prompt-tool --replay-user-messages';
  const launch=((_bin:string,args:string[])=>spawn(process.execPath,['-e',state==='unavailable'?'setTimeout(()=>{},1000)':`process.stdout.write(${JSON.stringify(output(args))})`],{stdio:['ignore','pipe','pipe'],windowsHide:true})) as typeof spawn;
  expect((await nativeReadiness(harness,f.dir,{launch,resolveExecutable:()=>process.execPath,timeoutMs:state==='unavailable'?30:2000})).state).toBe(state);
});
