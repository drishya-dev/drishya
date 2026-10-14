import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Operation, Prose, GraphNode } from '@drishya/contracts';
import { createFreshApi, type FreshApi, type HistoryPage, type RecordingSummary, type DiscoveredSource, type RepoGraph, type NativeState, type WorkspaceState, type ArtifactSlice, type CurrentFile, type Attachment, type GitSnapshot, type LocalConfig, type StorageInfo, type SearchResult } from './api';
import './fresh.css';
import { FreshEvidence } from './FreshEvidence';
import { CodeTokens } from './CodeTokens';
import { FreshGit as GitReview } from './FreshGit';
import { useMaterialMotion } from './material-motion';
import { SettingsSections } from '../components/UIVersions';

type View = 'home' | 'work' | 'repository' | 'review' | 'settings';
type IconName = 'home' | 'work' | 'files' | 'branch' | 'settings' | 'search' | 'arrow' | 'plus' | 'close' | 'play' | 'pause' | 'back' | 'refresh' | 'check' | 'terminal' | 'code' | 'spark' | 'link' | 'agents' | 'attach' | 'stop' | 'download' | 'copy' | 'eye' | 'chevron';
const paths: Record<IconName, string> = {
  home: 'M3 10 12 3l9 7v10H6V10m3 10v-7h6v7', work: 'M4 5h16v14H4zM4 10h16M9 10v9', files: 'M4 4h7l2 3h7v13H4z', branch: 'M6 5v14m0-7h8a4 4 0 0 0 4-4V5M3 5a3 3 0 1 0 6 0 3 3 0 0 0-6 0m12 0a3 3 0 1 0 6 0 3 3 0 0 0-6 0M3 19a3 3 0 1 0 6 0 3 3 0 0 0-6 0',
  settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z', search: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14m5 12 6 6', arrow: 'M4 12h16m-6-6 6 6-6 6', plus: 'M12 4v16M4 12h16', close: 'm6 6 12 12M6 18 18 6', play: 'm8 4 12 8-12 8z', pause: 'M8 5v14M16 5v14', back: 'm15 5-7 7 7 7', refresh: 'M20 7v5h-5M4 17v-5h5m11 0a8 8 0 0 0-14-5m-2 5a8 8 0 0 0 14 5', check: 'm5 12 4 4 10-10', terminal: 'm4 6 5 5-5 5m8 1h8', code: 'm8 6-6 6 6 6m8-12 6 6-6 6m-3-14-2 16', spark: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z', link: 'm9 15 6-6m-5-3 2-2a5 5 0 0 1 7 7l-2 2m-3 5-2 2a5 5 0 0 1-7-7l2-2', agents: 'M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8M2 21v-3a7 7 0 0 1 14 0v3m1-17a4 4 0 0 1 0 8m2 3a5 5 0 0 1 3 5v1', attach: 'm8 12 7-7a4 4 0 0 1 6 6L11 21a6 6 0 0 1-8-8L14 2m-6 10 7-7', stop: 'M5 5h14v14H5z', download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5', copy: 'M8 8h13v13H8zM16 8V3H3v13h5', eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7m10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6', chevron: 'm9 5 7 7-7 7',
};
function Icon({ name, size = 18 }: { name: IconName; size?: number }) { return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>; }
function Button({ children, icon, tone = 'quiet', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: IconName; tone?: 'quiet' | 'primary' | 'danger' }) { return <button className={`fr-button fr-button-${tone}`} {...props}>{icon && <Icon name={icon} size={16} />}{children}</button>; }
function Label({ children }: { children: ReactNode }) { return <span className="fr-label">{children}</span>; }
function Brand({ compact = false }: { compact?: boolean }) { return <div className="fr-brand"><span className="fr-mark" aria-hidden="true"><i /><i /><i /></span>{!compact && <><strong>drishya</strong><span className="fr-brand-sub">LOCAL WORKSPACE</span></>}</div>; }
const kindIcon = (kind: string): IconName => kind === 'read' || kind === 'write' ? 'files' : kind === 'shell' || kind === 'test' ? 'terminal' : kind === 'spawn' ? 'agents' : kind === 'mcp' || kind === 'web' ? 'link' : kind === 'search' ? 'search' : 'code';
const shortRoot = (root?: string) => root?.replace(/\\/g, '/').split('/').filter(Boolean).at(-1) ?? 'Local session';
const formatTime = (v?: string) => v ? new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Local';
const number = (v: number) => new Intl.NumberFormat().format(v);
const loadedCount = (v?: number) => v === undefined ? '…' : number(v);
const message = (e: unknown) => e instanceof Error ? e.message : 'The local request could not be completed.';
const workStates = ['running', 'connecting', 'approval'];

