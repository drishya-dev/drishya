import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent, type CSSProperties } from 'react'; import { plural } from '../lib/plural.ts';
import type { DiscoveredSource, RecordingSummary } from '@drishya/contracts';
import type {ReaderRecording} from "../api.ts";
import { BrandMark } from '../components/BrandMark.tsx';
import { SettingsGlyph } from '../components/SettingsGlyph.tsx';
import { InterfaceGlyph } from '../components/InterfaceGlyph.tsx';
import { HealthTag } from '../components/Home.tsx';
import { relTime } from '../components/common.tsx';
import { foldTemporary, parentFolder, timeSection, workspaceGroups } from '../lib/home-groups.ts';
import { useApp } from '../state.ts';
import { useWorkspaceState, useWorkspaceMemory } from '../lib/workspace-memory-react.ts';
import { GitHubStarLink } from './GitHubStarLink.tsx';
import { FeedbackLink } from './FeedbackLink.tsx';
import { HomeOverview } from './HomeOverview.tsx';
import './session-home.css';
import './home-active.css';
import './home-opening.css';
import { cleanSessionTitle } from '../lib/session-title.ts';
import { elapsed } from '../lib/now-state.ts';
import { importLabel, writingSince, type ImportProgress } from '../lib/home-import.ts';
import { useWaitNotice } from '../lib/use-wait-notice.ts';
import { HomeWaitCard } from '../components/WaitCard.tsx';
import { useReveal } from '../lib/reveal.ts';

const statCount = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
function SessionStats({stats}: {stats: RecordingSummary['stats']}) {
  if (!stats) return null;
  const basis = stats.source === 'claude-cost-state' ? 'reported by Claude Code' : 'recorded by Codex';
  return <span className="mh-row-stats">
    {stats.durationMs !== undefined && <span title={`${stats.durationMs} ms · ${basis}`}>{elapsed(stats.durationMs)}</span>}
    {stats.source === 'claude-cost-state' && stats.linesAdded !== undefined && <span className="mh-stat-added" title={`${plural(stats.linesAdded, 'line')} added · ${basis}`}>+{statCount.format(stats.linesAdded)}</span>}
    {stats.source === 'claude-cost-state' && stats.linesRemoved !== undefined && <span className="mh-stat-removed" title={`${plural(stats.linesRemoved, 'line')} removed · ${basis}`}>−{statCount.format(stats.linesRemoved)}</span>}
    {stats.source === 'codex-turns' && stats.lastOutcome !== undefined && stats.lastOutcome !== 'completed' && <span title={`Last turn ${stats.lastOutcome} · ${basis}`}>{stats.lastOutcome}</span>}
  </span>;
}

