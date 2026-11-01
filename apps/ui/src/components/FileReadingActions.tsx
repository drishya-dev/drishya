import type {Operation} from '@drishya/contracts';
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
export function FileReadingActions({path,op,hideCaptured=false,compact=false,onNavigate,beforeWorkspace,workspaceLabel='Open in Workspace',unavailableReason,hideWorkspace=false,explain=true}:{path:string;op?:Operation;hideCaptured?:boolean;compact?:boolean;onNavigate?:()=>void;beforeWorkspace?:()=>void;workspaceLabel?:string;unavailableReason?:string;hideWorkspace?:boolean;explain?:boolean}) {
  const source=useApp(s=>s.source),id=useApp(s=>s.recordingId),mode=useApp(s=>s.mode),projection=useApp(s=>s.projection),graph=useApp(s=>s.graph);
  const roots=useFileRoots(projection?.observationCount??0),{workspace}=useSessionWorkspace();
  const files=projection?.files.map(file=>file.path)??[],root=workspace?.root??projection?.workspaceRoot;
  const identity=recordedFileIdentity(path,files,roots,root),target=currentReadingTarget(identity,roots,root);
  const reason=unavailableReason??(source?.kind!=='daemon'?'This bundle contains captured material only.':id?.includes('+')?'Choose one session to read current files.':mode!=='history'?'Leave replay to read current files.':target.reason);
  const captured=files.includes(identity)||op?.paths.some(item=>item.path===identity);
  const listed=!identity.startsWith('/')&&!/^[a-z]:[\\/]/i.test(identity)&&[...files,...(graph?.nodes.map(node=>node.path)??[])].includes(identity);
  const navigate=(run:()=>void)=>{onNavigate?.();run();};
  const actions=<>
    {!hideCaptured&&<button type="button" className="btn ghost" disabled={!captured} title={captured?'Read the material this harness actually captured':'No file material was captured for this path'} onClick={()=>navigate(()=>openCapturedFileReading(identity,op))}>View captured file</button>}
    {!hideWorkspace&&<button type="button" className="btn ghost" disabled={!!reason||!target.path} title={reason??'Read the current file with workspace consent; captured material stays separate'} onClick={()=>navigate(()=>{if(!source||!id||!target.path)return;beforeWorkspace?.();rememberCurrentFileOrigin(source,id,target.path,identity);useApp.getState().set({developerWorkspace:true,explore:false,currentFile:undefined,filePanel:undefined,filePanelEvidence:capturedFileEvidence(op,identity),selectedOp:undefined,expandedOp:undefined,foldersHidden:false,follow:false,held:true});window.dispatchEvent(new CustomEvent('drishya-open-workspace-file',{detail:target.path}));})}>{workspaceLabel}</button>}
    <button type="button" className="btn ghost" disabled={!listed} title={listed?'Reveal this exact captured path in Files':'This captured path is not listed in Files; its captured material remains readable'} onClick={()=>navigate(()=>{useApp.getState().set({filePanel:undefined,currentFile:undefined,selectedOp:undefined,expandedOp:undefined,explore:false,foldersHidden:false,follow:false,held:true});window.dispatchEvent(new CustomEvent('drishya-reveal-captured-file',{detail:identity}));})}>Show in Files</button>
    {reason&&explain&&<small className="muted" role="status">{reason}</small>}
  </>;
  return compact?<WorkspaceOptions label={`File reading actions for ${path}`}>{actions}</WorkspaceOptions>:<div className="file-evidence-toolbar" onClick={event=>event.stopPropagation()}>{actions}</div>;
}
