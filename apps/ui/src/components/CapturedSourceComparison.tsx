import {useEffect,useRef,useState} from 'react';
import {workspaceApi,type CurrentFile} from '../api.ts';
import {useApp} from '../state.ts';
import type {FileEvidence} from '../lib/file-evidence.ts';
import {capturedDiskPair} from '../lib/captured-disk.ts';
import {useSessionWorkspace} from './SessionWorkspace.tsx';
import {SourceComparison} from './SourceVersions.tsx';

/** Selectively integrates PR110's distinct job using the current reader/version owners. */
export function CapturedSourceComparison({evidence,path,compact=false}:{evidence:FileEvidence;path:string;compact?:boolean}) {
  const source=useApp(s=>s.source),id=useApp(s=>s.recordingId),mode=useApp(s=>s.mode);
  const {workspace,approve}=useSessionWorkspace();
  const [value,setValue]=useState<{before:CurrentFile;after:CurrentFile;label:string}>(),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const ticket=useRef(0);
  useEffect(()=>{ticket.current++;setValue(undefined);setError('');setBusy(false);return()=>{ticket.current++;};},[source,id,path,evidence.key,mode]);
  if(source?.kind!=='daemon'||!id||id.includes('+')||mode!=='history'||evidence.patch||!evidence.artifactId)return null;
  const compare=async()=>{
    const request=++ticket.current;setBusy(true);setError('');
    const current=()=>request===ticket.current&&useApp.getState().source===source&&useApp.getState().recordingId===id;
    try{
      if(!workspace?.approved)await approve();if(!current())return;
      const captured=await source.artifact(id,evidence.artifactId!,{start:0,count:5000});if(!current())return;
      const disk=await workspaceApi.document(id,path);if(!current())return;
      const pair=capturedDiskPair(captured,disk,evidence.startLine);
      setValue({before:{...disk,modifiedAt:evidence.operation.startTime??'',text:pair.before,totalLines:captured.returnedLines,redacted:captured.artifact.redacted},after:{...disk,text:pair.after,totalLines:pair.after.split('\n').length},label:pair.label});
    }catch(error){if(current())setError((error as Error).message);}finally{if(current())setBusy(false);}
  };
  return <div className="captured-source-comparison"><button className="btn ghost small" aria-label="Compare captured source with disk" title="Compare captured source with disk" disabled={busy||!workspace?.root} onClick={()=>void compare()}>{busy?'Comparing source…':compact?'Compare with disk':'Compare captured source with disk'}</button>{error&&<p role="alert">{error}</p>}{value&&<SourceComparison path={path} before={value.before} after={value.after} beforeLabel={value.label} afterLabel="Current disk · matching positions" context="Captured source versus a separately approved current sample. Same line positions only; moved code is not mapped. No changes applied." close={()=>setValue(undefined)}/>}</div>;
}
