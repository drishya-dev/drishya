import {useContext,useEffect,useState} from 'react';
import type {DataSource} from '../api.ts';
import {useApp} from '../state.ts';
import {HistoryArtifacts} from '../lib/history-artifacts.ts';
import {materialCache} from '../lib/artifact-cache.ts';
import {proseBody,readFullProse} from '../lib/full-prose.ts';
import {Markdown} from '../lib/markdown.tsx';

const sources=new WeakMap<DataSource,number>();let nextSource=0;
export function FullProse({id,preview,workspaceRoot,onPath}:{id:string;preview:string;workspaceRoot?:string;onPath:(path:string,line?:number)=>void}){
 const source=useApp(s=>s.source),recording=useApp(s=>s.recordingId),history=useContext(HistoryArtifacts);
 const historical=history?.get(id);
 const current=useApp(s=>historical?undefined:s.projection?.artifacts.find(a=>a.id===id));
 const descriptor=historical??current;
 const revision=useApp(s=>descriptor?.blob?undefined:recording?.split('+').map(id=>s.renderedRevisions[id]??0).join(':'));
 if(source&&!sources.has(source))sources.set(source,++nextSource);
 const key=source&&recording?`full-prose/${sources.get(source)}/${recording}/${id}/${descriptor?.blob??revision}`:undefined;
 const [state,setState]=useState<{key:string;text?:string;error?:string}>(),[retry,setRetry]=useState(0);
 useEffect(()=>{
  if(!key||!source||!recording)return;
  let active=true;
  void materialCache.get(key,'reader',()=>readFullProse(source,recording,id)).then(slice=>{
   if(active)setState({key,text:proseBody(slice)});
  },error=>{if(active)setState({key,error:String(error.message??error)});});
  return()=>{active=false;};
 },[key,source,recording,id,retry]);
 const loaded=state?.key===key?state:undefined;
 return <><Markdown text={loaded?.text??preview} workspaceRoot={workspaceRoot} onPath={onPath}/>
  {loaded?.text===undefined&&<p role="status">{loaded?.error??'Loading complete recorded message…'}{loaded?.error&&<> <button onClick={()=>setRetry(n=>n+1)}>Retry</button></>}</p>}
 </>;
}
