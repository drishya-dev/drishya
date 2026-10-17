import { useEffect } from 'react';
import { useApp } from '../state.ts';
import { workspaceApi } from '../api.ts';
import { workspaceMemory } from './workspace-memory.ts';
import { promptDrafts } from './prompt-drafts.ts';
import { workspaceDrafts } from './workspace-drafts.ts';
import type { WorkingLocations } from '../../../../packages/contracts/src/working-locations.ts';

export async function restoreWorkingLocations() {
  const saved=await workspaceApi.workingLocations();
  return saved;
}

function checkpoint():WorkingLocations|undefined {
  const s=useApp.getState();
  if(s.source?.kind!=='daemon')return;
  const snapshot=workspaceMemory(s.source).snapshot(s.resumeRecordingId);
  if(s.recordingId&&s.projection&&s.mode==='history') {
    const session=snapshot.sessions.find(item=>item.id===s.recordingId);
    if(session) {
      const location={developerWorkspace:s.developerWorkspace,selectedOp:s.selectedOp,expandedOp:s.expandedOp,currentFile:s.currentFile,filePanel:s.filePanel,filePanelFocus:s.filePanelFocus,filePanelEvidence:s.filePanelEvidence,filePanelLine:s.filePanelLine,explore:s.explore,compareAgents:s.compareAgents,mapFocusPath:s.mapFocusPath,filter:s.filter,follow:s.follow,held:s.held,inspectorTab:s.inspectorTab,inspectorWidth:s.inspectorWidth,readingPassageId:s.readingPassageId,start:s.historyPage?.start};
      session.entries=session.entries.filter(([key])=>key!=='location');session.entries.push(['location',location]);snapshot.last=s.recordingId;
    }
  }
  return snapshot;
}

/** Incremental metadata checkpoints survive ordinary close/crash and a changed server port.
 * No source bytes, draft text, approval or playback state is part of this document. */
export function useWorkingRecovery() {
  useEffect(()=>{
    let timer:number|undefined,inFlight=false,again=false,last='',warning=false;
    const savedSessions=new Map<string,string>();
    const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};
    const updateWarning=()=>{
      const source=useApp.getState().source;
      const dirty=!!source&&(promptDrafts(source).hasDrafts()||workspaceDrafts(source).hasChanges());
      if(dirty&&!warning)window.addEventListener('beforeunload',warn);
      if(!dirty&&warning)window.removeEventListener('beforeunload',warn);
      warning=dirty;
    };
    const save=async()=>{
      timer=undefined;updateWarning();
      if(inFlight){again=true;return;}
      const snapshot=checkpoint();if(!snapshot)return;
      const signature=JSON.stringify({last:snapshot.last,sessions:snapshot.sessions.map(s=>({id:s.id,entries:s.entries}))});if(signature===last)return;
      const source=useApp.getState().source!;
      const sessions=snapshot.sessions.filter(s=>(savedSessions.get(s.id)??workspaceMemory(source).saved(s.id))!==JSON.stringify(s.entries));
      const payload={...snapshot,sessions},encoded=JSON.stringify(payload);
      inFlight=true;
      try { const result=await workspaceApi.saveWorkingLocations(payload,new TextEncoder().encode(encoded).length<60000);if(useApp.getState().source!==source)return;workspaceMemory(source).versions(result.revisions,sessions.map(s=>s.id));for(const session of sessions)savedSessions.set(session.id,JSON.stringify(session.entries));for(const id of savedSessions.keys())if(!(id in result.revisions))savedSessions.delete(id);last=signature;useApp.setState({recoveryState:'saved',recoveryError:undefined,resumeRecordingId:snapshot.last}); }
      catch(e) { if(useApp.getState().source===source)useApp.setState({recoveryState:'unavailable',recoveryError:(e as Error).message}); }
      finally {inFlight=false;if(again){again=false;schedule();}}
    };
    const schedule=()=>{updateWarning();if(timer===undefined)timer=window.setTimeout(()=>void save(),750);};
    const hidden=()=>{if(document.visibilityState==='hidden')void save();};
    const close=()=>void save();
    const stop=useApp.subscribe((state,previous)=>{for(const key of Object.keys(state) as (keyof typeof state)[])if(!['recoveryState','recoveryError','resumeRecordingId'].includes(key)&&state[key]!==previous[key]) {schedule();break;}});
    window.addEventListener('drishya-location-change',schedule);
    window.addEventListener('drishya-unsaved-change',updateWarning);
    window.addEventListener('pagehide',close);document.addEventListener('visibilitychange',hidden);
    return ()=>{stop();if(timer!==undefined)clearTimeout(timer);window.removeEventListener('drishya-location-change',schedule);window.removeEventListener('drishya-unsaved-change',updateWarning);window.removeEventListener('pagehide',close);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('beforeunload',warn);};
  },[]);
}
