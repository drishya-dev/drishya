import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Operation, Projection, RepoGraph } from '@drishya/contracts';
import { markers, stepOfObservation, type Scene } from '@drishya/scene';
import { NODE_WIDTH, canvasLayout, connectorPath, type CanvasNode } from '../lib/canvas-layout.ts';
import { agentColor, agentName } from '../lib/identity.ts';
import { Markdown } from '../lib/markdown.tsx';
import { focusAgent, focusKind, focusMcp } from '../lib/compound-focus.ts';
import { useApp } from '../state.ts';
import { BrandMark } from './BrandMark.tsx';
import { CodeView, DiffView, ProvenanceBadge, timeOf, useArtifact } from './common.tsx';
import { Detail } from './Inspector.tsx';
import { MaterialGlyph } from './MaterialGlyph.tsx';
import { SinceMarkSection } from './SinceMark.tsx';
import { ReadingDialog } from './ProductShell.tsx';
import { EvidenceReview } from './EvidenceReview.tsx';
import { useWorkspaceState } from '../lib/workspace-memory-react.ts';

type View = 'follow' | 'agents' | 'repository';
type Camera = { x: number; y: number; zoom: number };
const labels: Record<string, string> = { read: 'Read', search: 'Search', edit: 'Edit', write: 'Write', shell: 'Command', test: 'Test', mcp: 'MCP', web: 'Web', spawn: 'Helper agent', plan: 'Plan', other: 'Tool' };
const material: Record<string, string> = { read: 'source', search: 'matches', edit: 'change', write: 'change', shell: 'terminal', test: 'verification', mcp: 'external', spawn: 'external' };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function CanvasIcon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    search: <><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 5 5" /></>,
    sessions: <><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M8 2v6m8-6v6M8 12h8m-8 4h5" /></>,
    files: <><path d="M3 7V5h7l2 3h9v12H3Z" /></>,
    tools: <><path d="m5 7 5 5-5 5m8 0h6" /></>,
    agents: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2m1-15a3 3 0 0 1 0 6m3 9v-2a6 6 0 0 0-3-5" /></>,
    settings: <><path d="m10 3-1 3-3 1-3 3 2 3v3l4 2 1 3h4l1-3 4-2v-3l2-3-3-3-3-1-1-3Z" /><circle cx="12" cy="12" r="3" /></>,
    briefing: <><path d="M5 3h14v18H5Zm4 5h6m-6 4h6m-6 4h4" /></>,
    export: <><path d="M12 3v12m-4-8 4-4 4 4M5 14v6h14v-6" /></>,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    copy: <><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M15 8V3H3v12h5" /></>,
    previous: <path d="m14 5-7 7 7 7" />,
    next: <path d="m10 5 7 7-7 7" />,
    line: <><path d="M4 6h11M4 12h8M4 18h11m3-9 3 3-3 3m-4-3h7" /></>,
    map: <><circle cx="5" cy="5" r="2" /><circle cx="19" cy="6" r="2" /><circle cx="11" cy="19" r="2" /><path d="m7 5 10 1M6 7l4 10m8-9-6 9" /></>,
    play: <path d="m8 4 12 8-12 8Z" />,
    pause: <path d="M8 4v16m8-16v16" />,
    collapse: <path d="m14 6-6 6 6 6" />,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.files}</svg>;
}