type Session={key:string;root?:string;repository?:string;time?:string;title:string;harness:string;recording?:RecordingSummary;source?:DiscoveredSource;journalUpdated?:boolean;agents?:number;nested?:boolean};
const phoneLayout = '(max-width: 650px)', sectionHeight = 34;
const subscribeLayout = (notify: () => void) => { const media = matchMedia(phoneLayout); media.addEventListener('change', notify); return () => media.removeEventListener('change', notify); };
export function SessionHome({recordings,sources,now,opening,error,refresh,onOpen}:{recordings:ReaderRecording[];sources?:DiscoveredSource[];now:Date;opening:ImportProgress;error?:string;refresh:()=>Promise<void>;openDemo:()=>void;onOpen:(source:DiscoveredSource,live:boolean)=>void}) {
  const phone = useSyncExternalStore(subscribeLayout, () => matchMedia(phoneLayout).matches, () => false);
  const rowHeight = phone ? 84 : 64, previousHeight = useRef(rowHeight);
  const [query,setQuery]=useWorkspaceState('home/query','','@home');
  const [harness,setHarness]=useWorkspaceState('home/harness','all','@home');
  const [workspace,setWorkspace]=useWorkspaceState('home/workspace','all','@home');
  const [days,setDays]=useWorkspaceState('home/days',0,'@home');
  const [intro,setIntro]=useWorkspaceState<boolean|undefined>('home/intro',undefined,'@home');
  const [workspacesOpen,setWorkspacesOpen]=useState(false);
  const workspaces=useRef<HTMLElement>(null),workspaceTrigger=useRef<HTMLButtonElement>(null);
  const [shown,setShown]=useWorkspaceState('home/groups/shown',50,'@home'),[workspaceTop,setWorkspaceTop]=useState(0);
  const resumeId=useApp(s=>s.resumeRecordingId), recovery=useApp(s=>s.recoveryState), recoveryError=useApp(s=>s.recoveryError);
  const localEvidence=useApp(s=>s.source?.kind==='daemon');
  const memory=useWorkspaceMemory('@home'), list=useRef<HTMLDivElement>(null), restoring=useRef(true);
  const pendingFocus=useRef<{index:number;top:number}|undefined>(undefined);
  const [listTop,setListTop]=useState(0),[refreshing,setRefreshing]=useState(false);
  // SHIP-3: the opening fills the first screen; the library is a sheet that comes up over it. The list scrolls only once the sheet is docked.
  const scroller=useRef<HTMLDivElement>(null),[docked,setDocked]=useState(false);
  const dock=(smooth:boolean)=>{const node=scroller.current;if(!node)return;const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;node.scrollTo({top:node.scrollHeight,behavior:smooth&&!reduce?'smooth':'auto'});};
  useLayoutEffect(()=>{if(memory.get('home/docked')||((memory.get('home/top') as number|undefined)??0)>0)dock(false);},[memory]);
  const refreshSessions=async()=>{if(refreshing)return;setRefreshing(true);try{await refresh();}finally{setRefreshing(false);}};
  const discoveryWait = useWaitNotice({
    waiting: sources === undefined && !error,
    quietMessage: ' · discovering local sessions…',
    longMessage: ' · discovering local agent journals across workspaces (leave window open)…',
  });
  const inventory=useMemo(()=>{
    const ids=new Set(recordings.map(r=>r.id));
    // A journal being imported gains its recording before the next scan says so.
    const paths=new Set(recordings.map(r=>r.sourcePath));
    const discovered=new Map((sources??[]).filter(s=>s.importedRecordingId).map(s=>[s.importedRecordingId,s]));
    // A sub-agent thread is part of its parent's work, so it leaves the main list; its own group keeps the whole journal reachable, and an orphan keeps a row.
    const threads=new Set((sources??[]).flatMap(s=>s.sessionId?[s.sessionId]:[])),agents=new Map<string,number>();
    const nested=(s?:DiscoveredSource)=>!!s?.parentSessionId&&threads.has(s.parentSessionId);
    for(const s of sources??[])if(nested(s))agents.set(s.parentSessionId!,(agents.get(s.parentSessionId!)??0)+1);
    const titled=(title:string|undefined,s?:DiscoveredSource)=>s?.parentSessionId&&(!title||nested(s))?`Sub-agent${s.agentName?` ${s.agentName}`:''}`:cleanSessionTitle(title||'');
    const count=(s?:DiscoveredSource)=>s?.sessionId?agents.get(s.sessionId):undefined;
    return [...recordings.map(r=>{const local=discovered.get(r.id)??sources?.find(s=>s.path===r.sourcePath),journalUpdated=!!local&&typeof r.sourceBytes==="number"&&local.bytes>r.sourceBytes;return {key:r.id,root:r.workspaceRoot,repository:r.repositoryRoot??r.workspaceRoot,time:journalUpdated?local!.modifiedAt:r.lastSourceTime,title:titled(r.title,local),harness:r.harness,recording:r,source:local,journalUpdated,agents:count(local),nested:nested(local)};}),...(sources??[]).filter(s=>(!s.importedRecordingId||!ids.has(s.importedRecordingId))&&!paths.has(s.path)).map(s=>({key:s.path,root:s.cwd,repository:s.repositoryRoot??s.cwd,time:s.modifiedAt,title:titled(s.title,s),harness:s.harness,source:s,agents:count(s),nested:nested(s)}))] as Session[];
  },[recordings,sources]);
  const active=useMemo(()=>inventory.flatMap(session=>{const since=session.nested?undefined:writingSince({sourceModifiedAt:session.source?.modifiedAt,health:session.recording?.health},now.getTime());return since===undefined?[]:[{session,since}];}).sort((a,b)=>b.since-a.since).map(item=>item.session),[inventory,now]);
  const showIntro=intro??inventory.length===0;
  const introduction=useReveal<HTMLParagraphElement>(showIntro);
  useEffect(()=>setWorkspacesOpen(false),[phone]);
  useEffect(()=>{
    if(!phone||!workspacesOpen)return;
    const outside=(event:PointerEvent)=>{if(!event.composedPath().includes(workspaces.current!))setWorkspacesOpen(false);};
    const fit=()=>{const bottom=workspaceTrigger.current?.getBoundingClientRect().bottom??0;workspaces.current?.style.setProperty('--mh-workspace-menu-max',`${Math.max(100,innerHeight-bottom-20)}px`);};
    document.addEventListener('pointerdown',outside);window.addEventListener('resize',fit);fit();
    return()=>{document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',fit);};
  },[phone,workspacesOpen]);
  const found=inventory.filter(s=>(harness==='all'||s.harness===harness)&&(!query||`${s.title} ${s.root??''} ${s.harness}`.toLowerCase().includes(query.toLowerCase()))&&(!days||Date.parse(s.time??'')>=now.getTime()-days*86400000));
  const rail=(list:Session[])=>{const threads=list.filter(s=>s.nested);return [...foldTemporary(workspaceGroups(list.filter(s=>!s.nested),s=>s.repository,s=>s.time)),...(threads.length?[{key:'subagents',name:'Sub-agents',detail:'Threads inside other sessions',items:threads}]:[])];};
  const matches=found.filter(s=>!s.nested),groups=rail(found),group=rail(inventory).find(g=>g.key===workspace);
  // A remembered workspace that no longer exists must not leave Home empty.
  const selection=workspace==='all'||!group?matches:groups.find(g=>g.key===workspace)?.items??[];
  const filtered=!!query||harness!=='all'||!!days||!!group;
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
  const latest=[...inventory].filter(s=>!s.nested).sort((a,b)=>(Date.parse(b.time??'')||0)-(Date.parse(a.time??'')||0))[0];
  const writing=new Set(active.map(s=>s.key));
  const projects=rail(inventory).filter(g=>g.key!=='subagents').map(g=>({key:g.key,name:g.name,minor:g.key==='temporary'||!g.root,count:g.items.length,latest:g.items.map(s=>s.time??'').sort().at(-1)||undefined}));
  // A row can gain its recording while the journal is still being read, so its key changes mid-import.
  const progressOf=(session:Session)=>opening[session.key]??(session.recording?.sourcePath?opening[session.recording.sourcePath]:undefined);
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
  const reset=()=>{pendingFocus.current=undefined;restoring.current=false;setShown(50);setListTop(0);if(list.current)list.current.scrollTop=0;memory.set('home/top',0);};
  const choose=(next:string)=>{setWorkspace(next);reset();setWorkspacesOpen(false);if(phone)workspaceTrigger.current?.focus({preventScroll:true});};
  const clearFilters=()=>{setQuery('');setHarness('all');setDays(0);setWorkspace('all');reset();};
  const positions=new Map(ordered.map((session,index)=>[session.key,index]));
  const navigateSessions=(event:KeyboardEvent<HTMLDivElement>)=>{
    if(event.altKey||event.ctrlKey||event.metaKey||!['ArrowDown','ArrowUp','Home','End','PageDown','PageUp'].includes(event.key)||!ordered.length)return;
    const row=(event.target as HTMLElement).closest<HTMLElement>('[data-session-index]');
    const current=Number(row?.dataset.sessionIndex??-1),page=Math.max(1,Math.floor((list.current?.clientHeight??rowHeight)/rowHeight));
    const next=Math.max(0,Math.min(ordered.length-1,event.key==='Home'?0:event.key==='End'?ordered.length-1:current+(event.key==='ArrowDown'?1:event.key==='ArrowUp'?-1:event.key==='PageDown'?page:-page)));
    event.preventDefault();dock(false);setShown(n=>Math.max(n,Math.ceil((next+1)/50)*50));
    let headings=0,previous='';for(let i=0;i<=next;i++){const label=timeSection(ordered[i]!.time,now);if(label!==previous){headings++;previous=label;}}
    // Jump to a real row, then focus after React mounts that bounded window.
    const top=next*rowHeight+headings*sectionHeight;
    pendingFocus.current={index:next,top};setListTop(top);
  };
  useLayoutEffect(()=>{
    const pending=pendingFocus.current;if(!pending||!list.current)return;
    list.current.scrollTop=pending.top;
    if(list.current.scrollTop!==listTop)setListTop(list.current.scrollTop);
    const row=list.current.querySelector<HTMLButtonElement>(`[data-session-index="${pending.index}"] .mh-session-open`);
    if(row){row.focus({preventScroll:true});pendingFocus.current=undefined;}
  },[shown,listTop,rowHeight]);
  const first=Math.max(0,Math.floor(workspaceTop/64)-4),end=Math.min(groups.length,first+40);
  return <div className={`home mh-home mh-home-v2${showIntro?'':' mh-home-compact'}${docked?' mh-docked':''}`} onWheel={event=>{/* The header and footer sit outside the scroller: the wheel over them still moves the page. */if(!scroller.current?.contains(event.target as Node))scroller.current?.scrollBy({top:event.deltaY});}} style={{'--mh-row-height':`${rowHeight}px`,'--mh-section-height':`${sectionHeight}px`} as CSSProperties}>
    <header className="mh-header"><div className="brand static"><BrandMark/>Drishya<span>Local agent workspace</span></div><div>{localEvidence&&<button className="btn ghost" onClick={()=>window.dispatchEvent(new Event('drishya-search-library'))}><InterfaceGlyph name="search"/>Search sessions</button>}<button className="btn ghost" aria-label="Workspace settings" onClick={()=>useApp.setState({settingsOpen:true})}><SettingsGlyph/>Settings</button></div></header>
    <div className="mh-scroll" ref={scroller} onScroll={event=>{const node=event.currentTarget,next=node.scrollTop>=node.scrollHeight-node.clientHeight-2;if(next!==docked){setDocked(next);memory.set('home/docked',next);}}}>
    <section className="mh-opening" aria-label="Drishya">
      <div className="mh-opening-words">
        <span className="mh-opening-mark" aria-hidden="true"><BrandMark/></span>
        <p className="mh-wordmark" aria-hidden="true">drishya<span lang="hi">दृश्य</span></p>
        <p className="mh-opening-line">See the work behind the change.</p>
        <div className="mh-opening-actions">
    {active.length>0&&<section className="mh-active" aria-label="Running now" title="These journals changed within the last minute. Drishya cannot tell whether the agent process is alive."><b className="mh-active-label">Running now</b>{active.slice(0,4).map(session=><button key={session.key} data-session-key={session.key} onClick={()=>session.source?onOpen(session.source,true):open(session)} title="Writing now · journal changed within the last minute"><span className={`mh-harness-icon ${session.harness}`} style={session.harness==='antigravity'?{color:'var(--agent-violet-ink)'}:undefined} aria-hidden="true">{session.harness==='codex'?'C':session.harness==='antigravity'?'A':'✳'}</span><strong>{session.title}</strong><small>{session.root?.replaceAll('\\','/').split('/').at(-1)??'No workspace'}</small></button>)}{active.length>4&&<small className="mh-active-more">+{active.length-4} more</small>}</section>}
    {resume&&<button className="mh-resume" onClick={()=>open(resume)}><span className="mh-resume-icon"><InterfaceGlyph name="arrow"/></span><span><small>Resume your last workspace</small><strong>{resume.title}</strong><span>{resume.root?.replace(/\\/g,'/').split('/').at(-1)??'Local session'} · {resume.harness==='codex'?'Codex':resume.harness==='antigravity'?'Antigravity':'Claude Code'}</span></span><span aria-hidden="true">↗</span></button>}
          {!resume&&!active.length&&latest&&<button className="mh-latest" onClick={()=>open(latest)}><span className="mh-resume-icon"><InterfaceGlyph name="arrow"/></span><span><small>Open your latest session</small><strong>{latest.title}</strong></span></button>}
          <button className="mh-browse" onClick={()=>dock(true)}>{inventory.length?`Browse ${inventory.filter(s=>!s.nested).length} sessions`:'Your sessions'}<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5"/></svg></button>
        </div>
        <p className="mh-opening-facts">Local · open source · no telemetry</p>
      </div>
    </section>
    <div className="mh-sheet">
    <section className="mh-intro"><div><span className="mh-eyebrow">Your work, in view</span><h1>{showIntro?'Your agents. In view.':'Your sessions.'}</h1>{introduction.shown&&<p ref={introduction.ref} id="home-introduction">Drishya brings agent work, code and review into one local workspace.</p>}</div><div className="mh-intro-actions"><button aria-expanded={showIntro} className="btn ghost mh-about" aria-label="About Drishya" onClick={()=>setIntro(!showIntro)}><svg className="mh-about-mark" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/></svg><span>{showIntro?'Less introduction':'About Drishya'}</span></button><button className="btn mh-refresh" onClick={()=>void refreshSessions()} disabled={refreshing} aria-busy={refreshing}><InterfaceGlyph name="refresh"/>{refreshing?'Refreshing…':'Refresh sessions'}</button></div></section>
    <HomeOverview sessions={inventory.filter(s=>!s.nested)} groups={projects} now={now} onGroup={key=>{choose(key);dock(true);}}/>
    <section className="mh-library" aria-label="Session library"><div className="mh-filters"><label className="mh-search"><InterfaceGlyph name="search"/><input aria-label="Find sessions" placeholder="Search sessions or workspaces…" onFocus={()=>dock(true)} maxLength={200} value={query} onChange={e=>{setQuery(e.target.value);reset();}} onKeyDown={e=>{if(e.key==='Escape'&&query){e.preventDefault();e.stopPropagation();setQuery('');reset();}}}/>{query&&<button className="mh-clear-search icon-btn" aria-label="Clear session search" onClick={()=>{setQuery('');reset();}}>×</button>}</label><select aria-label="Harness" value={harness} onChange={e=>{setHarness(e.target.value);reset();}}><option value="all">All harnesses</option><option value="codex">Codex</option><option value="claude-code">Claude Code</option><option value="antigravity">Antigravity</option></select><select aria-label="Session time range" value={days} onChange={e=>{setDays(Number(e.target.value));reset();}}><option value={0}>All time</option><option value={1}>Last day</option><option value={7}>Last week</option><option value={30}>Last month</option></select></div>
      {error&&<div className="mh-error" role="alert">{error}<button className="btn ghost" onClick={()=>void refreshSessions()} disabled={refreshing}>Retry</button></div>}
      <div className="mh-columns"><aside ref={workspaces} className="mh-workspaces" aria-label="Workspaces" onKeyDown={event=>{if(phone&&workspacesOpen&&event.key==='Escape'){event.preventDefault();event.stopPropagation();setWorkspacesOpen(false);workspaceTrigger.current?.focus({preventScroll:true});}}} onBlur={event=>{if(phone&&!event.currentTarget.contains(event.relatedTarget))setWorkspacesOpen(false);}}><button ref={workspaceTrigger} className="mh-workspace-trigger" aria-label="Choose workspace" aria-expanded={phone&&workspacesOpen} aria-controls="home-workspace-options" onClick={()=>setWorkspacesOpen(!workspacesOpen)}><InterfaceGlyph name="folder"/><span>{group?.name??'All workspaces'}</span><small>{group?selection.length:matches.length}</small><svg className="mh-chevron" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5"/></svg></button><header><span>Workspaces</span><span>{groups.length}</span></header><div id="home-workspace-options" className={`mh-workspace-options${workspacesOpen?' open':''}`}><button className={`mh-workspace${group?'':' selected'}`} onClick={()=>choose('all')} aria-pressed={!group}><InterfaceGlyph name="local"/><span><strong>All sessions</strong><small>Across your local workspaces</small></span><b>{matches.length}</b></button><div className="mh-workspace-list" tabIndex={0} aria-label="Scroll workspaces" onScroll={e=>setWorkspaceTop(e.currentTarget.scrollTop)}><div style={{height:groups.length*64,position:'relative'}}><div style={{position:'absolute',top:first*64,left:0,right:0}}>{groups.slice(first,end).map(g=><button key={g.key} className={`mh-workspace${workspace===g.key?' selected':''}`} onClick={()=>choose(g.key)} aria-pressed={workspace===g.key} title={g.root??'No workspace'}><InterfaceGlyph name="folder"/><span><strong>{g.name}</strong><small>{g.detail??(g.root?parentFolder(g.root):'No workspace recorded')}</small></span><b>{g.items.length}</b></button>)}</div></div></div></div></aside>
        <div className="mh-results"><header><div><h2>{group?.name??'All sessions'}</h2><span>{ordered.length} session{ordered.length===1?'':'s'}{!sources ? (discoveryWait.isImmediate ? '' : discoveryWait.message) : ''}</span></div>{filtered&&<button className="btn ghost mh-clear-filters" onClick={clearFilters}>Clear filters</button>}{recovery==='unavailable'&&<span className="mh-save-status" title={recoveryError}>Reading positions could not be saved</span>}</header><div className="mh-session-list" tabIndex={0} aria-label="Sessions; use arrow keys to navigate" onKeyDown={navigateSessions} ref={list} onWheel={()=>{restoring.current=false;}} onScroll={e=>{setListTop(e.currentTarget.scrollTop);if(!restoring.current)memory.set('home/top',e.currentTarget.scrollTop);if(e.currentTarget.scrollTop+e.currentTarget.clientHeight>=e.currentTarget.scrollHeight-200)setShown(n=>Math.min(ordered.length,n+50));}}>
          {visibleSections.map(({label,rows,first,end})=><section className="mh-time-group" key={label}><h3>{label}</h3><div aria-hidden="true" style={{height:first*rowHeight}}/>{rows.slice(first,end).map(session=><article className="mh-session" key={session.key} data-session-index={positions.get(session.key)}><span className={`mh-harness-icon ${session.harness}`} style={session.harness==='antigravity'?{color:'var(--agent-violet-ink)'}:undefined} aria-hidden="true">{session.harness==='codex'?'C':session.harness==='antigravity'?'A':'✳'}</span><button className="mh-session-open" onClick={()=>open(session)}><strong title={session.title}>{session.title}</strong><span><b>{session.harness==='codex'?'Codex':session.harness==='antigravity'?'Antigravity':'Claude Code'}</b>{(!group||!group.root||session.root!==group.root)&&<><i>·</i><span title={session.root}>{session.root?.replace(/\\/g,'/').split('/').at(-1)??'No workspace'}</span></>}<i>·</i><time title={session.time}>{relTime(session.time)}</time>{!!session.agents&&<><i>·</i><span>{session.agents} sub-agent{session.agents===1?'':'s'}</span></>}{session.journalUpdated?<em>Journal updated</em>:session.recording?<HealthTag r={session.recording}/>:null}</span></button><span className="mh-row-end"><SessionStats stats={session.recording?.stats}/>{progressOf(session)&&<small className="mh-importing" role="status">{importLabel(progressOf(session)!)}</small>}<button className="icon-btn" aria-label={`Open ${session.title}`} onClick={()=>open(session)}>↗</button></span>{progressOf(session)?.fraction!==undefined&&<i className="mh-import-bar" aria-hidden="true" style={{transform:`scaleX(${progressOf(session)!.fraction})`}}/>}</article>)}<div aria-hidden="true" style={{height:(rows.length-end)*rowHeight}}/></section>)}
          {!ordered.length && (
            !sources ? (
              discoveryWait.isImmediate ? null : (
                discoveryWait.isLong ? (
                  <><HomeWaitCard /><p className="muted small" role="status">{discoveryWait.message}</p></>
                ) : (
                  <HomeWaitCard />
                )
              )
            ) : (
              <div className="mh-empty"><InterfaceGlyph name="search"/><h2>{filtered?'No matching sessions':'Your next session starts here'}</h2><p>{filtered?'Try another workspace or clear the filters.':'Run Codex, Claude Code or Antigravity locally, then refresh. Existing local journals appear here without moving your work.'}</p></div>
            )
          )}
          {ordered.length>shown&&<button className="btn mh-load" onClick={()=>setShown(n=>n+50)}>Load more sessions · {ordered.length-shown} remaining</button>}
        </div></div>
      </div>
    </section>
    </div>
    </div><footer className="mh-footer"><span>Local capture. No telemetry.</span><GitHubStarLink/><FeedbackLink/></footer>
  </div>;
}
