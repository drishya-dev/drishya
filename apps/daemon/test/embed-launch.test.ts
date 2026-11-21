import {mkdtemp, readdir, readFile, rm, lstat, mkdir, symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {PassThrough} from 'node:stream';
import {expect,it} from 'vitest';
import {App} from '../src/app.ts';
import {selection,openEmbed,nativeIdMatches,embedFailure,EmbedError} from '../src/embed-launch.ts';
import {EmbedCodes} from '../src/embed-auth.ts';
import {embedSupervisor,jsonLines,discoveryEntry,privateDacl,otherSids} from '../src/embed-runtime.ts';
import {execFileSync} from 'node:child_process';
const entry=fileURLToPath(new URL('../src/cli.ts',import.meta.url));
const fixture=fileURLToPath(new URL('../../../fixtures/synthetic/claude/checkout-fix.jsonl',import.meta.url));
it('selector is strict; no arbitrary paths or shell arguments',()=>{
 for(const v of [{},{latest:false},{sessionId:'../journal'},{sessionId:'rec_00000000',latest:true},{latest:true,cwd:'relative'},{latest:true,command:'node'}]) expect(()=>selection(v)).toThrow();
 expect(selection({latest:true})).toEqual({latest:true});
});
it('iframe declarations fail before storage or child startup',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'drishya-embed-refused-'));
 try {
  for(const origin of ['https://host.invalid','*','null','file://','broken','https://one.invalid https://two.invalid']) {
   const r=spawnSync(process.execPath,[entry,'embed','--frame-ancestor',origin],{env:{...process.env,DRISHYA_HOME:join(dir,'absent')},encoding:'utf8',windowsHide:true});
   expect(r.status).toBe(1);expect(JSON.parse(r.stdout).error.code).toBe('IFRAME_UNSUPPORTED');
  }
  expect(await readdir(dir)).toEqual([]);
 }finally{await rm(dir,{recursive:true,force:true});}
});
it('inherited worker opens/reuses only its own instance with credential-free private discovery',async()=>{
 const home=await mkdtemp(join(tmpdir(),'drishya-embed-worker-'));
 let supervisor:ReturnType<typeof embedSupervisor>|undefined;
 try {
  const app=new App(home);const imported=await app.ingest.importSource('claude-code',fixture);await app.close();
  supervisor=embedSupervisor(entry,{...process.env,DRISHYA_HOME:home});
  const a=await supervisor.open({sessionId:imported.recordingId});const b=await supervisor.open({sessionId:imported.recordingId});
  expect(a.port===b.port&&a.port!==7878&&a.port!==5180&&a.url!==b.url).toBe(true);
  const u=new URL(a.url);const code=new URLSearchParams(u.hash.slice(1)).get('launch')!;
  const r=await fetch(u.origin+'/v1/embed/session',{method:'POST',headers:{'content-type':'application/json',origin:u.origin},body:JSON.stringify({code,recordingId:a.recordingId})});
  expect(r.status).toBe(200);const cookie=r.headers.get('set-cookie')!.split(';')[0]!;
  expect((await fetch(u.origin+'/v1/config',{headers:{cookie}})).status).toBe(200);
  const directory=join(home,'embed-discovery');const names=await readdir(directory);expect(names.length).toBe(1);
  const raw=await readFile(join(directory,names[0]!),'utf8');const meta=JSON.parse(raw);
  expect(Object.keys(meta).sort()).toEqual(['instanceId','pid','port','version']);expect(!raw.includes(code)&&!raw.includes('token')).toBe(true);
  if(process.platform!=='win32') {expect((await lstat(directory)).mode&0o777).toBe(0o700);expect((await lstat(join(directory,names[0]!))).mode&0o777).toBe(0o600);}
  await supervisor.close();supervisor=undefined;expect(await readdir(directory)).toEqual([]);
 }finally{await supervisor?.close();await rm(home,{recursive:true,force:true});}
},30_000);
it('newline transport rejects oversized, malformed and partial data without echoing',async()=>{
 for(const value of ['x'.repeat(65),'not json\n','{"half":']) {
  const input=new PassThrough();let failed=false;jsonLines(input,64,()=>{},()=>{failed=true;});input.end(value);await new Promise(resolve=>setImmediate(resolve));expect(failed).toBe(true);
 }
});