export function FreshApp({ token, onExit }: { token: string; onExit?: () => void }) {
  const api = useMemo(() => createFreshApi(token), [token]);
  const [view, setView] = useState<View>('home');
  const [recordings, setRecordings] = useState<RecordingSummary[]>([]);
  const [sources, setSources] = useState<DiscoveredSource[]>([]);
  const [selected, setSelected] = useState<string | undefined>(() => /^#\/r\/([^/?]+)/.exec(location.hash)?.[1]);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(false);
  const [revision, setRevision] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTarget, setSearchTarget] = useState<{ id: string; revision: number }>();
  const [discoveryErrors, setDiscoveryErrors] = useState<string[]>([]);
  const recording = recordings.find(r => r.id === selected);
  const reload = useCallback(async () => {
    const r = await api.recordings(); setRecordings(r.recordings);
  }, [api]);
  const discover = useCallback(async () => {
    const r = await api.sources(); setSources(r.sources); setDiscoveryErrors(r.errors.map(e => e.message ?? JSON.stringify(e)));
  }, [api]);
  const run = useCallback(async (fn: () => Promise<void>) => {
    setPending(true); setError(undefined);
    try { await fn(); } catch (e) { setError(message(e)); } finally { setPending(false); }
  }, []);
  useEffect(() => {
    let alive = true;
    void (token ? api.request('session', {}).then(() => { const hash = /^#\/r\//.test(location.hash) ? location.hash : ''; history.replaceState(null, '', location.pathname + location.search + hash); }) : Promise.resolve()).then(() => reload()).then(() => { if (alive) { setReady(true); if (/^#\/r\//.test(location.hash)) setView('work'); } }).catch(e => { if (alive) setError(message(e)); });
    return () => { alive = false; };
  }, [api, reload]);
  useEffect(() => {
    if (!ready) return;
    const events = new EventSource('/v1/changes', { withCredentials: true });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const change = () => { clearTimeout(timer); timer = setTimeout(() => { setRevision(r => r + 1); void reload().catch(e => setError(message(e))); }, 160); };
    events.addEventListener('change', change); events.addEventListener('sync', change); events.addEventListener('health', change);
    return () => { events.close(); clearTimeout(timer); };
  }, [ready, reload]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(o => !o); } if (e.key === 'Escape') setSearchOpen(false); };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, []);
  useEffect(() => {
    const navigation = () => { const target = /^#\/r\/([^/?]+)/.exec(location.hash)?.[1]; if (target) { setSelected(decodeURIComponent(target)); setView('work'); setSearchOpen(false); } else { setView('home'); } };
    window.addEventListener('hashchange', navigation); window.addEventListener('popstate', navigation);
    const keyboard = () => document.querySelector('.fresh-app')?.setAttribute('data-modality', 'keyboard');
    const pointer = () => document.querySelector('.fresh-app')?.setAttribute('data-modality', 'pointer');
    window.addEventListener('keydown', keyboard); window.addEventListener('pointerdown', pointer);
    return () => { window.removeEventListener('hashchange', navigation); window.removeEventListener('popstate', navigation); window.removeEventListener('keydown', keyboard); window.removeEventListener('pointerdown', pointer); };
  }, []);
  const open = (id: string) => { setSelected(id); setView('work'); history.replaceState(null, '', `${location.pathname}${location.search}#/r/${encodeURIComponent(id)}`); };
  const importSource = (source: DiscoveredSource) => run(async () => { const r = await api.import(source); await reload(); open(r.recordingId); });
  return <div className="fresh-app fr-app">
    <aside className="fr-rail" aria-label="Main navigation">
      <button className="fr-brand-button" aria-label="Drishya home" onClick={() => setView('home')}><Brand compact /></button>
      <div className="fr-rail-main">{([
        ['home', 'home', 'Sessions'], ['work', 'work', 'Workspace'],
      ] as [View, IconName, string][]).map(([id, icon, label]) => <button key={id} className={`fr-rail-item ${view === id ? 'is-active' : ''}`} title={label} aria-label={label} aria-current={view === id ? 'page' : undefined} disabled={id !== 'home' && !selected} onClick={() => setView(id)}><Icon name={icon} /><span>{label}</span></button>)}</div>
      <div className="fr-rail-bottom"><button className="fr-rail-item" title="Search captured evidence · Ctrl K" aria-label="Search captured evidence" disabled={!selected} onClick={() => setSearchOpen(true)}><Icon name="search" /></button><button className={`fr-rail-item ${view === 'settings' ? 'is-active' : ''}`} title="Settings" aria-label="Settings" onClick={() => setView('settings')}><Icon name="settings" /></button>{onExit && <button className="fr-rail-item" title="Open previous workspace" aria-label="Open previous workspace" onClick={onExit}><Icon name="back" /></button>}<span className="fr-local-dot" title="Local daemon" /></div>
    </aside>
    <div className="fr-shell">
      <header className="fr-topbar"><div className="fr-breadcrumb"><Brand /><span className="fr-divider" />{recording && view !== 'home' ? <><span>{shortRoot(recording.workspaceRoot)}</span><Icon name="chevron" size={12} /><strong>{view === 'work' ? 'Work stage' : view === 'repository' ? 'Repository' : view === 'review' ? 'Review' : 'Settings'}</strong></> : <strong>{view === 'settings' ? 'Settings' : 'Your workspace'}</strong>}</div><div className="fr-topbar-actions"><span className="fr-local-badge"><i />On this machine</span><button className="fr-search-trigger" disabled={!selected} onClick={() => setSearchOpen(true)}><Icon name="search" size={14} /><span>Find evidence</span><kbd>⌘ K</kbd></button></div></header>
      {error && <div className="fr-error" role="alert"><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError(undefined)}><Icon name="close" size={16} /></button></div>}
      {view === 'home' ? <Home recordings={recordings} sources={sources} pending={pending} ready={ready} discoveryErrors={discoveryErrors} onDiscover={() => void run(discover)} onOpen={open} onImport={importSource} /> : view === 'settings' ? <Settings api={api} /> : recording ? <Workspace key={recording.id} api={api} recording={recording} recordings={recordings} view={view} onView={setView} onOpen={open} revision={revision} onReload={reload} onError={setError} searchTarget={searchTarget} /> : <div className="fr-empty"><Icon name="work" size={32} /><h2>Choose a session to begin.</h2><Button onClick={() => setView('home')}>Browse sessions</Button></div>}
    </div>
    {searchOpen && selected && <EvidenceSearch api={api} recordingId={selected} onClose={() => setSearchOpen(false)} onSelect={observationId => { setSearchOpen(false); setView('work'); setSearchTarget(previous => ({ id: observationId, revision: (previous?.revision ?? 0) + 1 })); }} />}
  </div>;
}

function Home({ recordings, sources, pending, ready, discoveryErrors, onDiscover, onOpen, onImport }: { recordings: RecordingSummary[]; sources: DiscoveredSource[]; pending: boolean; ready: boolean; discoveryErrors: string[]; onDiscover: () => void; onOpen: (id: string) => void; onImport: (s: DiscoveredSource) => void }) {
  const [filter, setFilter] = useState('');
  const [showSources, setShowSources] = useState(false);
  const sessions = recordings.filter(r => `${r.title} ${r.workspaceRoot} ${r.harness}`.toLowerCase().includes(filter.toLowerCase()));
  const projects = new Set(recordings.map(r => r.workspaceRoot).filter(Boolean)).size;
  return <main className="fr-home">
    <section className="fr-home-intro"><div><Label>THE AGENT WORKSPACE</Label><h1>See the work.<br /><span>Stay in the flow.</span></h1><p>Your agents, their tools, and the code they touch.<br />One place to follow, understand, and continue.</p><div className="fr-home-actions"><Button tone="primary" icon="plus" disabled={pending} onClick={() => { setShowSources(true); onDiscover(); }}>{pending ? 'Finding local sessions…' : 'Connect a local session'}</Button><span>Codex · Claude Code</span></div></div><div className="fr-home-illustration" aria-hidden="true"><div className="fr-orbit fr-orbit-one" /><div className="fr-orbit fr-orbit-two" /><div className="fr-orbit fr-orbit-three" /><span className="fr-orbit-node node-one"><Icon name="files" size={23} /></span><span className="fr-orbit-node node-two"><Icon name="terminal" size={23} /></span><span className="fr-orbit-node node-three"><Icon name="branch" size={23} /></span><div className="fr-illustration-center"><Brand compact /></div><span className="fr-illustration-caption">A clearer view of what happens.</span></div></section>
    <section className="fr-sessions-section"><div className="fr-section-heading"><div><h2>Recent sessions <span>{recordings.length}</span></h2><p>Captured locally. Ready to pick up where you left off.</p></div><label className="fr-inline-search"><Icon name="search" size={16} /><input aria-label="Filter sessions" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter sessions…" /></label></div>
      {recordings.length > 0 && <div className="fr-home-summary"><span><b>{projects}</b> workspaces</span><span><b>{recordings.filter(r => r.live).length}</b> following</span><span><b>{number(recordings.reduce((sum, r) => sum + r.observationCount, 0))}</b> captured observations</span></div>}
      <div className="fr-session-grid">{sessions.map(r => <button className="fr-session" key={r.id} onClick={() => onOpen(r.id)}><div className="fr-session-top"><span className={`fr-agent-avatar ${r.harness === 'codex' ? 'is-codex' : ''}`}>{r.harness === 'codex' ? <Icon name="spark" size={17} /> : 'C'}</span><span>{r.harness === 'codex' ? 'Codex' : r.harness === 'claude-code' ? 'Claude Code' : r.harness}</span><span className={`fr-session-status ${r.live ? 'is-live' : ''}`}><i />{r.live ? 'Following' : 'Recorded'}</span></div><h3>{r.title || 'Untitled session'}</h3><div className="fr-session-project"><Icon name="files" size={14} /><span>{shortRoot(r.workspaceRoot)}</span></div><footer><span>{formatTime(r.updatedAt)} · {number(r.observationCount)} observations</span><Icon name="arrow" size={17} /></footer>{r.privacyOutdated && <span className="fr-warning-text">Re-import needed for current privacy policy</span>}</button>)}</div>
      {!ready && !recordings.length && <div className="fr-empty fr-empty-small"><p>Connecting to your local workspace…</p></div>}
      {ready && !sessions.length && <div className="fr-empty fr-empty-small"><Icon name="work" size={28} /><h3>{filter ? 'No matching sessions' : 'Your first session starts here'}</h3><p>{filter ? 'Try a project name or another search.' : 'Connect an existing Codex or Claude Code session to see its actual work.'}</p>{!filter && <Button icon="plus" onClick={() => { setShowSources(true); onDiscover(); }}>Find local sessions</Button>}</div>}
    </section>
    {showSources && <section className="fr-discovery"><div className="fr-section-heading"><div><Label>LOCAL DISCOVERY</Label><h2>Continue something already in motion.</h2></div><Button icon="refresh" disabled={pending} onClick={onDiscover}>Refresh</Button></div><p className="fr-muted">Import reads native journals and redacts captured content before storing it. Connecting a prompt is a separate choice inside the session.</p>{sources.map(s => <div className="fr-source" key={s.path}><span className="fr-agent-avatar">{s.harness === 'codex' ? <Icon name="spark" size={17} /> : 'C'}</span><div><strong>{s.title || shortRoot(s.cwd)}</strong><span>{s.cwd ?? s.path}</span><small>{s.harness} · {formatTime(s.modifiedAt)} · {number(Math.round(s.bytes / 1024))} KB</small></div><Button icon="arrow" disabled={pending} onClick={() => s.importedRecordingId ? onOpen(s.importedRecordingId) : onImport(s)}>{s.importedRecordingId ? 'Open session' : 'Import & follow'}</Button></div>)}{!pending && !sources.length && <p className="fr-muted">No supported local journals found. Run a session in Codex or Claude Code, then refresh.</p>}{discoveryErrors.map((e, i) => <p key={i} className="fr-warning-text">{e}</p>)}</section>}
    <footer className="fr-home-footer"><span><Icon name="eye" size={14} /> Private by construction</span><span>Local capture. No telemetry.</span><span className="fr-home-wordmark">दृश्य</span></footer>
  </main>;
}

function Workspace({ api, recording, recordings, view, onView, onOpen, revision, onReload, onError, searchTarget }: { searchTarget?: { id: string; revision: number }; api: FreshApi; recording: RecordingSummary; recordings: RecordingSummary[]; view: View; onView: (view: View) => void; onOpen: (id: string) => void; revision: number; onReload: () => Promise<void>; onError: (error?: string) => void }) {
  const [page, setPage] = useState<HistoryPage>();
  const [graph, setGraph] = useState<RepoGraph>();
  const [native, setNative] = useState<NativeState>();
  const [workspace, setWorkspace] = useState<WorkspaceState>();
  const [selectedOp, setSelectedOp] = useState<string>();
  const [selectedPath, setSelectedPath] = useState<string>();
  const [step, setStep] = useState<number>();
  const [playing, setPlaying] = useState(false);
  const [replayOpen, setReplayOpen] = useState(false);
  const [historyStart, setHistoryStart] = useState<number>();
  const [filter, setFilter] = useState('');
  const [sidebarTab, setSidebarTab] = useState<'files' | 'tools' | 'agents'>('files');
  const [showInspector, setShowInspector] = useState(false);
  const [selectedProse, setSelectedProse] = useState<Prose>();
  const [observationId, setObservationId] = useState<string>();
  const [toolFilter, setToolFilter] = useState<string>();
  const [fileLimit, setFileLimit] = useState(150);
  const [loading, setLoading] = useState(true);
  const [follow, setFollow] = useState(true);
  const streamRef = useRef<HTMLDivElement>(null);
  const alive = useRef(true);
  const requestId = useRef(0);
  const id = recording.id;
  const transact = useCallback(async (fn: () => Promise<void>) => { onError(undefined); try { await fn(); } catch (e) { if (alive.current) onError(message(e)); } }, [onError]);
  const loadNative = useCallback(async () => { const value = await api.native(id); if (alive.current) setNative(value); }, [api, id]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    void transact(async () => { const values = await Promise.all([api.graph(id), api.workspace(id), api.native(id)]); if (alive.current) { setGraph(values[0]); setWorkspace(values[1]); setNative(values[2]); } });
  }, [api, id, transact]);
  useEffect(() => {
    const controller = new AbortController(); const seq = ++requestId.current;
    setLoading(true);
    void api.history(id, { count: 24, ...(historyStart !== undefined ? { start: historyStart } : {}), ...(step !== undefined ? { step } : {}), ...(selectedOp ? { selectedOperationId: selectedOp } : {}), ...(observationId && step === undefined ? { observationId } : {}), ...(toolFilter ? { filter: { tool: toolFilter } } : {}) }, controller.signal).then(r => { if (seq === requestId.current) { setPage(r); setLoading(false); } }).catch(e => { if (!controller.signal.aborted) { onError(message(e)); setLoading(false); } });
    return () => controller.abort();
  }, [api, id, revision, step, historyStart, selectedOp, observationId, toolFilter, onError]);
  useEffect(() => {
    const poll = setInterval(() => { if (!document.hidden) void loadNative().catch(e => onError(message(e))); }, 1600);
    return () => clearInterval(poll);
  }, [loadNative, onError]);
  useEffect(() => {
    if (!playing || !page) return;
    if ((step ?? page.scene.total) >= page.scene.total) { setPlaying(false); return; }
    const timer = setTimeout(() => setStep(s => Math.min(page.scene.total, (s ?? 0) + 1)), Math.max(250, Math.min(page.dwell || 850, 1800)));
    return () => clearTimeout(timer);
  }, [playing, page, step]);
  useEffect(() => { if (follow && streamRef.current && historyStart === undefined) streamRef.current.scrollTop = streamRef.current.scrollHeight; }, [page, follow, historyStart]);
  useEffect(() => { if (historyStart !== undefined && streamRef.current) streamRef.current.scrollTop = 0; }, [historyStart, page?.start]);
  useEffect(() => {
    if (!searchTarget) return;
    setObservationId(searchTarget.id); setSelectedOp(undefined); setHistoryStart(undefined); setFollow(false); setStep(undefined);
  }, [searchTarget]);
  const selectOperation = (op: string) => { setSelectedOp(op); setSelectedProse(undefined); setSelectedPath(undefined); setHistoryStart(undefined); setObservationId(undefined); setFollow(false); setShowInspector(true); };
  const selectFile = (path: string) => { setSelectedPath(path); setSelectedOp(undefined); setSelectedProse(undefined); setShowInspector(true); };
  const op = page?.projection.operations.find(o => o.id === selectedOp);
  // A long rootless recording's graph response may contain only the last passage.
  // Extend that paths-only map from this bounded page, never infer imports or a root.
  const safePage = step !== undefined && page && page.scene.step > step ? undefined : page;
  const displayGraph = useMemo(() => {
    if (!graph || graph.temporal === 'current') return graph;
    const paths = [...new Set([...graph.nodes.map(n => n.path), ...(safePage?.projection.files.map(f => f.path) ?? [])])].sort();
    const existing = new Map(graph.nodes.map(n => [n.path, n]));
    const nodes: GraphNode[] = paths.map((path, index) => existing.get(path) ?? {
      id: path, path, dir: path.slice(0, path.lastIndexOf('/')), language: 'text', bytes: 0,
      x: index % 12, y: Math.floor(index / 12),
    });
    return { ...graph, nodes };
  }, [graph, safePage?.projection.files]);
  const files = displayGraph?.nodes ?? [];
  const matchingFiles = files.filter(f => f.path.toLowerCase().includes(filter.toLowerCase()));
  const visibleFiles = matchingFiles.slice(0, fileLimit);
  const approveWorkspace = () => transact(async () => { const w = await api.workspaceApprove(id); setWorkspace(w); setGraph(await api.graph(id)); });
  const scene = page?.scene;
  return <main className={`fr-workspace ${showInspector ? 'has-inspector' : ''}`}>
    <aside className="fr-shelf"><div className="fr-project-heading"><div className="fr-project-icon"><Icon name="files" size={19} /></div><div><strong>{shortRoot(recording.workspaceRoot)}</strong><span>Local workspace</span></div></div><label className="fr-session-select"><span>SESSION</span><select aria-label="Active session" value={id} onChange={e => onOpen(e.target.value)}>{recordings.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}</select></label><div className="fr-shelf-tabs" role="tablist" aria-label="Workspace explorer">{(['files', 'tools', 'agents'] as const).map(t => <button key={t} role="tab" aria-selected={sidebarTab === t} className={sidebarTab === t ? 'is-active' : ''} onClick={() => setSidebarTab(t)}>{t}</button>)}</div>
      {sidebarTab === 'files' && <><label className="fr-file-search"><Icon name="search" size={14} /><input value={filter} onChange={e => { setFilter(e.target.value); setFileLimit(150); }} aria-label="Find repository file" placeholder="Find a file…" /></label><div className="fr-file-tree">{visibleFiles.map(n => <button data-fr-path={n.path} key={n.id} className={selectedPath === n.path ? 'is-active' : ''} onClick={() => selectFile(n.path)}><span className={`fr-file-extension ext-${n.language ?? 'text'}`}>{n.path.split('.').at(-1)?.slice(0, 3)}</span><span><strong>{n.path.split('/').at(-1)}</strong><small>{n.dir || '.'}</small></span>{scene?.heat.some(h => h.path === n.path && h.edited) && <i className="fr-edited-dot" title="Captured edit" />}</button>)}{matchingFiles.length > visibleFiles.length && <Button onClick={() => setFileLimit(n => n + 150)}>Show 150 more · {number(matchingFiles.length - visibleFiles.length)} remaining</Button>}{!files.length && <p className="fr-shelf-empty">Files appear here when a session touches them.</p>}</div><div className="fr-shelf-footer"><span>{number(files.length)} files</span><span>{graph?.temporal === 'current' ? 'Current map' : 'Captured paths'}</span></div></>}
      {sidebarTab === 'tools' && <div className="fr-inventory"><Label>CAPTURED TOOLS</Label>{scene?.dock.native.map(t => <button data-fr-tool={t.tools.join('\n')} key={t.key} onClick={() => setToolFilter(t.tools[0])} aria-pressed={toolFilter === t.tools[0]}><Icon name={kindIcon(t.kind)} size={16} /><span><strong>{t.kind}</strong><small>{t.tools.join(', ')}</small></span><b>{t.uses}</b></button>)}{scene?.dock.mcp.map(server => <section key={server.server}><Label>{server.server} / MCP</Label>{server.tools.map(t => <div className="fr-inventory-row" key={t.tool}><Icon name="link" size={14} /><span>{t.tool}</span><b>{t.uses}</b></div>)}</section>)}<Label>NATIVE RUNTIME</Label>{native?.inventory === 'runtime' ? native.tools.map(t => <div className="fr-inventory-row" key={t}><Icon name="terminal" size={14} /><span>{t}</span></div>) : <p className="fr-shelf-empty">Runtime inventory becomes available after a native connection. Captured tools above show evidence from this session.</p>}</div>}
      {sidebarTab === 'agents' && <div className="fr-inventory"><Label>SESSION AGENTS</Label>{page?.projection.agents.map(a => <div className="fr-agent-row" key={a.id}><span className="fr-agent-avatar">{a.harness === 'codex' ? <Icon name="spark" size={16} /> : <Icon name="agents" size={16} />}</span><div><strong>{a.label}</strong><small>{a.model ?? a.harness}</small>{a.parentId && <small>Spawned by {page.projection.agents.find(p => p.id === a.parentId)?.label ?? a.parentId}</small>}</div><span className="fr-state-text">{scene?.agents.find(s => s.id === a.id)?.state ?? 'recorded'}</span></div>)}</div>}
    </aside>
    <div className="fr-stage-column">
      <div className="fr-stage-heading"><div><span className={`fr-agent-avatar ${recording.harness === 'codex' ? 'is-codex' : ''}`}>{recording.harness === 'codex' ? <Icon name="spark" size={18} /> : 'C'}</span><div><h1>{recording.title}</h1><span>{recording.harness === 'codex' ? 'Codex' : 'Claude Code'}<i>·</i>{native && workStates.includes(native.state) ? `Native ${native.phase ?? native.state}` : recording.health?.state ?? (recording.live ? 'Following journal' : 'Recorded history')}</span></div></div><div><Button aria-pressed={recording.live} title="Read new native journal events independently of viewport following" onClick={() => void transact(async () => { await api.live(id, !recording.live); await onReload(); })}>{recording.live ? 'Watching journal' : 'Watch journal'}</Button><Button icon="refresh" title="Read new journal content" onClick={() => void transact(async () => { await api.sync(id); await onReload(); })} aria-label="Sync journal" /><Button icon="eye" title={showInspector ? 'Hide inspector' : 'Show inspector'} aria-pressed={showInspector} onClick={() => setShowInspector(s => !s)} aria-label="Toggle inspector" /></div></div>
      <div className="fr-stage-tabs"><div role="tablist" aria-label="Session view">{(['work', 'repository', 'review'] as const).map(t => <button role="tab" aria-selected={view === t} className={view === t ? 'is-active' : ''} key={t} onClick={() => onView(t)}>{t === 'work' ? 'Work stage' : t === 'repository' ? 'Repository map' : 'Git review'}</button>)}</div><span className="fr-evidence-label">{view === 'review' ? 'Current Git' : view === 'repository' ? graph?.temporal === 'current' ? 'Current structure' : 'Captured file paths' : 'Captured evidence'}</span></div>
      {view === 'review' ? <GitReview api={api} recordingId={id} onError={onError} /> : view === 'repository' ? <div className="fr-repository-view"><RepoMap graph={displayGraph} page={safePage} selectedPath={selectedPath} onFile={selectFile} expanded /><div className="fr-map-toolbar"><span>{number(graph?.edges.length ?? 0)} static imports · {number(graph?.unresolved.length ?? 0)} unresolved</span><Button icon="refresh" onClick={() => void transact(async () => setGraph(await api.graph(id, true)))}>Refresh structure</Button></div>{graph?.approvalNeeded && <ConsentPanel root={graph.approvalNeeded.root} label="Index the current repository" description="Read supported files under this captured root to map actual import relationships. Historical captured content stays separate." onApprove={() => void transact(async () => { await api.graphApprove(id); setGraph(await api.graph(id)); })} />}{graph?.truncated && <p className="fr-warning-text">Repository indexing reached its supported file limit. The map is partial.</p>}</div> : <>
        <div className="fr-map-strip"><RepoMap graph={displayGraph} page={safePage} selectedPath={selectedPath} onFile={selectFile} /><button className="fr-map-expand" onClick={() => onView('repository')}><Icon name="link" size={13} />Explore repository<Icon name="arrow" size={13} /></button></div>
        <div className="fr-work-stats"><span><b>{loadedCount(page?.operationCount)}</b> actions</span><span><b>{loadedCount(page?.summary.edits)}</b> files with confirmed writes</span><span className={(page?.summary.errors ?? 0) > 0 ? 'fr-warning-text' : ''}><b>{loadedCount(page?.summary.errors)}</b> errors</span><span>{page?.summary.lastTest ? <><Icon name="check" size={13} />{page.summary.lastTest}</> : 'Test outcomes appear when captured'}</span><button className={follow ? 'is-active' : ''} onClick={() => { setFollow(f => !f); setHistoryStart(undefined); }}>{follow ? 'Following latest' : 'Follow latest'}<Icon name="arrow" size={13} /></button></div>
        <div ref={streamRef} className="fr-work-stream" onWheel={e => { if (e.deltaY < 0 && !(e.target as HTMLElement).closest('pre,.fr-code-material')) setFollow(false); }} tabIndex={0} role="region" aria-label="Captured work">
          <div className="fr-history-control"><Label>{step === undefined ? 'LIVE HISTORY' : 'SEQUENCE REPLAY'}</Label>{toolFilter && <Button icon="close" onClick={() => setToolFilter(undefined)}>Clear {toolFilter} focus</Button>}{page && page.start > 0 && <Button icon="back" onClick={() => { setHistoryStart(Math.max(0, page.start - 24)); setFollow(false); }}>Earlier work</Button>}{historyStart !== undefined && <Button onClick={() => { setObservationId(undefined); setHistoryStart(undefined); setFollow(true); }}>Latest work</Button>}</div>
          {page && safePage && safePage.scene.passages.filter(p => !p.unloaded).map((passage, i) => <section className="fr-passage" key={passage.id}><div className="fr-passage-gutter"><span>{String(page.start + i + 1).padStart(2, '0')}</span><i /></div><div className="fr-passage-body">{passage.turnPrompt && <div className="fr-turn-prompt"><Label>YOUR PROMPT</Label><p>{passage.turnPrompt}</p></div>}<div className="fr-action-start-order">Captured start order</div><div className="fr-action-sequence">{passage.ops.map(s => { const operation = page.projection.operations.find(o => o.id === s.id); return operation ? <ActionTile api={api} recordingId={id} key={s.id} operation={{ ...operation, status: s.state }} muted={!s.matchesFilter} arrival={s.phase === 'arriving'} selected={selectedOp === s.id} onSelect={() => selectOperation(s.id)} /> : null; })}</div>{passage.prose.map(s => { const prose = page.projection.prose.find(p => p.id === s.id); return prose ? <ProseMaterial key={prose.id} prose={prose} onRead={() => { setSelectedProse(prose); setSelectedOp(undefined); setSelectedPath(undefined); setShowInspector(true); }} /> : null; })}<div className="fr-passage-agent"><Icon name="agents" size={11} />{page.projection.agents.find(a => a.id === passage.agentId)?.label ?? 'Agent'}</div></div></section>)}
          {!safePage?.scene.passages.some(p => !p.unloaded) && <div className="fr-empty fr-empty-small"><Icon name="work" size={28} /><h3>{loading ? 'Opening captured work…' : 'The stage is ready.'}</h3><p>{loading ? 'Loading a bounded page of this session.' : 'New tool actions and exposed prose will accumulate here.'}</p></div>}
          {safePage && safePage.projection.gaps.length > 0 && <details className="fr-gaps-overview"><summary>{safePage.projection.gaps.length} capture gaps in this recording · inspect limitations</summary>{safePage.projection.gaps.map(g => <div className="fr-gap" key={g.sequence}><span>Observation #{g.sequence}</span><span>{g.detail ?? g.reason}</span></div>)}</details>}
          {page && page.start + page.loadedPassageIds.length < page.scene.passages.length && <Button onClick={() => setHistoryStart(page.start + 24)}>Later work</Button>}
        </div>
      </>}
      {scene && <details className="fr-replay-disclosure" open={replayOpen} onToggle={event => setReplayOpen(event.currentTarget.open)}><summary>Sequence replay</summary><div className="fr-transport"><Button icon={playing ? 'pause' : 'play'} title={playing ? 'Pause replay' : 'Replay captured sequence'} aria-label={playing ? 'Pause replay' : 'Play replay'} onClick={() => { setObservationId(undefined); if (!playing && (step === undefined || step >= scene.total)) { setStep(0); setHistoryStart(undefined); } setPlaying(p => !p); }} /><input aria-label="Replay position" type="range" min={0} max={scene.total} value={step ?? scene.total} onChange={e => { setObservationId(undefined); setStep(Number(e.target.value)); setPlaying(false); }} /><span>{number(step ?? scene.total)} / {number(scene.total)}</span><Button onClick={() => { setObservationId(undefined); setStep(undefined); setPlaying(false); setFollow(true); setHistoryStart(undefined); }} aria-pressed={step === undefined}>Live</Button><Button icon="eye" title="Mark captured history as seen through this point" aria-label="Mark history as seen" onClick={() => void transact(async () => { await api.boundary(id, page!.projection.lastSequence); })} /></div></details>}
      <NativeComposer api={api} recording={recording} native={native} workspace={workspace} onNative={setNative} onApproveWorkspace={approveWorkspace} onError={onError} />
    </div>
    {showInspector && <Inspector api={api} recordingId={id} operation={safePage ? op : undefined} selectedProse={safePage?.projection.prose.some(prose => prose.id === selectedProse?.id) ? selectedProse : undefined} replay={step !== undefined} selectedPath={selectedPath} page={safePage} graph={graph} workspace={workspace} onApproveWorkspace={approveWorkspace} onFile={selectFile} onOperation={selectOperation} onClose={() => setShowInspector(false)} onError={onError} />}
  </main>;
}

function ActionTile({ api, recordingId, operation: op, selected, muted, arrival, onSelect }: { arrival: boolean; api: FreshApi; recordingId: string; operation: Operation; selected: boolean; muted?: boolean; onSelect: () => void }) {
  const d = op.detail;
  const [material, setMaterial] = useState<ArtifactSlice>();
  const [materialId, setMaterialId] = useState<string>();
  const card = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); } }, { rootMargin: '120px' });
    if (card.current) observer.observe(card.current); return () => observer.disconnect();
  }, []);
  const artifactId = d.kind === 'read' ? d.excerptArtifactId : d.kind === 'shell' || d.kind === 'test' ? d.outputArtifactId : undefined;
  const shownMaterial = artifactId && materialId === artifactId ? material : undefined;
  useMaterialMotion(card, { arrival, path: op.paths[0]?.path, tool: op.tool, revision: shownMaterial?.text ?? op.status });
  useEffect(() => { let alive = true; if (visible && artifactId) void api.request<ArtifactSlice>(`recordings/${encodeURIComponent(recordingId)}/artifacts/${encodeURIComponent(artifactId)}?start=0&count=8`).then(r => { if (alive) { setMaterial(r); setMaterialId(artifactId); } }).catch(() => {}); return () => { alive = false; }; }, [api, recordingId, artifactId, visible]);
  return <button ref={card} className={`fr-action fr-action-${op.kind} ${selected ? 'is-selected' : ''} ${muted ? 'is-muted' : ''} ${op.status === 'error' ? 'is-error' : ''}`} onClick={onSelect}><div className="fr-action-type"><span><Icon name={kindIcon(op.kind)} size={14} />{op.kind}</span><span className={`fr-outcome outcome-${op.status}`} title={`Captured outcome: ${op.status}`}>{op.status === 'ok' ? <Icon name="check" size={12} /> : op.status === 'error' ? '!' : op.status === 'running' ? '•••' : '?'}</span></div><strong>{op.title}</strong>{d.kind === 'shell' || d.kind === 'test' ? <code>$ {d.command}</code> : d.kind === 'edit' ? <div className="fr-diff-mini">{d.hunks.slice(0, 1).flatMap(h => h.lines.slice(0, 4)).map((l, i) => <code key={i} className={l.startsWith('+') ? 'fr-add' : l.startsWith('-') ? 'fr-remove' : ''}>{l}</code>)}</div> : d.kind === 'read' ? <div className="fr-read-range"><Icon name="code" size={13} />Lines {d.startLine}–{d.startLine + Math.max(0, d.lineCount - 1)}</div> : d.kind === 'search' ? <code>{d.query}</code> : d.kind === 'mcp' ? <span className="fr-read-range">{d.server} / {d.tool}</span> : d.kind === 'spawn' ? <span className="fr-read-range">{d.description ?? d.agentType ?? 'Delegated task'}</span> : null}<div className="fr-action-material">{shownMaterial?.available ? <><pre><CodeTokens text={shownMaterial.text} /></pre><small>{shownMaterial.hasMore ? 'Captured excerpt · open to read all available lines' : 'Captured material'}</small></> : (d.kind === 'shell' || d.kind === 'test') && d.outputPreview ? <><pre>{d.outputPreview}</pre><small>Captured output preview · inspect available evidence</small></> : null}</div><footer><span>{op.paths[0]?.path ?? op.tool}</span><Icon name="arrow" size={12} /></footer></button>;
}

