import {useEffect,useRef,useState} from 'react';
import type {Operation} from '@drishya/contracts';
import {useApp} from '../state.ts';
import {loadNotes,notesKey,saveNote,type StepNote} from '../lib/step-notes.ts';
import {ReadingDialog} from './ProductShell.tsx';
import {prepareCorrection} from './InvestigationActions.tsx';
import {operationObservation} from '../../../../packages/scene/src/operation-observations.ts';

let pendingNoteTarget:string|undefined;

/** Clear any active History note-routing hint (called when a note editor opens or dismissal is requested). */
export function clearHistoryNoteHint() {
  window.dispatchEvent(new Event('drishya-note-hint-clear'));
}

/** Expand the target operation's note disclosure once it is mounted and focus its textarea for immediate typing. */
export function openStepNoteEditor(operationId:string) {
  pendingNoteTarget=operationId;
  clearHistoryNoteHint();
  let tries=0;
  const attempt=()=>{
    const state=useApp.getState();
    if((state.expandedOp??state.selectedOp)!==operationId) {
      if(++tries<30)requestAnimationFrame(attempt);
      return;
    }
    const card=document.querySelector<HTMLElement>(`article[data-op-id="${CSS.escape(operationId)}"]`);
    const editor=card?.querySelector<HTMLDetailsElement>('.review-question-editor');
    const field=editor?.querySelector<HTMLTextAreaElement>('textarea');
    if(editor&&field) {
      pendingNoteTarget=undefined;
      editor.open=true;
      window.dispatchEvent(new CustomEvent('drishya-open-step-note',{detail:{operationId}}));
      requestAnimationFrame(()=>{
        editor.scrollIntoView({block:'nearest'});
        field.focus({preventScroll:true});
      });
      return;
    }
    if(++tries<30)requestAnimationFrame(attempt);
  };
  requestAnimationFrame(attempt);
}

export function HistoryNoteHint() {
  const [visible,setVisible]=useState(false);
  const id=useApp(s=>s.recordingId),mode=useApp(s=>s.mode),activeOp=useApp(s=>s.expandedOp??s.selectedOp);
  const workingWindow=useApp(s=>s.developerWorkspace),explore=useApp(s=>s.explore);
  useEffect(()=>{
    const show=()=>setVisible(true);
    const hide=()=>setVisible(false);
    window.addEventListener('drishya-note-hint',show);
    window.addEventListener('drishya-note-hint-clear',hide);
    return()=>{
      window.removeEventListener('drishya-note-hint',show);
      window.removeEventListener('drishya-note-hint-clear',hide);
    };
  },[]);
  useEffect(()=>{setVisible(false);},[id,mode]);
  useEffect(()=>{if(activeOp)setVisible(false);},[activeOp]);
  if(!visible||mode!=='history'||workingWindow||explore)return null;
  return <div className="history-note-hint" role="status" aria-live="polite">
    <span>Open any step for <strong>Add a note</strong> at the bottom, or focus a step and press <kbd>a</kbd>.</span>
    <button type="button" className="history-note-hint-close" aria-label="Dismiss note hint" onClick={()=>setVisible(false)}>✕</button>
  </div>;
}

export function useStepNotes() {
  const id=useApp(s=>s.recordingId),kind=useApp(s=>s.source?.kind)??'',key=notesKey(kind,id??'');
  const read=()=>{try{return {items:loadNotes(name=>localStorage.getItem(name),kind,id??''),readError:''};}catch{return {items:[] as StepNote[],readError:'Notes are unavailable in this browser. Restore storage access to read them.'};}};
  const [state,setState]=useState(()=>({key,...read()})),[error,setError]=useState('');
  useEffect(()=>{setError('');const refresh=()=>setState({key,...read()});refresh();window.addEventListener('drishya-notes',refresh);window.addEventListener('storage',refresh);return()=>{window.removeEventListener('drishya-notes',refresh);window.removeEventListener('storage',refresh);};},[key]);
  const write=(update:(items:StepNote[])=>StepNote[])=>{try{const current=read();if(current.readError)throw new Error(current.readError);const next=update(current.items);localStorage.setItem(key,JSON.stringify(next));setState({key,items:next,readError:''});setError('');window.dispatchEvent(new Event('drishya-notes'));return true;}catch(error){setError(error instanceof Error?error.message:'Could not save notes in this browser. Copy your text before closing.');return false;}};
  return {items:state.key===key?state.items:[],error:error||(state.key===key?state.readError:''),write};
}