it('latest restricts canonical checkout and never falls through to a sibling',async()=>{
 const home=await mkdtemp(join(tmpdir(),'drishya-embed-selection-'));
 try{
  const root=join(home,'root'),other=join(home,'sibling'),alias=join(home,'alias');await mkdir(root);await mkdir(other);await symlink(root,alias,process.platform==='win32'?'junction':'dir');
  let imports=0;const selected:string[]=[];const id='rec_0123456789abcdef';
  const app={store:{getRecording:(key:string)=>key===id?{id,workspaceRoot:root}:undefined},ingest:{
   discover:async()=>[{adapterId:'codex',harness:'codex',path:'sibling',cwd:other,modifiedAt:'2026-11-14T20:00:00Z'},
    {adapterId:'claude-code',harness:'claude-code',path:'matching',cwd:root,modifiedAt:'2026-11-14T19:00:00Z'}],
   importSource:async(_adapter:string,path:string)=>{imports++;selected.push(path);return{recordingId:id};},startLive:()=>{},
  }} as unknown as App;
  const codes=new EmbedCodes();await openEmbed(app,'http://127.0.0.1:42000',codes,{latest:true,cwd:alias});expect(selected).toEqual(['matching']);
  await expect(openEmbed(app,'http://127.0.0.1:42000',codes,{sessionId:id,cwd:other})).rejects.toMatchObject({code:'CHECKOUT_MISMATCH'});
  await expect(openEmbed(app,'http://127.0.0.1:42000',codes,{sessionId:'rec_0000000000000000'})).rejects.toMatchObject({code:'SESSION_NOT_FOUND'});
  const empty={...app,ingest:{...app.ingest,discover:async()=>[]}} as unknown as App;
  await expect(openEmbed(empty,'http://127.0.0.1:42000',codes,{latest:true,cwd:root})).rejects.toMatchObject({code:'NO_SESSION'});expect(imports).toBe(1);
 }finally{await rm(home,{recursive:true,force:true});}
});

it('an already-exited worker closes without waiting for another exit event',async()=>{
 const supervisor=embedSupervisor(join(tmpdir(),'drishya-no-such-cli.mjs'));
 await expect(supervisor.open({sessionId:'rec_0000000000000000'})).rejects.toMatchObject({code:'EMBED_UNAVAILABLE'});
 await supervisor.close();
});

it('the harness session ID selects that exact journal, and nothing path-shaped is accepted',async()=>{
 const uuid='0123abcd-1111-4222-8333-444455556666';
 expect(nativeIdMatches({path:join('p',uuid+'.jsonl')},uuid)).toBe(true);
 expect(nativeIdMatches({path:join('s','rollout-2026-11-18T10-00-00-'+uuid+'.jsonl')},uuid)).toBe(true);
 expect(nativeIdMatches({path:'x.jsonl',sessionId:uuid},uuid)).toBe(true);
 expect(nativeIdMatches({path:join('p','other-'+uuid+'-x.jsonl')},uuid)).toBe(false);
 expect(nativeIdMatches({path:join('p','9'+uuid+'.jsonl')},uuid)).toBe(false);
 for(const v of [{nativeSessionId:'../x/../../y'},{nativeSessionId:'short'},{nativeSessionId:uuid,latest:true},{nativeSessionId:uuid,sessionId:'rec_0123456789abcdef'}]) expect(()=>selection(v)).toThrow();
 const id='rec_00000000000000aa';let imported='';
 const app={store:{getRecording:(key:string)=>key===id?{id,workspaceRoot:tmpdir()}:undefined},ingest:{
  discover:async()=>[{adapterId:'codex',harness:'codex',path:join('s','rollout-new-ffff0000-1111-4222-8333-444455556666.jsonl'),modifiedAt:'2026-11-18T12:00:00Z'},
   {adapterId:'codex',harness:'codex',path:join('s','rollout-old-'+uuid+'.jsonl'),modifiedAt:'2026-11-18T09:00:00Z'}],
  importSource:async(_a:string,path:string)=>{imported=path;return{recordingId:id};},startLive:()=>{},
 }} as unknown as App;
 await openEmbed(app,'http://127.0.0.1:42000',new EmbedCodes(),{nativeSessionId:uuid});
 expect(imported.endsWith(uuid+'.jsonl')).toBe(true);
 await expect(openEmbed(app,'http://127.0.0.1:42000',new EmbedCodes(),{nativeSessionId:'99999999-1111-4222-8333-444455556666'})).rejects.toMatchObject({code:'SESSION_NOT_FOUND'});
});