function ProseMaterial({ prose, onRead }: { prose: Prose; onRead: () => void }) {
  return <div className={`fr-prose fr-prose-${prose.role}`}><div><Label>{prose.role === 'reasoning' ? prose.exposure === 'summary' ? 'EXPOSED REASONING SUMMARY' : 'EXPOSED THINKING' : prose.role === 'user' ? 'YOUR WORDS' : 'AGENT RESPONSE'}</Label><span>Captured</span></div><p>{prose.text}</p>{prose.truncated && <p className="fr-warning-text">This projection contains a bounded preview. Open the original captured observation to inspect available evidence.</p>}<button className="fr-text-button" onClick={onRead}><Icon name="eye" size={12} />Inspect session evidence</button></div>;
}

function RepoMap({ graph, page, selectedPath, onFile, expanded = false }: { graph?: RepoGraph; page?: HistoryPage; selectedPath?: string; onFile: (path: string) => void; expanded?: boolean }) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const pointer = useRef<{ id: number; x: number; y: number; start: { x: number; y: number } } | undefined>(undefined);
  const nodes = useMemo(() => {
    const all = graph?.nodes ?? [];
    const touched = new Set(page?.projection.files.map(f => f.path) ?? []);
    return [...all].sort((a, b) => Number(touched.has(b.path)) - Number(touched.has(a.path))).slice(0, expanded ? 160 : 8);
  }, [graph, page?.projection.files, expanded]);
  const positions = useMemo(() => {
    if (!nodes.length) return new Map<string, { x: number; y: number }>();
    const minX = Math.min(...nodes.map(n => n.x)), maxX = Math.max(...nodes.map(n => n.x));
    const minY = Math.min(...nodes.map(n => n.y)), maxY = Math.max(...nodes.map(n => n.y));
    return new Map(nodes.map((n, i) => [n.path, { x: maxX > minX ? 8 + (n.x - minX) / (maxX - minX) * 84 : 12 + (i % 6) * 15, y: maxY > minY ? 15 + (n.y - minY) / (maxY - minY) * 68 : 20 + Math.floor(i / 6) * 20 }]));
  }, [nodes]);
  const edges = graph?.edges.filter(e => positions.has(e.from) && positions.has(e.to)) ?? [];
  return <div className={`fr-repo-map ${expanded ? 'is-expanded' : ''}`} onPointerDown={e => { if ((e.target as HTMLElement).closest('button')) return; pointer.current = { id: e.pointerId, x: e.clientX, y: e.clientY, start: pan }; e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={e => { if (pointer.current?.id === e.pointerId) setPan({ x: pointer.current.start.x + e.clientX - pointer.current.x, y: pointer.current.start.y + e.clientY - pointer.current.y }); }} onPointerUp={() => { pointer.current = undefined; }} onPointerCancel={() => { pointer.current = undefined; }}>
    <div className="fr-map-caption"><Label>{graph?.temporal === 'current' ? 'REPOSITORY RELATIONSHIPS' : 'CAPTURED WORKING SET'}</Label><span>{expanded ? 'Drag to explore · select a file to read' : 'Your code, in context'}</span></div>
    <div className="fr-map-world" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}><svg className="fr-map-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{edges.map((e, i) => { const a = positions.get(e.from)!, b = positions.get(e.to)!; return <path key={`${e.from}-${e.to}-${i}`} className={selectedPath === e.from || selectedPath === e.to ? 'is-selected' : ''} d={`M${a.x} ${a.y} C${(a.x + b.x) / 2} ${a.y}, ${(a.x + b.x) / 2} ${b.y}, ${b.x} ${b.y}`} />; })}</svg>{nodes.map(n => { const pos = positions.get(n.path)!; const heat = page?.scene.heat.find(h => h.path === n.path); return <button data-fr-path={n.path} key={n.id} className={`fr-map-node ${selectedPath === n.path ? 'is-selected' : ''} ${heat ? `tone-${heat.tone}` : ''}`} style={{ left: `${pos.x}%`, top: `${pos.y}%` }} onClick={() => onFile(n.path)} title={n.path}><span className="fr-map-node-point" /><span>{n.path.split('/').at(-1)}</span>{expanded && <small>{n.dir}</small>}</button>; })}</div>
    {!nodes.length && <div className="fr-map-no-files"><Icon name="link" size={24} /><span>Repository relationships appear as files are captured or indexed.</span></div>}
    {expanded && <div className="fr-map-zoom"><Button onClick={() => setZoom(z => Math.max(.5, z - .2))} aria-label="Zoom out">−</Button><span>{Math.round(zoom * 100)}%</span><Button onClick={() => setZoom(z => Math.min(3, z + .2))} aria-label="Zoom in">+</Button><Button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>Reset</Button></div>}
    {nodes.length < (graph?.nodes.length ?? 0) && <span className="fr-map-bound">Showing {nodes.length} of {number(graph!.nodes.length)} files · all files in explorer</span>}
  </div>;
}

