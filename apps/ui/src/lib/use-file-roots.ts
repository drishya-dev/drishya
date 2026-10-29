import {useEffect,useState} from 'react';
import {workspaceApi} from '../api.ts';
import {useApp} from '../state.ts';
import type {RecordedFileRoot} from './worktree-files.ts';

export function useFileRoots(revision:number) {
  const source=useApp(s=>s.source),id=useApp(s=>s.recordingId);
  const [loaded,setLoaded]=useState<{source:typeof source;id:typeof id;roots:RecordedFileRoot[]}>();
  useEffect(()=>{
    if(source?.kind!=='daemon'||!id)return;
    let active=true;
    void workspaceApi.fileRoots(id).then(value=>{if(active)setLoaded({source,id,roots:value.roots});}).catch(()=>{});
    return()=>{active=false;};
  },[source,id,revision]);
  return loaded&&loaded.source===source&&loaded.id===id?loaded.roots:[];
}
