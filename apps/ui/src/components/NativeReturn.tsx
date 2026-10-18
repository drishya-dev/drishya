import { useEffect,useState } from 'react';
import { useApp } from '../state.ts';
import { hasNativeReading,returnToNativeReading } from '../lib/native-return.ts';
import type { ControllerStatus } from '../api.ts';
import { EvidenceReview } from './EvidenceReview.tsx';

/** Return context and chronological evidence, never inferred attribution to a turn. */
export function NativeReturn({controller}:{controller?:ControllerStatus}) {
  const source=useApp(s=>s.source),id=useApp(s=>s.recordingId),projection=useApp(s=>s.projection),mode=useApp(s=>s.mode);
  const [,setRevision]=useState(0),[error,setError]=useState('');
  useEffect(()=>{const changed=()=>setRevision(n=>n+1);window.addEventListener('drishya-native-return',changed);return()=>window.removeEventListener('drishya-native-return',changed);},[]);
  if(!source||!id||mode!=='history')return null;
  const back=hasNativeReading(source,id),review=controller?.afterSequence!==undefined&&['completed','stopped','failed'].includes(controller.state);
  if(!back&&!review)return null;
  return <div className="native-return-actions"><div>{back&&<button type="button" className="btn ghost" onClick={()=>{setError('');void returnToNativeReading(source,id).catch(e=>setError(e.message));}}>Back to reading</button>}{review&&projection&&<EvidenceReview projection={projection} after={controller!.afterSequence} label="Review new captured activity"/>}</div>{error&&<span className="bad" role="alert">{error}</span>}</div>;
}