function ConsentPanel({ root, label, description, onApprove }: { root?: string; label: string; description: string; onApprove: () => void }) { return <div className="fr-consent"><Icon name="files" size={25} /><h3>{label}</h3><p>{description}</p>{root && <code>{root}</code>}<Button tone="primary" icon="check" disabled={!root} onClick={onApprove}>Allow this workspace</Button>{!root && <p className="fr-muted">This recording has no canonical local workspace root. Captured evidence remains readable; current source and native prompts are unavailable.</p>}</div>; }

function Inspector({ api, recordingId, operation, selectedProse, replay, selectedPath, page, graph, workspace, onApproveWorkspace, onFile, onOperation, onClose, onError }: { api: FreshApi; recordingId: string; operation?: Operation; selectedProse?: Prose; replay: boolean; selectedPath?: string; page?: HistoryPage; graph?: RepoGraph; workspace?: WorkspaceState; onApproveWorkspace: () => Promise<void>; onFile: (path: string) => void; onOperation: (id: string) => void; onClose: () => void; onError: (e?: string) => void }) {
  const [artifactResult, setArtifact] = useState<ArtifactSlice>();
  const [currentResult, setCurrent] = useState<CurrentFile>();
  const [activeArtifact, setActiveArtifact] = useState<string>();
  const [readerStart, setReaderStart] = useState(0);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fileOps, setFileOps] = useState<Operation[]>([]);
  const [fileScope, setFileScope] = useState('');
  const [fileOpsStart, setFileOpsStart] = useState(0);
  const [fileOpsTotal, setFileOpsTotal] = useState(0);
  const [note, setNote] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);
  useEffect(() => { setReaderStart(0); setFileOpsStart(0); setArtifact(undefined); setCurrent(undefined); setFileOps([]); setActiveArtifact(selectedProse?.truncated ? `art_${selectedProse.id}_prose` : operation?.artifactIds[0]); }, [operation?.id, selectedPath, selectedProse?.id]);
  const requestedFileScope = `${recordingId}:${selectedPath}:${replay ? page?.scene.step ?? 'pending' : 'live'}:${fileOpsStart}`;
  const visibleFileOps = fileScope === requestedFileScope ? fileOps : [];
  const visibleFileTotal = fileScope === requestedFileScope ? fileOpsTotal : 0;
  useEffect(() => {
    let alive = true;
    if (selectedPath && (!replay || page)) void api.request<{ operations: Operation[]; total: number }>(`recordings/${encodeURIComponent(recordingId)}/file-operations?path=${encodeURIComponent(selectedPath)}&count=100&start=${fileOpsStart}${replay && page ? `&step=${page.scene.step}` : ''}`).then(r => { if (alive) { setFileOps(r.operations ?? []); setFileOpsTotal(r.total); setFileScope(requestedFileScope); } }).catch(e => { if (alive) onError(message(e)); });
    return () => { alive = false; };
  }, [selectedPath, api, recordingId, onError, fileOpsStart, replay, replay ? page?.scene.step : undefined]);
  useEffect(() => {
    let alive = true; setLoading(true);
    const promise = selectedPath && workspace?.approved ? api.file(recordingId, selectedPath, readerStart) : activeArtifact ? api.artifact(recordingId, activeArtifact, readerStart) : undefined;
    if (!promise) { setLoading(false); return; }
    void promise.then(r => { if (!alive) return; if ('artifact' in r) setArtifact(r); else setCurrent(r); }).catch(e => { if (alive) onError(message(e)); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [api, recordingId, selectedPath, workspace?.approved, activeArtifact, readerStart, onError]);
  const artifact = artifactResult?.artifact.id === activeArtifact && artifactResult?.start === readerStart ? artifactResult : undefined;
  const current = currentResult?.path === selectedPath && currentResult?.start === readerStart ? currentResult : undefined;
  const text = current?.text ?? artifact?.text;
  const node: GraphNode | undefined = graph?.nodes.find(n => n.path === selectedPath);
  const copy = async () => { try { await navigator.clipboard.writeText(text ?? JSON.stringify(operation?.detail ?? {}, null, 2)); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch (e) { onError(message(e)); } };
  const relations = selectedPath ? graph?.edges.filter(e => e.from === selectedPath || e.to === selectedPath) : page?.projection.links.filter(l => l.from === operation?.id || l.to === operation?.id);
  return <aside className="fr-inspector"><div className="fr-inspector-heading"><Label>{selectedPath ? 'SOURCE READER' : selectedProse ? 'CAPTURED PROSE' : operation ? 'ACTION INSPECTOR' : 'SESSION INSPECTOR'}</Label><Button icon="close" aria-label="Close inspector" onClick={onClose} /></div><div className="fr-inspector-scroll">
    {selectedProse ? <><div className="fr-inspector-title"><Icon name="spark" size={22} /><h2>{selectedProse.role === 'reasoning' ? 'Exposed reasoning' : 'Captured prose'}</h2><p>{selectedProse.exposure} · captured</p></div>{selectedProse.truncated ? <>{loading ? <p className="fr-muted">Opening captured prose…</p> : artifact?.available ? <p className="fr-full-prose">{artifact.text}</p> : <p className="fr-muted">Captured full text is unavailable.</p>}{activeArtifact && artifact?.available && <ArtifactFind api={api} recordingId={recordingId} artifactId={activeArtifact} onLine={setReaderStart} />}{artifact && <ReaderPaging start={readerStart} returned={artifact.returnedLines} total={artifact.totalLines} hasMore={artifact.hasMore} onStart={setReaderStart} />}</> : <p className="fr-full-prose">{selectedProse.text}</p>}</> : selectedPath ? <><div className="fr-inspector-title"><Icon name="files" size={22} /><h2>{selectedPath.split('/').at(-1)}</h2><p>{selectedPath}</p></div><div className="fr-provenance fr-provenance-current"><i />Current workspace · {workspace?.approved ? 'read permission granted' : 'permission required'}</div>{!workspace?.approved ? <ConsentPanel root={workspace?.root} label="Read current source" description="Allow read-only access to this session’s indexed workspace. Current source is distinct from historical tool evidence." onApprove={() => void onApproveWorkspace()} /> : <><div className="fr-reader-toolbar"><span>{node?.language ?? 'text'} · {current?.totalLines ?? node?.lines ?? '—'} lines</span><Button icon={copied ? 'check' : 'copy'} aria-label="Copy displayed source" onClick={() => void copy()} /></div>{loading ? <p className="fr-reader-loading">Reading source…</p> : current && <CodeMaterial text={current.text} start={current.start + 1} />}{current && <ReaderPaging start={readerStart} returned={current.returnedLines} total={current.totalLines} hasMore={current.hasMore} onStart={setReaderStart} />}</>}<div className="fr-inspector-section"><Label>CAPTURED FILE ACTIVITY</Label>{visibleFileOps.length ? visibleFileOps.map(o => <button className="fr-related-action" key={o.id} onClick={() => onOperation(o.id)}><Icon name={kindIcon(o.kind)} size={14} /><span>{o.title}</span><Icon name="arrow" size={13} /></button>) : <p className="fr-muted">No captured operations loaded for this path.</p>}{visibleFileTotal > 100 && <div className="fr-reader-paging"><Button disabled={fileOpsStart === 0} onClick={() => setFileOpsStart(s => Math.max(0, s - 100))}>Previous</Button><span>{fileOpsStart + 1}–{fileOpsStart + visibleFileOps.length} / {number(visibleFileTotal)}</span><Button disabled={fileOpsStart + 100 >= visibleFileTotal} onClick={() => setFileOpsStart(s => s + 100)}>Next</Button></div>}</div><div className="fr-inspector-section"><Label>STATIC IMPORT RELATIONSHIPS</Label>{relations?.map((r, i) => 'specifier' in r ? <button className="fr-related-action" key={i} onClick={() => onFile(r.from === selectedPath ? r.to : r.from)}><Icon name="link" size={14} /><span>{r.from === selectedPath ? `Imports ${r.to}` : `Imported by ${r.from}`}</span></button> : null)}{!relations?.length && <p className="fr-muted">No resolved static imports in this map.</p>}</div></> : operation ? <><div className="fr-inspector-title"><span className={`fr-type-symbol fr-type-${operation.kind}`}><Icon name={kindIcon(operation.kind)} size={22} /></span><h2>{operation.title}</h2><p>{operation.tool}</p></div><div className="fr-provenance"><i />{operation.titleProvenance.kind} title · captured tool evidence</div><div className="fr-detail-meta"><span>Outcome<strong className={operation.status === 'error' ? 'fr-warning-text' : ''}>{operation.status}</strong></span><span>Agent<strong>{page?.projection.agents.find(a => a.id === operation.agentId)?.label ?? operation.agentId}</strong></span></div>{operation.paths.map(p => <button className="fr-related-action" key={`${p.path}-${p.role}`} onClick={() => onFile(p.path)}><Icon name="files" size={14} /><span>{p.path}<small>{p.role} · {p.basis} location</small></span><Icon name="arrow" size={13} /></button>)}<OperationDetail operation={operation} />{operation.artifactIds.length > 0 && <><div className="fr-artifact-tabs">{operation.artifactIds.map((id, i) => <button className={activeArtifact === id ? 'is-active' : ''} key={id} onClick={() => { setActiveArtifact(id); setReaderStart(0); }}>{page?.projection.artifacts.find(a => a.id === id)?.kind ?? `Artifact ${i + 1}`}</button>)}</div><div className="fr-reader-toolbar"><span>{artifact ? `${artifact.artifact.provenance.kind} · ${artifact.artifact.availability}` : 'Captured material'}</span><Button icon={copied ? 'check' : 'copy'} aria-label="Copy displayed artifact" onClick={() => void copy()} /></div>{loading ? <p className="fr-reader-loading">Opening material…</p> : artifact?.available ? <CodeMaterial text={artifact.text} start={artifact.start + (artifact.artifact.range?.start ?? 1)} diff={artifact.artifact.kind === 'patch'} /> : <p className="fr-muted">{artifact?.reason === 'no-longer-stored' ? 'This content is no longer stored.' : 'No captured content is available for this artifact.'}</p>}{activeArtifact && artifact?.available && <ArtifactFind api={api} recordingId={recordingId} artifactId={activeArtifact} onLine={setReaderStart} />}{artifact && <ReaderPaging start={readerStart} returned={artifact.returnedLines} total={artifact.totalLines} hasMore={artifact.hasMore} onStart={setReaderStart} />}{artifact?.artifact.note && <p className="fr-warning-text">{artifact.artifact.note}</p>}</>}<FreshEvidence api={api} recordingId={recordingId} operation={operation} onOperation={onOperation} replay={replay} /><div className="fr-inspector-section"><Label>EVIDENCE LINKS</Label>{relations?.map((r, i) => 'explanation' in r ? <div className="fr-evidence-link" key={i}><Icon name="link" size={13} /><span>{r.explanation}<small>{r.relation} · {r.basis}</small></span></div> : null)}{!relations?.length && <p className="fr-muted">No evidence-backed relationship is recorded here.</p>}</div></> : <><div className="fr-inspector-title"><Icon name="eye" size={25} /><h2>A closer look.</h2><p>Select an action to read what the agent actually saw. Select a file to explore current source and recorded activity.</p></div><div className="fr-inspector-section"><Label>SESSION EVIDENCE</Label><div className="fr-detail-meta"><span>Observations<strong>{number(page?.projection.observationCount ?? 0)}</strong></span><span>Agents<strong>{page?.summary.agents ?? 0}</strong></span></div><p className="fr-muted">Action names and classifications are derived. Tool input, output, exposed thinking and prose come from captured observations. Current files and Git are labelled separately.</p></div><div className="fr-inspector-section"><Label>LEAVE A READING NOTE</Label><textarea placeholder="What should you revisit?" aria-label="Reading note" value={note} onChange={e => { setNote(e.target.value); setNoteSaved(false); }} /><Button icon={noteSaved ? 'check' : 'plus'} disabled={!note.trim()} onClick={() => { void api.bookmark(recordingId, page?.scene.step ?? 0, note).then(() => { setNoteSaved(true); }).catch(e => onError(message(e))); }}>{noteSaved ? 'Note saved' : 'Save at this point'}</Button></div><div className="fr-inspector-section"><Label>PORTABLE HISTORY</Label><Button icon="download" onClick={() => { void api.export(recordingId).then(bundle => { const url = URL.createObjectURL(new Blob([JSON.stringify(bundle)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = `drishya-${recordingId}.json`; a.click(); URL.revokeObjectURL(url); }).catch(e => onError(message(e))); }}>Export redacted replay</Button></div></>}
    </div></aside>;
}

function OperationDetail({ operation: op }: { operation: Operation }) {
  const d = op.detail;
  return <div className="fr-operation-detail">{d.kind === 'shell' || d.kind === 'test' ? <><Label>CAPTURED COMMAND</Label><pre className="fr-command">$ {d.command}</pre>{d.exitCode !== undefined && <span className="fr-muted">Exit code {d.exitCode ?? 'not recorded'}</span>}{d.kind === 'test' && d.summary && <div className="fr-test-summary"><span><b>{d.summary.passed}</b> passed</span><span><b>{d.summary.failed}</b> failed</span><small>Derived from captured test output · {d.summary.framework}</small></div>}{!d.outputArtifactId && d.outputPreview && <><Label>CAPTURED OUTPUT PREVIEW</Label><pre>{d.outputPreview}</pre></>}</> : d.kind === 'edit' ? <><Label>CAPTURED PATCH</Label>{d.hunks.map((h, i) => <div key={i}><div className="fr-hunk-heading">@@ −{h.oldStart},{h.oldLines} +{h.newStart},{h.newLines} @@</div><CodeMaterial text={h.lines.join('\n')} start={h.newStart} diff /></div>)}<p className="fr-muted">Reconstruction: {d.reconstruction}. {d.reconstructionNote}</p></> : d.kind === 'search' ? <><Label>CAPTURED SEARCH</Label><pre>{d.query}</pre>{d.hits.map((h, i) => <div className="fr-search-hit" key={i}><code>{h.path}{h.line ? `:${h.line}` : ''}</code>{h.text && <pre>{h.text}</pre>}</div>)}</> : d.kind === 'read' ? <div className="fr-read-detail"><Label>CAPTURED RANGE</Label><p>Lines {d.startLine}–{d.startLine + Math.max(0, d.lineCount - 1)}{d.totalLines ? ` of ${d.totalLines}` : ''}. Content beyond this range is not implied.</p></div> : d.kind === 'plan' ? <><Label>CAPTURED PLAN</Label>{d.items.map((item, i) => <div className="fr-plan-item" key={i}><Icon name={item.status === 'completed' ? 'check' : 'eye'} size={14} /><span>{item.text}<small>{item.status}</small></span></div>)}</> : <><Label>CAPTURED TOOL MATERIAL</Label><pre>{d.kind === 'mcp' || d.kind === 'other' ? JSON.stringify(d.input, null, 2) : d.kind === 'spawn' ? d.description ?? d.agentType : d.kind === 'web' ? d.url ?? d.query : JSON.stringify(d, null, 2)}</pre>{'resultPreview' in d && d.resultPreview && <><Label>CAPTURED RESULT PREVIEW</Label><pre>{d.resultPreview}</pre></>}</>}</div>;
}

function CodeMaterial({ text, start = 1, diff = false, numbered = !diff }: { text: string; start?: number; diff?: boolean; numbered?: boolean }) { return <div className="fr-code-material">{text.split('\n').map((line, i) => <div key={i} className={diff ? line.startsWith('+') ? 'fr-code-add' : line.startsWith('-') ? 'fr-code-remove' : '' : ''}>{numbered && <span aria-hidden="true">{start + i}</span>}<code><CodeTokens text={line || ' '} /></code></div>)}</div>; }
function ReaderPaging({ start, returned, total, hasMore, onStart }: { start: number; returned: number; total: number; hasMore: boolean; onStart: (start: number) => void }) { return <div className="fr-reader-paging"><Button disabled={start === 0} onClick={() => onStart(Math.max(0, start - returned))}>Previous</Button><span>{returned ? `${start + 1}–${start + returned}` : '0'} / {number(total)} lines</span><Button disabled={!hasMore} onClick={() => onStart(start + returned)}>Next</Button></div>; }

function ArtifactFind({ api, recordingId, artifactId, onLine }: { api: FreshApi; recordingId: string; artifactId: string; onLine: (line: number) => void }) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<{ matches: number[]; scannedThrough: number; totalLines: number; continuation?: string; skippedLines: number; available: boolean }>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  useEffect(() => { setQuery(''); setResult(undefined); setError(undefined); }, [artifactId]);
  const find = async (continuation?: string) => {
    if (!query.trim()) return;
    setBusy(true); setError(undefined);
    try { const r = await api.request<NonNullable<typeof result>>(`recordings/${encodeURIComponent(recordingId)}/artifacts/${encodeURIComponent(artifactId)}?find=${encodeURIComponent(query)}${continuation ? `&cursor=${continuation}` : ''}`); setResult(r); }
    catch (e) { setError(message(e)); } finally { setBusy(false); }
  };
  return <div className="fr-artifact-find"><form onSubmit={e => { e.preventDefault(); void find(); }}><input aria-label="Find in captured material" placeholder="Find in this material…" value={query} maxLength={200} onChange={e => { setQuery(e.target.value); setResult(undefined); }} /><Button icon="search" disabled={busy || !query.trim()} type="submit">Find</Button></form>{result && <><p>{result.matches.length} matches in scan · through {number(result.scannedThrough)} / {number(result.totalLines)} lines{result.skippedLines ? ` · ${result.skippedLines} skipped lines` : ''}</p><div>{result.matches.map((line, i) => <Button key={`${line}-${i}`} onClick={() => onLine(line)}>Line {line + 1}</Button>)}{result.continuation && <Button disabled={busy} onClick={() => void find(result.continuation)}>Continue scan</Button>}</div></>}{error && <p className="fr-warning-text">{error}</p>}</div>;
}

function NativeComposer({ api, recording, native, workspace, onNative, onApproveWorkspace, onError }: { api: FreshApi; recording: RecordingSummary; native?: NativeState; workspace?: WorkspaceState; onNative: (s: NativeState) => void; onApproveWorkspace: () => Promise<void>; onError: (e?: string) => void }) {
  const [prompt, setPrompt] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [exclusive, setExclusive] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState('');
  const [effort, setEffort] = useState('');
  const [sent, setSent] = useState(false);
  const id = recording.id;
  const active = !!native && workStates.includes(native.state);
  const action = async (fn: () => Promise<void>) => { setBusy(true); onError(undefined); try { await fn(); } catch (e) { onError(message(e)); } finally { setBusy(false); } };
  const send = () => void action(async () => { const state = await api.prompt(id, prompt, attachments, { ...(model ? { model } : {}), ...(effort ? { effort } : {}) }); onNative(state); setPrompt(''); setAttachments([]); setExclusive(false); setSent(true); });
  const attach = async (files: FileList | null) => {
    if (!files) return;
    await action(async () => {
      if (files.length + attachments.length > 32) throw new Error('Attach at most 32 files.');
      const next: Attachment[] = [];
      for (const file of Array.from(files)) {
        if (file.type.startsWith('image/')) {
          if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size > 4 * 1024 * 1024) throw new Error('Use PNG, JPEG, WebP or GIF images up to 4 MiB.');
          const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => { const base64 = String(reader.result).split(',')[1]; if (base64) resolve(base64); else reject(new Error('Could not read attachment.')); }; reader.onerror = () => reject(new Error('Could not read attachment.')); reader.readAsDataURL(file); });
          next.push({ name: file.webkitRelativePath || file.name, type: 'image', mime: file.type, data });
        } else { if (file.size > 512 * 1024) throw new Error('Text attachments support 512 KiB combined.'); next.push({ name: file.webkitRelativePath || file.name, type: 'text', data: await file.text() }); }
      }
      setAttachments(a => [...a, ...next]);
    });
  };
  const settings = native?.settings;
  const efforts = settings?.models.find(m => m.id === (model || settings.model))?.efforts ?? [];
  if (!recording.workspaceRoot) return <div className="fr-readonly-session"><Icon name="eye" size={15}/><span>Recorded session · prompting unavailable</span><details><summary>Why?</summary><p>This journal has no captured workspace root on this machine. Captured files, tools and prose remain readable; native prompting requires an identified local workspace.</p></details></div>;
  return <div className="fr-composer-wrap">
    {native?.approvals.map(a => <div className="fr-native-approval" key={a.id}><div><Label>ONE-TIME NATIVE APPROVAL</Label><strong>{a.name}</strong><pre>{a.detail}</pre></div><div><Button disabled={busy} onClick={() => void action(async () => onNative(await api.approval(id, native.runId!, a.id, false)))}>Deny</Button><Button tone="primary" disabled={busy} onClick={() => void action(async () => onNative(await api.approval(id, native.runId!, a.id, true)))}>Allow once</Button></div></div>)}
    <div className="fr-composer"><div className="fr-composer-top"><span><Icon name="spark" size={13} />{native?.available ? `Continue with ${recording.harness === 'codex' ? 'Codex' : 'Claude'}` : 'Native connection unavailable'}</span><button onClick={() => setExpanded(e => !e)}>{expanded ? 'Hide connection details' : 'Connection & permissions'}<Icon name="chevron" size={12} /></button></div>
      {expanded && <div className="fr-composer-connection"><p>Submit directly to this native session using its supported protocol. The harness owns project changes and approval policy.</p><div className="fr-composer-consent">{workspace?.approved ? <span><Icon name="check" size={13} />Workspace permitted</span> : <Button disabled={busy || !recording.workspaceRoot} onClick={() => void action(onApproveWorkspace)}>Allow workspace access</Button>}<label><input type="checkbox" checked={exclusive} onChange={e => setExclusive(e.target.checked)} />This session is idle in its other clients</label></div><Button disabled={!workspace?.approved || busy || active} onClick={() => void action(async () => onNative(await api.settings(id)))} icon="refresh">Read native settings</Button>{settings && <div className="fr-native-policy"><span>Permission: {settings.permission ?? 'native default'}</span><span>Sandbox: {settings.sandbox ?? 'native default'}</span></div>}</div>}
      <textarea aria-label="Prompt to native agent" onPaste={e => { if (e.clipboardData.files.length) { e.preventDefault(); void attach(e.clipboardData.files); } }} value={prompt} onChange={e => { setPrompt(e.target.value); setSent(false); }} placeholder={active ? 'A turn is running. You can prepare your next prompt here.' : 'Ask your agent to build, investigate, or continue…'} onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && prompt.trim() && exclusive && workspace?.approved && !active && !busy) { e.preventDefault(); send(); } }} />
      {attachments.length > 0 && <div className="fr-attachments">{attachments.map((a, i) => <span key={`${a.name}-${i}`}><Icon name={a.type === 'image' ? 'eye' : 'files'} size={13} />{a.name}<button aria-label={`Remove ${a.name}`} onClick={() => setAttachments(v => v.filter((_, n) => n !== i))}><Icon name="close" size={12} /></button></span>)}</div>}
      <div className="fr-composer-bottom"><div><label className="fr-attachment-button" title="Attach text or image"><Icon name="attach" size={17} /><input type="file" multiple aria-label="Attach text or image files" onChange={e => { void attach(e.target.files); e.target.value = ''; }} /></label><label className="fr-attachment-button" title="Attach a folder of text files"><Icon name="files" size={16} /><input type="file" multiple ref={e => { e?.setAttribute('webkitdirectory', ''); }} aria-label="Attach folder" onChange={e => { void attach(e.target.files); e.target.value = ''; }} /></label>{settings?.models.length ? <select aria-label="Native model" value={model || settings.model || ''} disabled={active} onChange={e => { setModel(e.target.value); setEffort(''); }}>{!settings.models.some(m => m.id === (model || settings.model)) && <option value="">Native model</option>}{settings.models.map(m => <option value={m.id} key={m.id}>{m.name}</option>)}</select> : <span className="fr-muted">{settings?.model ?? 'Native defaults'}</span>}{efforts.length > 0 && <select aria-label="Reasoning effort" value={effort} disabled={active} onChange={e => setEffort(e.target.value)}><option value="">Default effort</option>{efforts.map(e => <option key={e}>{e}</option>)}</select>}</div><div>{sent && <span className="fr-sent"><Icon name="check" size={12} />Submitted</span>}{active ? <Button icon="stop" disabled={busy || !native?.runId} onClick={() => void action(async () => onNative(await api.stop(id, native!.runId!)))}>Interrupt</Button> : <Button icon="arrow" tone="primary" disabled={!native?.available || !prompt.trim() || !exclusive || !workspace?.approved || busy} onClick={send}>{busy ? 'Connecting…' : 'Send'}</Button>}</div></div>
    </div>{native?.submittedPrompt && active && <div className="fr-native-receipt"><Label>SUBMITTED TO NATIVE SESSION</Label><p>{native.submittedPrompt}</p>{native.promptRedacted && <small>Protected text redacted</small>}{native.preview && <><Label>{native.preview.role === 'reasoning' ? `EXPOSED ${native.preview.exposure ?? 'reasoning'}` : 'NATIVE RESPONSE · AWAITING JOURNAL CAPTURE'}</Label><p>{native.preview.text}</p></>}</div>}<div className="fr-composer-caption"><span>{!workspace?.approved || !exclusive ? 'Open connection details to grant workspace access and confirm other clients are idle.' : 'Ctrl / ⌘ Enter to submit · capture continues independently'}</span>{native?.usage && <span>{number(native.usage.input + native.usage.output)} tokens{native.usage.costUsd !== undefined ? ` · $${native.usage.costUsd.toFixed(3)}` : ''}</span>}</div>{native?.error && <p className="fr-warning-text">{native.error}</p>}
  </div>;
}

