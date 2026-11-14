import {Fragment} from 'react'; import {plural} from '../lib/plural.ts';
import {outputPaths} from '../lib/output-paths.ts';
import type {ProsePath} from '../lib/prose-path.ts';
import {openCapturedPath} from './CapturedPath.tsx';
import {useEffect,useId,useRef,useState} from 'react';
import {useApp} from '../state.ts';
import {workspaceApi} from '../api.ts';
import type {LibrarySearchPage} from '../../../../packages/store/src/search-types.ts';
import {ReadingDialog} from './ProductShell.tsx';
import {CapturedTime} from './common.tsx';
import {useWaitNotice} from '../lib/use-wait-notice.ts';
import './library-search.css';

/** An occasional investigation, not another resident Home or canvas panel. */
export function LibrarySearch() {
  const source=useApp(s=>s.source),screen=useApp(s=>s.screen),recordings=useApp(s=>s.recordings);
  const [open,setOpen]=useState(false),[q,setQ]=useState(''),[root,setRoot]=useState(''),[harness,setHarness]=useState('');
  const [from,setFrom]=useState(''),[to,setTo]=useState(''),[before,setBefore]=useState<number>();
  const [page,setPage]=useState<LibrarySearchPage>(),[error,setError]=useState<string>(),[loading,setLoading]=useState(false),[opening,setOpening]=useState(false),[retry,setRetry]=useState(0);
  const searchWait = useWaitNotice({
    waiting: loading,
    quietMessage: 'Searching sessions…',
    longMessage: 'Searching session records across journals… This can take a moment for large search queries.',
  });
  const rootsId=useId();
  const input=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(open)input.current?.focus({preventScroll:true});},[open]);
  useEffect(()=>{const show=()=>{if(useApp.getState().source?.kind==='daemon')setOpen(true);};window.addEventListener('drishya-search-library',show);return()=>window.removeEventListener('drishya-search-library',show);},[]);
  useEffect(()=>{setOpen(false);setQ('');setPage(undefined);},[source]);
  useEffect(()=>{if(!['home','viewer'].includes(screen))setOpen(false);},[screen]);
  useEffect(()=>setBefore(undefined),[q,root,harness,from,to]);
  useEffect(()=>{
    setPage(undefined);setError(undefined);setLoading(false);
    if(!open||source?.kind!=='daemon'||q.trim().length<2)return;
    let active=true;setLoading(true);
    const timer=setTimeout(()=>{
      const fromTime=from?`${from}T00:00:00.000Z`:undefined,toTime=to?`${to}T23:59:59.999Z`:undefined;
      void workspaceApi.searchLibrary({q,root,harness:harness as 'codex'|'claude-code'|'antigravity'|undefined,from:fromTime,to:toTime,before}).then(value=>{if(active){setPage(value);setLoading(false);}}).catch(err=>{if(active){setError(err.message);setLoading(false);}});
    },160);
    return()=>{active=false;clearTimeout(timer);};
  },[open,source,q,root,harness,from,to,before,retry]);
  const choose=async(hit:LibrarySearchPage['items'][number],file?:ProsePath)=>{
    if(opening||!source)return;setOpening(true);setError(undefined);
    try {
      await useApp.getState().openRecording(hit.recordingId);
      const current=useApp.getState();if(current.source!==source||current.recordingId!==hit.recordingId||current.screen!=='viewer')return;
      const target=new URL(location.href);target.hash=`#/r/${encodeURIComponent(hit.recordingId)}`;history.pushState(null,'',target);
      current.set({developerWorkspace:false,currentFile:undefined,filePanel:undefined,selectedOp:undefined,expandedOp:undefined,explore:false,follow:false,held:true,focusObservationId:hit.observationId});
      await current.loadHistoryWindow({observationId:hit.observationId});
      if(file&&useApp.getState().source===source&&useApp.getState().screen==='viewer'&&useApp.getState().recordingId===hit.recordingId)openCapturedPath(file);
      setOpen(false);
    } catch(err){setError((err as Error).message);}finally{setOpening(false);}
  };
  if(!open||source?.kind!=='daemon')return null;
  return <ReadingDialog title="Search sessions" close={()=>setOpen(false)} className="library-search">
    <div className="library-search-body">
    <input ref={input} autoFocus type="search" aria-label="Search all imported sessions" placeholder="Find an error, decision, command or file…" maxLength={200} value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setOpen(false);}}}/>
    <details className="library-search-filters"><summary>Filter by workspace, harness or date</summary><div>
      <label>Workspace<input aria-label="Exact workspace path" list={rootsId} placeholder="All workspaces" value={root} maxLength={2048} onChange={e=>setRoot(e.target.value)}/><datalist id={rootsId}>{[...new Set(recordings.map(r=>r.workspaceRoot).filter((r):r is string=>!!r))].slice(0,200).map(path=><option key={path} value={path}/>)}</datalist></label>
      <label>Harness<select aria-label="Harness" value={harness} onChange={e=>setHarness(e.target.value)}><option value="">All harnesses</option><option value="codex">Codex</option><option value="claude-code">Claude Code</option><option value="antigravity">Antigravity</option></select></label>
      <label>From (UTC)<input type="date" aria-label="From date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>To (UTC)<input type="date" aria-label="To date" value={to} onChange={e=>setTo(e.target.value)}/></label>
    </div></details>
    <p className="library-search-scope">Imported sessions · redacted text · 50 results per page, recently indexed first. Excerpts up to 1,600 characters; full artifacts and unimported journals are not searched.</p>
    <div className="library-search-results" aria-label="Session results" aria-busy={loading||opening}>
      {loading && (searchWait.isImmediate ? null : <p role="status">{searchWait.message}</p>)}{error&&<p role="alert">{error} <button className="btn ghost" onClick={()=>setRetry(n=>n+1)}>Retry</button></p>}
      {!loading&&!error&&page&&!page.items.length&&<p>Nothing matched these filters.</p>}
      {!page&&!loading&&!error&&<p>Search across imported conversations without opening each session.</p>}
      {page?.items.map(hit=><Fragment key={`${hit.recordingId}/${hit.observationId}`}><button disabled={opening} onClick={()=>void choose(hit)}><strong>{hit.title||'Untitled session'}</strong><span>{hit.harness==='codex'?'Codex':hit.harness==='antigravity'?'Antigravity':'Claude Code'}{hit.sourceTime&&<> · <CapturedTime iso={hit.sourceTime}/></>}</span><small title={hit.workspaceRoot}>{hit.workspaceRoot||'Workspace not recorded'}</small><p>{hit.snippet}</p></button>{outputPaths(hit.snippet,hit.workspaceRoot,4).map(ref=><button key={ref.start} className="md-path" disabled={opening} aria-label={`Open work on ${ref.path}${ref.line?` at line ${ref.line}`:''}`} onClick={()=>void choose(hit,ref)}>{hit.snippet.slice(ref.start,ref.end)} ↗</button>)}</Fragment>)}
    </div>
    <footer><span role="status">{page?`${plural(page.items.length,'result')}${before?' · continued':''}`:'Session search'}</span><button className="btn ghost" disabled={!before||loading} onClick={()=>setBefore(undefined)}>First page</button><button className="btn" disabled={!page?.nextBefore||loading} onClick={()=>setBefore(page!.nextBefore)}>Next results</button></footer>
    </div></ReadingDialog>;
}
