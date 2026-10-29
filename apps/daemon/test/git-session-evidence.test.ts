import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {afterAll,beforeAll,expect,it} from 'vitest';
import {App} from '../src/app.ts';
import {startServer,type RunningServer} from '../src/server.ts';
import {explicitCommitPaths,gitSessionEvidence,commandAtWorkspace} from '../src/git-session-evidence.ts';
import {gitSessionContext} from '../src/git-session-context.ts';
import {HttpError} from '../src/app.ts';
import type {Observation,Operation} from '@drishya/contracts';

let dir:string,root:string,app:App,server:RunningServer,tip:string;
const ids:string[]=[];
const before='export const capturedValue = "before";\n',after='export const capturedValue = "after";\n';
const workingBefore='export const uncommittedValue = "before";\n',workingAfter='export const uncommittedValue = "after";\n';
const time=(n:number)=>`2026-10-28T10:00:0${n}Z`;
beforeAll(async()=>{
  dir=mkdtempSync(join(tmpdir(),'drishya-git-session-evidence-'));root=join(dir,'repo');mkdirSync(root);
  const git=(...args:string[])=>execFileSync('git',args,{cwd:root,windowsHide:true,encoding:'utf8',env:{...process.env,GIT_AUTHOR_DATE:time(2),GIT_COMMITTER_DATE:time(2)}}).trim();
  git('init','-b','main');git('config','user.name','Synthetic');git('config','user.email','synthetic@example.invalid');git('config','core.autocrlf','false');
  writeFileSync(join(root,'committed.ts'),before);writeFileSync(join(root,'working.ts'),workingBefore);writeFileSync(join(root,'manual.ts'),before);git('add','.');git('commit','-m','Base');
  writeFileSync(join(root,'committed.ts'),after);git('commit','-m','Captured commit','--','committed.ts');tip=git('rev-parse','HEAD');
  writeFileSync(join(root,'working.ts'),workingAfter);writeFileSync(join(root,'manual.ts'),after);
  app=new App(join(dir,'store'));
  for(const harness of ['codex','claude-code'] as const){
    const calls=[{id:'edit-working',tool:'Edit',input:{file_path:join(root,'working.ts'),old_string:workingBefore.trimEnd(),new_string:workingAfter.trimEnd()},output:'The file has been updated.',at:0},
      {id:'commit',tool:harness==='codex'?'exec_command':'Bash',input:harness==='codex'?{cmd:'git commit -m "Captured commit" -- committed.ts',workdir:root}:{command:'git commit -m "Captured commit" -- committed.ts'},output:'Commit completed. Process exited with code 0',at:1}];
    const rows:unknown[]=harness==='codex'?[{type:'session_meta',timestamp:time(0),payload:{id:'git-session-codex',cwd:root}},{type:'response_item',timestamp:time(0),payload:{type:'message',role:'user',content:[{type:'input_text',text:'Commit the captured change'}]}}]:[{type:'user',uuid:'prompt',sessionId:'git-session-claude',cwd:root,timestamp:time(0),message:{role:'user',content:'Commit the captured change'}}];
    for(const call of calls)if(harness==='codex'){
      rows.push({type:'response_item',timestamp:time(call.at),payload:{type:'function_call',call_id:call.id,name:call.id==='edit-working'?'apply_patch':call.tool,arguments:call.id==='edit-working'?JSON.stringify({input:`*** Begin Patch\n*** Update File: ${join(root,'working.ts')}\n@@\n-${workingBefore.trimEnd()}\n+${workingAfter.trimEnd()}\n*** End Patch`}):JSON.stringify(call.input)}});
      rows.push({type:'response_item',timestamp:time(call.at===1?3:0),payload:{type:'function_call_output',call_id:call.id,output:call.id==='commit'?JSON.stringify({output:call.output,metadata:{exit_code:0}}):call.output}});
    }else{
      rows.push({type:'assistant',uuid:`a-${call.id}`,cwd:root,sessionId:'git-session-claude',timestamp:time(call.at),message:{role:'assistant',content:[{type:'tool_use',id:call.id,name:call.tool,input:call.input}]}});
      rows.push({type:'user',uuid:`r-${call.id}`,cwd:root,sessionId:'git-session-claude',timestamp:time(call.at===1?3:0),message:{role:'user',content:[{type:'tool_result',tool_use_id:call.id,content:call.output}]},...(call.id==='commit'?{toolUseResult:{stdout:call.output,stderr:'',interrupted:false}}:{})});
    }
    const path=join(dir,`${harness}.jsonl`);writeFileSync(path,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');ids.push((await app.ingest.importSource(harness,path)).recordingId);
  }
  server=await startServer({app,port:0,token:'synthetic-session-evidence'});
});
afterAll(async()=>{await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temp path');rmSync(dir,{recursive:true,force:true});}});
it('accepts only an explicit literal commit path set',()=>{
  expect(explicitCommitPaths('git commit -m "Exact paths" -- "src/a file.ts" b.ts')).toEqual(['b.ts','src/a file.ts']);
  for(const cmd of ['git commit -am all','git commit -m x -- *.ts','git -C other commit -- a.ts','echo "git commit -- a.ts"','git commit -- a.ts; git status','git commit --amend -- a.ts','git commit -- ../a.ts','git commit -- $FILE'])expect(explicitCommitPaths(cmd)).toBeUndefined();
});
it('uses a standalone native command directory and captured elapsed interval without inventing a start event',()=>{
  const p=app.projection(ids[0]!),call=p.operations.find(op=>op.detail.kind==='shell'&&explicitCommitPaths(op.detail.command))!;
  const native:Operation={...call,tool:'CommandExecution',startTime:undefined,endTime:time(3),durationMs:2000,observationIds:['native-command']};
  const observation={kind:'item.completed',payload:{item:'command',cwd:root}} as Observation;
  const query={commits:[{hash:tip,committedAt:time(2),paths:['committed.ts']}],working:[]};
  const check=(op= native,obs=observation)=>gitSessionEvidence({...p,operations:[op]},query,()=>commandAtWorkspace([obs],root));
  expect(check().links[tip]?.basis).toBe('commit-time-paths');
  expect(native.startTime).toBeUndefined();
  for(const durationMs of [undefined,NaN,-1])expect(check({...native,durationMs}).links).toEqual({});
  expect(check(native,{...observation,payload:{item:'command',cwd:join(root,'other')}}).links).toEqual({});
  expect(commandAtWorkspace([{kind:'tool.call',workspaceRoot:root,payload:{input:{raw:'opaque wrapper'}}} as Observation,{...observation,payload:{item:'command',cwd:join(root,'other')}}],root)).toBe(false);
});
it('joins exact commit and uncommitted patch evidence for both harnesses over HTTP',async()=>{
  for(const id of ids){
    const headers={authorization:`Bearer ${server.token}`,'content-type':'application/json'},url=`${server.url}/v1/recordings/${id}`;
    for(const route of ['workspace/approve','git/approve'])expect((await fetch(`${url}/${route}`,{method:'POST',headers,body:'{}'})).status).toBe(200);
    const response=await fetch(`${url}/git/history`,{headers});expect(response.status).toBe(200);
    const result=await response.json() as any;
    expect(result.sessionLinks[tip],id).toMatchObject({basis:'commit-time-paths',turn:1});
    expect(result.workingTree.files.map((file:any)=>file.path)).toEqual(['working.ts']);
    expect(result.workingTree.files[0].links[0]).toMatchObject({basis:'working-patch',turn:1});
  }
},20_000);
it('rejects failed commands, wrong path/time/root and ambiguous associations',()=>{
  const projection=app.projection(ids[1]!);const commit=projection.operations.find(op=>op.detail.kind==='shell')!;
  const q={commits:[{hash:tip,committedAt:time(2),paths:['committed.ts']}],working:[]};
  expect(gitSessionEvidence(projection,q).links).toEqual({});
  expect(gitSessionEvidence(projection,{...q,commits:[{...q.commits[0]!,paths:['other.ts']}]},()=>true).links).toEqual({});
  expect(gitSessionEvidence(projection,{...q,commits:[{...q.commits[0]!,committedAt:time(8)}]},()=>true).links).toEqual({});
  expect(gitSessionEvidence(projection,{...q,commits:[q.commits[0]!,{...q.commits[0]!,hash:'f'.repeat(40)}]},()=>true).links).toEqual({});
  const raw=commit.observationIds.map(id=>app.store.observationById(ids[1]!,id)!).filter(Boolean);
  expect(commandAtWorkspace(raw,root)).toBe(true);expect(commandAtWorkspace(raw,join(root,'other'))).toBe(false);
  const failed=structuredClone(projection);failed.operations.find(op=>op.id===commit.id)!.status='error';
  expect(gitSessionEvidence(failed,q,()=>true).links).toEqual({});
});
it('omits oversized patches and rename source tokens without breaking history',async()=>{
  const calls:string[][]=[];
  const sample=await gitSessionContext(async args=>{
    calls.push(args);
    if(args[0]==='status')return 'R  new.ts\0old.ts\0 M huge.ts\0';
    if(args[0]==='diff')throw new HttpError(413,'bounded output');
    return '';
  },[]);
  expect(sample.query.working).toEqual([]);expect(sample.omitted).toBe(2);
  expect(calls.filter(args=>args[0]==='diff').map(args=>args.at(-1))).toEqual(['huge.ts']);
});
it('compares new files only through the approved bounded workspace reader',async()=>{
  let reads=0;
  const sample=await gitSessionContext(async args=>args[0]==='status'?'?? new.ts\0':'',[],true,async path=>{expect(path).toBe('new.ts');reads++;return {text:'export const newValue = true;\n',hasMore:false,redacted:false};});
  expect(reads).toBe(2);expect(sample.query.working).toEqual([{path:'new.ts',created:true,patch:'@@ -0,0 +1,1 @@\n+export const newValue = true;\n'}]);
  const absent=await gitSessionContext(async args=>args[0]==='status'?'?? new.ts\0':'',[]);
  expect(absent.query.working).toEqual([]);expect(absent.omitted).toBe(1);
});
it('older pages do not read working files and contextual work is bounded',async()=>{
  const older=await gitSessionContext(async()=>{throw new Error('No working read expected');},[],false);expect(older.query.working).toEqual([]);
  let diffs=0;
  const sample=await gitSessionContext(async args=>{if(args[0]==='status')return Array.from({length:50},(_,n)=>` M file-${n}.ts\0`).join('');diffs++;return '@@ -1 +1 @@\n-before value\n+after value\n';},[]);
  expect(sample.query.working).toHaveLength(12);expect(diffs).toBe(24);expect(sample.omitted).toBe(38);
});
