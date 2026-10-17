import {useEffect,useRef,useState} from 'react';
import type {DataSource} from '../api.ts';
import {useApp} from '../state.ts';

type SegmentResult=Awaited<ReturnType<NonNullable<DataSource['sessionSegments']>>>;
/** A native parent reference offers navigation, never a silently stitched timeline. */
export function SessionSegments() {
  const source=useApp(s=>s.source),id=useApp(s=>s.recordingId),harness=useApp(s=>s.recording?.harness),history=useApp(s=>s.mode==='history');
  const [result,setResult]=useState<SegmentResult>(),[error,setError]=useState<string>(),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0);
  const menu=useRef<HTMLDetailsElement>(null);
  const owner=useRef<{source:DataSource|null|undefined;id:string|undefined}>(undefined);
  useEffect(()=>{
    if(owner.current?.source!==source||owner.current?.id!==id) {owner.current={source,id};setResult(undefined);setError(undefined);setBusy(false);}
    if(source?.kind!=='daemon'||!source.sessionSegments||!id||id.includes('+')||harness!=='codex'||!history) return;
    let disposed=false,inFlight=false;
    const check=async()=>{
      if(disposed||inFlight||document.visibilityState==='hidden') return;
      inFlight=true;
      try {const value=await source.sessionSegments!(id);if(!disposed){setResult(value);setError(undefined);}}
      catch(error) {if(!disposed)setError((error as Error).message);}
      finally{inFlight=false;}
    };
    void check();const timer=setInterval(()=>void check(),30_000);
    document.addEventListener('visibilitychange',check);
    return()=>{disposed=true;clearInterval(timer);document.removeEventListener('visibilitychange',check);};
  },[source,id,harness,history,retry]);
  if(owner.current?.source!==source||owner.current?.id!==id||!history||!result?.items.length&&!result?.partial&&!error) return null;
  const open=async(item:SegmentResult['items'][number])=>{
    if(busy||!source||!id) return;
    setBusy(true);setError(undefined);
    try {
      const target=item.source.importedRecordingId??(await source.importSource(item.source.path,item.source.adapterId,false)).recordingId;
      const current=useApp.getState();if(current.source!==source||current.recordingId!==id||current.mode!=='history'||current.screen!=='viewer') return;
      if(menu.current)menu.current.open=false;
      location.hash=`#/r/${encodeURIComponent(target)}`;
      await current.openRecording(target);
    } catch(error){if(useApp.getState().source===source&&useApp.getState().recordingId===id)setError((error as Error).message);}
    finally {if(useApp.getState().recordingId===id)setBusy(false);}
  };
  return <details ref={menu} className="workspace-menu session-segments"><summary aria-label={result?.items.length?'Newer native session segments':'Check native session segments'} title={result?.items.length?'Newer work is stored in another native journal':'Session segment check unavailable'}><span aria-hidden="true">↗</span></summary><div><strong>{result?.items.length?'Newer native session segments':'Native session segments'}</strong><p>{result?.items.length?'Codex stored newer work separately. Open a segment to see it; this history stays available.':'No newer segment is confirmed among the journals checked.'}</p>{result?.items.map(item=><button className="btn ghost" key={item.source.path} disabled={busy} onClick={()=>void open(item)}><span>{busy?'Opening…':`Open ${new Date(item.source.modifiedAt).toLocaleString()}`}</span><code>{item.source.path.split(/[\\/]/).at(-1)?.slice(-14,-6)}</code></button>)}{result?.partial&&<p>Some candidate journals could not be checked (64-journal limit).</p>}{error&&<p role="alert">{error}</p>}<button className="btn ghost" disabled={busy} onClick={()=>setRetry(n=>n+1)}>Check again</button></div></details>;
}