export function CanvasWorkspace({ scene, projection, graph }: { scene: Scene; projection: Projection; graph?: RepoGraph }) {
  const source = useApp(s => s.source), recordingId = useApp(s => s.recordingId), recording = useApp(s => s.recording);
  const connection = useApp(s => s.connection), updateError = useApp(s => s.error);
  const captureIssue = recording?.health ? ({ 'missing-source': 'Journal missing', unsupported: 'Source unsupported', failed: 'Capture failed', importing: 'Importing' } as Record<string, string>)[recording.health.state] : undefined;
  const selected = useApp(s => s.selectedOp), filter = useApp(s => s.filter), follow = useApp(s => s.follow);
  const low = useApp(s => s.lowResource), motion = useApp(s => s.motion), mode = useApp(s => s.mode), playing = useApp(s => s.playing);
  const historyPage = useApp(s => s.historyPage), loadWindow = useApp(s => s.loadHistoryWindow), focusObservation = useApp(s => s.focusObservationId);
  const [view, setView] = useWorkspaceState<View>('canvas/view', 'follow'), [panelOpen, setPanelOpen] = useWorkspaceState('canvas/panel', () => window.innerWidth > 900), [panelFocus, setPanelFocus] = useWorkspaceState('canvas/panelFocus', 'overview');
  const [size, setSize] = useState({ width: 950, height: 700 }), [camera, setCameraState] = useWorkspaceState<Camera>('canvas/camera', { x: 32, y: 24, zoom: 1 });
  const [query, setQuery] = useState(''), [queryOpen, setQueryOpen] = useState(false), [briefing, setBriefing] = useState(false);
  const [notice, setNotice] = useState(''), [legend, setLegend] = useState(false);
  const viewport = useRef<HTMLDivElement>(null), world = useRef<HTMLDivElement>(null), searchInput = useRef<HTMLInputElement>(null);
  const cameraRef = useRef(camera), space = useRef(false), inertia = useRef<number | undefined>(undefined), dragging = useRef(false);
  const [seen, setSeen] = useState(scene.total);
  const animated = motion && !low && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const columns = Math.max(1, Math.floor((size.width - 36) / (NODE_WIDTH + 44)));
  const layout = useMemo(() => canvasLayout(scene, projection, columns, view === 'agents'), [scene, projection, columns, view]);
  const selectedNode = layout.nodes.find(n => n.id === selected), selectedOp = selectedNode?.op;
  const [repoQuery, setRepoQuery] = useState('');
  const repoNodes = useMemo(() => (graph?.nodes ?? projection.files.map(file => ({ id: file.path, path: file.path }))).filter(file => file.path.toLowerCase().includes(repoQuery.toLowerCase())).map((file, i) => ({ ...file, x: i % 5 * 210, y: Math.floor(i / 5) * 100 + 64 })), [graph, projection.files, repoQuery]);
  const move = useCallback((next: Camera, animate = false, duration = 260) => {
    if (inertia.current !== undefined) cancelAnimationFrame(inertia.current);
    cameraRef.current = next;
    if (world.current) world.current.style.transition = animate && animated ? `transform ${duration}ms cubic-bezier(.16,1,.3,1)` : 'none';
    setCameraState(next);
  }, [animated]);
  const interrupt = useCallback(() => {
    if (world.current) {
      const matrix = new DOMMatrix(getComputedStyle(world.current).transform);
      move({ x: matrix.m41, y: matrix.m42, zoom: matrix.a });
    }
    useApp.setState({ follow: false });
  }, [move]);
  const center = useCallback((x: number, y: number, height = 250, animate = true) => {
    const current = cameraRef.current;
    const usable = Math.max(280, size.width - (useApp.getState().selectedOp && size.width > 640 ? 420 : 0));
    move({ ...current, x: (usable - NODE_WIDTH * current.zoom) / 2 - x * current.zoom, y: clamp((size.height - height * current.zoom) / 2, 32, 150) - y * current.zoom }, animate);
  }, [move, size]);
  const fit = useCallback(() => {
    useApp.setState({ follow: false });
    const width = view === 'repository' ? 1050 : layout.width, height = view === 'repository' ? Math.max(250, Math.ceil(repoNodes.length / 5) * 100 + 96) : layout.height;
    const usable = Math.max(300, size.width - (selected && size.width > 640 ? 420 : 0));
    const zoom = clamp(Math.min((usable - 64) / width, (size.height - 100) / height), .35, 1);
    move({ x: (usable - width * zoom) / 2, y: 36, zoom }, true, 400);
  }, [layout, move, repoNodes.length, selected, size, view]);
  const openNode = useCallback((id: string) => { useApp.setState({ follow: false }); useApp.getState().select(id); }, []);
  const go = useCallback(async (direction: number, kind?: 'fail' | 'edit') => {
    const app = useApp.getState();
    const stillHere = () => useApp.getState().source === source && useApp.getState().recordingId === recordingId && useApp.getState().mode === mode;
    if (kind) {
      const all = (app.historyPage?.markers ?? markers(app.projection ?? projection)).filter(mark => mode !== 'replay' || mark.step <= scene.step);
      const current = selected ? all.find(m => m.operationId === selected)?.step ?? -1 : -1;
      let target = all.find(m => m.type === kind && m.operationId && m.step > current);
      if (app.historyPage && source?.historyMarker && recordingId) {
        const step = await source.historyMarker(recordingId, Math.max(0, current), [kind], 1);
        if (!stillHere()) return;
        if (step !== undefined && (mode !== 'replay' || step <= scene.step)) {
          const page = await source.history!(recordingId, { step, count: 24 });
          if (!stillHere()) return;
          const event = page.scene.current;
          if (event && 'operationId' in event) { openNode(event.operationId); return; }
        }
      }
      target ??= all.find(m => m.type === kind && m.operationId);
      if (target?.operationId) openNode(target.operationId);
      else setNotice(`No ${kind === 'fail' ? 'failure' : 'edit'} recorded${mode === 'replay' ? ' at this replay point' : ''}.`);
      return;
    }
    const ordered = layout.nodes;
    const index = ordered.findIndex(n => n.id === selected);
    const next = ordered[index < 0 ? 0 : index + direction];
    if (next) { openNode(next.id); return; }
    if (app.historyPage && selectedNode) {
      const group = layout.groups.findIndex(g => g.id === selectedNode.passageId);
      await loadWindow({ start: Math.max(0, group + (direction > 0 ? 1 : -20)), count: 24, selectedOperationId: selected });
      if (!stillHere()) return;
      const ops = [...(useApp.getState().projection?.operations ?? [])].sort((a, b) => a.startSequence - b.startSequence);
      const target = direction > 0 ? ops.find(op => op.startSequence > selectedNode.op.startSequence) : ops.reverse().find(op => op.startSequence < selectedNode.op.startSequence);
      if (target) openNode(target.id);
    }
  }, [layout, selected, projection, mode, scene.step, openNode, source, recordingId, loadWindow, selectedNode]);
  const safeGo = (direction: number, kind?: 'fail' | 'edit') => { void go(direction, kind).catch(error => setNotice(error.message)); };

  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    const observer = new ResizeObserver(measure); observer.observe(element); measure();
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    if (selectedNode) center(selectedNode.x, selectedNode.y, selectedNode.height);
  }, [selected, selectedNode?.x, selectedNode?.y, center]);
  useLayoutEffect(() => {
    if (!follow || view === 'repository') return;
    setSeen(scene.total);
    const prose = layout.groups.find(group => group.proseIds.includes(scene.focus?.proseId ?? ''));
    if (prose) {
      const c = cameraRef.current, top = prose.proseY * c.zoom + c.y;
      if (top < 24 || top + 142 * c.zoom > size.height - 36) center(prose.x, prose.proseY, 142);
      return;
    }
    const latest = layout.nodes.find(n => n.id === scene.focus?.operationId) ?? layout.nodes.at(-1);
    if (latest) {
      const c = cameraRef.current, y = latest.y * c.zoom + c.y;
      if (y < 24 || y + latest.height * c.zoom > size.height - 36) center(latest.x, latest.y, latest.height);
    }
  }, [scene.focus?.operationId, scene.focus?.proseId, scene.total, layout, follow, view, size.height, center]);
  useEffect(() => {
    if (!focusObservation) return;
    const op = projection.operations.find(op => op.observationIds.includes(focusObservation));
    if (op) { openNode(op.id); useApp.setState({ focusObservationId: undefined }); }
    else {
      const prose = projection.prose.find(pr => pr.observationIds.includes(focusObservation));
      const group = layout.groups.find(g => prose && g.proseIds.includes(prose.id));
      if (group) { useApp.setState({ follow: false, focusObservationId: undefined }); center(group.x, group.proseY, 150); }
    }
  }, [focusObservation, projection, layout, center, openNode]);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      if ((event.target as HTMLElement).closest('.cv-node-body,.cv-prose,.cv-reader')) return;
      event.preventDefault(); interrupt();
      const c = cameraRef.current;
      if (event.ctrlKey || event.metaKey) {
        const rect = element.getBoundingClientRect(), x = event.clientX - rect.left, y = event.clientY - rect.top;
        const zoom = clamp(c.zoom * Math.exp(-event.deltaY * .002), .35, 1.8);
        move({ x: x - (x - c.x) * zoom / c.zoom, y: y - (y - c.y) * zoom / c.zoom, zoom });
      } else move({ ...c, x: c.x - event.deltaX, y: c.y - event.deltaY });
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [interrupt, move]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('dialog[open],input,textarea,select,[contenteditable=true]')) return;
      const key = event.key.toLowerCase();
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (key === '/') { event.preventDefault(); searchInput.current?.focus(); setQueryOpen(true); }
      else if (key === 'f' || key === 'e') { event.preventDefault(); void go(1, key === 'f' ? 'fail' : 'edit').catch(error => setNotice(error.message)); }
      else if (key === 'arrowright' || key === 'arrowleft') { event.preventDefault(); void go(key === 'arrowright' ? 1 : -1).catch(error => setNotice(error.message)); }
      else if (key === 'escape') { event.preventDefault(); useApp.getState().select(undefined); setQueryOpen(false); setQuery(''); setBriefing(false); }
      else if (key === '+' || key === '=' || key === '-') { event.preventDefault(); interrupt(); move({ ...cameraRef.current, zoom: clamp(cameraRef.current.zoom * (key === '-' ? .85 : 1.15), .35, 1.8) }, true); }
      else if (key === '0') { event.preventDefault(); fit(); }
      else if (key === ' ') { event.preventDefault(); space.current = true; viewport.current?.setAttribute('data-grab', ''); }
    };
    const keyup = (event: KeyboardEvent) => { if (event.key === ' ') { space.current = false; viewport.current?.removeAttribute('data-grab'); } };
    window.addEventListener('keydown', keydown, true); window.addEventListener('keyup', keyup);
    return () => { window.removeEventListener('keydown', keydown, true); window.removeEventListener('keyup', keyup); if (inertia.current !== undefined) cancelAnimationFrame(inertia.current); };
  }, [fit, go, interrupt, move]);

  const visible = useMemo(() => {
    const margin = low ? 100 : 360, c = camera;
    const left = (-c.x - margin) / c.zoom, right = (size.width - c.x + margin) / c.zoom;
    const top = (-c.y - margin) / c.zoom, bottom = (size.height - c.y + margin) / c.zoom;
    const nearby = layout.nodes.filter(n => n.id !== selected && n.x + NODE_WIDTH >= left && n.x <= right && n.y + n.height >= top && n.y <= bottom).slice(0, (low ? 32 : 96) - (selected ? 1 : 0));
    const chosen = layout.nodes.find(n => n.id === selected);
    return chosen ? [...nearby, chosen] : nearby;
  }, [camera, layout, low, selected, size]);
  const visibleIds = useMemo(() => new Set(visible.map(n => n.id)), [visible]);
  const visibleGroups = layout.groups.filter(g => (g.y + g.height) * camera.zoom + camera.y > -300 && g.y * camera.zoom + camera.y < size.height + 300 && (g.x + g.width) * camera.zoom + camera.x > -300 && g.x * camera.zoom + camera.x < size.width + 300).slice(0, 28);
  const pageRequest = useRef('');
  const anchor = useRef<{ id: string; screenX: number; screenY: number } | undefined>(undefined);
  useEffect(() => {
    if (!historyPage || view === 'repository') return;
    const target = visibleGroups.find(g => g.unloaded && (g.y + g.height) * cameraRef.current.zoom + cameraRef.current.y > 0 && g.y * cameraRef.current.zoom + cameraRef.current.y < size.height && (g.x + g.width) * cameraRef.current.zoom + cameraRef.current.x > 0 && g.x * cameraRef.current.zoom + cameraRef.current.x < size.width);
    if (!target || pageRequest.current === target.id) return;
    pageRequest.current = target.id;
    const first = visibleGroups[0];
    if (first) anchor.current = { id: first.id, screenX: first.x * cameraRef.current.zoom + cameraRef.current.x, screenY: first.y * cameraRef.current.zoom + cameraRef.current.y };
    void loadWindow({ start: Math.max(0, layout.groups.indexOf(target) - 4), count: low ? 12 : 24, ...(selected ? { selectedOperationId: selected } : {}) }).catch(error => { pageRequest.current = ''; setNotice(error.message); });
  }, [historyPage, visibleGroups, view, loadWindow, layout.groups, low, selected]);
  useLayoutEffect(() => {
    const held = anchor.current;
    if (!held || follow) return;
    const group = layout.groups.find(g => g.id === held.id);
    if (group) move({ ...cameraRef.current, x: held.screenX - group.x * cameraRef.current.zoom, y: held.screenY - group.y * cameraRef.current.zoom });
    anchor.current = undefined;
  }, [layout, follow, move]);
  const observedSequence = useRef(Math.max(-1, ...layout.nodes.map(n => n.op.startSequence)));
  const firstArrivalFrame = useRef(true);
  const pendingArrivals = useRef(new Set<string>());
  const runningArrivals = useRef(new Set<Animation>());
  useEffect(() => {
    const cancel = () => { if (!animated || document.hidden) { for (const animation of runningArrivals.current) animation.cancel(); runningArrivals.current.clear(); } };
    cancel(); document.addEventListener('visibilitychange', cancel);
    return () => { document.removeEventListener('visibilitychange', cancel); for (const animation of runningArrivals.current) animation.cancel(); runningArrivals.current.clear(); };
  }, [animated]);
  useLayoutEffect(() => {
    const added = layout.nodes.filter(n => n.op.startSequence > observedSequence.current);
    const latest = Math.max(-1, ...layout.nodes.map(n => n.op.startSequence));
    observedSequence.current = mode === 'replay' ? latest : Math.max(observedSequence.current, latest);
    if (firstArrivalFrame.current) { firstArrivalFrame.current = false; return; }
    if (!animated || document.hidden || mode === 'replay' && !playing) { pendingArrivals.current.clear(); return; }
    for (const node of added) pendingArrivals.current.add(node.id);
    while (pendingArrivals.current.size > 96) pendingArrivals.current.delete(pendingArrivals.current.values().next().value!);
    const fresh = visible.filter(n => pendingArrivals.current.has(n.id));
    const animations: Animation[] = [];
    for (const node of fresh) {
      pendingArrivals.current.delete(node.id);
      const card = world.current?.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(node.id)}"]`);
      if (!card) continue;
      animations.push(card.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 260, easing: 'cubic-bezier(.16,1,.3,1)' }));
      const path = node.op.paths.find(p => p.role === 'read')?.path;
      const origin = path ? document.querySelector<HTMLElement>(`[data-canvas-file="${CSS.escape(path)}"]`) : document.querySelector<HTMLElement>(`[data-canvas-kind="${node.op.kind}"]`);
      const icon = card.querySelector<HTMLElement>('.cv-node-icon');
      if (origin && icon && path) {
        const a = origin.getBoundingClientRect(), b = icon.getBoundingClientRect();
        const clip = origin.closest('.cv-left-scroll')?.getBoundingClientRect();
        if (a.top > 56 && a.bottom < window.innerHeight - 80 && (!clip || a.top >= clip.top && a.bottom <= clip.bottom)) animations.push(icon.animate([{ transform: `translate(${(a.left - b.left) / camera.zoom}px,${(a.top - b.top) / camera.zoom}px)`, opacity: .5 }, { transform: 'translate(0,0)', opacity: 1 }], { duration: 500, easing: 'cubic-bezier(.16,1,.3,1)' }));
      } else if (origin) animations.push(origin.animate([{ backgroundColor: 'var(--cv-raised)' }, { backgroundColor: 'transparent' }], { duration: 320 }));
      const link = world.current?.querySelector<SVGPathElement>(`[data-connection-to="${CSS.escape(node.id)}"]`);
      if (link) { const length = link.getTotalLength(); animations.push(link.animate([{ strokeDasharray: `${length}`, strokeDashoffset: length }, { strokeDasharray: `${length}`, strokeDashoffset: 0 }], { duration: 320, easing: 'cubic-bezier(.16,1,.3,1)' })); }
    }
    // Camera updates and page measurement must not cancel a card's owned arrival.
    for (const animation of animations) {
      runningArrivals.current.add(animation);
      void animation.finished.catch(() => {}).then(() => runningArrivals.current.delete(animation));
    }
  }, [layout.nodes, visible, animated, camera.zoom, mode, playing]);
  const pointer = useRef<{ id: number; x: number; y: number; lastTime: number; vx: number; vy: number } | undefined>(undefined);
  const followLatest = () => { useApp.setState({ follow: true, held: false }); setSeen(scene.total); const latest = layout.nodes.at(-1); if (latest) center(latest.x, latest.y, latest.height); };
  const changeView = (next: View) => { setView(next); useApp.setState({ explore: false, follow: next === 'follow' }); move({ x: 32, y: 24, zoom: 1 }); };
  const goHome = () => { if (source?.kind === 'daemon') { useApp.setState({ screen: 'home', playing: false }); location.hash = ''; } else location.assign(location.pathname + '?experience=canvas'); };
  const totalOps = historyPage?.operationCount ?? projection.operations.length;
  return <main className={`cv-workspace${panelOpen ? '' : ' cv-panel-collapsed'}${selectedOp ? ' cv-has-reader' : ''}`} data-motion={animated}>
    <header className="cv-header">
      <button className="cv-brand" aria-label="Drishya sessions" onClick={goHome}><BrandMark /></button>
      <nav aria-label="Canvas views">{(['follow', 'agents', 'repository'] as const).map(item => <button key={item} aria-pressed={view === item} onClick={() => changeView(item)}>{item[0]!.toUpperCase() + item.slice(1)}</button>)}</nav>
      <h1 title={projection.title}>{projection.title ?? recording?.title ?? 'Agent session'}</h1>
      <div className="cv-header-actions"><button className="cv-icon-button" aria-label="Search" title="Search (/)" onClick={() => { searchInput.current?.focus(); setQueryOpen(true); }}><CanvasIcon name="search" /></button><button className="cv-icon-button" aria-label="Since you were away" title="Since you were away" onClick={() => setBriefing(true)}><CanvasIcon name="briefing" /></button><button className="cv-icon-button" aria-label="Workspace settings" title="Settings" onClick={() => useApp.setState({ settingsOpen: true })}><CanvasIcon name="settings" /></button>
        <button className="cv-primary cv-live-button" aria-pressed={follow} onClick={() => { if (source?.sample && !recording?.live) { const url = new URL(location.href); url.searchParams.set('demo', 'live'); url.searchParams.delete('at'); location.assign(url.href); return; } if (follow) useApp.setState({ follow: false }); else { followLatest(); if (source?.kind === 'daemon' && recordingId && !recording?.live) void source.setLive(recordingId, true).catch(error => setNotice(error.message)); } }}>{source?.kind === 'daemon' && connection === 'reconnecting' ? 'Reconnecting…' : recording?.live && follow ? <><i />Live</> : source?.sample && !recording?.live ? 'Watch live' : follow ? 'Following' : 'Watch live'}</button>
        <ExportButton /></div>
    </header>
    <nav className="cv-rail" aria-label="Workspace navigation">
      {[['sessions', 'Sessions'], ['files', 'Files'], ['tools', 'Tools'], ['agents', 'Agents']].map(([icon, label]) => <button key={icon} className={panelFocus === icon ? 'active' : ''} aria-label={label} title={label} onClick={() => { if (icon === 'sessions') goHome(); else { setPanelOpen(true); setPanelFocus(icon!); if (icon === 'agents') changeView('agents'); } }}><CanvasIcon name={icon!} /></button>)}
      <button className="cv-rail-settings" aria-label="Settings" title="Settings" onClick={() => useApp.setState({ settingsOpen: true })}><CanvasIcon name="settings" /></button>
    </nav>
    <aside className="cv-left-panel" aria-label="Session activity" hidden={!panelOpen}>
      <header><div><span className="cv-overline">{source?.sample ? 'Synthetic recording' : source?.kind === 'bundle' ? 'Offline recording' : 'Local recording'}</span><h2>Session activity</h2></div><button className="cv-icon-button" aria-label="Collapse activity panel" onClick={() => setPanelOpen(false)}><CanvasIcon name="collapse" /></button></header>
      <div className="cv-left-scroll">
        <details open className="cv-panel-section"><summary>Agents<span>{scene.agents.length}</span></summary><div>{scene.agents.map(state => { const agent = projection.agents.find(a => a.id === state.id); return <button key={state.id} className="cv-agent-row" role="switch" aria-checked={filter?.agentId === state.id} aria-label={`Focus ${agentName(agent)}`} onClick={() => useApp.getState().setFilter(focusAgent(filter, state.id))}><i style={{ background: agentColor(agent, projection.agents) }} /><span>{agentName(agent)}{state.parentId && <small>Helper agent</small>}</span><em>{state.state}</em></button>; })}</div></details>
        <details open className="cv-panel-section"><summary>Tools used<span>{scene.dock.native.filter(t => t.uses).length + scene.dock.mcp.length}</span></summary><div>{scene.dock.native.filter(t => t.uses).map(tool => <button key={tool.key} className="cv-tool-row" data-canvas-kind={tool.kind} role="switch" aria-checked={filter?.kind === tool.kind} aria-label={`Filter ${labels[tool.kind]} actions`} onClick={() => useApp.getState().setFilter(focusKind(filter, tool.kind))}><MaterialGlyph material={material[tool.kind] ?? 'external'} /><span>{labels[tool.kind]}</span><small>{tool.uses}</small><i className="cv-switch" /></button>)}{scene.dock.mcp.map(server => <button key={server.server} className="cv-tool-row" role="switch" aria-checked={filter?.server === server.server} aria-label={`Filter ${server.server} MCP actions`} onClick={() => useApp.getState().setFilter(focusMcp(filter, server.server))}><MaterialGlyph material="external" /><span>{server.server}<small>MCP</small></span><small>{server.tools.reduce((n, tool) => n + tool.uses, 0)}</small><i className="cv-switch" /></button>)}</div></details>
        <details open className="cv-panel-section"><summary>Working set files<span>{projection.files.length}</span></summary>{view === 'repository' && <input className="cv-file-search" aria-label="Find repository files" placeholder="Find a file…" value={repoQuery} onChange={event => setRepoQuery(event.target.value)} />}<div className="cv-file-list">{projection.files.filter(file => file.path.toLowerCase().includes(repoQuery.toLowerCase())).slice(0, low ? 40 : 100).map(file => <button key={file.path} data-canvas-file={file.path} title={file.path} onClick={() => useApp.setState({ filePanel: file.path, follow: false })}><i className={`cv-file-dot cv-tone-${scene.heat.find(h => h.path === file.path)?.tone ?? (file.roles.includes('write') ? 'write' : 'read')}`} /><span>{file.path}</span></button>)}{projection.files.length > (low ? 40 : 100) && <small>Showing the first {low ? 40 : 100} files. Search or use Repository to find more.</small>}</div></details>
        {filter && <button className="cv-reset" onClick={() => useApp.getState().setFilter(undefined)}>Clear filters</button>}
        <EvidenceReview projection={projection} label="Review changed files" />
      </div><footer><i /><span>Read-only observation</span><span title="No telemetry or external font requests">Local</span></footer>
    </aside>
    {!panelOpen && <button className="cv-panel-open cv-icon-button" aria-label="Open activity panel" onClick={() => setPanelOpen(true)}><CanvasIcon name="files" /></button>}
    <div ref={viewport} className="cv-viewport" tabIndex={0} aria-label={view === 'repository' ? 'Repository map' : 'Action canvas'} onPointerDown={event => {
      if (event.button !== 0 || !space.current && (event.target as HTMLElement).closest('button,input,article,.cv-prose,.cv-request')) return;
      interrupt(); dragging.current = true; viewport.current?.setAttribute('data-dragging', ''); event.currentTarget.setPointerCapture(event.pointerId); pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, lastTime: performance.now(), vx: 0, vy: 0 };
    }} onPointerMove={event => {
      const p = pointer.current; if (!p || !dragging.current) return;
      const dx = event.clientX - p.x, dy = event.clientY - p.y, now = performance.now(), dt = Math.max(1, now - p.lastTime);
      p.vx = dx / dt; p.vy = dy / dt; p.x = event.clientX; p.y = event.clientY; p.lastTime = now;
      move({ ...cameraRef.current, x: cameraRef.current.x + dx, y: cameraRef.current.y + dy });
    }} onPointerUp={event => {
      const p = pointer.current; pointer.current = undefined; dragging.current = false; viewport.current?.removeAttribute('data-dragging'); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      if (!p || !animated || performance.now() - p.lastTime > 80) return;
      let vx = p.vx * 12, vy = p.vy * 12;
      const coast = () => { vx *= .82; vy *= .82; if (Math.abs(vx) + Math.abs(vy) < .5 || document.hidden) return; cameraRef.current = { ...cameraRef.current, x: cameraRef.current.x + vx, y: cameraRef.current.y + vy }; setCameraState(cameraRef.current); inertia.current = requestAnimationFrame(coast); }; inertia.current = requestAnimationFrame(coast);
    }} onPointerCancel={() => { pointer.current = undefined; dragging.current = false; viewport.current?.removeAttribute('data-dragging'); }}>
      <div ref={world} className="cv-world" style={{ width: view === 'repository' ? 1100 : layout.width, height: view === 'repository' ? Math.ceil(repoNodes.length / 5) * 100 + 100 : layout.height, transform: `translate(${camera.x}px,${camera.y}px) scale(${camera.zoom})` }}>
        {view === 'repository' ? <>
          <p className="cv-repo-caption">{graph?.temporal === 'current' ? 'Current repository index' : 'Captured file references'}{graph?.stale ? ' · out of date' : ''}{graph?.truncated ? ' · partial index' : ''}</p>
          <svg className="cv-connections" width="1100" height={Math.ceil(repoNodes.length / 5) * 100 + 100} aria-hidden="true">{graph?.edges.slice(0, 300).map((edge, index) => { const from = repoNodes.find(n => n.id === edge.from), to = repoNodes.find(n => n.id === edge.to); return from && to ? <path key={index} d={`M${from.x + 80},${from.y + 25}C${from.x + 180},${from.y + 25} ${to.x - 30},${to.y + 25} ${to.x},${to.y + 25}`} /> : null; })}</svg>
          {repoNodes.filter(file => file.y * camera.zoom + camera.y > -150 && file.y * camera.zoom + camera.y < size.height + 150).slice(0, low ? 40 : 100).map(file => <button key={file.id} className={`cv-repo-file cv-tone-${scene.heat.find(h => h.path === file.path)?.tone ?? 'read'}`} style={{ left: file.x, top: file.y }} onClick={() => useApp.setState({ filePanel: file.path, follow: false })}><CanvasIcon name="files" /><span>{file.path}</span></button>)}
        </> : <>
          <svg className="cv-connections" width={layout.width + 60} height={layout.height} aria-label="Recorded order connections">{layout.links.filter(link => visibleIds.has(link.from.id) || visibleIds.has(link.to.id)).slice(0, 240).map(link => <g key={link.id} className={link.from.id === selected || link.to.id === selected ? 'cv-active-path' : ''}><path data-connection-to={link.to.id} d={connectorPath(link.from, link.to)} /><path className="cv-link-hit" d={connectorPath(link.from, link.to)}><title>{link.label} · recorded order, not causality</title></path></g>)}</svg>
          {visibleGroups.map(group => { const agent = projection.agents.find(a => a.id === group.agentId); return <div key={group.id} className="cv-passage" data-passage-id={group.id} style={{ left: group.x, top: group.y, width: group.width }}>
            {group.unloaded ? <button className="cv-unloaded" onClick={() => void loadWindow({ start: Math.max(0, layout.groups.indexOf(group) - 3), count: 24 }).catch(error => setNotice(error.message))}>Open earlier captured work…</button> : <><div className="cv-passage-label"><i style={{ background: agentColor(agent, projection.agents) }} />{agentName(agent)}{agent?.parentId && <span>Helper · {agentName(projection.agents.find(a => a.id === agent.parentId))}</span>}</div>{group.prompt && <div className="cv-request"><span>Captured request</span><p>{group.prompt}</p></div>}</>}
          </div>; })}
          {visible.map(node => <CanvasNodeCard key={node.id} node={node} projection={projection} selected={node.id === selected} select={openNode} />)}
          {visibleGroups.filter(group => !group.unloaded && group.proseIds.length).map(group => <div key={`${group.id}/prose`} className="cv-prose" style={{ left: group.x + 8, top: group.proseY, width: Math.min(660, layout.width - 16), '--agent': agentColor(projection.agents.find(a => a.id === group.agentId), projection.agents) } as CSSProperties}>{group.proseIds.map(id => { const prose = projection.prose.find(pr => pr.id === id); return prose ? <section key={id}><small>{prose.role === 'reasoning' ? 'Exposed reasoning' : prose.role === 'user' ? 'Captured request' : 'Agent response'} · captured{prose.exposure === 'summary' ? ' summary' : ''}</small><Markdown text={prose.text} />{prose.truncated && <small>Excerpt supplied by the history page.</small>}</section> : null; })}</div>)}
          {layout.nodes.length === 0 && !visibleGroups.some(g => g.unloaded) && <div className="cv-canvas-empty"><h2>{recording?.live ? 'Waiting for captured work' : 'No actions at this point'}</h2><p>{recording?.live ? 'New actions appear here as the local journal changes.' : 'Move forward in replay or return to the full recording.'}</p></div>}
        </>}
      </div>
    </div>
    {selectedOp && <CanvasReader key={selectedOp.id} op={selectedOp} projection={projection} previous={() => safeGo(-1)} next={() => safeGo(1)} />}
    <div className="cv-zoom"><div><button aria-label="Zoom out" onClick={() => { interrupt(); move({ ...cameraRef.current, zoom: clamp(cameraRef.current.zoom / 1.15, .35, 1.8) }, true); }}>−</button><span>{Math.round(camera.zoom * 100)}%</span><button aria-label="Zoom in" onClick={() => { interrupt(); move({ ...cameraRef.current, zoom: clamp(cameraRef.current.zoom * 1.15, .35, 1.8) }, true); }}>+</button><button onClick={fit}>Fit</button></div><p><i className={recording?.live ? 'is-live' : ''} />{mode === 'replay' ? 'Replay' : source?.kind === 'daemon' && connection === 'reconnecting' ? 'Reconnecting · cached' : captureIssue ?? (recording?.live ? 'Live' : 'Recorded')} · {scene.total} steps<span>{totalOps} actions</span></p><button className="cv-legend" aria-expanded={legend} onClick={() => setLegend(value => !value)}>{view === 'repository' ? 'Lines show static imports' : 'Lines show recorded order'} ⓘ</button>{legend && <p className="cv-legend-note">{view === 'repository' ? 'File positions are a derived layout. Edges come from the repository index.' : 'Connections express sequence only. A helper branch uses a captured parent relationship.'}</p>}</div>
    {!follow && scene.total > seen && <button className="cv-primary cv-back-latest" onClick={followLatest}>{scene.total - seen} new · Back to latest ↓</button>}
    <div className="cv-bottom-bar"><CanvasIcon name="search" /><input ref={searchInput} aria-label="Search actions, files, commands" placeholder="Search actions, files, commands…" value={query} onFocus={() => setQueryOpen(true)} onChange={event => { setQuery(event.target.value); setQueryOpen(true); }} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); setQueryOpen(false); searchInput.current?.blur(); } }} /><kbd>/</kbd><div className="cv-jump-chips"><button onClick={() => safeGo(1, 'fail')}><i className="cv-fail-dot" />Next failure</button><button onClick={() => safeGo(1, 'edit')}><i className="cv-edit-dot" />Next edit</button></div><CanvasTicks projection={projection} selected={selected} open={openNode} /></div>
    {queryOpen && query.trim().length >= 2 && <CanvasSearch query={query} projection={projection} close={() => setQueryOpen(false)} open={openNode} />}
    <div className="cv-replay-controls">{mode === 'replay' ? <><button className="cv-icon-button" aria-label={playing ? 'Pause replay' : 'Play replay'} onClick={() => useApp.getState().togglePlay()}><CanvasIcon name={playing ? 'pause' : 'play'} /></button><span>{scene.step} / {scene.total}</span><button onClick={() => useApp.getState().showHistory()}>Exit replay</button></> : <button className="cv-replay-open" onClick={() => useApp.getState().togglePlay()}><CanvasIcon name="play" />Replay</button>}</div>
    {(notice || updateError) && <div className="cv-notice" role={updateError ? 'alert' : 'status'}>{notice || updateError}{updateError && <button onClick={() => { useApp.setState({ error: undefined }); void useApp.getState().reloadProjection().catch(error => setNotice(error.message)); }}>Retry</button>}<button aria-label="Dismiss notification" onClick={() => { setNotice(''); useApp.setState({ error: undefined }); }}>×</button></div>}
    {briefing && <ReadingDialog title="Since you were away" close={() => setBriefing(false)} className="cv-digest"><SinceMarkSection projection={projection} />{source?.kind === 'bundle' && <CanvasLocalDigest projection={projection} open={id => { openNode(id); setBriefing(false); }} />}</ReadingDialog>}
  </main>;
}

