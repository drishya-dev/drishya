import {StoredToolResult} from './StoredToolResult.tsx';
import { useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import type { Operation } from '@drishya/contracts';
import { isScreenOperation } from '@drishya/scene';
import { browserStep, safeWebUrl } from '../lib/browser-evidence.ts';
import { useApp } from '../state.ts';
import { ToolOutput } from './ToolOutput.tsx';
import { ToolInput } from './ToolInput.tsx';
import { WebResults } from './WebResults.tsx';
import { webMaterial } from '../../../../packages/scene/src/web.ts';
import type { WebResultPage } from '../../../../packages/scene/src/web.ts';
import { CapturedOutcomes } from './CapturedOutcomes.tsx';
import { fetchFacts } from './CommandRun.tsx';
import './browser-evidence.css';

export function RecordedUrl({ url }: { url: string }) {
  return safeWebUrl(url) ? <a className="browser-url" href={url} target="_blank" rel="noopener noreferrer" onClick={event => event.stopPropagation()}>{url}</a> : <span className="browser-url">{url}</span>;
}

/** Captured page material. The result is an excerpt, never a generated page summary. */
export function BrowserEvidence({ op, full = false }: { op: Operation; full?: boolean }) {
  const step = browserStep(op);
  if (!step) return null;
  return <div className="browser-evidence">
    <div className="browser-address">{step.url ? <RecordedUrl url={step.url}/> : <span className="muted">No URL in captured input</span>}</div>
    <div className="browser-action"><span>{step.action}</span>{step.tab !== undefined && <small>tab {step.tab}</small>}<small>{op.status === 'running' ? 'Running' : op.status === 'error' ? 'Failed' : op.status === 'ok' ? 'Returned' : 'Outcome not captured'}</small></div>
    {step.batch?.length ? <ol className="browser-batch">{step.batch.map((item, i) => <li key={i}><span>{item.name ?? 'Recorded action'}{item.action ? ` · ${item.action}` : ''}</span>{item.url && <RecordedUrl url={item.url}/>}</li>)}{step.batchCount! > step.batch.length && <li className="muted">{step.batchCount! - step.batch.length} more actions · expand for captured input</li>}</ol> : null}
    {step.query && <div className="browser-query">{step.query}</div>}
    {full&&op.detail.kind==='mcp'?<StoredToolResult op={op} full/>:step.excerpt ? <div className={`browser-excerpt${full ? ' full' : ''}`} tabIndex={0} aria-label="Captured browser result excerpt"><ToolOutput text={step.excerpt}/></div> : <p className="muted">{op.status === 'running' ? 'Waiting for browser result' : 'No page text captured'}</p>}
    {full && op.detail.kind === 'mcp' && <details><summary>Captured browser input</summary><ToolInput value={op.detail.input}/></details>}
  </div>;
}

export function WebEvidence({ op, full = false }: { op: Operation; full?: boolean }) {
  const d = op.detail;
  if (d.kind !== 'web') return null;
  return <WebReading key={op.id} op={op} detail={d} full={full}/>;
}

function WebReading({op,detail:d,full}:{op:Operation;detail:Extract<Operation['detail'],{kind:'web'}>;full:boolean}) {
  const source=useApp(s=>s.source),recordingId=useApp(s=>s.recordingId);
  const [start,setStart]=useState(0),[query,setQuery]=useState(''),[retry,setRetry]=useState(0);
  const [knownTotal,setKnownTotal]=useState<number>();
  const [loaded,setLoaded]=useState<{key:string;page?:WebResultPage;error?:boolean}>();
  const preview=useMemo(()=>webMaterial(d.resultPreview??'',d.results??[]),[d.resultPreview,d.results]);
  const canRead=full&&op.endSequence!==undefined&&!!source?.webResult&&!!recordingId;
  const resultId=op.observationIds.length>1?op.observationIds.at(-1):undefined;
  const key=JSON.stringify([recordingId,op.id,resultId,op.endSequence,start,query,retry]);
  useEffect(()=>{
    if(!canRead||!source?.webResult||!recordingId)return;
    let active=true;
    source.webResult(recordingId,op.id,{start,count:100,q:query,...(resultId?{resultId}:{})}).then(page=>{if(active){setLoaded({key,page});setKnownTotal(page.total);}}).catch(()=>{if(active)setLoaded({key,error:true});});
    return()=>{active=false;};
  },[canRead,source,recordingId,key]);
  const page=loaded?.key===key?loaded.page:undefined,error=loaded?.key===key&&loaded.error;
  // A held reader can survive a replay seek. Never retain its later result before op-end.
  const displayed=canRead?(page??loaded?.page):undefined;
  const material=displayed??preview,results=displayed?.results??preview.results;
  const open=()=>useApp.getState().select(op.id);
  return <div className="web-evidence" aria-busy={canRead&&!page&&!error}>
    {d.url && <RecordedUrl url={d.url}/>}
    {d.query && <div className="query">{d.query}</div>}
    {full&&<div className="web-reading-meta"><span>{displayed?`${displayed.total} recorded result${displayed.total===1?'':'s'}`:`${preview.results.length} results in preview`}</span>{(displayed?.time??op.endTime)&&<time dateTime={displayed?.time??op.endTime}>{new Date((displayed?.time??op.endTime)!).toLocaleString()}</time>}</div>}
    {d.fetch && fetchFacts(d.fetch) && <div className="browser-action">{fetchFacts(d.fetch)}</div>}
    {full&&canRead&&(knownTotal??preview.results.length)>50&&<label className="web-result-filter">Find result<input type="search" value={query} placeholder="Title, address or snippet" onChange={event=>{setQuery(event.target.value);setStart(0);}}/></label>}
    {full&&canRead&&!page&&!error&&<span className="muted" role="status">Opening recorded results…</span>}
    {full&&error&&<p role="status">Could not open recorded results. <button type="button" onClick={()=>setRetry(value=>value+1)}>Retry</button></p>}
    {results.length ? <WebResults results={results} snippets={full} limit={full ? undefined : 5} onShowAll={open}/> : null}
    {!full&&op.endSequence!==undefined&&results.length<=5&&<button type="button" className="web-more" onClick={event=>{event.stopPropagation();open();}}>Open recorded results</button>}
    {full&&displayed&&(displayed.total>100||query)&&<nav className="web-result-pages" aria-label="Recorded result list"><span>{displayed.matched?`${displayed.start+1}–${displayed.start+displayed.results.length} of ${displayed.matched}${query?' matches':''}`:'No matching results'}</span><button type="button" disabled={!page||!displayed.start} onClick={()=>setStart(Math.max(0,start-100))}>Previous results</button><button type="button" disabled={!page||!displayed.hasMore} onClick={()=>setStart(start+100)}>Next results</button></nav>}
    {full&&!results.length&&!query&&<p className="muted">{op.endSequence===undefined?'Waiting for result':page?.availability==='removed'?'Captured result is no longer stored.':d.url?'No result list recorded for this page fetch.':'No structured result list available.'}</p>}
    {full && <CapturedOutcomes output={d.resultPreview}/>}
    {(full||!results.length)&&material.text&&<section className="web-response"><h4>{displayed?.availability==='captured'?(d.url?'Captured page text':'Captured response text'):'Available web preview'}</h4><div className={`browser-excerpt${full?' full':''}`} tabIndex={0} aria-label="Captured web result excerpt"><ToolOutput text={material.text}/></div></section>}
    {full&&<details className="web-original"><summary>{displayed?.originalComplete?'Original captured result':'Original captured preview'}</summary><div className="browser-excerpt full" tabIndex={0}><pre className="output web-original-text">{material.original||'No result text captured'}</pre></div>{displayed&&!displayed.originalComplete&&<small className="muted">Text excerpt limited to 64 KiB. Result counts cover the stored list.</small>}</details>}
  </div>;
}

/** The chosen step is still the original operation card: images, raw input and inspection keep their owners. */
export function BrowserStrip({ operations, renderOperation }: { operations: Operation[]; renderOperation: (op: Operation, index: number) => ReactNode }) {
  const trackLatest = useApp(s => s.follow && (s.mode === 'replay' || s.recording?.live === true));
  const [choice, setChoice] = useState(trackLatest ? operations.at(-1)?.id : operations[0]?.id);
  const target = useApp(s => s.expandedOp ?? s.selectedOp);
  const [lastCount, setLastCount] = useState(operations.length);
  if (lastCount !== operations.length) { setLastCount(operations.length); if (trackLatest) setChoice(operations.at(-1)?.id); }
  const observation = useApp(s => s.focusObservationId);
  const [lastTarget, setLastTarget] = useState<string>();
  const targeted = operations.find(op => op.id === target || observation && op.observationIds.includes(observation))?.id;
  // A new explicit navigation wins once. Scrubbing afterwards remains free.
  if (targeted !== lastTarget) { setLastTarget(targeted); if (targeted) setChoice(targeted); }
  const index = Math.max(0, operations.findIndex(op => op.id === choice));
  const op = operations[index];
  useLayoutEffect(() => { window.dispatchEvent(new Event('drishya-material-layout')); }, [op?.id]);
  if (!op) return null;
  const screenFrames = operations.filter(item => isScreenOperation(item) && item.images?.length).length;
  const choose = (next: number) => { const item = operations[next]; if (item) { setChoice(item.id); useApp.getState().set({ follow: false }); } };
  return <div className="browser-strip" data-browser-steps={operations.length} data-browser-first-op={operations[0]?.id}>
    <nav className="browser-scrubber" aria-label="Captured browser steps" onClick={event => event.stopPropagation()}>
      <button type="button" aria-label="Previous browser step" disabled={index === 0} onClick={() => choose(index - 1)}>‹</button>
      <span>Browser · {index + 1} / {operations.length}</span>
      <input type="range" aria-label="Browser step" min={1} max={operations.length} value={index + 1} onChange={event => choose(Number(event.target.value) - 1)}/>
      <button type="button" aria-label="Next browser step" disabled={index === operations.length - 1} onClick={() => choose(index + 1)}>›</button>
      {screenFrames > 0 && <button type="button" className="browser-screen-open" title="Watch these steps on a large screen" onClick={() => useApp.setState({ screenView: { opId: isScreenOperation(op) ? op.id : operations.find(item => isScreenOperation(item))?.id } })}>Open screen</button>}
    </nav>
    {renderOperation(op, index)}
  </div>;
}
