import {useMemo,useState,type ReactNode} from 'react';
import {extractExecPatches} from '../lib/exec-patch.ts';
import {ArtifactReader,DiffReader} from './ArtifactReader.tsx';
import {CommandText} from './CommandText.tsx';
import {DiffView} from './common.tsx';
import {ReadingCaption} from './OriginalToggle.tsx';

export function ExecPatchMaterial({id,command,truncated=false,full=false,compact=false,inputArtifactId,rawFallback}:{id:string;command:string;truncated?:boolean;full?:boolean;compact?:boolean;inputArtifactId?:string;rawFallback?:ReactNode}) {
  const patch=useMemo(()=>extractExecPatches(command,truncated),[command,truncated]);
  const [raw,setRaw]=useState(false);
  if(!patch||raw){
    return <>
      {patch&&<ReadingCaption label="Script" original={true} onToggle={()=>setRaw(false)}/>}
      {rawFallback??<CommandText text={command} compact={compact}/>}
    </>;
  }
  return <div className="exec-patch-material">
    <ReadingCaption label={`Patch · ${patch.files.length} file${patch.files.length===1?'':'s'}`} title="apply_patch payload recognised from Codex exec input" original={false} onToggle={()=>setRaw(true)}/>
    {patch.truncated&&<div className="material-context">Preview · open full input for remaining lines.</div>}
    {patch.files.map((file,i)=><div className="exec-patch-file" key={`${file.path}-${i}`}>
      <div className="material-context">{file.op==='add'?'Add':file.op==='delete'?'Delete':'Update'} · {file.moveTo?`${file.path} → ${file.moveTo}`:file.path}</div>
      {file.hunks.length?(full?<DiffReader hunks={file.hunks} path={file.moveTo??file.path} navigationKey={`${id}/${i}`}/>:<DiffView hunks={file.hunks} path={file.moveTo??file.path} maxLines={8}/>):<p className="muted">Empty file patch.</p>}
    </div>)}
    {full&&truncated&&inputArtifactId&&<details className="command-full-input"><summary>Full input</summary><ArtifactReader id={inputArtifactId} kind="code" navigationSlot={id}/></details>}
  </div>;
}
