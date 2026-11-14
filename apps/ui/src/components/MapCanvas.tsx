// Spatial WebGL points/edges with a flat low-resource fallback. Every label is DOM.
// Only opt-in orbit runs continuously, at a bounded rate and outside manual navigation.

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'; import { plural, pluralWord } from '../lib/plural.ts';
import type { GraphNode, RepoGraph } from '@drishya/contracts';
import type { HeatCell } from '@drishya/scene';
import { useApp } from '../state.ts';
import { mapPalette, useResolvedTheme } from '../lib/theme.ts';
import { groupMemberPaths, mapDetail, type MapGroup } from '../lib/map-detail.ts';
import { MAP_REST_ALPHA, QUIET_EDGE_FLOOR, QUIET_NODE_FLOOR, quietEdgePoints, quietFactor, type QuietZone } from '../lib/map-quiet.ts';
import { placeLabels, type LabelCandidate } from '../lib/map-labels.ts';
import { useSessionWorkspace } from './SessionWorkspace.tsx';
import { importConnections, observedGraph, neighborhoodGraph } from '../lib/map-focus.ts';
import { createSpatialRenderer, fileDepth, spatialProject, type MapVertex } from '../lib/spatial-map.ts';
import { fitProjectedMap, mapReadingArea, rebaseMapCamera, type MapFrame } from '../lib/map-fit.ts';
import { useWorkspaceState } from '../lib/workspace-memory-react.ts';

interface Cam {
  x: number;
  y: number;
  k: number;
}

/**
 * Map controls that change what the map reads (B2): approving a scan of the captured root, and
 * refreshing a map that is out of date. Both are explicit; the map never redraws under a reader.
 */