export function StepNoteEditor({op}:{op:Operation}) {
  const mode=useApp(s=>s.mode),source=useApp(s=>s.source),id=useApp(s=>s.recordingId),projection=useApp(s=>s.projection),sequence=operationObservation(projection,op.id);
  const {items,write,error}=useStepNotes(),held=items.find(item=>item.operationId===op.id);
  const [open,setOpen]=useState(()=>!!held||pendingNoteTarget===op.id);
  const [text,setText]=useState(held?.note??''),[follow,setFollow]=useState(held?.status==='open'),[owner,setOwner]=useState(held?.owner??''),[status,setStatus]=useState('');
  const field=useRef<HTMLTextAreaElement>(null);
  useEffect(()=>{if(held)setOpen(true);},[held]);
  useEffect(()=>{
    if(pendingNoteTarget===op.id) {
      pendingNoteTarget=undefined;
      setOpen(true);
      requestAnimationFrame(()=>{
        field.current?.scrollIntoView({block:'nearest'});
        field.current?.focus({preventScroll:true});
      });
    }
    const onOpen=(event:Event)=>{
      if((event as CustomEvent<{operationId?:string}>).detail?.operationId!==op.id)return;
      setOpen(true);
      requestAnimationFrame(()=>{
        field.current?.scrollIntoView({block:'nearest'});
        field.current?.focus({preventScroll:true});
      });
    };
    window.addEventListener('drishya-open-step-note',onOpen);
    return()=>window.removeEventListener('drishya-open-step-note',onOpen);
  },[op.id]);
  if(mode==='replay')return null;
  const changed=()=>setStatus('');
  const save=()=>{const now=new Date().toISOString();if(write(items=>saveNote(items,{operationId:op.id,title:op.title,sequence:sequence!,sequenceBasis:'captured-observation',note:text,owner:follow?owner:'',status:follow?'open':held?.status==='resolved'?'resolved':'saved',createdAt:held?.createdAt||now,updatedAt:now})))setStatus('Saved locally · view in Notes');};
  const remove=()=>{if(write(items=>items.filter(item=>item.operationId!==op.id))){setText('');setFollow(false);setOwner('');setStatus('Note removed');}};
  return <details className="review-question-editor" open={open||undefined} onToggle={event=>{const next=event.currentTarget.open;setOpen(next);if(next)clearHistoryNoteHint();}}><summary>{held?'Your note':'Add a note'}</summary>
    <textarea ref={field} aria-label="Note on this step" maxLength={3000} placeholder="What do you want to remember or check?" value={text} onChange={e=>{setText(e.target.value);changed();}}/>
    <button type="button" className="btn ghost small step-note-follow" aria-pressed={follow} onClick={()=>{setFollow(!follow);changed();}}>Needs follow-up</button>
    {follow&&<input aria-label="Note owner" maxLength={80} placeholder="Owner (optional)" value={owner} onChange={e=>{setOwner(e.target.value);changed();}}/>}
    <div className="step-note-actions"><button className="btn" disabled={sequence===undefined} title={sequence===undefined?'This step has no position to return to':undefined} onClick={save}>Save note</button>
      {held&&<button className="btn ghost" onClick={remove}>Remove note</button>}
      {source?.kind==='daemon'&&id&&!id.includes('+')&&<button className="btn ghost" disabled={!text.trim()} onClick={()=>{try{prepareCorrection(op,text);setStatus('');}catch(error){setStatus((error as Error).message);}}}>Prepare question with harness</button>}
    </div>
    <span role="status">{error||status}</span>
  </details>;
}

