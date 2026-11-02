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

/** The same captured output owns compact and expanded readings. No current-file fallback. */
export function StoredToolResult({op,full=false}:{op:Operation;full?:boolean}) {
  const source=useApp(s=>s.source);
  const history=useContext(HistoryArtifacts);
  const artifacts=useApp(s=>s.projection?.artifacts);
  const outputs=op.artifactIds.filter(id=>id.endsWith('_out')||(history?.get(id)??artifacts?.find(a=>a.id===id))?.kind==='output');
  const preview='resultPreview' in op.detail?op.detail.resultPreview:undefined;
  // Claude keeps complete result text on the sealed observation even without a projection artifact.
  if(!outputs.length&&source?.kind==='daemon'&&source.artifactChunk&&op.endSequence!==undefined)outputs.push(`result:${op.id}`);
  // A reader can survive seeking backwards. Never mount a fetcher for a future receipt.
  if(op.endSequence===undefined)return <span className="muted">{op.status==='running'?'Waiting for result':'No result content captured'}</span>;
  if(!full)return <>{preview?<StructuredResult text={preview}/>:<span className="muted">No preview text</span>}{outputs.length>0&&!!preview&&preview.length>=4000&&<button type="button" className="material-more" onClick={event=>{event.stopPropagation();useApp.getState().select(op.id);}}>Read full captured result</button>}</>;
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
  const [field,setField]=useEvidenceState<'text'|'structured'|undefined>(`stored-result/${id}/field`,undefined);
  const [retry,setRetry]=useState(0),[copied,setCopied]=useState('');
  const revision=useApp(s=>recordingId?.split('+').map(id=>s.renderedRevisions[id]??0).join(':'));
  const [loaded,setLoaded]=useState<{source:typeof source;key:string;version?:string;page?:StoredResultChunk;error?:boolean}>();
  // Retry unresolved references on rescan; immutable resolved bytes keep their real DOM selection.
  const version=loaded&&loaded.source===source&&loaded.page?.available?loaded.version:revision;
  const key=JSON.stringify([recordingId,id,descriptor?.blob,descriptor?.availability,op.endSequence,op.observationIds.at(-1),start,field,retry,version]);
  useEffect(()=>{
    if(!source?.artifactChunk||!recordingId)return;
    let active=true;
    source.artifactChunk(recordingId,id,start,field).then(page=>{if(active)setLoaded({source,key,version,page});}).catch(()=>{if(active)setLoaded({source,key,version,error:true});});
    return()=>{active=false;};
  },[source,recordingId,id,key]);
  const current=!!loaded&&loaded.source===source&&loaded.key===key;
  const page=current?loaded?.page:undefined;
  const error=current&&loaded?.error;
  if(!source?.artifactChunk)return <ArtifactReader id={id} kind="output" fallback={preview}/>;
  const complete=page?.available&&page.start===0&&!page.hasMore&&!page.partial;
  const text=page?.text??'';
  const structured=page?.field==='structured';
  const originalLabel=structured?'formatted structured field':'original result';
  const partial=page?.available&&!complete?`Stored byte portion ${start+1}–${page.next} of ${page.totalBytes}; reading choices cover this portion only`:undefined;
  return <section className="stored-tool-result" aria-label="Stored captured result" onClick={event=>event.stopPropagation()}>
    {ids.length>1&&<label className="material-context">Captured output<select aria-label="Captured output artifact" value={id} onChange={event=>setChoice(event.target.value)}>{ids.map((value,i)=><option key={value} value={value}>Output {i+1}</option>)}</select></label>}
    {page?.fields&&page.fields.length>1&&<label className="material-context">Captured result field<select aria-label="Captured result field" value={page.field} onChange={event=>{setField(event.target.value as 'text'|'structured');setStarts([0]);setCopied('');}}>{page.fields.map(value=><option key={value} value={value}>{value==='text'?'Original result text':'Structured field · formatting derived'}</option>)}</select></label>}
    {structured&&<span className="material-context">Captured structured field · JSON formatting derived</span>}
    {page?.partial&&<span className="material-context">{page.partial}</span>}
    <div className="structured-output-controls reader-tools"><ProvenanceBadge artifact={page?.artifact??descriptor}/>{page?.available&&<><span>{complete?'Complete stored result':partial}</span><button type="button" onClick={()=>{setRaw(value=>!value);setCopied('');}} aria-pressed={raw}>{raw?'Read formatted result':`Show ${originalLabel}`}</button><button type="button" onClick={()=>{void navigator.clipboard.writeText(text).then(()=>setCopied(complete?`Copied ${originalLabel}`:'Copied exact stored portion'),()=>setCopied('Copy unavailable · select original text'));}}>{complete?`Copy ${originalLabel}`:'Copy stored portion'}</button></>}</div>
    {error?<p role="status">Could not load stored result. <button type="button" onClick={()=>setRetry(value=>value+1)}>Retry</button></p>:!page?<span className="muted" role="status">Opening stored result…</span>:!page.available?<><p className="muted">{page.reason==='no-longer-stored'?'Captured result is no longer stored (deleted or past retention).':'Result bytes were not captured.'}</p><button type="button" onClick={()=>setRetry(value=>value+1)}>Retry stored result</button>{preview&&<><span className="material-context">Available preview</span><StructuredResult text={preview}/></>}</>:raw?<pre className="output stored-result-original">{text}</pre>:complete?<StructuredResult text={text}/>:<CapturedResultViews text={text} evidence={{partial}} fallback={<pre className="output stored-result-original">{text}</pre>}/>}
    {copied&&<span className="muted small" role="status">{copied}</span>}
    {(start>0||page?.hasMore)&&<nav className="reader-pages" aria-label="Stored result portions"><button type="button" disabled={starts.length<2} onClick={()=>{setStarts(values=>values.slice(0,-1));setCopied('');}}>Previous portion</button><button type="button" disabled={!page?.available||!page.hasMore||!page.next} onClick={()=>{if(page?.next!==undefined&&page.next>start){setStarts(values=>[...values,page.next!]);setCopied('');}}}>Next portion</button></nav>}
  </section>;
}
