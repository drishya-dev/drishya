import { useCallback, useEffect, useRef, useState } from 'react';
import { workspaceApi, type CurrentFile } from '../api.ts';
import { acceptSource, observeSource, type SourceVersions } from './source-versions.ts';

/** Refresh never swaps the source under a selection. Only explicit acceptance does. */
export function useCurrentSource(id:string,path:string,enabled=true) {
  const key=JSON.stringify([id,path]),serial=useRef(0);
  const [value,setValue]=useState<SourceVersions&{key:string;busy?:boolean;error?:string}>({key});
  const observe=useCallback((next:CurrentFile)=>setValue(old=>({key,...observeSource(old.key===key?old:{},next)})),[key]);
  const refresh=useCallback(async()=>{
    const request=++serial.current;
    setValue(old=>({...(old.key===key?old:{key}),busy:true,error:undefined}));
    try {
      const next=await workspaceApi.document(id,path);
      if(request!==serial.current)return;
      observe(next);return next;
    } catch(error) {
      if(request===serial.current)setValue(old=>({...old,busy:false,error:(error as Error).message}));
      return undefined;
    }
  },[id,path,key,observe]);
  useEffect(()=>{if(enabled)void refresh();return()=>{serial.current++;};},[enabled,refresh]);
  const accept=useCallback(()=>setValue(old=>({...old,candidate:undefined,previous:undefined,...acceptSource(old)})),[]);
  const current:typeof value=value.key===key?value:{key};
  return {...current,refresh,accept,observe};
}