export function NotesEntry() {
  const {items,write,error}=useStepNotes(),id=useApp(s=>s.recordingId),source=useApp(s=>s.source),mode=useApp(s=>s.mode),projection=useApp(s=>s.projection);
  const selectedOp=useApp(s=>s.expandedOp??s.selectedOp);
  const [open,setOpen]=useState(false),[shown,setShown]=useState(20),[opening,setOpening]=useState<string>(),[targetError,setTargetError]=useState(''),[preview,setPreview]=useState<string>(),[copyStatus,setCopyStatus]=useState('');
  useEffect(()=>{setOpen(false);setTargetError('');},[source,id,mode]);
  useEffect(()=>{const reveal=()=>setOpen(true);window.addEventListener('drishya-notes-open',reveal);return()=>window.removeEventListener('drishya-notes-open',reveal);},[]);
  useEffect(()=>{setPreview(undefined);setCopyStatus('');},[items]);
  const follow=items.filter(item=>item.status==='open'),saved=items.filter(item=>item.status==='saved'),resolved=items.filter(item=>item.status==='resolved');
  const activeStep=selectedOp?projection?.operations.find(op=>op.id===selectedOp):undefined;
  const update=(item:StepNote,status:StepNote['status'])=>write(items=>saveNote(items,{...item,status,updatedAt:new Date().toISOString()}));
  const navigate=async(operationId:string,editNote=false)=>{
    setOpening(operationId);
    setTargetError('');
    try {
      const state=useApp.getState();
      if(state.historyPage&&(!editNote||!state.projection?.operations.some(op=>op.id===operationId))) {
        await state.loadHistoryWindow({selectedOperationId:operationId});
      }
      const now=useApp.getState();
      if(now.source!==source||now.recordingId!==id||now.mode!==mode)return;
      if(!now.projection?.operations.some(op=>op.id===operationId))throw new Error(editNote?'The selected step is unavailable.':'This step is unavailable. Your note remains saved.');
      now.set({developerWorkspace:false,filePanel:undefined,currentFile:undefined,explore:false,...(editNote?{follow:false,expandedOp:operationId,selectedOp:undefined}:{})});
      if(!editNote&&now.selectedOp!==operationId)now.select(operationId);
      setOpen(false);
      if(editNote)openStepNoteEditor(operationId);
    }catch(e){setTargetError((e as Error).message);}finally{setOpening(undefined);}
  };
  const chooseStep=()=>{
    useApp.setState({developerWorkspace:false,filePanel:undefined,currentFile:undefined,explore:false});
    setOpen(false);
    window.dispatchEvent(new Event('drishya-note-hint'));
    requestAnimationFrame(()=>{document.querySelector<HTMLElement>('.history')?.focus({preventScroll:true});});
  };
  const rows=(notes:StepNote[])=>notes.slice(0,shown).map(item=><article key={item.operationId} className="review-question-row">
    <button className="question-target" disabled={!!opening} onClick={()=>void navigate(item.operationId)}>{opening===item.operationId?'Opening step…':`${item.title} ↗`}</button>
    {item.note&&<p>{item.note}</p>}
    <small>Step {item.sequence}{item.owner?` · Owner: ${item.owner}`:''}</small>
    <div className="step-note-actions">
      {item.status==='open'&&<button className="btn ghost small" onClick={()=>update(item,'resolved')}>Resolve</button>}
      {item.status!=='open'&&<button className="btn ghost small" onClick={()=>update(item,'open')}>{item.status==='resolved'?'Reopen':'Needs follow-up'}</button>}
      <button className="btn ghost small" onClick={()=>write(items=>items.filter(row=>row.operationId!==item.operationId))}>Remove</button>
    </div>
  </article>);
  return <><button className="btn ghost" data-notes disabled={mode==='replay'} onClick={()=>setOpen(true)}>Notes{mode!=='replay'&&items.length?` · ${items.length}`:''}</button>
    {open&&mode!=='replay'&&<ReadingDialog title="Notes" close={()=>setOpen(false)} className="review-questions-dialog step-notes-dialog">
      <p className="review-question-scope">Your notes on this session. They stay in this browser and never change what the agent did.</p>
      {(error||targetError)&&<p role="alert">{error||targetError}</p>}
      {!!follow.length&&<section aria-label="Needs follow-up"><h3>Needs follow-up</h3>{rows(follow)}</section>}
      {!!saved.length&&<section aria-label="Saved notes"><h3>Saved</h3>{rows(saved)}</section>}
      {!items.length&&<div className="step-notes-empty">
        {selectedOp?<>
          <p>No notes yet{activeStep?` · “${activeStep.title}” is selected.`:'. Add one on the selected step.'}</p>
          <div className="step-notes-empty-actions">
            <button type="button" className="btn" disabled={!!opening} onClick={()=>void navigate(selectedOp,true)}>{opening===selectedOp?'Opening step…':'Add a note to the selected step'}</button>
          </div>
          <p className="step-notes-hint">Opens Add a note at the bottom of that step, or focus any step and press <kbd>a</kbd>.</p>
        </>:<>
          <p>No notes yet.</p>
          <div className="step-notes-empty-actions">
            <button type="button" className="btn" onClick={chooseStep}>Choose a step</button>
          </div>
          <p className="step-notes-hint">In History, expand any step for <strong>Add a note</strong> at the bottom, or focus a step and press <kbd>a</kbd>.</p>
        </>}
      </div>}
      {!!resolved.length&&<details className="resolved-questions"><summary>Resolved · {resolved.length}</summary>{rows(resolved)}</details>}
      {Math.max(follow.length,saved.length,resolved.length)>shown&&<button className="btn" onClick={()=>setShown(n=>n+20)}>Show more notes</button>}
      {!!follow.length&&<button className="btn" onClick={()=>setPreview(follow.map(item=>`## ${item.title}\n\n${item.note}\n\nOwner: ${item.owner||'Unassigned'}\nStep reference: ${item.operationId}\nLocal reviewer note, not agent output or proof of coverage.`).join('\n\n'))}>Preview notes to follow up</button>}
      {preview&&<section className="question-export"><h3>Review before copying</h3><textarea aria-label="Notes handoff preview" value={preview} readOnly/><button className="btn" onClick={()=>void navigator.clipboard.writeText(preview).then(()=>setCopyStatus('Copied notes'),()=>setCopyStatus('Copy unavailable · select the preview text'))}>Copy notes</button><span role="status">{copyStatus}</span></section>}
      {source?.readingNotes&&id&&<EarlierReadingNotes key={id} close={()=>setOpen(false)}/>}
    </ReadingDialog>}
  </>;
}