function Settings({ api }: { api: FreshApi }) {
  const [config, setConfig] = useState<LocalConfig>();
  const [storage, setStorage] = useState<StorageInfo>();
  const [error, setError] = useState<string>();
  useEffect(() => { let alive = true; void Promise.all([api.config(), api.storage()]).then(([c, s]) => { if (alive) { setConfig(c); setStorage(s); } }).catch(e => { if (alive) setError(message(e)); }); return () => { alive = false; }; }, [api]);
  return <main className="fr-settings"><Label>YOUR LOCAL ENVIRONMENT</Label><h1>A workspace you can trust.</h1><p>Connection details and capture capabilities, directly from the daemon.</p><SettingsSections>{error && <p className="fr-warning-text">{error}</p>}<section><div><Icon name="work" size={21} /><h2>Local runtime</h2></div><dl><dt>Version</dt><dd>{config?.version ?? 'Loading…'}</dd><dt>Storage directory</dt><dd><code>{config?.dataDir ?? 'Loading…'}</code></dd><dt>Telemetry</dt><dd>None</dd><dt>Capture</dt><dd>Read-only journals · redacted before persistence</dd></dl></section><section><div><Icon name="agents" size={21} /><h2>Harness adapters</h2></div>{config?.adapters.map(a => <div className="fr-adapter" key={a.harness}><h3>{a.label}</h3><div>{Object.entries(a.capabilities).map(([name, status]) => <span key={name} className={`fr-capability capability-${status}`}>{name.replace(/([A-Z])/g, ' $1').toLowerCase()}<b>{status}</b></span>)}</div></div>)}</section><section><div><Icon name="spark" size={21} /><h2>Optional generated explanations</h2></div><p>Generated material is derived and requires an explicit preview and consent before sending evidence to a model destination.</p><dl><dt>Configuration</dt><dd>{config?.llm.configured ? 'Available' : 'Not configured'}</dd><dt>Destination</dt><dd>{config?.llm.baseUrl ?? 'Loading…'}</dd>{Object.entries(config?.llm.models ?? {}).map(([name, model]) => <><dt key={`${name}-label`}>{name}</dt><dd key={name}>{model}</dd></>)}</dl></section><section><div><Icon name="files" size={21} /><h2>Local storage</h2></div><pre>{storage ? JSON.stringify(storage, null, 2) : 'Loading usage…'}</pre></section></SettingsSections></main>;
}

