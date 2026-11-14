import {basename,dirname,normalize} from 'node:path';
import type {Agent,Observation,Operation,Projection} from '@drishya/contracts';
import {asOfProjection} from '@drishya/contracts';
import type {Store} from '@drishya/store';

import type {DelegationThread,DelegationStep} from './delegation-types.ts';
import {childMessageLabel,unavailableChildMessages} from './delegation-messages.ts';

const object=(value:unknown):Record<string,any>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,any>:{};
const canonical=(path:string)=>{const value=normalize(path).replace(/\\/g,'/');return /^[A-Za-z]:\//.test(value)?value.toLowerCase():value;};
const acknowledgement=(text:string|undefined)=>{try{const keys=Object.keys(JSON.parse(text??'null'));return keys.length>0&&keys.every(key=>['task_name','agent_id','nickname','agent_nickname'].includes(key))&&keys.some(key=>key==='task_name'||key==='agent_id');}catch{return false;}};
const uuid=/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/i;
const ordering=new WeakMap<Projection,Map<number,number>>();
function captureOrder(store:Store,p:Projection):Map<number,number> {
  let ranks=ordering.get(p);if(ranks)return ranks;
  if(store.getRecording(p.recordingId)?.harness==='antigravity'){
    const rows=store.db.prepare(`SELECT seq FROM observations WHERE recording_id=? ORDER BY
      CASE WHEN json_extract(body,'$.source.recordId') LIKE '%:metadata' THEN -1 ELSE
        CAST(substr(json_extract(body,'$.source.recordId'),instr(json_extract(body,'$.source.recordId'),':')+1) AS INTEGER) END,seq`).all(p.recordingId) as {seq:number}[];
    ranks=new Map(rows.map((row,n)=>[row.seq,n]));ordering.set(p,ranks);return ranks;
  }
  // Same source-clock carry-forward order as Store.orderedObservations, but metadata only.
  // Companion files append after the parent journal; ingest sequence is not replay position.
  const rows=store.db.prepare(`WITH timed AS (
    SELECT seq, MAX(CASE WHEN clock_time IS NOT NULL THEN seq END) OVER (
      PARTITION BY recording_id,json_extract(body,'$.source.sourceId') ORDER BY seq
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) clock_seq
    FROM observations WHERE recording_id=?
  ) SELECT timed.seq FROM timed LEFT JOIN observations clock
    ON clock.recording_id=? AND clock.seq=timed.clock_seq
    ORDER BY COALESCE(clock.clock_time,''),timed.seq`).all(p.recordingId,p.recordingId) as {seq:number}[];
  ranks=new Map(rows.map((row,n)=>[row.seq,n]));ordering.set(p,ranks);return ranks;
}

/** Imported sources only. File names are native identities, never a timing/name-similarity join. */
function childRecording(store:Store,id:string,threadId:string|undefined,childNative:string,root:string|undefined,sourcePath:string|undefined):string|undefined {
  if(store.getRecording(id)?.harness==='antigravity'&&sourcePath&&/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(childNative)){
    const parent=basename(dirname(dirname(dirname(sourcePath))));
    const rows=store.db.prepare(`SELECT DISTINCT recording_id id FROM observations WHERE kind='session.meta'
      AND json_extract(body,'$.source.adapterId')='antigravity' AND json_extract(body,'$.source.recordId')=?
      AND json_extract(body,'$.payload.parentThreadId')=? LIMIT 2`).all(`${childNative}:metadata`,parent) as {id:string}[];
    if(rows.length===1&&rows[0]!.id!==id&&store.getRecording(rows[0]!.id)?.harness==='antigravity')return rows[0]!.id;
    return;
  }
  if(!root||!sourcePath)return;
  const parent=basename(sourcePath).match(uuid)?.[0];
  if(threadId&&uuid.test(threadId)){
    const candidates=store.db.prepare('SELECT id,source_path path,workspace_root root FROM recordings WHERE source_path LIKE ? LIMIT 21').all(`%${threadId}.jsonl`) as {id:string;path:string;root:string|null}[];
    const matches=candidates.filter(row=>row.id!==id&&row.root&&canonical(row.root)===canonical(root)&&basename(row.path).endsWith(`-${threadId}.jsonl`)).filter(row=>{
      const headers=store.observationsOfKinds(row.id,['session.meta']);
      return parent&&headers.some(o=>object(o.payload).parentThreadId===parent);
    });
    if(matches.length===1)return matches[0]!.id;
  }
  // Claude companions belong to this parent's exact source directory, not any agent with a similar name.
  if(!/^[A-Za-z0-9_-]+$/.test(childNative))return;
  const path=normalize(`${dirname(sourcePath)}/${basename(sourcePath,'.jsonl')}/subagents/agent-${childNative}.jsonl`);
  const own=store.findSourceByPath(path);
  if(own&&own.recordingId!==id){const rec=store.getRecording(own.recordingId);if(rec?.workspaceRoot&&canonical(rec.workspaceRoot)===canonical(root))return own.recordingId;}
  return undefined;
}

/** A bounded read-model over sealed capture; no event-schema or reducer changes. */
export function delegationThread(store:Store,p:Projection,operationId:string,start=0,step?:number,taskStart=0):DelegationThread|null {
  const visible=step===undefined?p:asOfProjection(p,step),ranks=captureOrder(store,p),rank=(sequence:number)=>ranks.get(sequence)??Number.MAX_SAFE_INTEGER;
  const op=visible.operations.find(value=>value.id===operationId&&value.detail.kind==='spawn');if(!op||op.detail.kind!=='spawn')return null;
  const cutoff=step===undefined?Number.MAX_SAFE_INTEGER:step===0?-1:rank(p.timeline[Math.max(0,Math.min(step,p.timeline.length)-1)]?.sequence??-1);
  const call=op.observationIds.map(id=>store.observationById(p.recordingId,id)).find(o=>o?.kind==='tool.call');
  if(!call||rank(call.receivedSequence)>cutoff)return null;
  const receipts=call.operationId?store.operationObservations(p.recordingId,call.operationId).filter(o=>o.source.sourceId===call.source.sourceId&&o.source.generation===call.source.generation&&rank(o.receivedSequence)<=cutoff):[call];
  const spawnedReceipts=receipts.filter(o=>o.kind==='agent.spawn'&&['source-id','captured-reference'].includes(object(o.payload).basis));
  const multiple=call.source.adapterId==='antigravity'&&new Set(spawnedReceipts.map(o=>object(o.payload).childAgentId)).size>1;
  const spawned=multiple?undefined:spawnedReceipts[0];
  const exactLinks=p.links.filter(link=>link.from===op.id&&link.relation==='explicit-reference'&&link.basis==='source-id');
  const referenced=exactLinks.flatMap(link=>link.sourceObservationIds??[]).map(id=>store.observationById(p.recordingId,id)).filter((o):o is Observation=>!!o&&rank(o.receivedSequence)<=cutoff&&o.source.sourceId===call.source.sourceId&&o.source.generation===call.source.generation);
  const direct=referenced.find(o=>o.kind==='item.completed'&&object(o.payload).item==='subagent');
  const native=spawned?String(object(spawned.payload).childAgentId):direct?`agent:${object(object(direct.payload).agent).path?.split('/').at(-1)??object(object(direct.payload).agent).threadId}`:undefined;
  const childId=native?`${p.recordingId}.${native}`:undefined,agent=p.agents.find(a=>a.id===childId);
  const address=agent?.address,thread=object(object(direct?.payload).agent).threadId as string|undefined;
  // Only thin native metadata enters this read-model, never the whole parent transcript.
  const activities=childId?store.db.prepare(`SELECT id,seq sequence,source_time time,json_extract(body,'$.payload.agent') agent FROM observations WHERE recording_id=? AND kind='item.completed' AND json_extract(body,'$.payload.item')='subagent' AND seq>=? AND json_extract(body,'$.source.sourceId')=? AND json_extract(body,'$.source.generation')=? AND (json_extract(body,'$.payload.agent.path')=? OR json_extract(body,'$.payload.agent.threadId')=?) ORDER BY seq`).all(p.recordingId,call.receivedSequence,call.source.sourceId,call.source.generation,address??'',thread??'').map(raw=>{const row=raw as {id:string;sequence:number;time?:string;agent:string};return {...row,agent:JSON.parse(row.agent) as Record<string,any>};}).filter(row=>rank(row.sequence)<=cutoff):[];
  const threadIds=new Set(activities.map(o=>o.agent.threadId).filter(value=>typeof value==='string'));
  const threadId=thread??(threadIds.size===1?[...threadIds][0] as string:undefined);
  // Reused paths with different native threads cannot be collapsed as one child.
  const ambiguous=threadIds.size>1&&!thread;
  const safeActivities=ambiguous?[]:activities.filter(o=>!threadId||o.agent.threadId===threadId);
  const last=(key:string)=>safeActivities.findLast(o=>typeof o.agent[key]==='string')?.agent[key] as string|undefined;
  const input=object(object(call.payload).input),intent=object(object(call.payload).intent);
  const rawTask=input.prompt??intent.prompt;
  const taskValue=typeof rawTask==='string'?rawTask:rawTask&&typeof rawTask.$blob==='string'&&rawTask.bytes<=2*1024*1024?store.blobs.get(rawTask.$blob):undefined;
  const task=op.detail.descriptionEncrypted||typeof taskValue==='string'&&/^gAAAA[A-Za-z0-9_-]{80,}={0,2}$/.test(taskValue)?undefined:taskValue;
  const taskLimited=!!rawTask&&typeof rawTask==='object'&&rawTask.bytes>2*1024*1024;
  const taskMissing=!!rawTask&&typeof rawTask==='object'&&typeof rawTask.$blob==='string'&&taskValue===undefined;
  const steps:DelegationStep[]=[{id:call.id,kind:'spawn',label:'Task delegated',sequence:rank(call.receivedSequence),time:call.sourceTime,operationId:op.id}];
  for(const o of safeActivities){const kind=o.agent.kind,started=kind==='started'||kind==='spawn';if(kind==='completed'||kind==='interacted'||started)steps.push({id:o.id,kind:kind==='completed'?'completed':started?'spawn':'interaction',label:kind==='completed'?'Child completion recorded':started?'Child started':'Interaction recorded',sequence:rank(o.sequence),time:o.time});}
  const actions=childId&&!ambiguous?visible.operations.filter(other=>other.agentId===childId&&other.id!==op.id):[];
  for(const action of actions){const position=p.timeline[action.startSequence];if(!position||rank(position.sequence)>cutoff)continue;steps.push({id:action.id,kind:'action',label:action.title.slice(0,400),operationId:action.id,sequence:rank(position.sequence),time:action.startTime,status:action.status});}
  if(childId&&!ambiguous)for(const message of visible.prose){
    const position=p.timeline[message.sequence];
    if(message.agentId!==childId||message.role!=='assistant'||!position||rank(position.sequence)>cutoff)continue;
    const artifactId=`art_${message.id}_prose`,artifact=p.artifacts.find(a=>a.id===artifactId);
    const observation=message.observationIds[0]?store.observationById(p.recordingId,message.observationIds[0]):undefined;
    steps.push({id:message.id,kind:'message',label:childMessageLabel(observation),sequence:rank(position.sequence),time:message.time,text:message.text.slice(0,64000),truncated:message.truncated||message.text.length>64000,...(artifact?{artifactId}:{} )});
  }
  if(childId&&!ambiguous)steps.push(...unavailableChildMessages(store,p.recordingId,call,address,p.agents.find(a=>a.id===op.agentId)?.address??'/root',rank,cutoff));
  const result=receipts.find(o=>o.kind==='tool.result');
  if(result&&!acknowledgement(op.detail.resultPreview))steps.push({id:result.id,kind:'result',label:'Result returned to parent',sequence:rank(result.receivedSequence),time:result.sourceTime,operationId:op.id});
  steps.sort((a,b)=>a.sequence-b.sequence||a.id.localeCompare(b.id));
  // A parent spanning worktrees deliberately has no common projection root. The
  // captured spawn's own workspace still proves this child's exact boundary.
  const rec=store.getRecording(p.recordingId),recordingId=childId&&!ambiguous?childRecording(store,p.recordingId,threadId,native!.replace(/^agent:/,''),call.workspaceRoot??p.workspaceRoot,rec?.sourcePath):undefined;
  const children=multiple?[...new Map(spawnedReceipts.map(o=>{
    const data=object(o.payload),nativeId=String(data.childAgentId),childId=`${p.recordingId}.${nativeId}`;
    const linked=childRecording(store,p.recordingId,undefined,nativeId.replace(/^agent:/,''),call.workspaceRoot??p.workspaceRoot,rec?.sourcePath);
    return [nativeId,{id:childId,name:String(data.agentType??'Child agent').slice(0,300),...(linked?{recordingId:linked}:{})}] as const;
  })).values()]:undefined;
  const child=childId&&!ambiguous?{id:childId,name:(typeof input.description==='string'?input.description:(step===undefined?agent?.nickname??agent?.label:undefined)??op.detail.agentType??'Child agent').slice(0,300),model:last('model')??(step===undefined?agent?.model:undefined),effort:last('effort')??(step===undefined?agent?.effort:undefined),address:last('path')??(step===undefined?address:undefined),...(recordingId?{recordingId}:{})}:undefined;
  let taskAt=task?Math.min(taskStart,Math.max(0,task.length-1)):0;
  if(taskAt&&task&&/[\uDC00-\uDFFF]/.test(task[taskAt]!)&&/[\uD800-\uDBFF]/.test(task[taskAt-1]!))taskAt--;
  let taskEnd=Math.min(task?.length??0,taskAt+16000);
  if(task&&taskEnd<task.length&&/[\uD800-\uDBFF]/.test(task[taskEnd-1]!))taskEnd--;
  return {operationId:op.id,child,...(children?{children}:{}),...(task||taskLimited||taskMissing?{task:{text:task?.slice(taskAt,taskEnd)??'',truncated:taskLimited||taskMissing||!!task&&taskEnd<task.length,start:taskAt,total:task?.length??0,...(taskLimited||taskMissing?{unavailable:true,reason:taskLimited?'content-limit' as const:'missing' as const}:{})}}:{}),steps:steps.slice(start,start+25),total:steps.length,start,limit:25,childActions:actions.length,identity:child||children?.length?'captured':'unresolved',recording:recordingId||children?.some(c=>c.recordingId)?'separate-recording':actions.length?'same-recording':child||children?.length?'not-imported':'unresolved'};
}
