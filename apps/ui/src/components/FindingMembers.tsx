import {useEffect,useRef,useState} from 'react';
import {findingMembers,type FindingMembers as Members,type ReviewFinding} from '../../../../packages/scene/src/review-insights.ts';
import {useApp} from '../state.ts';
import {CapturedTime} from './common.tsx';

export function FindingMembers({finding,back,open}:{finding:ReviewFinding;back:()=>void;open:(id:string)=>void}) {
  const source=useApp(s=>s.source),id=useApp(s=>s.recordingId)!,projection=useApp(s=>s.projection);
  const heading=useRef<HTMLHeadingElement>(null),[input,setInput]=useState(''),[query,setQuery]=useState(''),[page,setPage]=useState(0),[retry,setRetry]=useState(0);
  const [value,setValue]=useState<{key:string;data:Members}>(),[error,setError]=useState('');
  const key=JSON.stringify([query,page,retry]),data=value?.key===key?value.data:undefined;
  useEffect(()=>{heading.current?.focus();},[]);
  useEffect(()=>{const timer=setTimeout(()=>{if(input!==query){setQuery(input);setPage(0);}},200);return()=>clearTimeout(timer);},[input,query]);
  useEffect(()=>{
    let active=true;setError('');
    const request=source?.findingMembers?source.findingMembers(id,finding.key,page,query):source?.kind==='bundle'&&projection?Promise.resolve(findingMembers(projection,finding.key,page,query)):Promise.reject(new Error('Finding membership is unavailable for this source.'));
    void request.then(data=>{if(active){const last=Math.max(0,Math.ceil(data.matching/25)-1);if(page>last)setPage(last);else setValue({key,data});}}).catch(error=>{if(active)setError(error.message);});return()=>{active=false;};
  },[source,id,finding.key,key]);
  const pages=Math.max(1,Math.ceil((data?.matching??0)/25));
  return <>
    <div className="insights-intro finding-member-intro"><button className="btn ghost" onClick={back}>← Findings</button><h3 ref={heading} tabIndex={-1}>{finding.title}</h3><label>Filter captured titles, paths and command previews<input type="search" aria-label="Filter finding members" maxLength={200} placeholder="Path, tool or captured text…" value={input} onChange={event=>setInput(event.target.value)}/></label><span>{data?`${data.matching} matching · ${data.total} total · through observation ${data.through}`:'Reading exact finding membership…'}</span><button className="btn ghost finding-refresh" aria-label="Refresh members" title="Refresh members" onClick={()=>setRetry(n=>n+1)}>↻</button></div>
    <div className="insights-content" aria-label="Finding members">
      {error?<p role="alert" className="insights-error">{error}</p>:!data?<p role="status" className="insights-empty">Loading captured members…</p>:!data.available?<p className="insights-empty">This finding is no longer available. Return and refresh findings.</p>:<>{data.items.map(item=><article className="insight-row finding-member" key={item.id}><header><h3>{item.title}</h3>{item.time&&<CapturedTime iso={item.time}/>}</header><p>{item.detail}</p><footer><span>{item.sequenceBasis==='timeline-position'?'Timeline position':'Observation'} {item.sequence}{item.tool?` · ${item.kind} · ${item.tool}`:''}{item.status?` · ${item.status==='ok'?'Tool returned':item.status==='error'?'Failed tool outcome':item.status==='unknown'?'Outcome not captured':'Running'}`:''}</span>{item.operationId&&<button className="btn ghost" onClick={()=>open(item.operationId!)}>{finding.kind==='capture-gap'?'Next captured activity':'Open captured action'} ↗</button>}</footer></article>)}{!data.items.length&&<p className="insights-empty">No matching members on this page.{query?' Change or clear the filter.':''}</p>}</>}
    </div>
    <nav className="commands-pages" aria-label="Finding member pages"><button className="btn" disabled={!page} onClick={()=>setPage(n=>n-1)}>Previous members</button><span>Page {page+1} of {pages} · up to 25 per page</span><button className="btn" disabled={!data||page+1>=pages} onClick={()=>setPage(n=>n+1)}>Next members</button></nav>
  </>;
}