const CanvasNodeCard = memo(function CanvasNodeCard({ node, projection, selected, select }: { node: CanvasNode; projection: Projection; selected: boolean; select: (id: string) => void }) {
  const op = node.op, agent = projection.agents.find(a => a.id === op.agentId);
  const tag = op.status === 'error' ? 'failed' : op.status === 'running' ? op.kind === 'read' ? 'reading' : 'running' : op.kind === 'edit' && op.status === 'ok' ? 'edited' : op.kind === 'test' && op.status === 'ok' ? 'passed' : undefined;
  const state = useRef(op.status);
  const card = useRef<HTMLElement>(null);
  const motion = useApp(s => s.motion), low = useApp(s => s.lowResource);
  useLayoutEffect(() => {
    const before = state.current; state.current = op.status;
    if (before === op.status || !motion || low || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const glyph = card.current?.querySelector('.cv-state'); glyph?.animate([{ opacity: .2 }, { opacity: 1 }], { duration: 150 });
    card.current?.querySelector('.cv-node-tag')?.animate([{ transform: 'scale(.9)', opacity: .3 }, { transform: 'scale(1)', opacity: 1 }], { duration: 200, easing: 'cubic-bezier(.16,1,.3,1)' });
    if (op.status === 'error') card.current?.animate([{ outline: '1px solid transparent' }, { outline: '1px solid #E35FD2', offset: .3 }, { outline: '1px solid transparent' }], { duration: 400 });
  }, [op.status, motion, low]);
  return <article ref={card} className={`cv-node cv-kind-${op.kind}${selected ? ' selected' : ''}${node.matches ? '' : ' filtered'}`} data-node-id={op.id} data-op-id={op.id} style={{ left: node.x, top: node.y, width: NODE_WIDTH, height: node.height }} aria-label={`${labels[op.kind]}: ${op.title}`}>
    <i className="cv-port cv-port-in" /><i className="cv-port cv-port-out" />{tag && <span className={`cv-node-tag cv-tag-${tag}`}>{tag}</span>}
    <button className="cv-node-header" onClick={() => select(op.id)} aria-label={`Read ${labels[op.kind]}: ${op.title}`} aria-pressed={selected}><span className="cv-node-icon"><MaterialGlyph material={material[op.kind] ?? 'external'} /></span><span><small>{op.origin.type === 'mcp' ? `MCP · ${op.origin.server}` : labels[op.kind]}</small><strong title={op.title}>{op.detail.kind === 'read' || op.detail.kind === 'edit' ? op.detail.path : op.detail.kind === 'test' || op.detail.kind === 'shell' ? op.detail.command : op.title}</strong></span><span className={`cv-state cv-state-${op.status}`} aria-label={op.status === 'unknown' ? 'Outcome not captured' : op.status}>{op.status === 'ok' ? '✓' : op.status === 'error' ? '×' : op.status === 'running' ? '◌' : '?'}</span></button>
    <div className="cv-node-body"><CanvasPreview op={op} /></div>
    <footer><span>{agentName(agent)}{op.startTime && <> · {timeOf(op.startTime)}</>}</span><span title={op.classification.kind === 'derived' ? op.classification.rule : 'Label derived from the captured operation'}>derived label</span><button aria-label={`Open full ${labels[op.kind]} result`} title="Read full captured content" onClick={() => select(op.id)}>↗</button></footer>
  </article>;
});

function Missing({ children = 'Not captured' }: { children?: ReactNode }) { return <div className="cv-missing">{children}</div>; }

/** Copy the displayed material without application labels, controls or line-number gutters. */
function copyReaderMaterial(root: HTMLElement | null): Promise<string> {
  if (!root) return Promise.resolve('Reader unavailable');
  const lines = [...root.querySelectorAll<HTMLElement>('.code .ln')].map(row => {
    const text = row.querySelector('.ln-tx')?.textContent ?? '';
    return row.closest('.diff') ? `${row.classList.contains('add') ? '+' : row.classList.contains('del') ? '-' : ' '}${text}` : text;
  });
  const text = lines.length ? lines.join('\n') : [...root.querySelectorAll<HTMLElement>('.output, .json, .cmd')].filter(node => !node.parentElement?.closest('.output, .json, .cmd')).map(node => node.textContent ?? '').filter(Boolean).join('\n\n');
  if (!text) return Promise.resolve('No captured material on this loaded page');
  return navigator.clipboard.writeText(text).then(() => 'Copied visible material', () => 'Copy unavailable · select material to copy');
}

function CanvasRead({ op }: { op: Operation }) {
  const detail = op.detail;
  const id = detail.kind === 'read' ? detail.excerptArtifactId : undefined;
  const view = useArtifact(id, { scope: 'preview', count: 8 });
  if (!id) return <Missing>{op.status === 'running' ? 'Waiting for output…' : 'Not captured'}</Missing>;
  if (view.error) return <Missing>Could not open captured lines. Open the reader to retry.</Missing>;
  if (view.unavailable) return <Missing>{view.unavailable}</Missing>;
  if (view.text === undefined) return <p className="cv-loading" role="status">Opening captured lines…</p>;
  if (!view.text) return <p className="cv-empty-result">Captured empty file.</p>;
  return <CodeView text={view.text} startLine={view.artifact?.range?.start ?? (detail.kind === 'read' ? detail.startLine : 1)} path={detail.kind === 'read' ? detail.path : undefined} maxLines={8} />;
}
function CanvasPreview({ op }: { op: Operation }) {
  const d = op.detail;
  if (d.kind === 'read') return <CanvasRead op={op} />;
  if (op.status === 'running') return <><p className="cv-request-preview">{d.kind === 'shell' || d.kind === 'test' ? d.command : d.kind === 'search' ? d.query : op.tool}</p><div className="cv-waiting"><i />Waiting for output…</div></>;
  if (d.kind === 'edit') return d.hunks.length ? <DiffView hunks={d.hunks} path={d.path} maxLines={6} /> : <Missing>{d.reconstructionNote ?? 'Not captured'}</Missing>;
  if (d.kind === 'search') return <><p className="cv-query-label">{d.query}</p>{d.hits.slice(0, 4).map((hit, index) => <div className="cv-search-hit" key={index}><code>{hit.path}{hit.line !== undefined ? `:${hit.line}` : ''}</code>{hit.text && <p>{hit.text.trim()}</p>}</div>)}{!d.hits.length && <p className="cv-empty-result">No matches recorded.</p>}</>;
  if (d.kind === 'shell') return <><pre className="cv-command">$ {d.command}</pre>{d.outputPreview !== undefined ? <pre className="cv-terminal">{d.outputPreview.split('\n').slice(0, 4).join('\n')}</pre> : <Missing />}</>;
  if (d.kind === 'test') return <><pre className="cv-command">$ {d.command}</pre>{d.summary ? <><div className="cv-test-squares" aria-hidden="true">{Array.from({ length: Math.min(32, d.summary.passed) }, (_, i) => <i key={`p${i}`} className="pass" />)}{Array.from({ length: Math.min(32, d.summary.failed) }, (_, i) => <i key={`f${i}`} className="fail" />)}{Array.from({ length: Math.min(16, d.summary.skipped) }, (_, i) => <i key={`s${i}`} />)}</div><p className="cv-test-count"><span>{d.summary.passed} passed</span> · <span>{d.summary.failed} failed</span>{d.summary.skipped > 0 && <> · {d.summary.skipped} skipped</>}</p><small>Counts derived from captured runner output{d.summary.passed > 32 || d.summary.failed > 32 || d.summary.skipped > 16 ? ' · squares sampled' : ''}</small></> : d.outputPreview ? <pre className="cv-terminal">{d.outputPreview.split('\n').slice(0, 4).join('\n')}</pre> : <Missing />}</>;
  if (d.kind === 'mcp') return <><p className="cv-mcp-name">{d.tool}</p><dl className="cv-input-fields">{d.input && typeof d.input === 'object' && !Array.isArray(d.input) ? Object.entries(d.input).slice(0, 4).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{typeof value === 'string' ? value : JSON.stringify(value)}</dd></div>) : <div><dt>input</dt><dd>{JSON.stringify(d.input) ?? 'Not captured'}</dd></div>}</dl></>;
  if (d.kind === 'spawn') return <><p className="cv-mcp-name">{d.agentType ?? 'Helper agent'}</p><p>{d.description ?? 'Description not captured.'}</p></>;
  if (d.kind === 'plan') return <ul>{d.items.slice(0, 4).map((item, i) => <li key={i}>{item.text} · {item.status}</li>)}</ul>;
  return 'resultPreview' in d && d.resultPreview ? <pre className="cv-terminal">{d.resultPreview.slice(0, 600)}</pre> : <Missing />;
}

