import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import type { DiscoveredSource, RecordingSummary } from '@drishya/contracts';
import type {ReaderRecording} from "../api.ts";
import { BrandMark } from '../components/BrandMark.tsx';
import { SettingsGlyph } from '../components/SettingsGlyph.tsx';
import { InterfaceGlyph } from '../components/InterfaceGlyph.tsx';
import { HealthTag } from '../components/Home.tsx';
import { relTime } from '../components/common.tsx';
import { timeSection, workspaceGroups } from '../lib/home-groups.ts';
import { useApp } from '../state.ts';
import { useWorkspaceState, useWorkspaceMemory } from '../lib/workspace-memory-react.ts';
import './session-home.css';

type Session={key:string;root?:string;time?:string;title:string;harness:string;recording?:RecordingSummary;source?:DiscoveredSource;journalUpdated?:boolean};
const phoneLayout = '(max-width: 650px)', sectionHeight = 34;
const subscribeLayout = (notify: () => void) => { const media = matchMedia(phoneLayout); media.addEventListener('change', notify); return () => media.removeEventListener('change', notify); };
export function SessionHome({recordings,sources,now,busy,error,refresh,onOpen}:{recordings:ReaderRecording[];sources?:DiscoveredSource[];now:Date;busy?:string;error?:string;refresh:()=>void;openDemo:()=>void;onOpen:(source:DiscoveredSource,live:boolean)=>void}) {
  const phone = useSyncExternalStore(subscribeLayout, () => matchMedia(phoneLayout).matches, () => false);
  const rowHeight = phone ? 104 : 80, previousHeight = useRef(rowHeight);
  const [query,setQuery]=useWorkspaceState('home/query','','@home');
  const [harness,setHarness]=useWorkspaceState('home/harness','all','@home');
  const [workspace,setWorkspace]=useWorkspaceState('home/workspace','all','@home');
  const [days,setDays]=useWorkspaceState('home/days',0,'@home');
  const [shown,setShown]=useWorkspaceState('home/groups/shown',50,'@home'),[workspaceTop,setWorkspaceTop]=useState(0);
  const resumeId=useApp(s=>s.resumeRecordingId), recovery=useApp(s=>s.recoveryState), recoveryError=useApp(s=>s.recoveryError);
  const localEvidence=useApp(s=>s.source?.kind==='daemon');
  const memory=useWorkspaceMemory('@home'), list=useRef<HTMLDivElement>(null), restoring=useRef(true);
  const [listTop,setListTop]=useState(0);
  const inventory=useMemo(()=>{
    const ids=new Set(recordings.map(r=>r.id));
    const discovered=new Map((sources??[]).filter(s=>s.importedRecordingId).map(s=>[s.importedRecordingId,s]));
    return [...recordings.map(r=>{const local=discovered.get(r.id),journalUpdated=!!local&&typeof r.sourceBytes==="number"&&local.bytes>r.sourceBytes;return {key:r.id,root:r.workspaceRoot,time:journalUpdated?local!.modifiedAt:r.lastSourceTime,title:r.title||'Untitled session',harness:r.harness,recording:r,journalUpdated};}),...(sources??[]).filter(s=>!s.importedRecordingId||!ids.has(s.importedRecordingId)).map(s=>({key:s.path,root:s.cwd,time:s.modifiedAt,title:s.title||'Untitled session',harness:s.harness,source:s}))] as Session[];
  },[recordings,sources]);
  const matches=inventory.filter(s=>(harness==='all'||s.harness===harness)&&(!query||`${s.title} ${s.root??''} ${s.harness}`.toLowerCase().includes(query.toLowerCase()))&&(!days||Date.parse(s.time??'')>=now.getTime()-days*86400000));
  const groups=workspaceGroups(matches,s=>s.root,s=>s.time);
  const group=groups.find(g=>g.key===workspace);
  const selection=workspace==='all'?matches:group?.items??matches;
  const ordered=[...selection].sort((a,b)=>(Date.parse(b.time??'')||0)-(Date.parse(a.time??'')||0)||a.key.localeCompare(b.key));
  const sections=new Map<string,Session[]>();
  for(const session of ordered.slice(0,shown)) {const label=timeSection(session.time,now);const rows=sections.get(label)??[];rows.push(session);sections.set(label,rows);}
  let sectionTop=0;
  const visibleSections=[...sections].map(([label,rows])=>{
    const first=Math.max(0,Math.min(rows.length,Math.floor((listTop-sectionTop-sectionHeight)/rowHeight)-4));
    const end=Math.max(first,Math.min(rows.length,Math.ceil((listTop+(list.current?.clientHeight??700)-sectionTop-sectionHeight)/rowHeight)+4));
    sectionTop+=sectionHeight+rows.length*rowHeight;return {label,rows,first,end};
  });
  const resume=inventory.find(s=>s.key===resumeId);
  const open=(session:Session)=>{if(session.recording){location.hash=`#/r/${session.key}`;void useApp.getState().openRecording(session.key);}else if(session.source)onOpen(session.source,false);};
  useLayoutEffect(()=>{if(restoring.current&&list.current&&(sources!==undefined||error)) {list.current.scrollTop=memory.get('home/top') as number??0;setListTop(list.current.scrollTop);restoring.current=false;}},[memory,ordered.length,shown,sources!==undefined,error]);
  useLayoutEffect(() => {
    const before = previousHeight.current; previousHeight.current = rowHeight;
    if (before === rowHeight || !list.current || restoring.current) return;
    // Preserve the same session and fractional row position across the layout boundary.
    let remaining = listTop, next = 0;
    for (const rows of sections.values()) {
      if (remaining < sectionHeight) { next += remaining; break; }
      remaining -= sectionHeight; next += sectionHeight;
      if (remaining < rows.length * before) { next += remaining / before * rowHeight; break; }
      remaining -= rows.length * before; next += rows.length * rowHeight;
    }
    list.current.scrollTop = next; setListTop(list.current.scrollTop); memory.set('home/top', list.current.scrollTop);
  }, [rowHeight]);
  const reset=()=>{restoring.current=false;setShown(50);setListTop(0);if(list.current)list.current.scrollTop=0;memory.set('home/top',0);};
  const choose=(next:string)=>{setWorkspace(next);reset();};
  const first=Math.max(0,Math.floor(workspaceTop/64)-4),end=Math.min(groups.length,first+40);
  return <div className="home mh-home" style={{'--mh-row-height':`${rowHeight}px`,'--mh-section-height':`${sectionHeight}px`} as CSSProperties}>
    <header className="mh-header"><div className="brand static"><BrandMark/>Drishya<span>Local agent workspace</span></div><div>{localEvidence&&<button className="btn ghost" onClick={()=>window.dispatchEvent(new Event('drishya-search-library'))}><InterfaceGlyph name="search"/>Search evidence</button>}<a className="btn ghost mh-github" href="https://github.com/drishya-dev/drishya" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">☆</span>Star on GitHub</a><button className="btn ghost" aria-label="Workspace settings" onClick={()=>useApp.setState({settingsOpen:true})}><SettingsGlyph/>Settings</button></div></header>
    <section className="mh-intro"><div><span className="mh-eyebrow">Your work, in view</span><h1>Your agents. In view.</h1><p>Drishya brings captured work, code and review into one local workspace.</p></div><button className="btn mh-refresh" onClick={refresh}><InterfaceGlyph name="refresh"/>Refresh sessions</button></section>
    {resume&&<button className="mh-resume" onClick={()=>open(resume)}><span className="mh-resume-icon"><InterfaceGlyph name="arrow"/></span><span><small>Resume your last workspace</small><strong>{resume.title}</strong><span>{resume.root?.replace(/\\/g,'/').split('/').at(-1)??'Local session'} · {resume.harness==='codex'?'Codex':'Claude Code'}</span></span><span aria-hidden="true">↗</span></button>}
    <section className="mh-library" aria-label="Session library"><div className="mh-filters"><label className="mh-search"><InterfaceGlyph name="search"/><input aria-label="Find sessions" placeholder="Search sessions or workspaces…" maxLength={200} value={query} onChange={e=>{setQuery(e.target.value);reset();}}/></label><select aria-label="Harness" value={harness} onChange={e=>{setHarness(e.target.value);reset();}}><option value="all">All harnesses</option><option value="codex">Codex</option><option value="claude-code">Claude Code</option></select><select aria-label="Session time range" value={days} onChange={e=>{setDays(Number(e.target.value));reset();}}><option value={0}>All time</option><option value={1}>Last day</option><option value={7}>Last week</option><option value={30}>Last month</option></select></div>
      {error&&<div className="mh-error" role="alert">{error}<button className="btn ghost" onClick={refresh}>Retry</button></div>}
      <div className="mh-columns"><aside className="mh-workspaces" aria-label="Workspaces"><header><span>Workspaces</span><span>{groups.length}</span></header><button className={`mh-workspace${workspace==='all'?' selected':''}`} onClick={()=>choose('all')} aria-pressed={workspace==='all'}><InterfaceGlyph name="local"/><span><strong>All sessions</strong><small>Across your local workspaces</small></span><b>{matches.length}</b></button><div className="mh-workspace-list" tabIndex={0} aria-label="Scroll workspaces" onScroll={e=>setWorkspaceTop(e.currentTarget.scrollTop)}><div style={{height:groups.length*64,position:'relative'}}><div style={{position:'absolute',top:first*64,left:0,right:0}}>{groups.slice(first,end).map(g=><button key={g.key} className={`mh-workspace${workspace===g.key?' selected':''}`} onClick={()=>choose(g.key)} aria-pressed={workspace===g.key} title={g.root??'No captured workspace'}><InterfaceGlyph name="folder"/><span><strong>{g.name}</strong><small>{g.root??'No workspace recorded'}</small></span><b>{g.items.length}</b></button>)}</div></div></div></aside>
        <div className="mh-results"><header><div><h2>{group?.name??'All sessions'}</h2><span>{ordered.length} session{ordered.length===1?'':'s'}{!sources?' · discovering local sessions…':''}</span></div><span className="mh-save-status" title={recoveryError}>{recovery==='saved'?'Reading locations saved locally':recovery==='unavailable'?'Location recovery unavailable':''}</span></header><div className="mh-session-list" tabIndex={0} ref={list} onWheel={()=>{restoring.current=false;}} onScroll={e=>{setListTop(e.currentTarget.scrollTop);if(!restoring.current)memory.set('home/top',e.currentTarget.scrollTop);if(e.currentTarget.scrollTop+e.currentTarget.clientHeight>=e.currentTarget.scrollHeight-200)setShown(n=>Math.min(ordered.length,n+50));}}>
          {visibleSections.map(({label,rows,first,end})=><section className="mh-time-group" key={label}><h3>{label}</h3><div aria-hidden="true" style={{height:first*rowHeight}}/>{rows.slice(first,end).map(session=><article className="mh-session" key={session.key}><span className={`mh-harness-icon ${session.harness}`} aria-hidden="true">{session.harness==='codex'?'C':'✳'}</span><button className="mh-session-open" disabled={!!busy} onClick={()=>open(session)}><strong title={session.title}>{session.title}</strong><span><b>{session.harness==='codex'?'Codex':'Claude Code'}</b><i>·</i>{!group&&<span title={session.root}>{session.root?.replace(/\\/g,'/').split('/').at(-1)??'No workspace'}</span>}<time title={session.time}>{relTime(session.time)}</time>{session.journalUpdated?<em>Journal updated</em>:session.recording?<HealthTag r={session.recording}/>:<em>Available locally</em>}</span></button><span className="mh-row-end">{session.recording?<small>{session.recording.observationCount.toLocaleString()} events</small>:busy===session.key?<small>Opening…</small>:null}<button className="icon-btn" aria-label={`Open ${session.title}`} disabled={!!busy} onClick={()=>open(session)}>↗</button></span></article>)}<div aria-hidden="true" style={{height:(rows.length-end)*rowHeight}}/></section>)}
          {!ordered.length&&<div className="mh-empty"><InterfaceGlyph name="search"/><h2>{query||harness!=='all'||days?'No matching sessions':'Your next session starts here'}</h2><p>{query||harness!=='all'||days?'Try another workspace or clear the filters.':'Run Codex or Claude Code locally, then refresh. Existing local journals appear here without moving your work.'}</p></div>}
          {ordered.length>shown&&<button className="btn mh-load" onClick={()=>setShown(n=>n+50)}>Load more sessions · {ordered.length-shown} remaining</button>}
        </div></div>
      </div>
    </section><footer className="mh-footer"><span>Local capture. No telemetry.</span><span>{inventory.length} sessions · {workspaceGroups(inventory,s=>s.root,s=>s.time).length} workspaces</span></footer>
  </div>;
}