function EvidenceSearch({ api, recordingId, onClose, onSelect }: { api: FreshApi; recordingId: string; onClose: () => void; onSelect: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const el = dialog.current; el?.showModal(); return () => { el?.close(); }; }, []);
  useEffect(() => { if (!query.trim()) { setHits([]); return; } const controller = new AbortController(); const timer = setTimeout(() => { setBusy(true); setError(undefined); void api.search(recordingId, query, controller.signal).then(r => setHits(r.hits)).catch(e => { if (!controller.signal.aborted) setError(message(e)); }).finally(() => { if (!controller.signal.aborted) setBusy(false); }); }, 180); return () => { clearTimeout(timer); controller.abort(); }; }, [api, recordingId, query]);
  return <dialog className="fr-search-dialog" ref={dialog} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}><div className="fr-search-dialog-input"><Icon name="search" size={20} /><input autoFocus aria-label="Search captured evidence" placeholder="Search what the agent saw, said, or did…" value={query} onChange={e => setQuery(e.target.value)} /><button aria-label="Close search" onClick={onClose}><kbd>esc</kbd></button></div><div className="fr-search-results">{error && <p role="alert">{error}</p>}{hits.map((hit, i) => <button key={hit.observationId ?? hit.id ?? i} onClick={() => onSelect(hit.observationId ?? hit.id ?? '')}><span><Icon name="eye" size={14} />{hit.kind ?? 'Captured evidence'}{hit.sequence !== undefined && <small>#{hit.sequence}</small>}</span><p>{hit.snippet ?? hit.text ?? JSON.stringify(hit)}</p><Icon name="arrow" size={14} /></button>)}{!hits.length && <div className="fr-empty fr-empty-small"><Icon name="search" size={24} /><p>{busy ? 'Searching captured evidence…' : query ? 'No matches in this recording.' : 'Search commands, tool output, code excerpts, and exposed prose.'}</p></div>}</div><footer><span>Captured content · local search</span><span>Enter a phrase to find its original observation</span></footer></dialog>;
}
