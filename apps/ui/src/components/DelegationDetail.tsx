import type { Operation } from '@drishya/contracts';
import {useEffect,useState} from 'react';
import type {DelegationThread} from '../../../daemon/src/delegation-types.ts';
import { useApp } from '../state.ts';
import { delegationFacts, delegationLine, delegationReply, type SpawnDetail } from '../lib/delegation.ts';
import { ToolOutput } from './ToolOutput.tsx';
import './delegation-detail.css';

const useChild = (d: SpawnDetail) => useApp(state => d.childAgentId ? state.projection?.agents.find(agent => agent.id === d.childAgentId) : undefined);

/** CONTENT-5: who ran the delegation, quietly, on the collapsed card. */
export function DelegationLine({ d }: { d: SpawnDetail }) {
  const line = delegationLine(d, useChild(d));
  return line ? <div className="delegation-line">{line}</div> : null;
}

/**
 * The delegation as one reading: the agent and its recorded model, the task it was given, and what came back.
 * Every fact is the harness's; nothing is joined by timing. A child's own actions live in its own session
 * for harnesses that journal sub-agents separately, and the card says so instead of implying they are missing.
 */
export function DelegationDetail({ op, d }: { op: Operation; d: SpawnDetail }) {
  const child = useChild(d);
  const source=useApp(s=>s.source),recordingId=useApp(s=>s.recordingId),mode=useApp(s=>s.mode),step=useApp(s=>s.step),revision=useApp(s=>s.projection?.observationCount);
  const [start,setStart]=useState(0),[retry,setRetry]=useState(0),[value,setValue]=useState<{key:string;data:DelegationThread}>(),[error,setError]=useState('');
  const at=mode==='replay'?step:undefined,key=`${recordingId}/${op.id}/${start}/${at??'live'}`;
  const thread=value?.key===key?value.data:undefined;
  useEffect(()=>{
    if(!recordingId||!source?.delegationThread)return;let active=true;setError('');
    void source.delegationThread(recordingId,op.id,start,at).then(data=>{if(active)setValue({key,data});}).catch(e=>{if(active)setError(e.message);});
    return()=>{active=false;};
  },[source,recordingId,op.id,start,at,key,revision,retry]);
  const own = useApp(state => child ? state.projection?.operations.filter(other => other.agentId === child.id).length ?? 0 : 0);
  const facts = thread?delegationFacts(d,undefined):delegationFacts(d,at===undefined?child:undefined);
  if(thread?.child){
    facts.splice(0,facts.length,{label:'Agent',value:thread.child.name});
    if(thread.child.address)facts.push({label:'Address',value:thread.child.address});
    const model=[thread.child.model,thread.child.effort&&`${thread.child.effort} effort`].filter(Boolean).join(' · ');
    if(model)facts.push({label:'Model',value:model});
  }
  const reply = delegationReply(d);
  return <div className="op-expanded delegation-material" onClick={(e) => e.stopPropagation()}>
    {facts.length > 0 && <dl className="delegation-facts">{facts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>}
    <div className="material-context">Task given to the agent</div>
    <div className="delegation-task">{d.descriptionEncrypted ? 'Not recorded: Codex stored the task text encrypted.' : thread?.task?.text ?? d.description ?? 'Not recorded.'}</div>
    {thread?.task?.truncated&&<button className="btn ghost" onClick={()=>useApp.getState().select(op.id)}>Task preview limited · read captured request</button>}
    {source?.delegationThread&&<details className="delegation-thread"><summary>Delegation thread{thread?` · ${thread.total} captured steps`:''}</summary>
      {error?<p role="alert">Could not read the captured thread. <button className="btn ghost" onClick={()=>setRetry(n=>n+1)}>Retry</button></p>:!thread?<p role="status">Reading captured thread…</p>:<>
        {thread.identity==='unresolved'&&<p className="muted small">The capture does not establish one exact child identity. No child session is inferred.</p>}
        {thread.child?.recordingId?<a className="btn ghost" href={`#/r/${encodeURIComponent(thread.child.recordingId)}`}>Open child session</a>:thread.childActions>0&&thread.child?<button className="btn ghost" onClick={()=>useApp.getState().setFilter({...useApp.getState().filter,agentId:thread.child!.id})}>Focus child actions · {thread.childActions}</button>:thread.child&&<p className="muted small">The child’s own recording is not imported here.</p>}
        <ol start={thread.start+1}>{thread.steps.map(item=><li key={item.id} data-delegation-step={item.kind}><span aria-hidden="true" className="delegation-step-dot"/><div>{item.operationId?<button className="btn ghost" onClick={()=>useApp.getState().select(item.operationId!)}>{item.label}</button>:<span>{item.label}</span>}{item.time&&<time dateTime={item.time}>{new Date(item.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</time>}{item.status&&<small>{item.status==='ok'?'Tool returned':item.status}</small>}</div></li>)}</ol>
        {thread.total>thread.limit&&<nav aria-label="Delegation thread pages"><button className="btn ghost" disabled={thread.start===0} onClick={()=>setStart(Math.max(0,start-thread.limit))}>Previous steps</button><span>{thread.start+1}–{Math.min(thread.start+thread.limit,thread.total)} / {thread.total}</span><button className="btn ghost" disabled={thread.start+thread.limit>=thread.total} onClick={()=>setStart(start+thread.limit)}>Next steps</button></nav>}
      </>}
    </details>}
    <div className="material-context">Result returned to the parent</div>
    {reply.text ? <ToolOutput text={reply.text} />
      : <div className="muted small">{reply.acknowledgementOnly ? 'Codex recorded only an acknowledgement for this call, not the agent’s answer.' : op.status === 'running' ? 'Waiting for the result' : 'No result content captured'}</div>}
    {child && <div className="delegation-scope">{(thread?.childActions??own) > 0 ? `${thread?.childActions??own} action${(thread?.childActions??own) === 1 ? '' : 's'} by this agent in this recording.` : 'This agent’s own actions are not in this recording; harnesses that journal sub-agents separately keep them in the agent’s own session.'}</div>}
  </div>;
}