function EarlierReadingNotes({close}:{close:()=>void}) {
  const source=useApp(s=>s.source)!,id=useApp(s=>s.recordingId)!, [shown,setShown]=useState(false),[start,setStart]=useState(0),[retry,setRetry]=useState(0),[error,setError]=useState('');
  const [data,setData]=useState<Awaited<ReturnType<NonNullable<typeof source.readingNotes>>>>();
  useEffect(()=>{if(!shown)return;let active=true;setData(undefined);setError('');void source.readingNotes!(id,start).then(value=>{if(active)setData(value);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[source,id,shown,start,retry]);
  return <section className="earlier-reading-notes">
    <button type="button" className="earlier-notes-toggle" aria-expanded={shown} onClick={()=>setShown(!shown)}>
      <svg className="earlier-notes-chevron" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3.5 9 7l-4 3.5"/></svg>
      <span className="earlier-notes-label">Earlier reading notes</span>
      <span className="earlier-notes-state" aria-hidden="true">{shown?'Hide':'Show'}</span>
    </button>
    {shown&&<div className="earlier-reading-notes-body"><p>Notes saved by earlier Drishya screens. These refer to timeline positions, which can change after a recording rebuild; they are not exact action identifiers.</p>{error&&<p role="alert">{error}<button className="btn ghost" onClick={()=>setRetry(n=>n+1)}>Retry notes</button></p>}{!error&&!data&&<p role="status">Reading saved notes…</p>}{data&&<><span>{data.total} notes · up to 25 per page</span>{data.bookmarks.map(item=><article key={item.id}><p>{item.note||'No note text'}</p><small>Saved replay position {item.step}</small><button className="btn ghost" onClick={()=>{useApp.getState().set({replayDiagnostics:true,developerWorkspace:false,selectedOp:undefined,currentFile:undefined,filePanel:undefined,explore:false});useApp.getState().seek(item.step,{hold:true});close();}}>Open saved replay position</button></article>)}{!data.total&&<p>No earlier reading notes for this recording.</p>}<nav aria-label="Earlier reading note pages"><button className="btn ghost" disabled={!start} onClick={()=>setStart(n=>Math.max(0,n-25))}>Previous notes</button><button className="btn ghost" disabled={start+data.bookmarks.length>=data.total} onClick={()=>setStart(n=>n+25)}>Next notes</button></nav></>}</div>}
  </section>;
}
