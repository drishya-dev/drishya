import { useMemo, useRef, useState } from 'react';
import type { CurrentFile } from '../api.ts';
import type { SourceVersions } from '../lib/source-versions.ts';
import { compareDraft } from '../lib/draft-comparison.ts';
import { ReadingDialog } from './ProductShell.tsx';
import { DiffReader } from './ArtifactReader.tsx';
import { WholeSource } from './WholeSource.tsx';

function Snapshot({file,label}:{file:CurrentFile;label:string}) {
  const viewport=useRef<HTMLDivElement>(null);
  return <section><h3>{label}<small title={file.modifiedAt}>{file.totalLines} lines{file.redacted?' · redacted':''}</small></h3><div ref={viewport} className="source-reading source-snapshot" tabIndex={0} aria-label={label}><WholeSource text={file.text} path={file.path} viewport={viewport} wrap/></div></section>;
}
export function SourceComparison({path,before,after,close,beforeLabel='Retained reading',afterLabel='Latest disk snapshot',context='Local comparison of checked file snapshots · no changes applied'}:{path:string;before:CurrentFile;after:CurrentFile;close:()=>void;beforeLabel?:string;afterLabel?:string;context?:string}) {
  const comparison=useMemo(()=>compareDraft(before.text,after.text),[before.text,after.text]);
  return <ReadingDialog title={`Source versions · ${path}`} close={close} className="source-version-dialog">
    <p className="source-version-context">{beforeLabel} → {afterLabel}<small>{context}</small></p>
    {comparison.kind==='patch'?comparison.hunks.length?<DiffReader hunks={comparison.hunks} path={path} navigationKey={`source-versions/${path}/${before.modifiedAt}/${after.modifiedAt}`} scope="source-comparison"/>:<p className="source-version-empty" role="status">The source text is identical.</p>:<div className="source-snapshot-pair"><Snapshot file={before} label={beforeLabel}/><Snapshot file={after} label={afterLabel}/></div>}
  </ReadingDialog>;
}
export function SourceVersionNotice({versions,accept,path}:{versions:SourceVersions;accept:()=>void;path:string}) {
  const [comparing,setComparing]=useState(false),[kept,setKept]=useState(false);
  const latest=versions.candidate??versions.shown,older=versions.candidate?versions.shown:versions.previous;
  if(!latest||!older)return null;
  return <><div className="source-version-notice" role="region" aria-label="Source version status"><span>{versions.candidate?(kept?'Retained reading · newer disk snapshot available':'Source changed on disk · your reading is retained'):'Previous reading retained'}<small>Snapshots stay in this reading space only</small></span><button className="btn ghost" onClick={()=>setComparing(true)}>Compare versions</button>{versions.candidate&&<><button className="btn ghost" onClick={()=>setKept(true)}>Keep reading</button><button className="btn" onClick={()=>{accept();setKept(false);}}>Use latest</button></>}</div>{comparing&&<SourceComparison path={path} before={older} after={latest} close={()=>setComparing(false)}/>}</>;
}
