import {basename,dirname,normalize} from 'node:path';
import type {Agent,Observation,Operation,Projection} from '@drishya/contracts';
import type {Store} from '@drishya/store';

import type {DelegationThread,DelegationStep} from './delegation-types.ts';

const object=(value:unknown):Record<string,any>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,any>:{};
const canonical=(path:string)=>{const value=normalize(path).replace(/\\/g,'/');return /^[A-Za-z]:\//.test(value)?value.toLowerCase():value;};
const acknowledgement=(text:string|undefined)=>{try{const keys=Object.keys(JSON.parse(text??'null'));return keys.length===1&&['task_name','agent_id'].includes(keys[0]!);}catch{return false;}};
const uuid=/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/i;

/** Imported sources only. File names are native identities, never a timing/name-similarity join. */
function childRecording(store:Store,id:string,threadId:string|undefined,childNative:string,root:string|undefined,sourcePath:string|undefined):string|undefined {
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
export function delegationThread(store:Store,p:Projection,operationId:string,start=0,step?:number):DelegationThread|null {
  const op=p.operations.find(value=>value.id===operationId&&value.detail.kind==='spawn');if(!op||op.detail.kind!=='spawn')return null;
  const cutoff=step===undefined?Number.MAX_SAFE_INTEGER:step===0?-1:p.timeline[Math.max(0,Math.min(step,p.timeline.length)-1)]?.sequence??-1;
  const call=op.observationIds.map(id=>store.observationById(p.recordingId,id)).find(o=>o?.kind==='tool.call');
  if(!call||call.receivedSequence>cutoff)return null;
  const receipts=call.operationId?store.operationObservations(p.recordingId,call.operationId).filter(o=>o.source.sourceId===call.source.sourceId&&o.source.generation===call.source.generation&&o.receivedSequence<=cutoff):[call];
  const spawned=receipts.find(o=>o.kind==='agent.spawn'&&['source-id','captured-reference'].includes(object(o.payload).basis));
  const exactLinks=p.links.filter(link=>link.from===op.id&&link.relation==='explicit-reference'&&link.basis==='source-id');
  const referenced=exactLinks.flatMap(link=>link.sourceObservationIds??[]).map(id=>store.observationById(p.recordingId,id)).filter((o):o is Observation=>!!o&&o.receivedSequence<=cutoff&&o.source.sourceId===call.source.sourceId&&o.source.generation===call.source.generation);
  const direct=referenced.find(o=>o.kind==='item.completed'&&object(o.payload).item==='subagent');
  const native=spawned?String(object(spawned.payload).childAgentId):direct?`agent:${object(object(direct.payload).agent).path?.split('/').at(-1)??object(object(direct.payload).agent).threadId}`:undefined;
  const childId=native?`${p.recordingId}.${native}`:undefined,agent=p.agents.find(a=>a.id===childId);
  const address=agent?.address,thread=object(object(direct?.payload).agent).threadId as string|undefined;
  // Only thin native metadata enters this read-model, never the whole parent transcript.
  const activities=childId?store.db.prepare(`SELECT id,seq sequence,source_time time,json_extract(body,'$.payload.agent') agent FROM observations WHERE recording_id=? AND kind='item.completed' AND json_extract(body,'$.payload.item')='subagent' AND seq>=? AND seq<=? AND json_extract(body,'$.source.sourceId')=? AND json_extract(body,'$.source.generation')=? AND (json_extract(body,'$.payload.agent.path')=? OR json_extract(body,'$.payload.agent.threadId')=?) ORDER BY seq`).all(p.recordingId,call.receivedSequence,cutoff,call.source.sourceId,call.source.generation,address??'',thread??'').map(raw=>{const row=raw as {id:string;sequence:number;time?:string;agent:string};return {...row,agent:JSON.parse(row.agent) as Record<string,any>};}):[];
  const threadIds=new Set(activities.map(o=>o.agent.threadId).filter(value=>typeof value==='string'));
  const threadId=thread??(threadIds.size===1?[...threadIds][0] as string:undefined);
  // Reused paths with different native threads cannot be collapsed as one child.
  const ambiguous=threadIds.size>1&&!thread;
  const safeActivities=ambiguous?[]:activities.filter(o=>!threadId||o.agent.threadId===threadId);
  const last=(key:string)=>safeActivities.findLast(o=>typeof o.agent[key]==='string')?.agent[key] as string|undefined;
  const input=object(object(call.payload).input),intent=object(object(call.payload).intent);
  const rawTask=input.prompt??intent.prompt;
  const task=op.detail.descriptionEncrypted?undefined:typeof rawTask==='string'?rawTask:rawTask&&typeof rawTask.$blob==='string'&&rawTask.bytes<=64000?store.blobs.get(rawTask.$blob):undefined;
  const steps:DelegationStep[]=[{id:call.id,kind:'spawn',label:'Task delegated',sequence:call.receivedSequence,time:call.sourceTime,operationId:op.id}];
  for(const o of safeActivities){const kind=o.agent.kind;if(kind==='completed'||kind==='interacted'||kind==='spawn')steps.push({id:o.id,kind:kind==='completed'?'completed':kind==='spawn'?'spawn':'interaction',label:kind==='completed'?'Child completion recorded':kind==='spawn'?'Child started':'Interaction recorded',sequence:o.sequence,time:o.time});}
  const actions=childId&&!ambiguous?p.operations.filter(other=>other.agentId===childId&&other.id!==op.id&&(p.timeline[other.startSequence]?.sequence??Number.MAX_SAFE_INTEGER)<=cutoff):[];
  for(const action of actions){const position=p.timeline[action.startSequence];if(!position||position.sequence>cutoff)continue;steps.push({id:action.id,kind:'action',label:action.title.slice(0,400),operationId:action.id,sequence:position.sequence,time:action.startTime,status:action.status});}
  const result=receipts.find(o=>o.kind==='tool.result');
  if(result&&!acknowledgement(op.detail.resultPreview))steps.push({id:result.id,kind:'result',label:'Result returned to parent',sequence:result.receivedSequence,time:result.sourceTime,operationId:op.id});
  steps.sort((a,b)=>a.sequence-b.sequence||a.id.localeCompare(b.id));
  const rec=store.getRecording(p.recordingId),recordingId=childId&&!ambiguous?childRecording(store,p.recordingId,threadId,native!.replace(/^agent:/,''),p.workspaceRoot,rec?.sourcePath):undefined;
  const child=childId&&!ambiguous?{id:childId,name:(typeof input.description==='string'?input.description:agent?.nickname??agent?.label??op.detail.agentType??'Child agent').slice(0,300),model:last('model')??(step===undefined?agent?.model:undefined),effort:last('effort')??(step===undefined?agent?.effort:undefined),address:last('path')??(step===undefined?address:undefined),...(recordingId?{recordingId}:{})}:undefined;
  return {operationId:op.id,child,...(task?{task:{text:task.slice(0,16000),truncated:task.length>16000}}:{}),steps:steps.slice(start,start+25),total:steps.length,start,limit:25,childActions:actions.length,identity:child?'captured':'unresolved',recording:recordingId?'separate-recording':actions.length?'same-recording':child?'not-imported':'unresolved'};
}
