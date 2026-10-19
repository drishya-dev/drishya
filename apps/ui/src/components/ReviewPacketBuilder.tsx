import {useEffect,useRef,useState} from 'react';
import type {ReviewInsightsPage} from '../../../../packages/scene/src/review-insights.ts';
import {useApp} from '../state.ts';
import {readQuestions} from '../lib/review-questions.ts';
import {reviewPacket,type PacketEvidence} from '../lib/review-packet.ts';
import {operationOutcome} from '../lib/operation-outcome.ts';
import {useSavedMoments} from './SavedMoments.tsx';
import {operationObservation} from '../../../../packages/scene/src/operation-observations.ts';

export function ReviewPacketBuilder({data}:{data:ReviewInsightsPage}) {
  const source=useApp(s=>s.source)!,id=useApp(s=>s.recordingId)!,projection=useApp(s=>s.projection),recording=useApp(s=>s.recording);
  const {items,error:storageError}=useSavedMoments();
  const [samples,setSamples]=useState(true),[questions,setQuestions]=useState(true),[selected,setSelected]=useState<string[]>([]),[packet,setPacket]=useState(''),[error,setError]=useState(''),[status,setStatus]=useState(''),[busy,setBusy]=useState(false);
  const request=useRef(0);
  useEffect(()=>{request.current++;setPacket('');setBusy(false);},[samples,questions,selected,items,data]);
  useEffect(()=>()=>{request.current++;},[]);
  const prepare=async()=>{const generation=++request.current;setBusy(true);setError('');setStatus('');try{
    if(storageError)throw new Error(storageError);
    const notes=questions?readQuestions(localStorage.getItem(`drishya-review-questions-v1:${source.kind}:${id}`)??'[]'):[];
    const evidence:PacketEvidence[]=[];
    // At most four bounded history requests in flight, twenty selected references total.
    const targets=items.filter(item=>selected.includes(item.operationId)).slice(0,20);
    for(let start=0;start<targets.length;start+=4){const rows=await Promise.all(targets.slice(start,start+4).map(async item=>{
      const current=source.history?(await source.history(id,{selectedOperationId:item.operationId,count:1})).projection:projection;
      const op=current?.operations.find(op=>op.id===item.operationId);
      const sequence=operationObservation(current,op?.id??'');
      return {operationId:item.operationId,sequence:sequence??item.sequence,title:op?.title??item.title,status:op?operationOutcome(op).label:'Unavailable',note:item.note,available:!!op&&sequence!==undefined};
    }));if(generation!==request.current)return;evidence.push(...rows);}
    if(generation!==request.current)return;
    setPacket(reviewPacket(data,notes,{samples,questions,selected:evidence,workspaceRoot:recording?.workspaceRoot}));
  }catch(e){if(generation===request.current)setError((e as Error).message);}finally{if(generation===request.current)setBusy(false);}};
  return <div className="review-packet"><p>{data.facts.editedFileCount} files with change inputs · {data.facts.counts.tests} recorded checks · {data.facts.counts.gaps} capture gaps</p><fieldset><legend>Choose packet contents</legend><label className="packet-choice"><input type="checkbox" checked={samples} onChange={e=>setSamples(e.target.checked)}/>Recording samples: changes, checks, gaps, findings and prompts</label><label className="packet-choice"><input type="checkbox" checked={questions} onChange={e=>setQuestions(e.target.checked)}/>Open local reviewer questions</label><details><summary>Choose saved evidence · {selected.length} selected</summary>{items.length?items.map(item=><label className="packet-choice" key={item.operationId}><input type="checkbox" disabled={!selected.includes(item.operationId)&&selected.length>=20} checked={selected.includes(item.operationId)} onChange={e=>setSelected(current=>e.target.checked?[...current,item.operationId]:current.filter(id=>id!==item.operationId))}/><span>{item.title}<small>Observation {item.sequence}{item.note?' · includes your local note':''}</small></span></label>):<p>Save moments from action details, then choose up to 20 here.</p>}</details></fieldset><p>Selected actions are re-read individually. References need the matching recording or evidence bundle. Current Git, disk text and drafts are excluded.</p><button className="btn" disabled={busy||!samples&&!questions&&!selected.length} onClick={()=>void prepare()}>{busy?'Preparing evidence…':'Prepare packet preview'}</button>{(error||storageError)&&<p role="alert">{error||storageError}</p>}{packet&&<><label>Review before exporting<textarea aria-label="Review packet preview" value={packet} readOnly spellCheck={false}/></label><div><button className="btn" onClick={()=>void navigator.clipboard.writeText(packet).then(()=>setStatus('Copied review packet'),()=>setStatus('Copy unavailable · select the preview text'))}>Copy packet</button><button className="btn" onClick={()=>{const url=URL.createObjectURL(new Blob([packet],{type:'text/markdown;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='drishya-review.md';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setStatus('Review packet saved');}}>Download Markdown</button></div></>}<span role="status">{status}</span></div>;
}
