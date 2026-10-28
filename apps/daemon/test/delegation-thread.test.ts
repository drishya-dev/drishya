import {mkdtempSync,mkdirSync,writeFileSync,appendFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {afterAll,beforeAll,expect,it} from 'vitest';
import {App} from '../src/app.ts';
import {startServer,type RunningServer} from '../src/server.ts';
import {asOfProjection} from '@drishya/contracts';
import {delegationThread} from '../src/delegation-thread.ts';

let dir:string,app:App,server:RunningServer,codex:string,claude:string,child:string,parentPath:string;
const parentId='11111111-1111-4111-8111-111111111111',childId='22222222-2222-4222-8222-222222222222';
const t=(n:number)=>new Date(Date.UTC(2026,9,28,10,0,n)).toISOString();
const write=(path:string,rows:unknown[])=>writeFileSync(path,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');
beforeAll(async()=>{
  dir=mkdtempSync(join(tmpdir(),'drishya-thread-'));app=new App(join(dir,'store'));
  parentPath=join(dir,`rollout-2026-10-28T10-00-00-${parentId}.jsonl`);
  const item=(n:number,kind:string)=>({type:'event_msg',timestamp:t(n),payload:{type:'item_completed',item:{type:'SubAgentActivity',id:n===2?'spawn':`activity-${n}`,agent_thread_id:childId,agent_path:'/root/review',kind,model:'synthetic-model',reasoning_effort:'high'}}});
  write(parentPath,[{type:'session_meta',timestamp:t(0),payload:{id:parentId,cwd:dir}},{type:'response_item',timestamp:t(0),payload:{type:'message',role:'user',content:[{type:'input_text',text:'Delegate a review'}]}},{type:'response_item',timestamp:t(1),payload:{type:'function_call',name:'spawn_agent',call_id:'spawn',arguments:JSON.stringify({task_name:'review',message:'Review the captured change'})}},item(2,'spawn'),{type:'response_item',timestamp:t(3),payload:{type:'function_call_output',call_id:'spawn',output:'{"task_name":"review"}'}},item(4,'interacted'),item(5,'completed'),{type:'response_item',timestamp:t(6),payload:{type:'agent_message',author:'/root/review',content:[{type:'output_text',text:'Captured child reply'}]}}]);
  codex=(await app.ingest.importSource('codex',parentPath)).recordingId;
  const childPath=join(dir,`rollout-2026-10-28T10-00-01-${childId}.jsonl`);
  write(childPath,[{type:'session_meta',timestamp:t(2),payload:{id:childId,cwd:dir,parent_thread_id:parentId,agent_path:'/root/review'}},{type:'response_item',timestamp:t(2),payload:{type:'message',role:'user',content:[{type:'input_text',text:'Child task'}]}}]);child=(await app.ingest.importSource('codex',childPath)).recordingId;
  const main=join(dir,'claude-parent.jsonl'),common={sessionId:'claude-parent',cwd:dir};
  write(main,[{...common,type:'user',uuid:'u',timestamp:t(0),message:{role:'user',content:'Delegate a repository review'}},{...common,type:'assistant',uuid:'a',timestamp:t(1),message:{role:'assistant',content:[{type:'tool_use',id:'agent-call',name:'Agent',input:{subagent_type:'Explore',description:'Review repository',prompt:'Read the implementation and return findings.'}}]}},{...common,type:'user',uuid:'r',timestamp:t(40),message:{role:'user',content:[{type:'tool_result',tool_use_id:'agent-call',content:'Captured review returned'}]},toolUseResult:{agentId:'worker',content:[{type:'text',text:'Captured review returned'}]}}]);
  const subdir=join(dir,'claude-parent','subagents');mkdirSync(subdir,{recursive:true});const rows:unknown[]=[];
  for(let n=0;n<30;n++){rows.push({...common,isSidechain:true,agentId:'worker',type:'assistant',uuid:`a${n}`,timestamp:t(n+2),message:{role:'assistant',model:'synthetic-claude',content:[{type:'tool_use',id:`read${n}`,name:'Read',input:{file_path:join(dir,`file${n}.ts`)}}]}});rows.push({...common,isSidechain:true,agentId:'worker',type:'user',uuid:`r${n}`,timestamp:t(n+2),message:{role:'user',content:[{type:'tool_result',tool_use_id:`read${n}`,content:'1: captured source'}]}});}
  write(join(subdir,'agent-worker.jsonl'),rows);claude=(await app.ingest.importSource('claude-code',main)).recordingId;
  server=await startServer({app,port:0,token:'synthetic-delegation-thread'});
});
afterAll(async()=>{await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});}});
const spawn=(id:string)=>app.projection(id).operations.find(op=>op.detail.kind==='spawn')!;
it('joins captured Codex lifecycle, reply and exact imported child recording',async()=>{
  const value=await app.history.delegationThread(codex,spawn(codex).id);
  expect(value?.identity).toBe('captured');expect(value?.child).toMatchObject({recordingId:child,model:'synthetic-model',effort:'high'});
  expect(value?.steps.map(row=>row.kind)).toEqual(['spawn','spawn','interaction','completed','message']);expect(value?.steps.at(-1)?.text).toBe('Captured child reply');
  expect(value?.steps.some(row=>row.kind==='result')).toBe(false);
});
it('paginates every captured Claude child action and preserves its task and returned result',async()=>{
  const op=spawn(claude),first=await app.history.delegationThread(claude,op.id),last=await app.history.delegationThread(claude,op.id,25);
  expect(first?.task?.text).toBe('Read the implementation and return findings.');expect(first?.child?.name).toBe('Review repository');expect(first?.childActions).toBe(30);expect(first?.total).toBe(32);expect(first?.steps).toHaveLength(25);expect(last?.steps).toHaveLength(7);expect(last?.steps.at(-1)?.kind).toBe('result');
  expect(new Set([...first!.steps,...last!.steps].map(row=>row.id)).size).toBe(32);
});
it('does not reveal later child identity, metadata, completion or result before replay observes it',async()=>{
  const p=app.projection(codex),op=spawn(codex),before=await app.history.delegationThread(codex,op.id,0,op.startSequence+1);
  expect(before?.child).toBeUndefined();expect(before?.steps.map(row=>row.kind)).toEqual(['spawn']);
  expect(await app.history.delegationThread(codex,op.id,0,0)).toBeNull();
  const fake=structuredClone(p);fake.links=[];fake.operations.find(other=>other.id===op.id)!.observationIds=[];
  expect(delegationThread(app.store,asOfProjection(fake,op.startSequence+1),op.id,0,op.startSequence+1)).toBeNull();
});
it('removes a forgotten child link without rewriting captured lifecycle',async()=>{
  await app.forget(child);const value=await app.history.delegationThread(codex,spawn(codex).id);
  expect(value?.child?.recordingId).toBeUndefined();expect(value?.steps.some(row=>row.kind==='completed')).toBe(true);
});
it('authenticates and validates bounded thread queries',async()=>{
  const url=`${server.url}/v1/recordings/${claude}/delegation-thread/${encodeURIComponent(spawn(claude).id)}`,headers={authorization:`Bearer ${server.token}`};
  expect((await fetch(url)).status).toBe(401);expect((await fetch(url,{headers})).status).toBe(200);expect((await fetch(url+'?start=1.5',{headers})).status).toBe(400);expect((await fetch(url.replace(encodeURIComponent(spawn(claude).id),'missing'),{headers})).status).toBe(404);
});
it('refreshes lifecycle after a live append while the previous replay boundary stays unchanged',async()=>{
  const op=spawn(codex),boundary=app.projection(codex).timeline.length;
  appendFileSync(parentPath,JSON.stringify({type:'event_msg',timestamp:t(9),payload:{type:'item_completed',item:{type:'SubAgentActivity',id:'late-interaction',agent_thread_id:childId,agent_path:'/root/review',kind:'interacted'}}})+'\n');
  await app.ingest.sync(codex);
  const live=await app.history.delegationThread(codex,op.id),past=await app.history.delegationThread(codex,op.id,0,boundary);
  expect(live?.steps.filter(row=>row.kind==='interaction')).toHaveLength(2);expect(past?.steps.filter(row=>row.kind==='interaction')).toHaveLength(1);
});
it('never joins the projection’s nearest-spawn heuristic as a captured child',async()=>{
  const path=join(dir,'heuristic.jsonl'),common={cwd:dir,sessionId:'heuristic'};
  write(path,[{...common,type:'user',uuid:'u',timestamp:t(0),message:{role:'user',content:'A task'}},{...common,type:'assistant',uuid:'a',timestamp:t(1),message:{role:'assistant',content:[{type:'tool_use',id:'ambiguous-agent',name:'Agent',input:{description:'Review',subagent_type:'Explore',prompt:'Inspect'}}]}},{...common,type:'user',uuid:'r',timestamp:t(4),message:{role:'user',content:[{type:'tool_result',tool_use_id:'ambiguous-agent',content:'Returned without an agent identifier'}]}}]);
  const sub=join(dir,'heuristic','subagents');mkdirSync(sub,{recursive:true});write(join(sub,'agent-unlinked.jsonl'),[{...common,type:'assistant',uuid:'child',agentId:'unlinked',isSidechain:true,timestamp:t(2),message:{role:'assistant',content:'Child evidence'}}]);
  const id=(await app.ingest.importSource('claude-code',path)).recordingId,p=app.projection(id),op=p.operations.find(row=>row.detail.kind==='spawn')!;
  if(op.detail.kind==='spawn')op.detail.childAgentId=`${id}.agent:unlinked`;const value=delegationThread(app.store,p,op.id);expect(value?.identity).toBe('unresolved');expect(value?.child).toBeUndefined();expect(value?.steps.some(row=>row.kind==='message')).toBe(false);
});
it('keeps encrypted native task text out of the thread DTO',async()=>{
  const path=join(dir,'encrypted-task.jsonl'),cipher='gAAAA'+'A'.repeat(100),common={cwd:dir,sessionId:'encrypted-task'};
  write(path,[{...common,type:'user',uuid:'u',timestamp:t(0),message:{role:'user',content:'Review'}},{...common,type:'assistant',uuid:'a',timestamp:t(1),message:{role:'assistant',content:[{type:'tool_use',id:'encrypted-agent',name:'Agent',input:{description:'Review',subagent_type:'Explore',prompt:cipher}}]}}]);
  const id=(await app.ingest.importSource('claude-code',path)).recordingId,value=await app.history.delegationThread(id,spawn(id).id);expect(value?.task).toBeUndefined();expect(JSON.stringify(value)).not.toContain(cipher);
});
it('retains a normal long reply and provides the complete artifact for a truncated reply',async()=>{
  const normal='captured child reply '.repeat(250),large='captured large reply '.repeat(4000);
  for(const [n,text] of [[10,normal],[11,large]] as const)appendFileSync(parentPath,JSON.stringify({type:'response_item',timestamp:t(n),payload:{type:'agent_message',author:'/root/review',content:[{type:'output_text',text}]}})+'\n');
  await app.ingest.sync(codex);
  const direct=delegationThread(app.store,app.projection(codex),spawn(codex).id)!;
  expect(direct.steps.find(row=>row.text===normal)?.truncated).toBe(false);
  const value=await app.history.delegationThread(codex,spawn(codex).id),message=value?.steps.findLast(row=>row.kind==='message');
  expect(message?.truncated).toBe(true);expect(message?.artifactId).toBeTruthy();const full=await app.history.artifact(codex,message!.artifactId!,0,100);expect(full.text).toBe(large);
});
it('keeps a long captured task reachable as bounded exact character pages',async()=>{
  const path=join(dir,'long-task.jsonl'),task='Recorded 🚀 task content.\n'.repeat(2000),common={cwd:dir,sessionId:'long-task'};
  write(path,[{...common,type:'user',uuid:'u',timestamp:t(0),message:{role:'user',content:'Review'}},{...common,type:'assistant',uuid:'a',timestamp:t(1),message:{role:'assistant',content:[{type:'tool_use',id:'long-agent',name:'Agent',input:{description:'Review',subagent_type:'Explore',prompt:task}}]}}]);
  const id=(await app.ingest.importSource('claude-code',path)).recordingId,op=spawn(id);let joined='';
  for(let start=0;start<task.length;){const value=await app.history.delegationThread(id,op.id,0,undefined,start);expect(value?.task?.text.length).toBeLessThanOrEqual(16000);joined+=value?.task?.text;start=value!.task!.start+value!.task!.text.length;}
  expect(joined).toBe(task);
});