function CanvasReader({ op, projection, previous, next }: { op: Operation; projection: Projection; previous: () => void; next: () => void }) {
  const ref = useRef<HTMLElement>(null), [copied, setCopied] = useState(''), [lineOpen, setLineOpen] = useState(false), [line, setLine] = useState('');
  const motion = useApp(s => s.motion), low = useApp(s => s.lowResource);
  const path = op.paths[0]?.path;
  useLayoutEffect(() => { if (motion && !low && document.documentElement.hasAttribute('data-ui-press') && !matchMedia('(prefers-reduced-motion: reduce)').matches) { const animation = ref.current?.animate([{ opacity: 0, transform: 'translateX(12px)' }, { opacity: 1, transform: 'translateX(0)' }], { duration: 220, easing: 'cubic-bezier(.16,1,.3,1)' }); return () => animation?.cancel(); } }, [motion, low]);
  return <aside ref={ref} className="cv-reader" aria-label="Selected action reader"><header><div><small>{labels[op.kind]} · {op.origin.type === 'mcp' ? op.origin.server : op.tool}</small><h2>{op.title}</h2></div><button className="cv-icon-button" aria-label="Close reader" onClick={() => useApp.getState().select(undefined)}><CanvasIcon name="close" /></button></header><div className="cv-reader-meta"><span className={`cv-reader-state cv-state-${op.status}`}>{op.status === 'ok' ? '✓ Completed' : op.status === 'error' ? '× Failed' : op.status === 'running' ? 'Waiting for output…' : 'Outcome not captured'}</span><ProvenanceBadge p={op.classification} /></div><div className="cv-reader-content"><Detail op={op} projection={projection} /></div><footer><button className="cv-icon-button" aria-label="Copy visible captured content" title="Copy visible captured content" onClick={() => { void copyReaderMaterial(ref.current?.querySelector<HTMLElement>('.cv-reader-content') ?? null).then(setCopied); }}><CanvasIcon name="copy" /></button><button className="cv-icon-button" aria-label="Open file history" title="Open file history" disabled={!path} onClick={() => useApp.setState({ filePanel: path })}><CanvasIcon name="files" /></button><span /><button className="cv-icon-button" aria-label="Previous action" title="Previous action (←)" onClick={previous}><CanvasIcon name="previous" /></button><button className="cv-icon-button" aria-label="Next action" title="Next action (→)" onClick={next}><CanvasIcon name="next" /></button><button className="cv-icon-button" aria-label="Go to line" aria-expanded={lineOpen} title="Go to a visible line" onClick={() => setLineOpen(value => !value)}><CanvasIcon name="line" /></button></footer>{lineOpen && <form className="cv-line-jump" onSubmit={event => { event.preventDefault(); const target = /^\d+$/.test(line) ? ref.current?.querySelector<HTMLElement>(`[data-source-line="${line}"]`) : null; if (target) { target.scrollIntoView({ block: 'center', behavior: 'instant' }); setCopied(`Visible line ${line}`); } else setCopied('Line is outside this loaded page. Use the source reader’s page and line controls.'); }}><input autoFocus aria-label="Visible source line" inputMode="numeric" value={line} onChange={event => setLine(event.target.value)} /><button>Go</button></form>}{copied && <p className="cv-copy-status" role="status">{copied}</p>}</aside>;
}