function MapActions({ graph }: { graph: RepoGraph }) {
  const source = useApp((s) => s.source);
  const recordingId = useApp((s) => s.recordingId);
  const set = useApp((s) => s.set);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  if (source?.kind !== 'daemon' || !recordingId) return null;
  const run = async (load: () => Promise<RepoGraph | undefined>) => {
    setBusy(true);
    setErr(undefined);
    try {
      const g = await load();
      if (g && useApp.getState().recordingId === recordingId) set({ graph: g });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      {graph.approvalNeeded && (
        <button className="btn ghost" disabled={busy} title={`Reads file names and imports under ${graph.approvalNeeded.root}. File contents are not stored.`} onClick={() => run(() => source.approveGraph(recordingId))}>
          {busy ? 'Scanning…' : 'Map the whole repository'}
        </button>
      )}
      {graph.stale && (
        <button className="btn ghost" disabled={busy} title="Files changed since this map was drawn" onClick={() => run(() => source.graph(recordingId, true))}>
          {busy ? 'Refreshing…' : 'Out of date · Refresh'}
        </button>
      )}
      {err && <span className="bad small">{err}</span>}
    </>
  );
}

export function MapCanvas({ graph, heat, passagePaths = [], readingRect }: { graph?: RepoGraph; heat: HeatCell[]; passagePaths?: string[]; readingRect?: { left: number; width: number } }) {
  const arrowId=useId().replace(/:/g,'');
  const canvas = useRef<HTMLCanvasElement>(null);
  const spatialCanvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<ReturnType<typeof createSpatialRenderer>>(undefined);
  const [gpuReady, setGpuReady] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const explore = useApp((s) => s.explore);
  const motion = useApp(s => s.motion);
  const lowResource = useApp(s => s.lowResource);
  const depth = useApp(s => s.mapDepth);
  const orbit = useApp(s => s.mapOrbit);
  const [yaw, setYaw] = useWorkspaceState('map/yaw', .25);
  const [pitch, setPitch] = useWorkspaceState('map/pitch', .18);
  const manualUntil = useRef(0);
  const spatialActive = depth && !lowResource && gpuReady;
  const holdOrientation = () => { manualUntil.current = performance.now() + 12_000; };
  useEffect(() => {
    const node = spatialCanvas.current;
    if (!node) return;
    if (!depth || lowResource) { renderer.current?.dispose(); renderer.current = undefined; setGpuReady(false); node.width = node.height = 1; return; }
    const create = () => { renderer.current?.dispose(); try { renderer.current = createSpatialRenderer(node); } catch { renderer.current = undefined; } setGpuReady(!!renderer.current); };
    const lost = (event: Event) => { event.preventDefault(); setGpuReady(false); };
    create(); node.addEventListener('webglcontextlost', lost); node.addEventListener('webglcontextrestored', create);
    return () => { renderer.current?.dispose(); node.removeEventListener('webglcontextlost', lost); node.removeEventListener('webglcontextrestored', create); };
  }, [depth, lowResource]);
  const { workspace,approve } = useSessionWorkspace();
  const source=useApp(s=>s.source),recordingId=useApp(s=>s.recordingId),capturedFiles=useApp(s=>s.historyPage?.partial?undefined:s.projection?.files);
  const [openingCurrent,setOpeningCurrent]=useState(false),[readError,setReadError]=useState(''),[focusNotice,setFocusNotice]=useState<string>();
  const resolvedTheme = useResolvedTheme();
  const hoveredPath = useApp((s) => s.hoveredPath);
  const set = useApp((s) => s.set);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [cam, setCam] = useWorkspaceState<Cam>('map/camera', { x: 0, y: 0, k: 1 });
  const camera = useRef(cam);
  const cameraFrame = useRef(0);
  const cameraTarget = useRef(cam);
  camera.current = cam;
  const animateCam = (target: Cam, immediate = false) => {
    cancelAnimationFrame(cameraFrame.current);
    cameraTarget.current = target;
    if (immediate || !useApp.getState().motion || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setCam(target); return; }
    const start = camera.current, began = performance.now();
    const tick = (time: number) => {
      const fraction = Math.min(1, (time - began) / 300);
      const t = 1 - (1 - fraction) ** 3;
      setCam({ x: start.x + (target.x - start.x) * t, y: start.y + (target.y - start.y) * t, k: start.k + (target.k - start.k) * t });
      if (fraction < 1) cameraFrame.current = requestAnimationFrame(tick);
    };
    cameraFrame.current = requestAnimationFrame(tick);
  };
  useEffect(() => () => cancelAnimationFrame(cameraFrame.current), []);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const stop = () => { cancelAnimationFrame(cameraFrame.current); setCam(cameraTarget.current); };
    if (!motion || preference.matches) stop();
    preference.addEventListener('change', stop);
    return () => preference.removeEventListener('change', stop);
  }, [motion]);
  const zoomCamera = (factor: number) => {
    holdOrientation();
    const c = cameraTarget.current, k = Math.max(.1, Math.min(8, c.k * factor));
    animateCam({ k, x: size.w / 2 - (size.w / 2 - c.x) * k / c.k, y: size.h / 2 - (size.h / 2 - c.y) * k / c.k });
  };
  const [tip, setTip] = useState<{ node: MapGroup; x: number; y: number }>();
  const [query, setQuery] = useWorkspaceState('map/query', '');
  const [observedOnly, setObservedOnly] = useWorkspaceState('map/observed', false);
  const [changesOnly,setChangesOnly]=useWorkspaceState('map/changed',false);
  const changedPaths=useMemo(()=>new Set(capturedFiles?.filter(file=>file.roles.includes('write')).map(file=>file.path)??[]),[capturedFiles]);
  const changedCount=useMemo(()=>graph?.nodes.filter(node=>changedPaths.has(node.id)).length??0,[graph,changedPaths]);
  const [connectionsOpen, setConnectionsOpen] = useWorkspaceState('map/connections', false);
  const [connectionFile, setConnectionFile] = useWorkspaceState<string | undefined>('map/file', undefined);
  const [connectionPage, setConnectionPage] = useWorkspaceState('map/page', 0);
  const [neighborhood, setNeighborhood] = useWorkspaceState('map/neighborhood', false);
  const requestedFocus = useApp(s => s.mapFocusPath);
  const observedKey = heat.map(cell => cell.path).join('\0');
  const observedPaths = useMemo(() => new Set(observedKey ? observedKey.split('\0') : []), [observedKey]);
  const observedCount = useMemo(() => graph?.nodes.filter(node => observedPaths.has(node.id)).length ?? 0, [graph, observedPaths]);
  const viewGraph = useMemo(() => graph && explore && connectionsOpen && neighborhood && connectionFile ? neighborhoodGraph(graph, connectionFile) : graph && explore && changesOnly ? observedGraph(graph,changedPaths) : graph && observedOnly ? observedGraph(graph, observedPaths) : graph, [graph, explore, connectionsOpen, neighborhood, connectionFile, observedOnly, observedPaths,changesOnly,changedPaths]);
  const detail = useMemo(() => viewGraph ? mapDetail(viewGraph, cam.k) : undefined, [viewGraph, cam.k]);
  const connections = useMemo(() => graph && connectionsOpen && connectionFile ? importConnections(graph, connectionFile) : undefined, [graph, connectionsOpen, connectionFile]);
  const passageFiles = useMemo(() => graph?.nodes.filter(node => passagePaths.includes(node.id)).slice(0, 12) ?? [], [graph, passagePaths]);
  const focusFile = (node: GraphNode, bounded = neighborhood) => {
    holdOrientation();
    setConnectionFile(node.id); setConnectionPage(0);
    set({ hoveredPath: node.id });
    const related = graph && bounded ? importConnections(graph, node.id).neighbors.map(item => item.node) : [];
    const points = [node, ...related].map(spatial);
    const minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x));
    const minY = Math.min(...points.map(p => p.y)), maxY = Math.max(...points.map(p => p.y));
    // Leave real space for the existing connection drawer and map controls.
    // Labels need space beyond their dot; fitting the world alone hides endpoints.
    const usableWidth = Math.max(180, size.w - (size.w > 900 ? 820 : 120));
    const top = (document.querySelector('.workspace-header')?.getBoundingClientRect().height ?? 64) + 80;
    const usableHeight = Math.max(120, size.h - top - 100);
    const k = related.length ? Math.max(.5, Math.min(4, usableWidth / Math.max(80, (maxX - minX) * fit.sx), usableHeight / Math.max(80, (maxY - minY) * fit.sy))) : Math.max(cam.k, graph && graph.nodes.length > 80 ? 4 : 1.5);
    animateCam({ k, x: (related.length && size.w > 900 ? size.w / 2 - 70 : size.w / 2) - (fit.ox + (minX + maxX) / 2 * fit.sx) * k, y: top + usableHeight / 2 - (fit.oy + (minY + maxY) / 2 * fit.sy) * k });
  };
  useEffect(() => {
    if (!explore || !requestedFocus || !graph || graph.approvalNeeded || !size.w || !size.h) return;
    const node = graph.nodes.find(node => node.id === requestedFocus||node.path===requestedFocus);
    setFocusNotice(node?undefined:requestedFocus);
    set({ mapFocusPath: undefined });
    if (node) { setConnectionsOpen(true); setChangesOnly(false); setObservedOnly(false); setNeighborhood(true); focusFile(node, true); }
  }, [explore, requestedFocus, graph, size.w, size.h]);
  const zoomGroup = (node: MapGroup) => {
    holdOrientation();
    const k = Math.min(8, Math.max(2, cam.k * 2));
    const p = spatial(node);
    const x = fit.ox + p.x * fit.sx;
    const y = fit.oy + p.y * fit.sy;
    animateCam({ k, x: size.w / 2 - x * k, y: size.h / 2 - y * k });
    setTip(undefined);
  };
  useLayoutEffect(()=>{
    const map=wrap.current,tools=map?.querySelector<HTMLElement>('.map-tools');if(!map||!tools)return;
    const measure=()=>map.style.setProperty('--map-controls-bottom',`${tools.getBoundingClientRect().bottom-map.getBoundingClientRect().top}px`);
    const observer=new ResizeObserver(measure);observer.observe(tools);observer.observe(map);const header=map.closest('.viewer')?.querySelector('.workspace-header');if(header)observer.observe(header);measure();
    return()=>{observer.disconnect();map.style.removeProperty('--map-controls-bottom');};
  },[explore]);
  const displayNodes = detail?.nodes ?? [];
  const depths = useMemo(() => new Map(displayNodes.map(node => [node.id, node.members ? node.members.reduce((sum, id) => sum + fileDepth(id), 0) / node.members.length : fileDepth(node.id)])), [detail]);
  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0, last = 0;
    const enabled = () => displayNodes.length > 0 && spatialActive && orbit && motion && document.visibilityState === 'visible' && !preference.matches && displayNodes.length <= 1500;
    const tick = (time: number) => {
      if (!enabled()) { frame = 0; last = 0; return; }
      if (last && time - last >= 1000 / 15) { const elapsed = Math.min(100, time - last); if (time >= manualUntil.current && !wrap.current?.contains(document.activeElement)) setYaw(value => (value + elapsed * .000035) % (Math.PI * 2)); last = time; }
      if (!last) last = time;
      frame = requestAnimationFrame(tick);
    };
    const resume = () => { cancelAnimationFrame(frame); frame = 0; last = 0; if (enabled()) frame = requestAnimationFrame(tick); };
    resume(); document.addEventListener('visibilitychange', resume); preference.addEventListener('change', resume);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', resume); preference.removeEventListener('change', resume); };
  }, [spatialActive, orbit, motion, displayNodes.length]);
  const displayById = useMemo(() => new Map(displayNodes.map(n => [n.id, n])), [detail]);
  const heatMap = useMemo(() => new Map(heat.map((h) => [h.path, h])), [heat]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!explore) { cancelAnimationFrame(cameraFrame.current); cameraTarget.current = { x: 0, y: 0, k: 1 }; setCam(cameraTarget.current); }
  }, [explore]);

  // Use the whole world, rather than hiding a square map behind the reading column.
  // All hit tests, search destinations and motion origins share this same projection.
  const fit = useMemo(() => {
    const pad = 48;
    const top = explore ? (document.querySelector('.workspace-header')?.getBoundingClientRect().height ?? 64) + 80 : pad;
    const height = Math.max(40, size.h - top - (explore ? 100 : pad));
    if (spatialActive) { const span = Math.max(40, Math.min(size.w - pad * 2, height)); return { sx: span, sy: span, ox: (size.w - span) / 2, oy: top + (height - span) / 2 }; }
    return { sx: Math.max(40, size.w - pad * 2), sy: height, ox: pad, oy: top };
  }, [size, spatialActive, explore]);
  // GPU geometry, DOM labels, picking and arrivals share the same 3D camera.
  const spatial = (n: { id: string; x: number; y: number }) => {
    if (!spatialActive) return { ...n, z: 0, scale: 1 };
    return spatialProject({ ...n, z: depths.get(n.id) ?? fileDepth(n.id) }, yaw, pitch);
  };
  const project = (n: { id: string; x: number; y: number }) => { const p = spatial(n); return { x: (fit.ox + p.x * fit.sx) * cam.k + cam.x, y: (fit.oy + p.y * fit.sy) * cam.k + cam.y, z: p.z, scale: p.scale }; };
  const previousFrame = useRef<(MapFrame & { explore: boolean }) | undefined>(undefined);
  useLayoutEffect(() => {
    const next = { ...fit, ...size, explore }, before = previousFrame.current;
    previousFrame.current = next;
    if (!explore || !before?.explore || before.w === next.w && before.h === next.h) return;
    const selected = graph?.nodes.find(node => node.id === connectionFile);
    // Pixel offsets from the full canvas otherwise move the selected file off the smaller map.
    animateCam(rebaseMapCamera(camera.current, before, next, selected ? spatial(selected) : undefined), true);
  }, [size.w, size.h, explore]);
  const fitWorld = (immediate = false) => {
    if (!viewGraph?.nodes.length || !wrap.current) return;
    holdOrientation();
    const world = wrap.current.getBoundingClientRect();
    const obstacles = [...document.querySelectorAll<HTMLElement>('.workspace-header, .map-tools, .map-zoom, .map-legend, .map-connections, .folder-explorer, .prompt-composer, .map-reader')].flatMap(element => {
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height || getComputedStyle(element).visibility === 'hidden') return [];
      return [{ left: rect.left - world.left - 8, right: rect.right - world.left + 8, top: rect.top - world.top - 8, bottom: rect.bottom - world.top + 8 }];
    });
    const area = mapReadingArea({ left: 20, top: 20, right: size.w - 20, bottom: size.h - 20 }, obstacles);
    const points = viewGraph.nodes.map(node => { const point = spatial(node); return { x: fit.ox + point.x * fit.sx, y: fit.oy + point.y * fit.sy }; });
    animateCam(fitProjectedMap(points, area), immediate);
    setTip(undefined); setQuery(''); set({ hoveredPath: undefined });
  };

  const previousGraph=useRef(graph);
  useLayoutEffect(()=>{const before=previousGraph.current;previousGraph.current=graph;if(explore&&before?.approvalNeeded&&graph&&!graph.approvalNeeded)fitWorld(true);},[graph,explore]);

  // SHIP-8: the reading column is the one allocation the map recedes beneath at rest. Measured with the layout
  // (not per frame) and held in a ref so rotation redraws never read the DOM. Exploring has no reading material.
  const quiet = useRef<QuietZone[]>([]);
  const redraw = useRef<() => void>(undefined);
  useLayoutEffect(() => {
    const map = wrap.current, column = map?.closest('.viewer')?.querySelector<HTMLElement>('.history-inner > *') ?? undefined;
    const measure = () => {
      if (!map || explore || !column || !map.clientWidth) { quiet.current = []; map?.removeAttribute('data-map-quiet'); return; }
      const m = map.getBoundingClientRect(), c = column.getBoundingClientRect();
      quiet.current = c.width > 0 ? [{ left: c.left - m.left, right: c.right - m.left, top: 0, bottom: map.clientHeight }] : [];
      if (quiet.current.length) map.setAttribute('data-map-quiet', `${Math.round(quiet.current[0]!.left)},${Math.round(quiet.current[0]!.right)}`); else map.removeAttribute('data-map-quiet');
    };
    measure();
    if (!map || explore || !column) return;
    // The column can settle after the first measure (rail or composer changes); repaint only when the zone really moved.
    let last = map.getAttribute('data-map-quiet');
    const observer = new ResizeObserver(() => { measure(); const now = map.getAttribute('data-map-quiet'); if (now !== last) { last = now; redraw.current?.(); } });
    observer.observe(column); observer.observe(map);
    return () => observer.disconnect();
  }, [readingRect, size.w, size.h, explore]);
  // The dots of files the reader is looking at stay crisp: the hovered file and the files of the current passage.
  // Import lines never do: a line is never the evidence of an origin, so none crosses prose at rest.
  const sharpIds = useMemo(() => {
    const keep = new Set<string>(passagePaths);
    if (hoveredPath) keep.add(hoveredPath);
    if (connections?.root) keep.add(connections.root.id);
    return new Set(displayNodes.filter(n => keep.has(n.id) || n.members?.some(id => keep.has(id))).map(n => n.id));
  }, [detail, passagePaths, hoveredPath, connections]);

  const draw = () => {
    const c = canvas.current;
    if (!c || !graph) return false;
    const zones = explore ? [] : quiet.current;
    // A full-screen 2x canvas reserves four pixels per CSS pixel. Keep the
    // repository sharp enough while bounding the backing store on local GPUs.
    const dpr = Math.min(lowResource ? 1 : 1.5, window.devicePixelRatio || 1);
    if (c.width !== Math.round(size.w * dpr) || c.height !== Math.round(size.h * dpr)) {
      c.width = size.w * dpr;
      c.height = size.h * dpr;
    }
    if (spatialActive && spatialCanvas.current && renderer.current && size.w && size.h) {
      const target = spatialCanvas.current;
      if (target.width !== c.width || target.height !== c.height) { target.width = c.width; target.height = c.height; }
      const opacity = explore ? .96 : MAP_REST_ALPHA;
      const vertex = (node: MapGroup): MapVertex => {
        const p = project(node);
        return { ...p, size: (node.members ? Math.min(8, 4 + Math.log2(node.members.length) * .4) : 2.5) * p.scale, alpha: (node.opacity ?? 1) * opacity };
      };
      const nodes = displayNodes.filter(n => (n.opacity ?? 1) > .02).map(n => {
        const v = vertex(n);
        return zones.length && !sharpIds.has(n.id) ? { ...v, alpha: v.alpha * quietFactor(v.x, v.y, zones, QUIET_NODE_FLOOR) } : v;
      });
      const edges: MapVertex[] = [];
      const budget = Math.min(600, Math.round(120 * Math.max(1, cam.k)));
      const stride = Math.max(1, Math.ceil((detail?.edges.length ?? 0) / budget));
      for (let i = 0; i < (detail?.edges.length ?? 0); i += stride) {
        const edge = detail!.edges[i]!, a = displayById.get(edge.from), b = displayById.get(edge.to);
        if (!a || !b) continue;
        const va = vertex(a), vb = vertex(b), alpha = Math.min(va.alpha, vb.alpha);
        if (!zones.length) { edges.push({ ...va, alpha }, { ...vb, alpha }); continue; }
        // Cut the line where it meets the quiet zone so it fades under prose and returns on the far side.
        const points = quietEdgePoints(va.x, va.y, vb.x, vb.y, zones, QUIET_EDGE_FLOOR);
        for (let k = 1; k < points.length; k++) {
          for (const point of [points[k - 1]!, points[k]!]) edges.push({ x: point.x, y: point.y, z: va.z + (vb.z - va.z) * point.t, size: va.size, alpha: alpha * point.factor });
        }
      }
      renderer.current.draw(nodes, edges, mapPalette(c).node, size.w, size.h, dpr);
      return;
    }
    const g = c.getContext('2d')!;
    const colours = mapPalette(c);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, size.w, size.h);

    g.lineWidth = 1.2;
    g.strokeStyle = colours.node;
    let drawnEdges = 0;
    const edgeBudget = Math.min(600, Math.round(120 * Math.max(1, cam.k)));
    const stride = Math.max(1, Math.ceil((detail?.edges.length ?? 0) / edgeBudget));
    let edgeIndex = 0;
    for (const e of detail?.edges ?? []) {
      if (edgeIndex++ % stride !== 0) continue;
      const a = displayById.get(e.from);
      const b = displayById.get(e.to);
      if (!a || !b) continue;
      const pa = project(a);
      const pb = project(b);
      if (Math.max(pa.x, pb.x) < 0 || Math.max(pa.y, pb.y) < 0 || Math.min(pa.x, pb.x) > size.w || Math.min(pa.y, pb.y) > size.h) continue;
      const base = Math.min(a.opacity ?? 1, b.opacity ?? 1) * (explore ? .82 : MAP_REST_ALPHA);
      if (base < .02) continue;
      if (!zones.length) {
        g.globalAlpha = base;
        g.beginPath();
        g.moveTo(pa.x, pa.y);
        g.lineTo(pb.x, pb.y);
        g.stroke();
      } else {
        // The flat renderer has no per-vertex alpha: stroke each cut run at its own strength.
        const points = quietEdgePoints(pa.x, pa.y, pb.x, pb.y, zones, QUIET_EDGE_FLOOR);
        for (let k = 1; k < points.length; k++) {
          g.globalAlpha = base * (points[k - 1]!.factor + points[k]!.factor) / 2;
          g.beginPath(); g.moveTo(points[k - 1]!.x, points[k - 1]!.y); g.lineTo(points[k]!.x, points[k]!.y); g.stroke();
        }
      }
      if (++drawnEdges >= edgeBudget) break;
    }
    g.globalAlpha = 1;

    if (explore && connections?.root) {
      const origin = project(connections.root);
      g.strokeStyle = colours.focus; g.lineWidth = 1.5;
      g.beginPath();
      for (const { node } of connections.neighbors) { const p = project(node); g.moveTo(origin.x, origin.y); g.lineTo(p.x, p.y); }
      g.stroke();
      for (const node of [connections.root, ...connections.neighbors.map(item => item.node)]) {
        const p = project(node); g.beginPath(); g.arc(p.x, p.y, node.id === connectionFile ? 5 : 3, 0, Math.PI * 2); g.fillStyle = colours.focus; g.fill();
      }
    }

    if (explore && hoveredPath) {
      g.beginPath();
      for (const edge of detail?.edges ?? []) {
        if (edge.from !== hoveredPath && edge.to !== hoveredPath) continue;
        const a = displayById.get(edge.from); const b = displayById.get(edge.to);
        if (!a || !b) continue;
        const pa = project(a); const pb = project(b);
        g.moveTo(pa.x, pa.y); g.lineTo(pb.x, pb.y);
      }
      g.lineWidth = 1.6;
      g.strokeStyle = colours.text; g.stroke();
      g.lineWidth = 1.2;
    }

    const r0 = Math.max(1.2, Math.min(2, 1.2 * Math.sqrt(cam.k)));
    for (const n of displayNodes) {
      const p = project(n);
      if (p.x < -10 || p.y < -10 || p.x > size.w + 10 || p.y > size.h + 10) continue;
      // Group detail crossfades without semantic rings or a changed file position.
      g.globalAlpha = (n.opacity ?? 1) * (explore ? .96 : MAP_REST_ALPHA) * (zones.length && !sharpIds.has(n.id) ? quietFactor(p.x, p.y, zones, QUIET_NODE_FLOOR) : 1);
      g.beginPath();
      const radius = n.members ? Math.min(4.5, 2 + Math.log2(n.members.length) * .25) : hoveredPath === n.id ? r0 + .5 : r0;
      g.arc(p.x, p.y, radius, 0, Math.PI * 2);
      g.fillStyle = colours.node;
      g.fill();
    }

    g.globalAlpha = 1;

  };

  redraw.current = draw;
  // Paint the camera's committed frame; scheduling another RAF here can cancel
  // every intermediate paint while React commits the next camera position.
  useLayoutEffect(() => { draw(); }, [graph, detail, cam, size, lowResource, hoveredPath, explore, readingRect, resolvedTheme, connections, spatialActive, yaw, pitch, passagePaths]);

  // ── interaction (explore mode) ────────────────────────────────────────────
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; yaw: number; pitch: number; rotate: boolean; moved: boolean } | undefined>(undefined);
  const nearest = (mx: number, my: number) => {
    if (!graph) return undefined;
    let best: MapGroup | undefined;
    let bd = 14 * 14;
    for (const n of displayNodes) {
      if ((n.opacity ?? 1) < .6) continue;
      const p = project(n);
      const d = (p.x - mx) ** 2 + (p.y - my) ** 2;
      if (d < bd) {
        bd = d;
        best = n;
      }
    }
    return best;
  };

  // Label text is measured in the stylesheet's mono face; widths are recomputed when a web font finishes loading.
  const [fontsReady, setFontsReady] = useState(0);
  useEffect(() => {
    const bump = () => setFontsReady(v => v + 1);
    document.fonts?.addEventListener?.('loadingdone', bump);
    return () => document.fonts?.removeEventListener?.('loadingdone', bump);
  }, []);
  const labelWidth = useMemo(() => {
    const context = document.createElement('canvas').getContext('2d');
    const family = getComputedStyle(document.documentElement).getPropertyValue('--mono').trim() || 'monospace';
    if (context) context.font = `11px ${family}`;
    const cache = new Map<string, number>();
    return (text: string) => {
      let width = cache.get(text);
      if (width === undefined) { width = context ? context.measureText(text).width : text.length * 6.6; cache.set(text, width); }
      return width;
    };
  }, [fontsReady]);
  const labels = useMemo(() => {
    if (!explore) return [];
    const world = wrap.current?.getBoundingClientRect();
    const chrome = world ? [...wrap.current!.querySelectorAll<HTMLElement>('.map-tools, .map-zoom, .map-legend, .map-connections')].map(el => {
      const r = el.getBoundingClientRect(); return { left: r.left - world.left - 8, right: r.right - world.left + 8, top: r.top - world.top - 8, bottom: r.bottom - world.top + 8 };
    }) : [];
    // SHIP-8: boxes come from measured text, so what is placed is what is drawn and no two visible labels touch.
    // The explicit import-path working set (the selected file and up to eight neighbours) is placed first.
    const candidates: LabelCandidate[] = [];
    const seen = new Set<string>();
    const byId = new Map<string, MapGroup>();
    if (connections?.root) {
      for (const node of [connections.root, ...connections.neighbors.slice(0, 8).map(item => item.node)]) {
        if (seen.has(node.id)) continue;
        seen.add(node.id); byId.set(node.id, node);
        const p = project(node);
        if (p.x < 6 || p.y < 6 || p.x > size.w - 180 || p.y > size.h - 24) continue;
        candidates.push({ id: node.id, x: p.x, y: p.y, kind: 'file', text: node.path, pinned: true });
      }
    }
    // Cull before ranking: zooming into one region must not sort every file in a huge repo.
    const sorted = displayNodes.filter(n => {
      const p = project(n);
      return !seen.has(n.id) && (n.opacity ?? 1) > .6 && p.x >= 6 && p.y >= 70 && p.x < size.w - 20 && p.y < size.h - 50;
    }).sort((a, b) =>
      Number(b.id === hoveredPath) - Number(a.id === hoveredPath) || Number(heatMap.has(b.id)) - Number(heatMap.has(a.id)) || (b.members?.length ?? 0) - (a.members?.length ?? 0));
    for (const node of sorted) {
      byId.set(node.id, node);
      const p = project(node);
      candidates.push(node.members ? { id: node.id, x: p.x, y: p.y, kind: 'group', text: node.path, count: node.members.length } : { id: node.id, x: p.x, y: p.y, kind: 'file', text: node.path });
    }
    return placeLabels(candidates, { width: size.w, height: size.h }, chrome, labelWidth, 48).map(label => ({ node: byId.get(label.id)!, x: label.x, y: label.y, pinned: !!label.pinned }));
  }, [detail, explore, cam, size, hoveredPath, heatMap, connections, spatialActive, yaw, pitch, lowResource, query, fontsReady]);

  // Share exact renderer coordinates for a bounded working set, never a guessed graph origin.
  const anchors = [...heat].sort((a, b) => b.heat - a.heat).slice(0, 63).map((h) => h.path);
  if (hoveredPath && !anchors.includes(hoveredPath)) anchors.push(hoveredPath);
  const matches = query.trim() && viewGraph ? viewGraph.nodes.filter((node) => !(viewGraph.temporal === 'current' && node.path.startsWith('.local/')) && node.path.toLowerCase().includes(query.trim().toLowerCase())) : [];

  // A generic "Mixed files" cluster says nothing alone; hovering it names its members (touched ones first).
  const pathById = useMemo(() => new Map((graph?.nodes ?? []).map(n => [n.id, n.path])), [graph]);
  const tipMembers = useMemo(() => tip?.node.members ? groupMemberPaths(tip.node.members, id => pathById.get(id), id => heatMap.has(id)) : undefined, [tip?.node, pathById, heatMap]);
  const revealGroup = (node: MapGroup, x: number, y: number) => setTip(current => current?.node.id === node.id ? current : { node, x, y: y + 12 });

  return (
    <div
      ref={wrap}
      data-map-depth={spatialActive ? 'spatial-3d' : 'flat'}
      data-map-yaw={yaw.toFixed(5)}
      data-map-pitch={pitch.toFixed(5)}
      data-map-zoom={cam.k.toFixed(5)}
      data-map-scope={explore && connectionsOpen && neighborhood ? 'direct-neighborhood' : explore&&changesOnly?'changes':observedOnly ? 'observed' : 'all'}
      className={`map${explore ? ' exploring' : ''}`}
      onFocusCapture={holdOrientation}
      onBlurCapture={holdOrientation}
      onWheel={(e) => {
        if ((e.target as HTMLElement).closest('.map-tools, .map-zoom, .map-legend, .map-group, .map-file-label, .map-connections')) return;
        if (!explore) return;
        holdOrientation();
        const r = wrap.current!.getBoundingClientRect();
        const mx = e.clientX - r.left;
        const my = e.clientY - r.top;
        const c = cameraTarget.current;
        const k = Math.max(0.1, Math.min(8, c.k * Math.exp(-e.deltaY * 0.0015)));
        animateCam({ k, x: mx - ((mx - c.x) * k) / c.k, y: my - ((my - c.y) * k) / c.k });
      }}
      onPointerDown={(e) => {
        if (!explore) return;
        if ((e.target as HTMLElement).closest('.map-tools, .map-zoom, .map-legend, .map-group, .map-file-label, .map-connections')) return;
        cancelAnimationFrame(cameraFrame.current);
        holdOrientation();
        drag.current = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, yaw, pitch, rotate: spatialActive && !e.shiftKey && e.button !== 1, moved: false };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if ((e.target as HTMLElement).closest('.map-tools, .map-zoom, .map-legend, .map-group, .map-file-label, .map-connections')) return;
        const r = wrap.current!.getBoundingClientRect();
        if (drag.current && explore) {
          const dx = e.clientX - drag.current.x;
          const dy = e.clientY - drag.current.y;
          if (Math.abs(dx) + Math.abs(dy) > 3) drag.current.moved = true;
          holdOrientation();
          if (drag.current.rotate) { setYaw(drag.current.yaw + dx * .006); setPitch(Math.max(-Math.PI / 2 + .05, Math.min(Math.PI / 2 - .05, drag.current.pitch + dy * .006))); return; }
          const target = { ...cam, x: drag.current!.cx + dx, y: drag.current!.cy + dy };
          cameraTarget.current = target; setCam(target);
          return;
        }
        if (!explore) return;
        const n = nearest(e.clientX - r.left, e.clientY - r.top);
        const point = n ? project(n) : undefined;
        setTip(current => current?.node.id === n?.id && current?.x === point?.x && current?.y === point?.y
          ? current : n && point ? { node: n, ...point } : undefined);
        if (useApp.getState().hoveredPath !== n?.id) set({ hoveredPath: n?.id });
      }}
      onPointerUp={(e) => {
        if ((e.target as HTMLElement).closest('.map-tools, .map-zoom, .map-legend, .map-group, .map-file-label, .map-connections')) return;
        const d = drag.current;
        drag.current = undefined;
        if (d) holdOrientation();
        if (!explore || (d && d.moved)) return;
        const r = wrap.current!.getBoundingClientRect();
        const n = nearest(e.clientX - r.left, e.clientY - r.top);
        if (n?.members) {
          zoomGroup(n); return;
        }
        if (n && connectionsOpen) focusFile(n);
        else if (n) set(workspace?.approved ? { currentFile: n.path, filePanel: undefined } : { filePanel: n.id, currentFile: undefined });
      }}
      onPointerLeave={() => explore && (setTip(undefined), set({ hoveredPath: undefined }))}
      onPointerCancel={() => { drag.current = undefined; holdOrientation(); }}
      aria-hidden={!explore}
    >
      <canvas ref={canvas} style={{ width: size.w, height: size.h, display: spatialActive ? 'none' : 'block' }} />
      <canvas ref={spatialCanvas} data-spatial-renderer="webgl" style={{ width: size.w, height: size.h, display: spatialActive ? 'block' : 'none' }} />
      {explore&&connections?.root&&graph?.temporal==='current'&&<svg className="map-import-directions" width={size.w} height={size.h} aria-label="Selected file import directions" role="img">
        <title>Importer to dependency. Static imports, not execution order.</title>
        <defs><marker id={arrowId} viewBox="0 0 8 8" refX="8" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8" fill="none" stroke="currentColor"/></marker></defs>
        {connections.neighbors.slice(0,40).map(({node,direction})=>{const origin=project(connections.root!),neighbor=project(node),a=direction==='imports'?origin:neighbor,b=direction==='imports'?neighbor:origin,length=Math.hypot(b.x-a.x,b.y-a.y);return length<24?null:<path key={`${direction}/${node.id}`} data-import-from={direction==='imports'?connections.root!.path:node.path} data-import-to={direction==='imports'?node.path:connections.root!.path} d={`M${a.x+(b.x-a.x)*7/length},${a.y+(b.y-a.y)*7/length}L${b.x-(b.x-a.x)*9/length},${b.y-(b.y-a.y)*9/length}`} markerEnd={`url(#${arrowId})`}/>;})}
      </svg>}
      {explore && <div className="map-tools">
        <button className="btn" onClick={() => set({ explore: false })}>Back to work</button>
        <label className="ux-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></svg><input aria-label="Find a file on the map" placeholder="Find a file…" maxLength={200} value={query} onChange={(e) => setQuery(e.target.value)} />{query && <button aria-label="Clear map search" onClick={() => setQuery('')}>×</button>}</label>
        <div className="map-scope" role="group" aria-label="Files shown on the map"><button aria-pressed={!observedOnly && !changesOnly && !neighborhood} onClick={() => { setObservedOnly(false); setChangesOnly(false); setNeighborhood(false); }}>All files</button><button aria-pressed={observedOnly && !changesOnly && !neighborhood} onClick={() => { setObservedOnly(true); setChangesOnly(false); setNeighborhood(false); }}>Observed <small>{observedCount}</small></button><button aria-pressed={changesOnly&&!neighborhood} title="Indexed locations of edit/write calls; not a current Git diff" onClick={()=>{setChangesOnly(true);setObservedOnly(false);setNeighborhood(false);}}>Changes <small>{changedCount}</small></button></div>{changesOnly&&!neighborhood&&<small className="map-scope-note">Change locations · {changedCount} indexed{changedPaths.size>changedCount?` · ${changedPaths.size-changedCount} outside this map`: ''}</small>}{focusNotice&&<div className="map-focus-notice" role="status"><span>{focusNotice} is not in this index.</span><button className="btn ghost" onClick={()=>{set({filePanel:focusNotice,currentFile:undefined});setFocusNotice(undefined);}}>Open agent work</button></div>}
        <button className="map-connections-toggle" role="switch" aria-checked={connectionsOpen} onClick={() => {
          setConnectionsOpen(!connectionsOpen);
          if (!connectionsOpen && graph) { const node = graph.nodes.find(n => n.id === hoveredPath) ?? passageFiles[0] ?? graph.nodes.find(n => observedPaths.has(n.id)); if (node) focusFile(node); }
        }}>Import paths <span className={`mini-switch${connectionsOpen ? ' on' : ''}`} /></button>
        {query && <div className="map-matches" aria-label="Map file matches">
          {matches.slice(0, 30).map((node) => <button key={node.id} onFocus={() => set({ hoveredPath: node.id })} onMouseEnter={() => set({ hoveredPath: node.id })} onClick={() => {
            if(connectionsOpen){setNeighborhood(true);focusFile(node,true);setTip(undefined);return;}
            holdOrientation();
            const point = spatial(node);
            const x = fit.ox + point.x * fit.sx; const y = fit.oy + point.y * fit.sy;
            const k = graph && graph.nodes.length > 80 ? 6 : 2;
            animateCam({ k, x: size.w / 2 - x * k, y: size.h / 2 - y * k });
            setTip({ node, x: size.w / 2, y: size.h / 2 });
            setConnectionFile(node.id); setConnectionPage(0);
            set({ hoveredPath: node.id });
          }}>{node.path}</button>)}
          <span className="muted small">{matches.length} matched files{matches.length > 30 ? ' · first 30 shown; refine the query' : ''}</span>
          {tip && <button className="btn" onClick={() => { set({ filePanel: tip.node.id, currentFile: undefined }); }}>Open agent work on this file</button>}
        </div>}
      </div>}
      {explore && (observedOnly||changesOnly) && !viewGraph?.nodes.length && <p className="map-empty">No indexed recorded {changesOnly?'change ':''}locations in this view.</p>}
      {explore && connectionsOpen && <section className="map-connections" aria-label="Direct import connections">
        <header><strong>Direct imports</strong><button className="icon-btn" aria-label="Close import paths" onClick={() => setConnectionsOpen(false)}>×</button></header>
        <p className="muted small">{graph?.temporal === 'current' ? 'Current repository imports' : 'Imports from the saved map'} · static relationships</p>
        {!!passageFiles.length && <div className="map-passage-files" aria-label="Files in the current passage"><small>Current passage</small>{passageFiles.map(node => <button key={node.id} aria-pressed={connectionFile === node.id} onClick={() => focusFile(node)}>{node.path}</button>)}</div>}
        {connections?.root ? <><code className="map-connection-root">{connections.root.path}</code><div className="map-neighbors">{connections.neighbors.slice(connectionPage * 12, connectionPage * 12 + 12).map(({ node, direction }, i) => <button key={`${direction}/${node.id}/${i}`} onClick={() => focusFile(node)}><small>{direction}</small><span>{node.path}</span><span aria-hidden="true">↗</span></button>)}</div>
          <button className="btn ghost small" aria-pressed={neighborhood} onClick={() => { setNeighborhood(!neighborhood); if(neighborhood){setChangesOnly(false);setObservedOnly(false);} if (!neighborhood) focusFile(connections.root!, true); }}>{neighborhood ? 'Show full map' : 'Focus direct neighborhood'}</button>
          {!connections.total && <p className="muted small">No resolved direct imports on this map.</p>}
          {connections.neighbors.length > 12 && <div className="folder-pages"><button disabled={!connectionPage} onClick={() => setConnectionPage(p => p - 1)}>Previous</button><span>{connectionPage + 1} / {Math.ceil(connections.neighbors.length / 12)}</span><button disabled={(connectionPage + 1) * 12 >= connections.neighbors.length} onClick={() => setConnectionPage(p => p + 1)}>Next</button></div>}
          {connections.total > 64 && <p className="muted small">First 64 of {connections.total} direct imports shown.</p>}
          <button className="btn" onClick={() => set({ filePanel: connections.root!.id, currentFile: undefined })}>Open agent work</button>
          {source?.kind==='daemon'&&recordingId&&!recordingId.includes('+')&&workspace?.root&&<button className="btn ghost" disabled={openingCurrent} onClick={()=>{setOpeningCurrent(true);setReadError('');const path=connections.root!.path;void (workspace.approved?Promise.resolve():approve()).then(()=>{if(useApp.getState().recordingId===recordingId&&useApp.getState().source===source)set({currentFile:path,filePanel:undefined});}).catch(error=>setReadError(error.message)).finally(()=>setOpeningCurrent(false));}}>{openingCurrent?'Opening…':workspace.approved?'Read current file':'Approve reading & open file'}</button>}
          {source?.kind==='daemon'&&workspace?.root&&!workspace.approved&&<p className="muted small">Approves current-file reading in {workspace.root}. Session work remains separate.</p>}
          {readError&&<p role="alert" className="bad small">{readError}</p>}

        </> : <p className="muted small">Choose a file using the map or search.</p>}
      </section>}
      {explore && <div className="map-zoom" aria-label="Repository zoom">
        {spatialActive && <span className="map-camera-hint">Drag orbit · Shift drag pan</span>}
        <button className="btn ghost" aria-label="Zoom into repository" onClick={() => zoomCamera(1.25)}>+</button>
        <button className="btn ghost" aria-label="Zoom out of repository" onClick={() => zoomCamera(1 / 1.25)}>−</button>
        <button className="btn ghost" onClick={event => fitWorld(event.detail === 0)}>Fit</button>
      </div>}
      {anchors.map((path) => {
        const node = displayById.get(path);
        if (!node || (node.opacity ?? 1) < .95) return null;
        const p = project(node);
        const visible = displayById.has(path) && size.w > 0 && p.x >= 6 && p.y >= 6 && p.x < size.w - 6 && p.y < size.h - 6;
        return <span key={path} className="map-origin-point" data-origin-file={path} data-origin-visible={visible} style={{ left: p.x - 3, top: p.y - 3 }} aria-hidden="true" />;
      })}
      {labels.map(({ node, x, y }) => node.members
        ? <button className="map-group" key={node.id} style={{ left: x + 12, top: y - 9, opacity: node.opacity ?? 1 }} aria-label={`${node.path} · ${node.members.length} grouped files; zoom to reveal`} onPointerEnter={() => revealGroup(node, x, y)} onPointerLeave={() => setTip(current => current?.node.id === node.id ? undefined : current)} onFocus={() => revealGroup(node, x, y)} onBlur={() => setTip(current => current?.node.id === node.id ? undefined : current)} onClick={() => zoomGroup(node)}><small>{node.path}</small><strong>{node.members.length}</strong></button>
        : <button className="map-file-label" key={node.id} title={node.path} onClick={() => set(workspace?.approved ? { currentFile: node.path, filePanel: undefined } : { filePanel: node.id, currentFile: undefined })} style={{ left: x + 8, top: y - 9, opacity: node.opacity ?? 1 }}>{node.path}</button>)}
      {explore && tip && (
        <div className="map-tip" style={{ left: tip.x + 12, top: tip.y + 8 }}>
          <div className="map-tip-path">{tip.node.path}</div>
          <div className="muted">
            {tip.node.members ? `${plural(tip.node.members.length, 'file')} · ` : tip.node.lines ? `${plural(tip.node.lines, 'line')} · ` : ''}
            {heatMap.get(tip.node.id) ? 'touched in this run' : 'not touched in this run'}
          </div>
          {tipMembers && <ul className="map-tip-members" aria-label="Files in this group">{tipMembers.paths.map(path => <li key={path}>{path}</li>)}{tipMembers.more > 0 && <li className="muted">+ {tipMembers.more} more</li>}</ul>}
        </div>
      )}
      {graph && explore && (
        <div className="map-legend">{connections?.root&&graph.temporal==='current'&&<span>Importer → dependency · up to40 static imports</span>}
          <span title={`${detail?.depth === 99 ? 'Files' : 'Spatial density groups'} · ${plural(displayNodes.length, 'map item')} · zoom for detail`}>{connectionsOpen && neighborhood ? `${plural(viewGraph?.nodes.length ?? 0, 'neighborhood file')} · ${plural(viewGraph?.edges.length ?? 0, 'shown import')}` : observedOnly ? `${viewGraph?.nodes.length}/${graph.nodes.length} ${pluralWord(graph.nodes.length, 'observed file')} · ${plural(viewGraph?.edges.length ?? 0, 'shown import')}` : `${plural(graph.nodes.length, 'file')} · ${plural(graph.edges.length, 'import')}`}</span>

          {!!graph.stats.nestedCheckouts&&<span title="Directories with their own .git (agent worktrees, submodules, nested clones) are other checkouts, not this workspace.">{graph.stats.nestedCheckouts} nested checkout{graph.stats.nestedCheckouts===1?'':'s'} not shown</span>}
          <MapActions graph={graph} />
        </div>
      )}
    </div>
  );
}
