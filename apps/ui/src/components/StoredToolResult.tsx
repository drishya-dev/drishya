import {useContext,useEffect,useState} from 'react';
import type {Operation} from '@drishya/contracts';
import type {StoredResultChunk} from '../api.ts';
import {useApp} from '../state.ts';
import {HistoryArtifacts} from '../lib/history-artifacts.ts';
import {useEvidenceState} from './EvidenceNavigation.tsx';
import {StructuredResult} from './StructuredResult.tsx';
import {CapturedResultViews} from './CapturedResultViews.tsx';
import {ArtifactReader} from './ArtifactReader.tsx';
import {ProvenanceBadge} from './common.tsx';

/** The same captured output owns compact, expanded and Inspector readings. No current-file fallback. */
export function StoredToolResult({op,full=false}:{op:Operation;full?:boolean}) {
  const history=useContext(HistoryArtifacts);
  const artifacts=useApp(s=>s.projection?.artifacts);
  const outputs=op.artifactIds.filter(id=>id.endsWith('_out')||(history?.get(id)??artifacts?.find(a=>a.id===id))?.kind==='output');
  const preview='resultPreview' in op.detail?op.detail.resultPreview:undefined;
  // A reader can survive seeking backwards. Never mount a fetcher for a future receipt.
  if(op.endSequence===undefined)return <span className="muted">{op.status==='running'?'Waiting for result':'No result content captured'}</span>;
  if(!full)return <><StructuredResult text={preview||'No result content captured'}/>{outputs.length>0&&<button type="button" className="material-more" onClick={event=>{event.stopPropagation();useApp.getState().select(op.id);}}>Read full captured result</button>}</>;
  if(!outputs.length)return <><span className="material-context">{preview?'Available preview · no stored original recorded':'No result content captured'}</span>{preview&&<StructuredResult text={preview}/>}</>;
  return <StoredResultReading key={op.id} op={op} ids={outputs} preview={preview}/>;
}
function StoredResultReading({op,ids,preview}:{op:Operation;ids:string[];preview?:string}) {
  const source=useApp(s=>s.source),recordingId=useApp(s=>s.recordingId);
  const history=useContext(HistoryArtifacts);
  const artifacts=useApp(s=>s.projection?.artifacts);
  const [choice,setChoice]=useEvidenceState(`stored-result/${op.id}/artifact`,ids[0]!);
  const id=ids.includes(choice)?choice:ids[0]!;
  const descriptor=history?.get(id)??artifacts?.find(a=>a.id===id);
  const [starts,setStarts]=useEvidenceState<number[]>(`stored-result/${id}/pages`,[0]);
  const start=starts.at(-1)??0;
  const [raw,setRaw]=useEvidenceState(`stored-result/${id}/original`,false);
  const [retry,setRetry]=useState(0),[copied,setCopied]=useState('');
  const key=JSON.stringify([recordingId,id,descriptor?.blob,descriptor?.availability,op.endSequence,start,retry]);
  const [loaded,setLoaded]=useState<{key:string;page?:StoredResultChunk;error?:boolean}>();
  useEffect(()=>{
    if(!source?.artifactChunk||!recordingId)return;
    let active=true;
    source.artifactChunk(recordingId,id,start).then(page=>{if(active)setLoaded({key,page});}).catch(()=>{if(active)setLoaded({key,error:true});});
    return()=>{active=false;};
  },[source,recordingId,id,key]);
  const page=loaded?.key===key?loaded.page:undefined;
  const error=loaded?.key===key&&loaded.error;
  if(!source?.artifactChunk)return <ArtifactReader id={id} kind="output" fallback={preview}/>;
  const complete=page?.available&&page.start===0&&!page.hasMore;
  const text=page?.text??'';
  const partial=page?.available&&!complete?`Stored byte portion ${start+1}–${page.next} of ${page.totalBytes}; reading choices cover this portion only`:undefined;
  return <section className="stored-tool-result" aria-label="Stored captured result" onClick={event=>event.stopPropagation()}>
    {ids.length>1&&<label className="material-context">Captured output<select aria-label="Captured output artifact" value={id} onChange={event=>setChoice(event.target.value)}>{ids.map((value,i)=><option key={value} value={value}>Output {i+1}</option>)}</select></label>}
    <div className="structured-output-controls"><ProvenanceBadge artifact={page?.artifact??descriptor}/>{page?.available&&<><span>{complete?'Complete stored result':partial}</span><button type="button" onClick={()=>{setRaw(value=>!value);setCopied('');}} aria-pressed={raw}>{raw?'Read formatted result':'Show original result'}</button><button type="button" onClick={()=>{void navigator.clipboard.writeText(text).then(()=>setCopied(complete?'Copied original result':'Copied exact stored portion'),()=>setCopied('Copy unavailable · select original text'));}}>{complete?'Copy original result':'Copy stored portion'}</button></>}</div>
    {error?<p role="status">Could not load stored result. <button type="button" onClick={()=>setRetry(value=>value+1)}>Retry</button></p>:!page?<span className="muted" role="status">Opening stored result…</span>:!page.available?<><p className="muted">{page.reason==='no-longer-stored'?'Captured result is no longer stored (deleted or past retention).':'Result bytes were not captured.'}</p>{preview&&<><span className="material-context">Available preview</span><StructuredResult text={preview}/></>}</>:raw?<pre className="output stored-result-original">{text}</pre>:complete?<StructuredResult text={text}/>:<CapturedResultViews text={text} evidence={{partial}} fallback={<pre className="output stored-result-original">{text}</pre>}/>}
    {copied&&<span className="muted small" role="status">{copied}</span>}
    {(start>0||page?.hasMore)&&<nav className="reader-pages" aria-label="Stored result portions"><button type="button" disabled={starts.length<2} onClick={()=>{setStarts(values=>values.slice(0,-1));setCopied('');}}>Previous portion</button><button type="button" disabled={!page?.available||!page.hasMore||!page.next} onClick={()=>{if(page?.next!==undefined&&page.next>start){setStarts(values=>[...values,page.next!]);setCopied('');}}}>Next portion</button></nav>}
  </section>;
}
