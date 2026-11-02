import { useEffect,useState } from 'react';
import { useApp } from '../state.ts';
import { hasNativeReading,returnToNativeReading,investigation,clearInvestigation } from '../lib/native-return.ts';
import type { ControllerStatus } from '../api.ts';
import { EvidenceReview } from './EvidenceReview.tsx';

/** Return context and chronological evidence, never inferred attribution to a turn. */
export function NativeReturn({controller}:{controller?:ControllerStatus}) {
  const source=useApp(s=>s.source),id=useApp(s=>s.recordingId),projection=useApp(s=>s.projection),mode=useApp(s=>s.mode);
  const [,setRevision]=useState(0),[error,setError]=useState('');
  useEffect(()=>{const changed=()=>setRevision(n=>n+1);window.addEventListener('drishya-native-return',changed);return()=>window.removeEventListener('drishya-native-return',changed);},[]);
  if(!source||!id||mode!=='history')return null;
  const back=hasNativeReading(source,id),review=controller?.afterSequence!==undefined&&['completed','stopped','failed'].includes(controller.state);
  const origin=investigation(source,id);
  if(!back&&!review)return null;
  return <div className="native-return-actions">{origin&&<p className="investigation-status">{origin.runId?'Request submitted to native controller':origin.prepared?'Correction prepared · not submitted':'Investigating action'}<small title={origin.title}>Observation {origin.sequence??'unavailable'} · {origin.title}</small></p>}<div>{back&&<button type="button" className="btn ghost" onClick={()=>{setError('');void returnToNativeReading(source,id).catch(e=>setError(e.message));}}>Back to reading</button>}{(origin?.afterSequence!==undefined||review)&&projection&&<EvidenceReview projection={projection} after={origin?.afterSequence??controller!.afterSequence} label="Review new activity"/>}{origin&&<button type="button" className="btn ghost" onClick={()=>clearInvestigation(source,id)}>End investigation</button>}</div>{origin?.runId&&<small>Later activity shows order, not a fix or test coverage.</small>}{error&&<span className="bad" role="alert">{error}</span>}</div>;
}
