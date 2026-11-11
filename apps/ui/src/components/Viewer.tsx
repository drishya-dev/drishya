import { NotesEntry } from './StepNotes.tsx';
import { ProductMenu } from './ProductMenu.tsx';
import {Disclosure,useDisclosureChoice} from './Disclosure.tsx';
import {developerToolsEnabled} from '../lib/local-preview.ts';
import {CapturedPath,openCapturedPath} from './CapturedPath.tsx';
import {prosePath} from '../lib/prose-path.ts';
import {ReplayEntry,ModernReplayTransport} from './ModernReplay.tsx';
import {useFilePeekLayout} from '../lib/use-file-peek-layout.ts';
import { useNow } from '../lib/now-store.ts';
import {GitHistory} from './GitHistory.tsx';
import {ReviewInsights} from './ReviewInsights.tsx';
import {CapturedCommands} from './CapturedCommands.tsx';
import { NativeReturn } from './NativeReturn.tsx';
import { RescanEntry, UsagePeek } from './RecordedUsage.tsx';
import { ScreenEntry, ScreenHost } from './ScreenView.tsx';
import { ContextRing } from './ContextRing.tsx';
import {SessionSegments} from "./SessionSegments.tsx";
import { focusAgent, focusKind, focusMcp } from '../lib/compound-focus.ts';
import { BrandMark } from './BrandMark.tsx';
import { SettingsGlyph } from './SettingsGlyph.tsx';
import { InterfaceGlyph } from './InterfaceGlyph.tsx';
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Operation, Projection } from '@drishya/contracts';
import { operationFailed } from '@drishya/contracts';
import { asOfProjection, compose, markers, stepOfObservation, stepOfOperation, type Scene } from '@drishya/scene';
import { changedPreview, type Explanation, type ModelPreview } from '../api.ts';
import { agentColor, agentName, KIND_LABEL } from '../lib/identity.ts';
import { setLowResource, setMapVisible, setMotion, useApp } from '../state.ts';
import { Kbd, timeOf } from './common.tsx';
import { History } from './History.tsx';
import { ExplanationView } from './ExplanationView.tsx';
import { HealthTag } from './Home.tsx';
import { MapCanvas } from './MapCanvas.tsx';
import { MaterialGlyph } from './MaterialGlyph.tsx';
import { FileHistory } from './FileHistory.tsx';
import { WorkspaceBar, AgentOverview } from './Workspace.tsx';
import { registerHeaderSlot } from '../lib/header-slot.ts';
import { SinceMarkPill, SinceMarkSection } from './SinceMark.tsx';
import type { HistorySummary } from '../../../../packages/scene/src/history.ts';
import { ReadingReferenceProvider } from './ReadingReference.tsx';
import { EvidenceNavigationProvider } from './EvidenceNavigation.tsx';
import { sampleActivity } from '../lib/activity.ts';
import { SessionWorkspaceProvider, FolderExplorer, CurrentFileReader, PromptComposer, useSessionWorkspace } from './SessionWorkspace.tsx';
import { NowWatcher } from './NowWatcher.tsx';
import { NotifyWatcher } from './NotifyWatcher.tsx';
import { TurnsWatcher } from './TurnsWatcher.tsx';
import { ContextReportWatcher } from './ContextReportWatcher.tsx';
import { EvidenceReview } from './EvidenceReview.tsx';
import { CompareButton, CompareWindow } from './CompareWindow.tsx';
import { GitReviewEntry } from './GitReview.tsx';
import { useExperience } from '../lib/experience.ts';
import { WorkbenchHeader, WorkbenchSources, WorkbenchStation, LocalPreviewEntry } from './Workbench.tsx';
import { ago } from '../lib/git-commit-rows.ts';
import './search-context.css';
import type { SessionSearchHit } from '../../../../packages/store/src/search-types.ts';
import {searchDestination} from '../lib/search-destination.ts';
import { DeveloperWorkspace } from './DeveloperWorkspace.tsx';

export function Viewer() {
  const id = useApp(s => s.recordingId);
  return <ReadingReferenceProvider><SessionWorkspaceProvider key={id}><EvidenceNavigationProvider><ProductMenu /><WorkspaceViewer /></EvidenceNavigationProvider></SessionWorkspaceProvider></ReadingReferenceProvider>;
}

