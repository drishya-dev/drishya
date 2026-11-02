import {useEffect,useState} from 'react';
import type {Operation} from '@drishya/contracts';
import {useApp} from '../state.ts';
import {momentKey,readMoments,saveMoment,type SavedMoment} from '../lib/saved-moments.ts';
import {ReadingDialog} from './ProductShell.tsx';
import {operationObservation} from '../../../../packages/scene/src/operation-observations.ts';

export function useSavedMoments() {
  const id=useApp(s=>s.recordingId),kind=useApp(s=>s.source?.kind),key=momentKey(kind??'',id??'');
  const read=()=>{try{return {items:readMoments(localStorage.getItem(key)??'[]'),readError:''};}catch{return {items:[] as SavedMoment[],readError:'Saved moments are unavailable in this browser. Restore storage access to read them.'};}};
  const [state,setState]=useState(()=>({key,...read()})),[error,setError]=useState('');
  useEffect(()=>{setError('');const refresh=()=>setState({key,...read()});refresh();window.addEventListener('drishya-moments',refresh);window.addEventListener('storage',refresh);return()=>{window.removeEventListener('drishya-moments',refresh);window.removeEventListener('storage',refresh);};},[key]);
  const write=(update:(items:SavedMoment[])=>SavedMoment[])=>{try{const current=read();if(current.readError)throw new Error(current.readError);const next=update(current.items);localStorage.setItem(key,JSON.stringify(next));setState({key,items:next,readError:''});setError('');window.dispatchEvent(new Event('drishya-moments'));return true;}catch(e){setError(e instanceof Error&&e.message.startsWith('50 moments')?e.message:'Browser storage is unavailable. The moment was not saved.');return false;}};
  return {items:state.key===key?state.items:[],error:error||(state.key===key?state.readError:''),write};
}
export function SaveMoment({op}:{op:Operation}) {
  const {items,write,error}=useSavedMoments(),mode=useApp(s=>s.mode),projection=useApp(s=>s.projection),sequence=operationObservation(projection,op.id),saved=items.some(item=>item.operationId===op.id);
  if(mode!=='history')return null;
  return <div className="save-moment"><button className="btn ghost" aria-pressed={saved} disabled={!saved&&sequence===undefined} title={sequence===undefined?'Observation position unavailable':undefined} onClick={()=>write(items=>saved?items.filter(item=>item.operationId!==op.id):saveMoment(items,{operationId:op.id,sequence:sequence!,title:op.title,note:''}))}>{saved?'Remove saved moment':'Save moment'}</button><span role="status">{error}</span></div>;
}
export function SavedMomentsEntry() {
  const {items,write,error}=useSavedMoments(),id=useApp(s=>s.recordingId),source=useApp(s=>s.source),mode=useApp(s=>s.mode);
  const [open,setOpen]=useState(false),[opening,setOpening]=useState(false),[targetError,setTargetError]=useState('');
  useEffect(()=>{setOpen(false);setTargetError('');},[source,id,mode]);
  useEffect(()=>{const reveal=()=>setOpen(true);window.addEventListener('drishya-saved-moments',reveal);return()=>window.removeEventListener('drishya-saved-moments',reveal);},[]);
  const navigate=async(item:SavedMoment)=>{setOpening(true);setTargetError('');try{const state=useApp.getState();if(state.historyPage)await state.loadHistoryWindow({selectedOperationId:item.operationId});const now=useApp.getState();if(now.source!==source||now.recordingId!==id)return;if(!now.projection?.operations.some(op=>op.id===item.operationId))throw new Error('This action is unavailable. Its saved reference remains here.');now.set({developerWorkspace:false,filePanel:undefined,currentFile:undefined,explore:false});now.select(item.operationId);setOpen(false);}catch(e){setTargetError((e as Error).message);}finally{setOpening(false);}};
  return <><button className="btn ghost" disabled={mode!=='history'} onClick={()=>setOpen(true)}>Saved moments{items.length?` · ${items.length}`:''}</button>{open&&mode==='history'&&<ReadingDialog title="Saved moments" className="saved-moments-dialog" close={()=>setOpen(false)}><p>Saved steps. Saving does not mark a step as reviewed or correct. Up to 50 per session.</p>{(error||targetError)&&<p role="alert">{error||targetError}</p>}<div className="saved-moment-list">{items.map(item=><MomentRow key={item.operationId} item={item} opening={opening} open={()=>void navigate(item)} update={note=>write(items=>saveMoment(items,{...item,note}))} remove={()=>write(items=>items.filter(row=>row.operationId!==item.operationId))}/>)}{!items.length&&<p>No saved moments. Open a step and choose Save moment.</p>}</div>{source?.readingNotes&&id&&<EarlierReadingNotes key={id} close={()=>setOpen(false)}/>}</ReadingDialog>}</>;
}
function EarlierReadingNotes({close}:{close:()=>void}) {
  const source=useApp(s=>s.source)!,id=useApp(s=>s.recordingId)!, [shown,setShown]=useState(false),[start,setStart]=useState(0),[retry,setRetry]=useState(0),[error,setError]=useState('');
  const [data,setData]=useState<Awaited<ReturnType<NonNullable<typeof source.readingNotes>>>>();
  useEffect(()=>{if(!shown)return;let active=true;setData(undefined);setError('');void source.readingNotes!(id,start).then(value=>{if(active)setData(value);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[source,id,shown,start,retry]);
  return <section className="earlier-reading-notes"><button className="btn ghost" aria-expanded={shown} onClick={()=>setShown(!shown)}>Earlier reading notes</button>{shown&&<><p>Notes saved by earlier Drishya screens. These refer to timeline positions, which can change after a recording rebuild; they are not exact action identifiers.</p>{error&&<p role="alert">{error}<button className="btn ghost" onClick={()=>setRetry(n=>n+1)}>Retry notes</button></p>}{!error&&!data&&<p role="status">Reading saved notes…</p>}{data&&<><span>{data.total} notes · up to 25 per page</span>{data.bookmarks.map(item=><article key={item.id}><p>{item.note||'No note text'}</p><small>Saved replay position {item.step}</small><button className="btn ghost" onClick={()=>{useApp.getState().set({replayDiagnostics:true,developerWorkspace:false,selectedOp:undefined,currentFile:undefined,filePanel:undefined,explore:false});useApp.getState().seek(item.step,{hold:true});close();}}>Open saved replay position</button></article>)}{!data.total&&<p>No earlier reading notes for this recording.</p>}<nav aria-label="Earlier reading note pages"><button className="btn ghost" disabled={!start} onClick={()=>setStart(n=>Math.max(0,n-25))}>Previous notes</button><button className="btn ghost" disabled={start+data.bookmarks.length>=data.total} onClick={()=>setStart(n=>n+25)}>Next notes</button></nav></>}</>}</section>;
}
function MomentRow({item,opening,open,update,remove}:{item:SavedMoment;opening:boolean;open:()=>void;update:(note:string)=>boolean;remove:()=>void}) {
  const [note,setNote]=useState(item.note),[saved,setSaved]=useState(false);
  return <article><button className="question-target" disabled={opening} onClick={open}>{item.title} ↗</button><small>Step {item.sequence}</small><label>Local note<textarea aria-label={`Note for ${item.title}`} maxLength={1000} value={note} onChange={e=>{setNote(e.target.value);setSaved(false);}}/></label><div><button className="btn ghost" onClick={()=>{if(update(note))setSaved(true);}}>Save note</button><button className="btn ghost" onClick={remove}>Remove moment</button><span role="status">{saved?'Note saved locally':''}</span></div></article>;
}
