import type {Operation} from '@drishya/contracts';
import {useEffect,useState} from 'react';
import {useApp} from '../state.ts';
import {useFileRoots} from '../lib/use-file-roots.ts';
import {rememberCurrentFileOrigin} from '../lib/current-file-origin.ts';
import {capturedFileEvidence,currentReadingTarget,recordedFileIdentity} from '../lib/file-reading.ts';
import {useSessionWorkspace} from './SessionWorkspace.tsx';
import {WorkspaceOptions} from './WorkspaceOptions.tsx';

export function openCapturedFileReading(path:string,op?:Operation) {
  const state=useApp.getState();
  state.set({filePanel:path,filePanelFocus:undefined,filePanelEvidence:capturedFileEvidence(op,path),filePanelLine:undefined,currentFile:undefined,selectedOp:undefined,expandedOp:undefined,developerWorkspace:false,explore:false,follow:false,held:true});
}

/** One navigation contract for captured material; current bytes never stand in for it. */
export function FileReadingActions({path,op,capturedKnown=false,hideCaptured=false,hideReveal=false,compact=false,onNavigate,beforeWorkspace,workspaceLabel='Open in Workspace',unavailableReason,hideWorkspace=false,explain=true}:{path:string;op?:Operation;capturedKnown?:boolean;hideCaptured?:boolean;hideReveal?:boolean;compact?:boolean;onNavigate?:()=>void;beforeWorkspace?:()=>void;workspaceLabel?:string;unavailableReason?:string;hideWorkspace?:boolean;explain?:boolean}) {
  const source=useApp(s=>s.source),id=useApp(s=>s.recordingId),mode=useApp(s=>s.mode),projection=useApp(s=>s.projection),graph=useApp(s=>s.graph);
  const roots=useFileRoots(projection?.observationCount??0),{workspace}=useSessionWorkspace();
  const files=projection?.files.map(file=>file.path)??[],root=workspace?.root??projection?.workspaceRoot;
  const identity=recordedFileIdentity(path,files,roots,root),target=currentReadingTarget(identity,roots,root);
  const reason=unavailableReason??(source?.kind!=='daemon'?'This bundle holds the session only, not your files.':id?.includes('+')?'Choose one session to read current files.':mode!=='history'?'Leave replay to read current files.':target.reason);
  const known=capturedKnown||files.includes(identity)||!!op?.paths.some(item=>item.path===identity);
  const step=useApp(s=>s.mode==='replay'?s.step:undefined),revision=useApp(s=>id?s.renderedRevisions[id]:undefined);
  const [checked,setChecked]=useState<{source:typeof source;id:typeof id;path:string;step:typeof step;revision:typeof revision;found:boolean}>();
  // A resident History page is not the file index. Query one bounded action only
  // for current-file/Git entry points which have no captured-path receipt already.
  useEffect(()=>{
    if(known||!source?.fileOperations||!id)return;
    let active=true;
    void source.fileOperations(id,identity,0,1,step).then(page=>{if(active)setChecked({source,id,path:identity,step,revision,found:page.total>0});}).catch(()=>{if(active)setChecked({source,id,path:identity,step,revision,found:false});});
    return()=>{active=false;};
  },[known,source,id,identity,step,revision]);
  const verified=checked&&checked.source===source&&checked.id===id&&checked.path===identity&&checked.step===step&&checked.revision===revision?checked:undefined;
  const captured=known||verified?.found;
  const listed=!identity.startsWith('/')&&!/^[a-z]:[\\/]/i.test(identity)&&(captured||graph?.nodes.some(node=>node.path===identity));
  const navigate=(run:()=>void)=>{onNavigate?.();run();};
  const actions=<>
    {!hideCaptured&&<button type="button" className="btn ghost" disabled={!captured} title={captured?'Read what the agent saw':!verified&&source?.fileOperations?'Checking file history…':'No file material was recorded for this path'} onClick={()=>navigate(()=>openCapturedFileReading(identity,op))}>View what the agent saw</button>}
    {!hideWorkspace&&<button type="button" className="btn ghost" disabled={!!reason||!target.path} title={reason??'Read the current file with workspace consent'} onClick={()=>navigate(()=>{if(!source||!id||!target.path)return;beforeWorkspace?.();rememberCurrentFileOrigin(source,id,target.path,identity);useApp.getState().set({developerWorkspace:true,explore:false,currentFile:undefined,filePanel:undefined,filePanelEvidence:capturedFileEvidence(op,identity),selectedOp:undefined,expandedOp:undefined,foldersHidden:false,follow:false,held:true});window.dispatchEvent(new CustomEvent('drishya-open-workspace-file',{detail:target.path}));})}>{workspaceLabel}</button>}
    {!hideReveal&&<button type="button" className="btn ghost" disabled={!listed} title={listed?'Reveal this exact path in Files':'This path is not listed in Files; what the agent saw remains readable'} onClick={()=>navigate(()=>{useApp.getState().set({filePanel:undefined,currentFile:undefined,selectedOp:undefined,expandedOp:undefined,explore:false,foldersHidden:false,follow:false,held:true});window.dispatchEvent(new CustomEvent('drishya-reveal-captured-file',{detail:identity}));})}>Show in Files</button>}
    {reason&&explain&&<small className="muted" role="status">{reason}</small>}
  </>;
  return compact?<WorkspaceOptions label={`File reading actions for ${path}`}>{actions}</WorkspaceOptions>:<div className="file-evidence-toolbar" onClick={event=>event.stopPropagation()}>{actions}</div>;
}