function WorkspaceViewer() {
  const experience = useExperience();
  const developerWorkspace = useApp(s => s.developerWorkspace), compareOpen = useApp(s => s.compareOpen);
  // A working window (Workspace or Compare) hides the stage behind it the same way.
  const workingWindow = developerWorkspace || compareOpen;
  const projection = useApp((s) => s.projection);
  const error = useApp((s) => s.error);
  const historyPage = useApp((s) => s.historyPage);
  const loadHistoryWindow = useApp((s) => s.loadHistoryWindow);
  const graph = useApp((s) => s.graph);
  const mapVisible = useApp((s) => s.mapVisible);
  const recordingId = useApp((s) => s.recordingId);
  const source = useApp((s) => s.source);
  const historyMode = useApp(s=>s.mode==='history');
  const step = useApp((s) => s.step);
  const filter = useApp((s) => s.filter);
  const selectedOp = useApp((s) => s.selectedOp);
  const readingPassageId = useApp(s => s.readingPassageId);
  const explore = useApp((s) => s.explore);
  const mapReading = useApp(s => !!(s.currentFile || s.filePanel));
  const compareAgents = useApp((s) => s.compareAgents);
  const motion = useApp((s) => s.motion);
  const foldersHidden = useApp(s => s.foldersHidden);
  const main = useRef<HTMLDivElement>(null);
  const currentFile=useApp(s=>s.currentFile);
  const filePeek=!!currentFile&&!explore&&!developerWorkspace&&document.documentElement.dataset.uiVersion==='modern';
  useFilePeekLayout(main,filePeek&&!!projection);
  const [reading, setReading] = useState<{ left: number; width: number }>();
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [mapError, setMapError] = useState<string>();
  const [mapRetry, setMapRetry] = useState(0);
  const [catchupError,setCatchupError]=useState<string>();
  const [catchupRetry,setCatchupRetry]=useState(0);

  useEffect(()=>{
    if(!historyMode||source?.kind!=='daemon'||!source.refreshRecording||!recordingId||recordingId.includes('+')) return;
    let disposed=false, timer:ReturnType<typeof setTimeout>|undefined;
    setCatchupError(undefined);
    const catchUp=async()=>{
      try {
        const result=await source.refreshRecording!(recordingId);
        if(disposed||useApp.getState().source!==source||useApp.getState().recordingId!==recordingId) return;
        if(result.added) await useApp.getState().reloadProjection();
        if(!disposed&&result.more) timer=setTimeout(()=>void catchUp(),150);
      } catch(error) {if(!disposed)setCatchupError((error as Error).message);}
    };
    void catchUp();
    return ()=>{disposed=true;clearTimeout(timer);};
  },[source,recordingId,historyMode,catchupRetry]);

  const lastComposed = useRef<{ id?: string; step: number; since: number }>(undefined);
  const composition = useMemo(() => {
    if (historyPage) return { scene: historyPage.scene, since: historyPage.since ?? historyPage.scene.step - 1 };
    if (!projection) return;
    const applied = Math.max(0, Math.min(projection.timeline.length, step)), previous = lastComposed.current;
    const since = !historyMode || !previous || previous.id !== recordingId || applied < previous.step ? applied - 1
      : applied === previous.step ? previous.since : previous.step;
    return { scene: compose(projection, { step, since, filter, selectedOperationId: selectedOp }), since };
  }, [historyPage, projection, step, filter, selectedOp, historyMode, recordingId]);
  const scene = composition?.scene;
  useLayoutEffect(() => {
    // Commit only what was actually shown. A re-render or same-step page retains
    // its interval instead of stripping an in-flight arrival's class.
    if (composition) lastComposed.current = { id: recordingId, step: composition.scene.step, since: composition.since };
  }, [composition, recordingId]);
  const historical = useMemo(() => historyPage?.projection ?? (projection ? asOfProjection(projection, step) : undefined), [historyPage, projection, step]);
  const passagePaths = useMemo(() => {
    const passage = scene?.passages.find(ps => selectedOp ? ps.ops.some(op => op.id === selectedOp) : ps.id === (readingPassageId ?? scene.focus?.passageId));
    return [...new Set(passage?.ops.flatMap(op => op.paths) ?? [])];
  }, [scene, selectedOp, readingPassageId]);

  useEffect(() => {
    if (!mapVisible || !projection || graph || !source || !recordingId) return;
    let active = true;
    setMapError(undefined);
    source.graph(recordingId).then((loaded) => {
      if (active && useApp.getState().source === source && useApp.getState().recordingId === recordingId && useApp.getState().mapVisible) useApp.setState({ graph: loaded });
    }).catch(error => { if (active && useApp.getState().source === source && useApp.getState().recordingId === recordingId) setMapError(error.message ?? 'Map unavailable'); });
    return () => { active = false; };
  }, [mapVisible, !!projection, graph, source, recordingId, mapRetry]);

  useEffect(() => {
    if (!mapVisible || source?.kind !== 'daemon' || !recordingId || graph?.temporal !== 'current') return;
    let disposed = false;
    let inFlight = false;
    const check = async () => {
      if (disposed || inFlight || document.visibilityState === 'hidden') return;
      const shown = useApp.getState().graph;
      if (!shown || shown.temporal !== 'current') return;
      inFlight = true;
      try {
        const latest = await source.graph(recordingId);
        if (disposed || !latest || useApp.getState().recordingId !== recordingId) return;
        const current = useApp.getState().graph;
        if (current?.generation !== shown.generation) return; // an explicit refresh won the race
        const stale = latest.generation !== shown.generation || !!latest.stale;
        if (current.stale !== stale) useApp.setState({ graph: { ...current, stale } });
      } catch {
        // A disconnected daemon is reported by the connection indicator; keep the last map.
      } finally {
        inFlight = false;
      }
    };
    const timer = window.setInterval(() => void check(), 30_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, [mapVisible, source, recordingId, graph?.temporal]);

  useEffect(() => {
    const el = main.current;
    if (!el) return;
    const measure = () => {
      const col = el.querySelector('.history-inner') as HTMLElement | null;
      if (!col) return;
      const a = el.getBoundingClientRect();
      const b = col.getBoundingClientRect();
      const left = b.left - a.left, width = b.width;
      setReading(old => old?.left === left && old.width === width ? old : { left, width });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const column = el.querySelector('.history-inner');
    if (column) ro.observe(column);
    return () => ro.disconnect();
  }, [!!projection, foldersHidden, explore, experience]);

  if (!projection || !scene || !historical) return <div className="center notice">{error ? <><p role="alert">{error}</p><button className="btn" onClick={() => useApp.setState({ screen: 'home', error: undefined })}>Back to sessions</button></> : 'Loading history…'}</div>;
  // Keep the viewport and finite arrivals alive across paged forward steps.
  // A backward seek must conceal later evidence until its as-of page arrives.
  const awaitingEarlierPage = !!historyPage && scene.step > step;


  return (
    <><CapturedCommands/><ReviewInsights/><GitHistory/>
    <div inert={awaitingEarlierPage} aria-busy={!!historyPage && scene.step !== step} style={{ visibility: awaitingEarlierPage ? 'hidden' : undefined, '--session-color': agentColor(projection.agents.find(a => !a.parentId), projection.agents) } as React.CSSProperties} className={`viewer connected-workspace${workingWindow ? ' developer-workspace-open' : ''}${filePeek?' file-peek-open':''}${scene.agents.length > 1 ? " multi-agent" : ""}${foldersHidden ? ' folders-hidden' : ''}${foldersHidden === false ? ' folders-shown' : ''}${motion ? '' : ' still'}${explore ? ' exploring' : ''}${explore && mapReading ? ' map-reading' : ''}${compareAgents ? ' comparing-agents' : ''}${catalogOpen ? ' catalog-open' : ''}`}>
      <WorkspaceHeader scene={scene} projection={projection} />{experience === 'studio' ? <WorkbenchSources projection={historical} /> : <WorkspaceBar />}
      {error && <div className="notice bad" role="alert">History update failed: {error} <button className="btn" onClick={() => void useApp.getState().reloadProjection().catch((failure) => useApp.setState({ error: failure.message }))}>Retry</button></div>}
      {catchupError&&<div className="notice bad" role="alert">Local journal refresh failed: {catchupError} <button className="btn" onClick={()=>setCatchupRetry(n=>n+1)}>Retry journal refresh</button></div>}
      <div className="main" ref={main}>
        {mapVisible && !workingWindow && <MapCanvas graph={graph} heat={scene.heat} passagePaths={passagePaths} readingRect={reading} />}
        {mapVisible && mapError && <div className="map-recovery" role="alert">Repository map unavailable: {mapError}<button className="btn" onClick={() => setMapRetry(n => n + 1)}>Retry repository map</button></div>}
        {(experience !== 'studio' || foldersHidden === false) && <FolderExplorer key={`folders/${recordingId}`} scene={scene} projection={historical} />}
        {experience === 'legacy' && <AgentOverview scene={scene} projection={historical} />}
        <History key={recordingId} scene={scene} projection={historical} onWindow={historyPage ? loadHistoryWindow : undefined} />
        {!workingWindow && <FileHistory projection={historical} />}
        <CurrentFileReader />
      </div>
      {experience !== 'legacy' ? <WorkbenchStation scene={scene} projection={projection}><StudioDock scene={scene} /></WorkbenchStation> : <Dock scene={scene} />}
      <button className="btn catalog-toggle" aria-expanded={catalogOpen} aria-controls="observed-tools" onClick={() => { setCatalogOpen((open) => !open); }}>{catalogOpen ? 'Close tools' : 'Tools'}</button>
      <Transport scene={scene} projection={projection} />
      <NowWatcher key={`now/${recordingId}`} /><NotifyWatcher />
      <TurnsWatcher key={`turns/${recordingId}`} />
      <ContextReportWatcher key={`context-report/${recordingId}`} />
      <PromptComposer key={`composer/${recordingId}`} />
      <DeveloperWorkspace /><CompareWindow />
      <Briefing projection={projection} />
      <Search projection={projection} />
      <ScreenHost />
    </div>
    {awaitingEarlierPage && <div className="center notice" style={{ position: 'absolute', inset: 0 }} role="status">{error ? <><p role="alert">History update failed: {error}</p><button className="btn" onClick={() => void useApp.getState().loadHistoryWindow({ step }).catch(failure => useApp.setState({ error: failure.message }))}>Retry</button><button className="btn" onClick={() => useApp.setState({ screen: 'home', playing: false })}>Back to sessions</button></> : 'Loading history…'}</div>}
    </>
  );
}

// ─── crown: agents across the top ────────────────────────────────────────────────────────

function WorkspaceHeader({ scene, projection }: { scene: Scene; projection: Projection }) {
  const experience = useExperience();
  const header = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = header.current!;
    const viewer = element.closest<HTMLElement>('.viewer')!;
    // Wrapped controls and native font sizes own their clearance, not a fixed 28px strip.
    const measure = () => viewer.style.setProperty('--workspace-header-h', `${element.getBoundingClientRect().height}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    const scroll = (event: Event) => {
      if (event.target instanceof HTMLElement && event.target.matches('.history')) {
        element.toggleAttribute('data-scrolled', event.target.scrollTop > 12);
      }
    };
    viewer.addEventListener('scroll', scroll, true);
    return () => { observer.disconnect(); viewer.removeEventListener('scroll', scroll, true); viewer.style.removeProperty('--workspace-header-h'); };
  }, []);
  return <div ref={header} className="workspace-header">{experience === 'studio' ? <WorkbenchHeader projection={projection} scene={scene}><span className="workbench-mobile-review"><EvidenceReview projection={projection} /></span><button className="btn ghost search-open" aria-label="Search" popoverTarget="recording-search" title="Search (/)"><InterfaceGlyph name="search" /><span>Search</span><kbd>/</kbd></button><button className="btn ghost settings-open" aria-label="Workspace settings" onClick={() => useApp.setState({ settingsOpen: true })}><SettingsGlyph /></button><details className="workspace-menu"><summary aria-label="More workspace options">•••</summary><div><NativeReturnEntry/><UsagePeek /><WorkbenchExport /><LocalPreviewEntry /><SinceMarkPill projection={projection} /><details className="prompt-menu"><summary>Navigate history</summary><div className="prompt-popup"><PromptNavigation scene={scene} projection={projection} /><ActivityTimeline scene={scene} projection={projection} /></div></details></div></details></WorkbenchHeader> : experience === 'classic' ? <StudioHeader scene={scene} projection={projection} /> : <Crown scene={scene} projection={projection} />}</div>;
}

function WorkbenchExport() {
  const id = useApp(s => s.recordingId);
  const source = useApp(s => s.source);
  const url = id ? source?.exportUrl(id) : undefined;
  return url ? <a className="btn ghost" href={url} download>Export recording</a> : null;
}

const HARNESS_NAME: Record<string, string> = { 'claude-code': 'Claude Code', codex: 'Codex' };

/**
 * Which session this is, beside the brand and inside its outline (UI-1): the title, then the repository, harness and the
 * main agent's recorded model, and a dot for whether the journal is watched and the agent is working now.
 */
function SessionLine({ projection }: { projection: Projection }) {
  const recording = useApp(s => s.recording);
  const source = useApp(s => s.source);
  const mode = useApp(s => s.mode), selectedId = useApp(s => s.recordingId);
  const working = useNow(s => !!s.view?.mark);
  if (!recording) return null;
  const title = projection.title || recording.title || 'Untitled session';
  const repo = recording.workspaceRoot?.replace(/\\/g, '/').replace(/\/$/, '').split('/').at(-1);
  const model = projection.agents.find(agent => !agent.parentId)?.model;
  const rootKey = (root?: string) => { const normalized = root?.replace(/\\/g, '/').replace(/\/+$/, ''); return normalized && /^[a-z]:/i.test(normalized) ? normalized.toLowerCase() : normalized; };
  const revealBranch = (element: HTMLElement) => { const box = element.getBoundingClientRect(); element.style.setProperty('--branch-reading-width', box.width + 'px'); element.style.setProperty('--branch-reading-left', box.left + 'px'); element.dataset.reading = ''; };
  const dismissBranch = (element: HTMLElement) => { if (!element.matches(':hover,:focus')) delete element.dataset.reading; };
  const branch = mode === 'history' && !selectedId?.includes('+') && !recording.privacyOutdated && projection.recordedBranch && rootKey(projection.recordedBranch.workspaceRoot) === rootKey(recording.workspaceRoot) ? projection.recordedBranch : undefined;
  const meta = [repo ?? (source?.kind === 'bundle' ? 'Offline session' : undefined), HARNESS_NAME[recording.harness] ?? recording.harness, model].filter(Boolean).join(' · ');
  const state = !recording.live ? undefined : working ? 'working' : 'watching';
  const stateText = state === 'working' ? 'Agent working now' : state === 'watching' ? 'Watching the journal; the agent is quiet' : undefined;
  return <div className="session-line" title={[title, meta, stateText].filter(Boolean).join('\n')}>
    <span className="session-line-title">{title}</span>
    <span className="session-line-meta">{state && <span className="session-line-state" data-state={state} role="img" aria-label={stateText} />}<ContextRing projection={projection} /><span className="session-line-repo">{repo ?? (source?.kind === 'bundle' ? 'Offline session' : '')}</span>{branch && <span className="session-line-branch" tabIndex={0} onMouseEnter={event => revealBranch(event.currentTarget)} onFocus={event => revealBranch(event.currentTarget)} onMouseLeave={event => dismissBranch(event.currentTarget)} onBlur={event => dismissBranch(event.currentTarget)} aria-label={`Branch: ${branch.name}. Last branch in session metadata; not current Git`} title="Last branch in session metadata; not current Git"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="5" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="6" cy="19" r="2.5"/><path d="M6 7.5v9M18 8.5v1a6 6 0 0 1-6 6H6"/></svg><span className="session-branch-name">{branch.name}</span></span>}<span className="session-line-harness">{[HARNESS_NAME[recording.harness] ?? recording.harness, model].filter(Boolean).join(' · ')}</span></span>
  </div>;
}

/** A task-oriented shell; evidence and native capabilities stay in shared functional readers. */
function StudioHeader({ scene, projection }: { scene: Scene; projection: Projection }) {
  const liveMetadata = useApp(s=>s.mode==='history');
  const recording = useApp(s => s.recording);
  const id = useApp(s => s.recordingId);
  const source = useApp(s => s.source);
  const connection = useApp(s => s.connection);
  const searchOpen = useApp(s => s.searchOpen);
  const filter = useApp(s => s.filter);
  const exportUrl = id ? source?.exportUrl(id) : undefined;
  const modern = document.documentElement.dataset.uiVersion === 'modern';
  const [menuOpen, setMenuOpen] = useState(false);
  return <header className={`studio-header crown${modern ? ' modern-session-header' : ''}`}>
    {modern ? <div className="modern-identity"><button className="brand" aria-label="Drishya" title="All sessions" onClick={() => source?.kind === 'bundle' ? location.assign(location.pathname + (location.hash.startsWith('#token=') ? location.hash : '')) : (useApp.setState({ screen: 'home', playing: false }), location.hash = '')}><BrandMark /><span>Drishya</span></button><SessionLine projection={projection} /></div>
      : <button className="brand" title="All recordings" onClick={() => source?.kind === 'bundle' ? location.assign(location.pathname + (location.hash.startsWith('#token=') ? location.hash : '')) : (useApp.setState({ screen: 'home', playing: false }), location.hash = '')}><BrandMark /><span>Drishya</span></button>}
    {!modern&&<div className="studio-session crown-title" tabIndex={modern?0:undefined}><span className={`studio-session-label${source?.sample ? " crown-sample" : ""}`}>{modern && recording?.workspaceRoot ? recording.workspaceRoot.replace(/\\/g, '/').split('/').at(-1) : source?.sample ? 'Synthetic workspace' : source?.kind === 'bundle' ? 'Offline session' : 'Local workspace'}</span><h1 title={projection.title || recording?.title}>{projection.title || recording?.title || 'Untitled session'}</h1>{connection === 'reconnecting' && <span role="status" className="tag warn">Reconnecting…</span>}{recording && !['following', 'idle'].includes(recording.health?.state ?? '') && <HealthTag r={recording} />}{recording?.privacyOutdated && <span className="tag warn">Older privacy policy</span>}</div>}
    {modern&&connection==='reconnecting'&&<span role="status" className="session-connection">Reconnecting…</span>}
    <div className="crown-actions studio-actions">{!modern && <span className="workbench-mobile-review"><EvidenceReview key={id} projection={projection} /></span>}{modern && <CompareButton key={`compare-${id}`} />}{modern && <EvidenceReview key={`changes-${id}`} projection={projection} trigger={false} />}{modern && <span className="workspace-view-slot" ref={registerHeaderSlot} />}<button className="btn ghost search-open" aria-label="Search" popoverTarget="recording-search" aria-controls="recording-search" aria-expanded={searchOpen} title="Search (/)"><InterfaceGlyph name="search" /><span>Search</span><kbd aria-hidden="true">/</kbd></button><button className="btn ghost settings-open" aria-label="Workspace settings" title="Settings" onClick={() => useApp.setState({ settingsOpen: true })}><SettingsGlyph /></button><details className="workspace-menu" onToggle={event => { if (event.target === event.currentTarget) setMenuOpen(event.currentTarget.open); }}><summary aria-label="More workspace options">{modern ? <svg className="modern-utility-glyph" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="3" /><path d="M9 5v14m4-9h3m-3 4h3" /></svg> : '•••'}</summary><div className={modern?"workspace-utilities":undefined}>{modern&&<span className="utility-heading">This session</span>}<NativeReturnEntry deferMoments={modern}/><SessionSegments/>{modern && <div className="modern-evidence-actions"><NotesEntry key={`questions/${id}`}  /><SessionIdentity/></div>}<UsagePeek />{modern ? <><span className="utility-heading">Move around</span>{developerToolsEnabled()&&<ReplayEntry/>}<ScreenEntry menuOpen={menuOpen} /><details className="prompt-menu"><summary>Navigate history</summary><div className="prompt-popup"><PromptNavigation scene={scene} projection={projection} /><div className="prompt-activity"><ActivityTimeline scene={scene} projection={projection} /></div></div></details><span className="utility-heading">Share</span><LocalPreviewEntry />{exportUrl && <a className="btn ghost" href={exportUrl} download>Export recording</a>}</> : <><ScreenEntry menuOpen={menuOpen} /><LocalPreviewEntry />{exportUrl && <a className="btn ghost" href={exportUrl} download>Export recording</a>}<SinceMarkPill projection={projection} /><details className="prompt-menu"><summary>Navigate history</summary><div className="prompt-popup"><PromptNavigation scene={scene} projection={projection} /><div className="prompt-activity"><ActivityTimeline scene={scene} projection={projection} /></div></div></details></>}</div></details></div>
    {scene.agents.length > 1 && <div className="workspace-agent-bar" role="group" aria-label="Agent shortcuts">{scene.agents.map(state => {
      const agent = projection.agents.find(a => a.id === state.id);
      const parent = projection.agents.find(a => a.id === state.parentId);
      return <button key={state.id} data-origin-agent={state.id} role="switch" aria-checked={filter?.agentId === state.id} aria-label={`Focus ${agentName(agent)} from agent bar`} title={`${agentName(agent)} · ${state.state}${liveMetadata&&agent?.model ? ` · ${agent.model}` : ''}${liveMetadata&&agent?.effort ? ` · ${agent.effort} effort` : ''}${parent ? ` · child of ${agentName(parent)}` : ''}`} style={{ '--agent': agentColor(agent, projection.agents) } as React.CSSProperties} onClick={() => useApp.getState().setFilter(focusAgent(filter, state.id))}><span className="agent-dot" /><span>{agentName(agent)}</span><small>{[state.state,liveMetadata&&agent?.model,liveMetadata&&agent?.effort&&`${agent.effort} effort`].filter(Boolean).join(' · ')}</small></button>;
    })}</div>}
  </header>;
}

function StudioDock({ scene }: { scene: Scene }) {
  const { controller } = useSessionWorkspace();
  const filter = useApp(s => s.filter);
  const setFilter = useApp(s => s.setFilter);
  return <aside id="observed-tools" className="dock studio-dock" aria-label="Tools" title="Tools observed in this recording"><div className="studio-dock-title">Tools <span>{scene.dock.native.filter(d => d.uses).length}</span></div>
    <div className="studio-instruments">{scene.dock.native.map(d => <button key={d.key} className={`instrument k-${d.kind}${d.active ? ' active' : ''}${d.uses ? '' : ' unused'}`} aria-pressed={filter?.kind === d.kind} disabled={!d.uses} title={`Show observed ${KIND_LABEL[d.kind]} activity · ${d.tools.join(', ')}`} onClick={() => setFilter(focusKind(filter, d.kind))}><span className="tool-mark"><MaterialGlyph material={({ read: 'source', search: 'matches', edit: 'change', shell: 'terminal', test: 'verification' } as Record<string, string>)[d.kind] ?? d.kind} /></span><span className="studio-instrument-name">{KIND_LABEL[d.kind]}<small>{d.tools.join(' · ')}</small></span><span className="inst-uses">{d.uses || '—'}</span></button>)}</div>
    {scene.dock.mcp.length > 0 && <div className="studio-dock-title">MCP servers <span>{scene.dock.mcp.length}</span></div>}
    {scene.dock.mcp.map(server => <section key={server.server} className={`server catalogued${server.open ? ' open' : ''}`}><button className="server-name" aria-pressed={filter?.server === server.server} onClick={() => setFilter(focusMcp(filter, server.server))}><span className="server-dot" />{server.server}</button><div className="drawer">{server.tools.map(t => <button key={t.tool} className={`server-tool${t.active ? ' active' : ''}`} data-mcp-server={server.server} data-mcp-tool={t.tool} aria-pressed={filter?.server === server.server && filter?.tool === t.tool} disabled={!t.uses} onClick={() => setFilter(focusMcp(filter, server.server, t.tool))}><span className="server-tool-identity"><span className="tool-mark"><MaterialGlyph material="external" /></span><span>{t.tool}</span></span><span className="inst-uses">{t.uses || '—'}</span></button>)}</div></section>)}
    {controller?.inventory === 'runtime' && <Disclosure surface="tools/runtime" className="runtime-tools"><summary>Available in connected runtime · {controller.tools.length}</summary><ol>{controller.tools.map(t => <li key={t}>{t}</li>)}</ol></Disclosure>}
    {filter && <button className="btn ghost clear-filter" onClick={() => setFilter(undefined)}>Show everything <Kbd>Esc</Kbd></button>}
  </aside>;
}

function Crown({ scene, projection }: { scene: Scene; projection: Projection }) {
  const liveMetadata = useApp(s=>s.mode==='history');
  const recording = useApp((s) => s.recording);
  const recordingId = useApp((s) => s.recordingId);
  const connection = useApp((s) => s.connection);
  const source = useApp((s) => s.source);
  const filter = useApp((s) => s.filter);
  const set = useApp((s) => s.set);
  const setFilter = useApp((s) => s.setFilter);
  const searchOpen = useApp((s) => s.searchOpen);
  const exportUrl = recordingId ? source?.exportUrl(recordingId) : undefined;

  return (
    <header className="crown">
      <div className="crown-identity"><button className="brand" onClick={() => source?.kind === 'bundle' ? location.assign(location.pathname + (location.hash.startsWith('#token=') ? location.hash : '')) : (set({ screen: 'home', playing: false }), (location.hash = ''))} title="All recordings">
        <BrandMark />
        Drishya
      </button>
      {source?.sample && <span className="crown-sample">Synthetic demo</span>}</div>
      <div className="crown-title" title={projection.title}>
        {projection.title ?? recording?.title ?? 'Recording'}
        {source?.kind === 'bundle' && !source.sample && <span className="tag">offline bundle</span>}
        {connection === 'reconnecting' && <span className="tag warn" role="status">reconnecting…</span>}
        {recording && recording.health?.state !== 'following' && recording.health?.state !== 'idle' && <HealthTag r={recording} />}
        {recording?.privacyOutdated && <span className="tag warn" title="Imported under an older privacy policy. Forget it and import it again to apply the current redaction.">older privacy policy</span>}
      </div>
      {scene.agents.length > 1 && <div className="agents" role="group" aria-label="Agents">
        {scene.agents.map((a) => {
          const agent = projection.agents.find((x) => x.id === a.id);
          const on = filter?.agentId === a.id;
          return (
            <button
              key={a.id}
              data-agent-id={a.id}
              aria-label={`Filter by ${agentName(agent)} agent`}
              role="switch"
              aria-checked={on}
              className={`agent st-${a.state}${on ? ' on' : ''}${a.parentId ? ' child' : ''}`}
              style={{ '--agent': agentColor(agent, projection.agents) } as React.CSSProperties}
              onClick={() => setFilter(focusAgent(filter, a.id))}
              title={`${agentName(agent)} — ${a.state}${a.activeOperationIds.length ? `, ${a.activeOperationIds.length} call in flight` : ''}. Click to follow only this agent.`}
            >
              <span className="agent-dot" />
              {agentName(agent)}<small className="agent-harness">{[liveMetadata&&agent?.model||agent?.harness,liveMetadata&&agent?.effort&&`${agent.effort} effort`].filter(Boolean).join(' · ')}</small>
              {a.state === 'active' && a.activeOperationIds.length > 0 && <span className="orbit" />}
            </button>
          );
        })}
      </div>}
      <div className="crown-actions"><EvidenceReview key={recordingId} projection={projection} /><GitReviewEntry /><UsagePeek />
        <button className="btn ghost settings-open" aria-label="Workspace settings" onClick={() => set({ settingsOpen: true })}>Settings</button>
        <button className="btn ghost search-open" aria-label="Search" popoverTarget="recording-search" aria-controls="recording-search" aria-expanded={searchOpen} title="Search (/)">Search <kbd aria-hidden="true">/</kbd></button>
        <details className="workspace-menu"><summary aria-label="More workspace options">•••</summary><div>
          <NativeReturnEntry/>
          {exportUrl && <a className="btn ghost" href={exportUrl} download>Export recording</a>}
          <SinceMarkPill projection={projection} />
          <details className="prompt-menu"><summary>Navigate history</summary><div className="prompt-popup"><PromptNavigation scene={scene} projection={projection} /><div className="prompt-activity"><ActivityTimeline scene={scene} projection={projection} /></div></div></details>
        </div></details>
      </div>
    </header>
  );
}

function LiveWatch() {
  const follow = useApp(s => s.follow);
  const mode = useApp(s => s.mode);
  const enabled = follow;
  return <button className={`btn ghost live workspace-follow${enabled ? ' on' : ''}`} role="switch" aria-label="Automatically follow new work" aria-checked={enabled} onClick={() => useApp.setState({follow:!enabled})} title="Follow new work; scrolling upward holds your reading position"><span className={`mini-switch${enabled ? ' on' : ''}`} />{mode === 'replay' ? 'Follow replay' : 'Follow latest'}</button>;
}

function NativeReturnEntry({deferMoments=false}:{deferMoments?:boolean}={}) {
  const {controller}=useSessionWorkspace();
  return <><NativeReturn controller={controller}/>{!deferMoments&&<SessionIdentity/>}</>;
}

function SessionIdentity() {
  const recording=useApp(s=>s.recording),id=useApp(s=>s.recordingId),source=useApp(s=>s.source);
  const [status,setStatus]=useState('');
  const [open]=useDisclosureChoice('session/details',false);
  if(!recording||!id)return null;
  return <Disclosure surface="session/details" initiallyOpen={false} className="session-identity"><summary className="btn ghost">Session details</summary><dl><dt>Title</dt><dd>{recording.title??'Untitled session'}</dd><dt>Harness</dt><dd>{recording.harness}</dd><dt>Recording</dt><dd>{id}</dd><dt>Workspace</dt><dd>{recording.workspaceRoot??'Not captured'}</dd><dt>Observation</dt><dd>{source?.kind==='bundle'?'Offline session bundle':recording.live?'Watching the journal':'Journal watch off'} · independent of agent status</dd></dl><button className="btn ghost" onClick={()=>void navigator.clipboard.writeText(id).then(()=>setStatus('Recording reference copied'),()=>setStatus('Copy unavailable'))}>Copy recording reference</button><span role="status">{status}</span><RescanEntry menuOpen={open}/></Disclosure>;
}

// ─── dock: native instruments, then MCP servers by name ──────────────────────────────────

function Dock({ scene }: { scene: Scene }) {
  const { controller } = useSessionWorkspace();
  const filter = useApp((s) => s.filter);
  const setFilter = useApp((s) => s.setFilter);
  return (
    <aside id="observed-tools" className="dock" aria-label="Tools" title="Tools observed in this recording; connected runtime inventory is listed separately">
      <div className="dock-head">Tools</div>

      {controller?.inventory === 'runtime' && <Disclosure surface="tools/runtime" className="runtime-tools"><summary>Available in connected runtime · {controller.tools.length}</summary><ol>{controller.tools.map(t => <li key={t}>{t}</li>)}</ol>{controller.tools.length === 0 && <small>No MCP tools reported by this runtime</small>}</Disclosure>}
      {scene.dock.native.map((d) => (
        <button key={d.key} className={`instrument k-${d.kind}${d.active ? ' active' : ''}${d.uses ? '' : ' unused'}${filter?.kind === d.kind ? ' on' : ''}`} title={`Show observed ${KIND_LABEL[d.kind]} activity · ${d.tools.join(', ')}`} aria-pressed={filter?.kind === d.kind} disabled={!d.uses} onClick={() => setFilter(focusKind(filter, d.kind))}>
          <span className={`op-kind k-${d.kind}`}><span className="tool-mark"><MaterialGlyph material={({ read: 'source', search: 'matches', edit: 'change', shell: 'terminal', test: 'verification' } as Record<string, string>)[d.kind] ?? d.kind} /></span>{KIND_LABEL[d.kind]}</span>
          <span className="inst-tools">{d.tools.join(' · ')}</span>
          <span className="inst-uses">{d.uses || ''}</span>
        </button>
      ))}
      {scene.dock.mcp.length > 0 && <div className="dock-head">MCP servers</div>}
      {scene.dock.mcp.map((s) => {
        const on = filter?.server === s.server;
        return (
          <div key={s.server} className={`server catalogued${s.open ? ' open' : ''}${on ? ' on' : ''}`}>
            <button className="server-name" onClick={() => setFilter(focusMcp(filter, s.server))} title="Follow only this server's calls">
              <span className="server-dot" />
              {s.server}
            </button>
            <div className="drawer">
              {s.tools.map((t) => (
                <button key={t.tool} data-mcp-server={s.server} data-mcp-tool={t.tool} className={`server-tool${t.active ? ' active' : ''}${t.uses ? '' : ' unused'}`} disabled={!t.uses} aria-pressed={filter?.server === s.server && filter?.tool === t.tool} onClick={() => setFilter(focusMcp(filter, s.server, t.tool))}>
                  <span className="server-tool-identity"><span className="tool-mark"><MaterialGlyph material="external" /></span><span>{t.tool}</span></span>
                  <span className="inst-uses">{t.uses || ''}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
      {filter && (
        <button className="btn ghost clear-filter" onClick={() => setFilter(undefined)}>
          Show everything <Kbd>Esc</Kbd>
        </button>
      )}
    </aside>
  );
}

// ─── transport: play, step, scrub ────────────────────────────────────────────────────────

function Transport({ scene, projection }: { scene: Scene; projection: Projection }) {
  const lowResource = useApp((s) => s.lowResource);
  const mode = useApp((s) => s.mode);
  const playing = useApp((s) => s.playing);
  const held = useApp((s) => s.held);
  const speed = useApp((s) => s.speed);
  const motion = useApp((s) => s.motion);
  const mapVisible = useApp((s) => s.mapVisible);
  const explore = useApp((s) => s.explore);
  const set = useApp((s) => s.set);
  const seek = useApp((s) => s.seek);
  const togglePlay = useApp((s) => s.togglePlay);
  const stepBy = useApp((s) => s.stepBy);
  const jump = useApp((s) => s.jump);
  const resume = useApp((s) => s.resume);
  const showHistory = useApp((s) => s.showHistory);
  const historyPage = useApp((s) => s.historyPage);
  const ms = useMemo(() => (historyPage?.markers ?? markers(projection)).filter((m) => m.type !== 'prose'), [projection, historyPage]);
  const strip = useRef<HTMLDivElement>(null);
  const diagnostic = useApp(s => s.replayDiagnostics);
  const setDiagnostic = (value: boolean) => useApp.setState({ replayDiagnostics: value });
  const total = Math.max(1, scene.total);
  const at = (clientX: number) => {
    const r = strip.current!.getBoundingClientRect();
    return Math.round(((clientX - r.left) / r.width) * total);
  };
  const cur = scene.current;
  if (diagnostic && document.documentElement.dataset.uiVersion === 'modern') return <ModernReplayTransport scene={scene} markers={ms}/>;
  if (!diagnostic) return (
    <footer className="transport history-transport">
      <span className="reading-status sr-only">{scene.total} recorded steps</span>
      {mode === 'replay' && <button className="btn ghost" onClick={showHistory}>Full history</button>}
      {!explore && <LiveWatch />}
    </footer>
  );
  return (
    <footer className="transport">
      <button className="btn ghost" onClick={() => { setDiagnostic(false); showHistory(); }} title="Show all work">← History</button>
      <button className="icon-btn txt" aria-pressed={lowResource} onClick={() => setLowResource(!lowResource)}>{lowResource ? 'Low resource' : 'Standard'}</button>
      <div className="t-controls">
        <button className="icon-btn" onClick={() => stepBy(-1)} aria-label="Step back" title="Step back (←)">‹</button>
        <button className="play" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'} title="Play / pause (Space)">
          {playing ? '❚❚' : '▶'}
        </button>
        <button className="icon-btn" onClick={() => stepBy(1)} aria-label="Step forward" title="Step forward (→)">›</button>
        <select className="speed" value={speed} onChange={(e) => set({ speed: Number(e.target.value) })} aria-label="Speed">
          {[0.5, 1, 1.5, 2, 4].map((s) => (
            <option key={s} value={s}>{s}×</option>
          ))}
        </select>
      </div>
      <div
        className="filmstrip"
        ref={strip}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          seek(at(e.clientX), { hold: true });
        }}
        onPointerMove={(e) => e.buttons === 1 && seek(at(e.clientX), { hold: true })}
        onKeyDown={e => {
          const target = e.key === 'Home' ? 0 : e.key === 'End' ? scene.total : e.key === 'ArrowRight' ? Math.min(scene.total, scene.step + 1) : e.key === 'ArrowLeft' ? Math.max(0, scene.step - 1) : undefined;
          if (target !== undefined) { e.preventDefault(); e.stopPropagation(); seek(target, { hold: true }); }
        }}
        role="slider"
        aria-label="Timeline"
        aria-valuemin={0}
        aria-valuemax={scene.total}
        aria-valuenow={scene.step}
        tabIndex={0}
      >
        <div className="fs-track" />
        <div className="fs-done" style={{ width: `${(scene.step / total) * 100}%` }} />
        {ms.map((m, i) => (
          <span key={i} className={`mk k-${m.type}`} style={{ left: `${(m.step / total) * 100}%` }} title={`${m.type}: ${m.label}`} />
        ))}
        <div className="fs-head" style={{ left: `${(scene.step / total) * 100}%` }} />
      </div>
      <div className="t-info">
        {held && !playing ? (
          <button className="held" onClick={resume}>Held · resume</button>
        ) : (
          <span className="muted">
            {scene.step} / {scene.total}
            {cur?.time ? ` · ${timeOf(cur.time)}` : ''}
          </span>
        )}
        <button className="icon-btn txt" onClick={() => jump(['edit'])} title="Next edit (E)">E</button>
        <button className="icon-btn txt" onClick={() => jump(['fail'])} title="Next failure (F)">F</button>
        <button className={`icon-btn txt${explore ? ' on' : ''}`} onClick={() => set({ explore: !explore })} disabled={!mapVisible} title={mapVisible ? 'Explore the map (X)' : 'Show the map to explore it'}>Explore</button>
        <button className="icon-btn txt" onClick={() => setMapVisible(!mapVisible)} aria-pressed={mapVisible} title={mapVisible ? 'Hide repository map' : 'Show repository map'}>{mapVisible ? 'Map on' : 'Map off'}</button>
        <button className={`icon-btn txt${motion ? '' : ' on'}`} onClick={() => setMotion(!motion)} title="Motion (M)">{motion ? 'Motion' : 'Still'}</button>
      </div>
    </footer>
  );
}

/** Prompt navigation holds the reading camera; it never reruns a harness task. */
function PromptNavigation({ scene, projection }: { scene: Scene; projection: Projection }) {
  const page = useApp(s => s.historyPage);
  const source = useApp(s => s.source);
  const recordingId = useApp(s => s.recordingId);
  const chosen = useApp(s => s.promptStep);
  const turns = useMemo(() => (page?.markers ?? markers(projection)).filter(m => m.type === 'turn'), [page, projection]);
  const sampled = useMemo(() => { const stride = Math.max(1, Math.ceil(turns.length / 58)); return turns.filter((turn, i) => i % stride === 0 || i === turns.length - 1 || turn.step === chosen).slice(0, 60); }, [turns, chosen]);
  const navigateAll = !!page || turns.length > 60;
  const open = async (step: number) => {
    const state = useApp.getState();
    if (state.mode !== 'history') state.showHistory();
    state.set({ promptStep: step, playing: false, held: true, selectedOp: undefined, expandedOp: undefined, focusObservationId: undefined });
    if (page) {
      try { await state.loadHistoryWindow({ promptStep: step, count: 32 }); }
      catch (e) { if (useApp.getState().recordingId === recordingId) state.set({ error: (e as Error).message }); }
    }
  };
  const adjacent = async (direction: 1 | -1) => {
    if (!recordingId) return;
    if (!source?.historyMarker) {
      const target = direction > 0 ? turns.find(turn => turn.step > (chosen ?? 0)) : [...turns].reverse().find(turn => turn.step < (chosen ?? scene.total + 1));
      if (target) await open(target.step);
      return;
    }
    try { const step = await source.historyMarker(recordingId, chosen ?? (direction > 0 ? 0 : scene.total + 1), ['turn'], direction); if (step !== undefined && useApp.getState().recordingId === recordingId) await open(step); }
    catch(e) { if (useApp.getState().recordingId === recordingId) useApp.setState({error:(e as Error).message}); }
  };
  return <nav className="prompt-navigation" aria-label="Prompts">
    {navigateAll && <button className="icon-btn" aria-label="Previous prompt" onClick={() => void adjacent(-1)}>‹</button>}
    <div className="prompt-chapters" title={navigateAll ? 'Sampled chapters; Previous/Next visits every prompt' : undefined}>{sampled.map((turn, i) => <button key={turn.step} aria-pressed={chosen === turn.step} title={turn.label} onClick={() => void open(turn.step)}><span>{page ? 'Prompt' : turns.indexOf(turn) + 1}</span><span className="prompt-copy">{turn.label}</span></button>)}</div>
    {navigateAll && <button className="icon-btn" aria-label="Next prompt" onClick={() => void adjacent(1)}>›</button>}
    {chosen !== undefined && <button className="btn ghost" onClick={() => { const state=useApp.getState();state.set({selectedOp:undefined,expandedOp:undefined,follow:true,held:false,playing:true});state.seek(chosen - 1); }}>Follow from prompt</button>}
  </nav>;
}

// ─── activity timeline: the whole recording at a glance, in history mode ─────────────────

const MARK_LABEL: Record<string, string> = { edit: 'Edit', fail: 'Failure', pass: 'Passed test', spawn: 'Subagent', turn: 'Prompt', gap: 'Capture gap' };

/** Recorded edits, failures and test outcomes as ticks; a tick opens its operation in history.
 * Positions are recorded order (timeline steps), not wall-clock time. */
function ActivityTimeline({ scene, projection }: { scene: Scene; projection: Projection }) {
  const historyPage = useApp((s) => s.historyPage);
  const selectedOp = useApp((s) => s.selectedOp);
  const select = useApp((s) => s.select);
  const all = useMemo(() => (historyPage?.markers ?? markers(projection)).filter((m) => m.type !== 'prose'), [projection, historyPage]);
  const shown = useMemo(() => sampleActivity(all), [all]);
  const total = Math.max(1, scene.total);
  const openable = all.filter((m) => m.operationId);
  const current = openable.find((m) => m.operationId === selectedOp);
  const go = (types: string[], dir: 1 | -1) => {
    const list = openable.filter((m) => types.includes(m.type));
    const next = current ? (dir > 0 ? list.find((m) => m.step > current.step) : [...list].reverse().find((m) => m.step < current.step)) : dir > 0 ? list[0] : list[list.length - 1];
    if (next?.operationId) select(next.operationId);
  };
  const count = (type: string) => all.filter((m) => m.type === type).length;
  const failures = count('fail');
  const edits = count('edit');
  if (!all.length) return <div className="transport-spacer" />;
  return (
    <div className="activity" role="group" aria-label="Activity">
      <div className="activity-jump">
        <button onClick={() => go(['fail'], -1)} disabled={!failures} aria-label="Previous failure" title="Previous failure">‹</button>
        <button onClick={() => go(['fail'], 1)} disabled={!failures} title="Next failure"><span className="k-fail-dot" />Next failure</button>
        <button onClick={() => go(['edit'], 1)} disabled={!edits} title="Next edit"><span className="k-edit-dot" />Next edit</button>
      </div>
      {/* Pointer shortcut only: keyboard and screen-reader users have the jump buttons, so the
          ticks stay out of the accessibility tree rather than adding hundreds of unnamed stops. */}
      <div className="activity-strip" aria-hidden="true" title={historyPage ? 'Recorded order. Long recordings show a sample of marks.' : 'Recorded order, not wall-clock time.'}>
        {shown.map((m, i) => {
          const style = { left: `${Math.min(100, (m.step / total) * 100)}%` };
          const label = `${MARK_LABEL[m.type] ?? m.type}: ${m.label}`;
          return m.operationId
            ? <button key={i} tabIndex={-1} className={`activity-mark k-${m.type}${m.operationId === selectedOp ? ' current' : ''}`} style={style} title={label} onClick={() => select(m.operationId)} />
            : <span key={i} className={`activity-mark k-${m.type}`} style={style} title={label} />;
        })}
      </div>
      {!historyPage && <span className="activity-count">{edits} edits · {failures} failed · {count('pass')} passed</span>}
    </div>
  );
}

// ─── briefing: "while you were away" ─────────────────────────────────────────────────────

function Briefing({ projection }: { projection: Projection }) {
  const paged = useApp((s) => !!s.historyPage);
  const open = useApp((s) => s.briefingOpen);
  const source = useApp((s) => s.source);
  const config = useApp((s) => s.config);
  const recordingId = useApp((s) => s.recordingId);
  const step = useApp((s) => s.step);
  const set = useApp((s) => s.set);
  const [range, setRange] = useState<'all' | 'since'>('all');
  const [preview, setPreview] = useState<ModelPreview>();
  // The range the preview was built for; a send uses it, not wherever playback has moved since.
  const [previewFrom, setPreviewFrom] = useState<number>();
  const [result, setResult] = useState<Explanation>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const [facts, setFacts] = useState<HistorySummary>();
  const from = range === 'since' ? step : undefined;
  useEffect(() => {
    let active = true;
    setFacts(undefined);
    if (open && paged && source?.summary && recordingId) void source.summary(recordingId, from).then((data) => { if (active) setFacts(data); }).catch((e) => { if (active) setErr(e.message); });
    return () => { active = false; };
  }, [open, paged, source, recordingId, from, projection]);

  useEffect(() => {
    if (!open || source?.kind !== 'daemon' || !recordingId) return;
    setErr(undefined);
    source.briefing(recordingId, { from }).then((r) => {
      setPreview(r.preview);
      setPreviewFrom(from);
      setResult(r.cached);
    }).catch((e) => setErr(e.message));
  }, [open, range, recordingId, source]);

  if (!open) return null;
  const counts = paged ? facts : summarize(projection, from ?? 0);
  return (
    <div className="sheet" role="dialog" aria-label="Briefing">
      <header>
        <h3>Briefing</h3>
        <button className="icon-btn" onClick={() => set({ briefingOpen: false })} aria-label="Close">✕</button>
      </header>
      <SinceMarkSection projection={projection} />
      <div className="seg">
        <button className={range === 'all' ? 'on' : ''} onClick={() => setRange('all')}>Whole recording</button>
        <button className={range === 'since' ? 'on' : ''} onClick={() => setRange('since')}>Since step {step}</button>
      </div>
      <div className="facts">
        <p className="muted small">Counted directly from the session.</p>
        <ul>
          {counts ? <><li>{counts.edits} file{counts.edits === 1 ? '' : 's'} changed: {counts.editedFiles.slice(0, 6).join(', ')}{counts.editedFiles.length > 6 ? '…' : ''}</li>
          <li>{counts.tests} test run{counts.tests === 1 ? '' : 's'} — last: {counts.lastTest ?? 'none'}</li>
          <li>{counts.errors} failed operation{counts.errors === 1 ? '' : 's'}</li>
          <li>{counts.agents} agent{counts.agents === 1 ? '' : 's'} active</li></> : <li>Loading…</li>}
        </ul>
      </div>
      {source?.kind === 'daemon' ? (
        <>
          {result && <ExplanationView r={result} />}
          {preview && (
            <div className="consent">
              <div>
                A generated briefing sends <strong>{preview.items}</strong> redacted items ({Math.round(preview.chars / 1000)}k characters) to <code>{preview.model}</code>.
              </div>
              {config?.llm.configured ? (
                <button
                  className="btn primary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setErr(undefined);
                    try {
                      setResult((await source.briefing(recordingId!, { from: previewFrom }, preview.digest)).result);
                    } catch (e) {
                      const fresh = changedPreview(e);
                      if (fresh) setPreview(fresh);
                      setErr((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? 'Waiting for Nemotron…' : result ? 'Regenerate' : 'Write briefing with Nemotron'}
                </button>
              ) : (
                <span className="muted">Set <code>NEBIUS_API_KEY</code> to enable generated briefings.</span>
              )}
            </div>
          )}
          {err && <p className="bad">{err}</p>}
        </>
      ) : (
        <p className="muted small">Generated briefings run only in the local app.</p>
      )}
    </div>
  );
}

function summarize(p: Projection, from: number) {
  // `from` is a timeline step; operations carry observation sequences. Compare like with like:
  // "since step N" means after the observation that step N showed.
  const after = from > 0 ? (p.timeline[from - 1]?.sequence ?? -1) : -1;
  const inRange = (s: number) => s > after;
  const edits = p.operations.filter((o) => (o.kind === 'edit' || o.kind === 'write') && o.status === 'ok' && inRange(o.startSequence));
  const tests = p.operations.filter((o) => o.kind === 'test' && inRange(o.startSequence));
  const last = tests.at(-1);
  const lastTest = last?.detail.kind === 'test' ? (last.detail.summary ? `${last.detail.summary.passed} passed, ${last.detail.summary.failed} failed` : last.status) : undefined;
  return {
    edits: new Set(edits.flatMap((e) => e.paths.map((x) => x.path))).size,
    editedFiles: [...new Set(edits.flatMap((e) => e.paths.map((x) => x.path)))],
    tests: tests.length,
    lastTest,
    errors: p.operations.filter((o) => operationFailed(o) && inRange(o.startSequence)).length,
    agents: new Set(p.operations.filter((o) => inRange(o.startSequence)).map((o) => o.agentId)).size,
  };
}

// ─── search ──────────────────────────────────────────────────────────────────────────────

const HIT_KIND: Record<string, string> = { 'message.user': 'Prompt', 'message.assistant': 'Reply', reasoning: 'Reasoning', 'tool.call': 'Call', 'tool.result': 'Result' };
function Search({ projection }: { projection: Projection }) {
  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const open = useApp((s) => s.searchOpen);
  const source = useApp((s) => s.source);
  const recordingId = useApp((s) => s.recordingId);
  const set = useApp((s) => s.set);
  const seek = useApp((s) => s.seek);
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<'captured' | 'files'>('captured');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const graph = useApp(s => s.graph);
  const mode = useApp(s => s.mode);
  const step = useApp(s => s.step);
  const [result, setResult] = useState<{ query: string; hits: SessionSearchHit[] }>();
  useEffect(() => {
    const element = panel.current;
    if (!element) return;
    // Native light dismissal preserves the outside click and restores the opening control.
    if (open && !element.matches(':popover-open')) element.showPopover();
    else if (!open && element.matches(':popover-open')) element.hidePopover();
    if (open) input.current?.focus({ preventScroll: true });
  }, [open]);
  useEffect(() => {
    setResult(undefined); setError(undefined); setLoading(false);
    if (!open || scope !== 'captured' || !source || !recordingId || q.trim().length < 2) return;
    let current = true;
    setLoading(true);
    const t = setTimeout(() => source.search(recordingId, q).then(result => { if (current) { setResult({ query: q, hits: result }); setLoading(false); } }).catch(() => { if (current) { setError('Search unavailable. Change the query or reopen search to retry.'); setLoading(false); } }), 160);
    return () => { current = false; clearTimeout(t); };
  }, [q, scope, open, source, recordingId]);
  const hits = result?.query === q ? result.hits : [];
  const visibleHits = mode === 'replay' ? hits.filter(hit => { const at = searchDestination(projection, hit.observationId)?.step; return at !== undefined && at <= step; }) : hits;
  const files = q.trim().length >= 2 ? graph?.nodes.filter(node => node.path.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 50) ?? [] : [];
  const noMatches = scope === 'captured'
    ? result?.query === q && visibleHits.length === 0
    : q.trim().length >= 2 && files.length === 0;
  const emptyTitle = scope === 'captured'
    ? mode === 'replay' ? 'No matches at this replay step' : 'No matches in the whole session'
    : !graph ? 'File references unavailable in this view'
    : graph.temporal === 'current' ? 'No matches in the current index' : 'No matches in file references';
  const refine = scope === 'captured'
    ? mode === 'replay' ? 'Try a shorter term or move to a later step.' : 'Try a shorter phrase, command or path.'
    : graph ? 'Try part of a file name or folder path.' : 'Choose Session work to search the recording.';
  const go = async (obs: string) => {
    const initial=useApp.getState();
    const current=()=>useApp.getState().source===source&&useApp.getState().recordingId===recordingId;
    // Search is deliberate navigation. A result must not race the live-edge camera.
    set({follow:false,held:true});setError(undefined);
    try {
      let target=searchDestination(initial.projection??projection,obs,initial.historyPage?.scene);
      if(!target&&initial.historyPage){
        await initial.loadHistoryWindow({observationId:obs});
        if(!current())return;
        const loaded=useApp.getState();
        target=searchDestination(loaded.projection??projection,obs,loaded.historyPage?.scene);
      }
      if(!target){setError('No readable history location was recorded for this result.');return;}
      if(initial.mode==='replay')seek(target.step,{hold:true});
      set({selectedOp:target.kind==='operation'?target.id:undefined,expandedOp:undefined,promptStep:target.kind==='prompt'?target.step:undefined,focusObservationId:target.kind==='prose'?obs:undefined,searchOpen:false});
      if(initial.historyPage)await initial.loadHistoryWindow(target.kind==='prompt'?{promptStep:target.step}:target.kind==='operation'?{selectedOperationId:target.id}:{observationId:obs});
    }catch(error){if(current())set({error:(error as Error).message});}
  };
  return (
    <div ref={panel} id="recording-search" popover="auto" className="search" role="dialog" aria-label="Search this recording" onToggle={event => set({ searchOpen: event.newState === 'open' })}>
      <div className="search-field">
        <svg className="search-symbol" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></svg>
        <input ref={input} autoFocus aria-label="Search prose, commands, paths" placeholder="Search prose, commands, paths…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="search-close" aria-label="Close search" popoverTarget="recording-search" popoverTargetAction="hide">×</button>
      </div>
      <div className="search-scopes" role="group" aria-label="Search scope"><button aria-pressed={scope === 'captured'} onClick={() => setScope('captured')}>Session work</button><button aria-pressed={scope === 'files'} onClick={() => setScope('files')}>Indexed files</button></div>
      <p className="search-scope-note">{scope === 'captured' ? mode === 'replay' ? 'Session work visible at this replay step' : 'Whole recording · up to 50 results per recording' : graph?.temporal === 'current' ? `Current index${graph.stale ? ' · out of date' : ''}${graph.truncated ? ' · partial' : ''} · first 50 matches · names only` : 'File references · first 50 matches · names only'}</p>
      <div className="search-results">
        {scope === 'captured' && visibleHits.map((h, i) => (
          <Fragment key={i}>
            {h.turn !== undefined && h.turn !== visibleHits[i - 1]?.turn && <div className="search-turn" role="presentation">Turn {h.turn}</div>}
            <button className="search-hit" onClick={() => void go(h.observationId)}>
              <span>{h.snippet.split(/[«»]/).map((part, j) => (j % 2 ? <mark key={j}>{part}</mark> : part))}</span>
              <small>{[HIT_KIND[h.kind ?? ''] ?? h.kind, h.kind?.startsWith('tool.') ? h.tool : undefined, h.path ?? h.command, h.time ? ago(h.time) : undefined].filter(Boolean).join(' · ')}</small>
            </button>
            {h.path && <CapturedPath path={h.path}>{h.path}</CapturedPath>}
          </Fragment>
        ))}
        {scope === 'files' && files.map(file => <button key={file.id} onClick={() => {const ref=prosePath(file.path,useApp.getState().recording?.workspaceRoot,true);if(ref)openCapturedPath(ref);}}>{file.path}<span aria-hidden="true"> ↗</span></button>)}
        {loading && <div role="status">Searching session…</div>}
        {error && <div role="alert">{error}</div>}
        {noMatches && !loading && !error && <div className="search-empty">
          <div role="status"><strong>{emptyTitle}</strong><p>{refine}</p></div>
          <button type="button" className="btn ghost small" onClick={() => {
            setQ('');
            input.current?.focus({ preventScroll: true });
          }}>Clear search</button>
        </div>}
      </div>
    </div>
  );
}