function CanvasTicks({ projection, selected, open }: { projection: Projection; selected?: string; open: (id: string) => void }) {
  const page = useApp(s => s.historyPage), full = useApp(s => s.projection), mode = useApp(s => s.mode), step = useApp(s => s.step);
  const total = page?.scene.total ?? (full ?? projection).timeline.length;
  const all = (page?.markers ?? markers(full ?? projection)).filter(m => m.operationId && (mode !== 'replay' || m.step <= step));
  const stride = Math.max(1, Math.ceil(all.length / 80));
  return <div className="cv-timeline" aria-hidden="true" title="Recorded order; large recordings show sampled marks">{all.filter((_, i) => i % stride === 0).map((mark, i) => <button tabIndex={-1} key={`${mark.operationId}/${i}`} className={`cv-tick cv-tick-${mark.type}${mark.operationId === selected ? ' selected' : ''}`} style={{ left: `${mark.step / Math.max(1, total) * 100}%` }} title={mark.label} onClick={() => open(mark.operationId!)} />)}</div>;
}
function CanvasSearch({ query, projection, close, open }: { query: string; projection: Projection; close: () => void; open: (id: string) => void }) {
  const source = useApp(s => s.source), id = useApp(s => s.recordingId), mode = useApp(s => s.mode), step = useApp(s => s.step);
  const [hits, setHits] = useState<{ observationId: string; snippet: string }[]>([]), [busy, setBusy] = useState(true), [error, setError] = useState('');
  useEffect(() => {
    let active = true; setBusy(true); setError(''); setHits([]);
    const timer = setTimeout(() => {
      if (mode === 'replay') {
        const q = query.toLowerCase(); setHits(projection.operations.filter(op => `${op.title} ${JSON.stringify(op.detail)}`.toLowerCase().includes(q)).slice(0, 40).map(op => ({ observationId: op.observationIds[0]!, snippet: op.title }))); setBusy(false); return;
      }
      if (!source || !id) { setBusy(false); return; }
      void source.search(id, query).then(result => { if (active) { setHits(result); setBusy(false); } }).catch(() => { if (active) { setError('Search unavailable. Edit the query to retry.'); setBusy(false); } });
    }, 160);
    return () => { active = false; clearTimeout(timer); };
  }, [query, source, id, projection, mode, step]);
  const choose = async (observation: string) => {
    const app = useApp.getState();
    if (app.historyPage) await app.loadHistoryWindow({ observationId: observation });
    if (useApp.getState().source !== source || useApp.getState().recordingId !== id) return;
    const p = useApp.getState().projection;
    const op = p?.operations.find(op => op.observationIds.includes(observation));
    if (op) open(op.id);
    useApp.setState({ focusObservationId: observation, follow: false }); close();
  };
  return <section className="cv-search-results" role="region" aria-label="Search results"><header><span>{mode === 'replay' ? 'Captured work at this replay point' : 'Whole recording · captured work'}</span><button className="cv-icon-button" aria-label="Close search results" onClick={close}><CanvasIcon name="close" /></button></header>{hits.filter(hit => mode !== 'replay' || (stepOfObservation(projection, hit.observationId) ?? Infinity) <= step).map((hit, i) => <button key={`${hit.observationId}/${i}`} onClick={() => void choose(hit.observationId).catch(error => setError(error.message))}><CanvasIcon name="search" /><span>{hit.snippet.split(/[«»]/).map((part, index) => index % 2 ? <mark key={index}>{part}</mark> : part)}</span><span>↗</span></button>)}{busy ? <p role="status">Searching stored evidence…</p> : error ? <p role="alert">{error}</p> : !hits.length ? <p>No captured matches.</p> : null}</section>;
}
function ExportButton() {
  const source = useApp(s => s.source), id = useApp(s => s.recordingId), [error, setError] = useState('');
  const url = id ? source?.exportUrl(id) : undefined;
  const downloadBundle = () => {
    const params = new URLSearchParams(location.search), bundle = params.get('bundle') ?? (source?.sample ? `${import.meta.env.BASE_URL}demo/bundle.json` : undefined);
    if (!bundle) { setError('This offline source has no downloadable bundle URL.'); return; }
    const a = document.createElement('a'); a.href = bundle; a.download = 'drishya-evidence.json'; a.click();
  };
  return url ? <a className="cv-export" href={url} download><CanvasIcon name="export" /><span>Export</span></a> : <button className="cv-export" title={error || 'Download the current sanitized evidence bundle'} onClick={downloadBundle}><CanvasIcon name="export" /><span>Export</span></button>;
}
function CanvasLocalDigest({ projection, open }: { projection: Projection; open: (id: string) => void }) {
  const [after, setAfter] = useState(-1);
  const groups = [{ label: 'Failures', ops: projection.operations.filter(op => op.status === 'error' && (op.endSequence ?? op.startSequence) > after) }, { label: 'Edits', ops: projection.operations.filter(op => ['edit', 'write'].includes(op.kind) && op.startSequence > after) }, { label: 'Running', ops: projection.operations.filter(op => op.status === 'running' && op.startSequence > after) }];
  return <div className="cv-local-digest"><p>Facts from this offline recording. The seen mark lasts until you close this view.</p>{groups.map(group => <section key={group.label}><h3>{group.label}<span>{group.ops.length}</span></h3>{group.ops.slice(0, 20).map(op => <button key={op.id} onClick={() => open(op.id)}>{op.title}<span>↗</span></button>)}</section>)}<button className="cv-primary" onClick={() => setAfter(projection.lastSequence)}>Mark all as seen</button></div>;
}
