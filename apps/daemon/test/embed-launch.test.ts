import {mkdtemp, readdir, readFile, rm, lstat, mkdir, symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {PassThrough} from 'node:stream';
import {expect,it} from 'vitest';
import {App} from '../src/app.ts';
import {selection,openEmbed} from '../src/embed-launch.ts';
import {EmbedCodes} from '../src/embed-auth.ts';
import {embedSupervisor,jsonLines} from '../src/embed-runtime.ts';
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
it('newline transport rejects oversized, malformed and partial data without echoing',()=>{
 for(const value of ['x'.repeat(65),'not json\n','{"half":']) {
  const input=new PassThrough();let failed=false;jsonLines(input,64,()=>{},()=>{failed=true;});input.end(value);if(value.endsWith('\n')||value.length>64) expect(failed).toBe(true);
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