it('a released detached worker keeps serving its pane, then stops by itself and removes its discovery entry',async()=>{
 const home=await mkdtemp(join(tmpdir(),'drishya-embed-detached-'));let supervisor:ReturnType<typeof embedSupervisor>|undefined;
 try {
  const app=new App(home);const imported=await app.ingest.importSource('claude-code',fixture);await app.close();
  supervisor=embedSupervisor(entry,{...process.env,DRISHYA_HOME:home,DRISHYA_EMBED_IDLE_MS:'1500'},{detached:true});
  const launched=await supervisor.open({sessionId:imported.recordingId});const pid=supervisor.pid!;
  supervisor.release();supervisor=undefined;
  const u=new URL(launched.url);const code=new URLSearchParams(u.hash.slice(1)).get('launch')!;
  // The launcher is gone from the channel; the code it handed out still signs in exactly once.
  const r=await fetch(u.origin+'/v1/embed/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code,recordingId:launched.recordingId})});
  expect(r.status).toBe(200);
  const alive=()=>{try{process.kill(pid,0);return true;}catch{return false;}};
  const deadline=Date.now()+20_000;while(alive()&&Date.now()<deadline) await new Promise(resolve=>setTimeout(resolve,200));
  expect(alive()).toBe(false);
  expect(await readdir(join(home,'embed-discovery'))).toEqual([]);
 }finally{await supervisor?.close();await rm(home,{recursive:true,force:true});} // a failed open must not leave the worker holding the store
},40_000);

it('the SDDL check accepts only a protected DACL of this user\'s allow entries, and names every other account',()=>{
 const me='S-1-5-21-1-2-3-1001';
 expect(privateDacl(`x\r\nD:PAI(A;;FA;;;${me})(A;OICI;FA;;;${me})\r\n`,me)).toBeUndefined();
 expect(privateDacl(`D:AI(A;OICI;FA;;;${me})`,me)).toBe('verify: inheritance not removed');
 expect(privateDacl(`D:PAI(A;OICI;FA;;;${me})(A;OICI;FA;;;SY)(A;OICI;FA;;;BA)`,me)).toBe('verify: 3 entries not only this user');
 expect(privateDacl(`D:PAI(D;;FA;;;${me})`,me)).toBe('verify: 1 entries not only this user');
 expect(privateDacl('D:PAI',me)).toBe('verify: 0 entries not only this user');
 expect(privateDacl('O:BA',me)).toBe('verify: no DACL');
 // A runner's default DACL: SYSTEM, Administrators and the user, as explicit entries.
 expect(otherSids(`D:PAI(A;OICI;FA;;;${me})(A;;FA;;;SY)(A;;FA;;;BA)(A;;FA;;;S-1-5-21-9-9-9-500)`,me)).toEqual(['S-1-5-18','S-1-5-32-544','S-1-5-21-9-9-9-500']);
 expect(otherSids(`D:PAI(A;;FA;;;ZZ)`,me)).toEqual(['ZZ']); // unknown alias: the caller refuses it
 expect(privateDacl(`D:PAI(A;;FA;;;ZZ)`,me)).toBe('verify: unknown account alias ZZ');
 // Running as the built-in Administrator (a hosted runner), SDDL writes this very user as LA.
 const admin='S-1-5-21-1-2-3-500';
 expect(privateDacl(`D:PAI(A;OICI;FA;;;LA)`,admin)).toBeUndefined();
 expect(otherSids(`D:PAI(A;OICI;FA;;;LA)(A;;FA;;;SY)(A;;FA;;;BA)`,admin)).toEqual(['S-1-5-18','S-1-5-32-544']);
 // For any other user, LA is another account and is removed.
 expect(otherSids(`D:PAI(A;OICI;FA;;;${me})(A;;FA;;;LA)`,me)).toEqual(['S-1-5-21-1-2-3-500']);
 expect(privateDacl(`D:PAI(A;OICI;FA;;;${me})(A;;FA;;;LA)`,me)).toBe('verify: 2 entries not only this user');
});

it.runIf(process.platform==='win32')('Windows discovery is this user only, even where the folder starts with explicit foreign entries',async()=>{
 const home=await mkdtemp(join(tmpdir(),'drishya-embed-acl-'));
 const icacls=join(process.env.SystemRoot??'C:/Windows','System32','icacls.exe');
 const sddl=async(dir:string)=>{const out=join(home,'acl.out');execFileSync(icacls,[dir,'/save',out,'/q'],{windowsHide:true});const text=(await readFile(out)).toString('utf16le');await rm(out);return text;};
 try {
  const dir=join(home,'embed-discovery');
  await mkdir(dir);
  // Explicit entries for Everyone and SYSTEM, like a token's default DACL on a hosted runner.
  execFileSync(icacls,[dir,'/grant','*S-1-1-0:(R)','*S-1-5-18:(F)','/q'],{windowsHide:true});
  // An orphaned account SID: icacls /remove tries name resolution and returns 1332.
  const orphan='S-1-5-21-1-2-3-12345';
  const seed=`$ProgressPreference='SilentlyContinue'; $d=$env:DRISHYA_TEST_ACL_DIRECTORY; $a=[System.IO.Directory]::GetAccessControl($d); $s=New-Object System.Security.Principal.SecurityIdentifier('${orphan}'); $r=New-Object System.Security.AccessControl.FileSystemAccessRule($s,'Read','Allow'); $a.AddAccessRule($r); [System.IO.Directory]::SetAccessControl($d,$a)`;
  execFileSync(join(process.env.SystemRoot??'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(seed,'utf16le').toString('base64')],{windowsHide:true,env:{...process.env,DRISHYA_TEST_ACL_DIRECTORY:dir}});
  expect((await sddl(dir)).includes(orphan)).toBe(true);
  const done=await discoveryEntry(home,1);
  expect((await readdir(dir)).length).toBe(1);
  const me=/"(S-1-[0-9-]+)"\s*$/.exec(execFileSync(join(process.env.SystemRoot??'C:/Windows','System32','whoami.exe'),['/user','/fo','csv','/nh'],{encoding:'utf8',windowsHide:true}).trim())![1]!;
  expect(privateDacl(await sddl(dir),me)).toBeUndefined();
  await done();expect(await readdir(dir)).toEqual([]);
 }finally{await rm(home,{recursive:true,force:true});}
});

it('a failed step travels as a printable detail, never as arbitrary text',()=>{
 const failure=embedFailure(new EmbedError('DISCOVERY_UNSAFE','icacls grant: exit 5'));
 expect(failure).toMatchObject({code:'DISCOVERY_UNSAFE',detail:'icacls grant: exit 5'});
 expect(embedFailure(new EmbedError('DISCOVERY_UNSAFE','C:\\Users\\someone\\secret path')).detail).toBeUndefined();
});
