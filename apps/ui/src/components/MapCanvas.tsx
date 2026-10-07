// The repository map, behind everything. Canvas 2D in this base UI (Pixi replaces it in the
// frontend pass). The canvas draws shapes only; every label is DOM. It redraws on change,
// never on a continuous loop, so an idle screen costs nothing.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { GraphNode, RepoGraph } from '@drishya/contracts';
import type { HeatCell } from '@drishya/scene';
import { useApp } from '../state.ts';
import { mapPalette, useResolvedTheme } from '../lib/theme.ts';
import { mapDetail, type MapGroup } from '../lib/map-detail.ts';
import { useSessionWorkspace } from './SessionWorkspace.tsx';

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

export function MapCanvas({ graph, heat, readingRect }: { graph?: RepoGraph; heat: HeatCell[]; readingRect?: { left: number; width: number } }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const explore = useApp((s) => s.explore);
  const motion = useApp(s => s.motion);
  const { workspace } = useSessionWorkspace();
  useResolvedTheme();
  const hoveredPath = useApp((s) => s.hoveredPath);
  const set = useApp((s) => s.set);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [cam, setCam] = useState<Cam>({ x: 0, y: 0, k: 1 });
  const camera = useRef(cam);
  const cameraFrame = useRef(0);
  const cameraTarget = useRef(cam);
  camera.current = cam;
  const animateCam = (target: Cam) => {
    cancelAnimationFrame(cameraFrame.current);
    cameraTarget.current = target;
    if (!useApp.getState().motion || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setCam(target); return; }
    const start = camera.current, began = performance.now();
    const tick = (time: number) => {
      const fraction = Math.min(1, (time - began) / 360);
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
    const c = cameraTarget.current, k = Math.max(.5, Math.min(8, c.k * factor));
    animateCam({ k, x: size.w / 2 - (size.w / 2 - c.x) * k / c.k, y: size.h / 2 - (size.h / 2 - c.y) * k / c.k });
  };
  const [tip, setTip] = useState<{ node: MapGroup; x: number; y: number }>();
  const [query, setQuery] = useState('');
  const detail = useMemo(() => graph ? mapDetail(graph, cam.k) : undefined, [graph, cam.k]);
  const zoomGroup = (node: MapGroup) => {
    const k = Math.min(8, Math.max(2, cam.k * 2));
    const x = 48 + node.x * Math.max(40, size.w - 96);
    const y = 48 + node.y * Math.max(40, size.h - 96);
    animateCam({ k, x: size.w / 2 - x * k, y: size.h / 2 - y * k });
    setTip(undefined);
  };
  const displayNodes = detail?.nodes ?? [];
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
    return { sx: Math.max(40, size.w - pad * 2), sy: Math.max(40, size.h - pad * 2), ox: pad, oy: pad };
  }, [size]);
  const project = (n: { x: number; y: number }) => ({ x: (fit.ox + n.x * fit.sx) * cam.k + cam.x, y: (fit.oy + n.y * fit.sy) * cam.k + cam.y });

  const draw = () => {
    const c = canvas.current;
    if (!c || !graph) return false;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== Math.round(size.w * dpr) || c.height !== Math.round(size.h * dpr)) {
      c.width = size.w * dpr;
      c.height = size.h * dpr;
    }
    const g = c.getContext('2d')!;
    const colours = mapPalette(c);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, size.w, size.h);

    g.lineWidth = 1.2;
    g.strokeStyle = colours.edge;
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
      g.globalAlpha = Math.min(a.opacity ?? 1, b.opacity ?? 1) * (hoveredPath ? .18 : .55);
      if (g.globalAlpha < .02) continue;
      g.beginPath();
      g.moveTo(pa.x, pa.y);
      g.lineTo(pb.x, pb.y);
      g.stroke();
      if (++drawnEdges >= edgeBudget) break;
    }
    g.globalAlpha = 1;

    if (hoveredPath) {
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
      g.globalAlpha = (n.opacity ?? 1) * (n.members || hoveredPath === n.id ? 1 : .72 + Math.min(.28, (cam.k - 1) * .07));
      g.beginPath();
      const radius = n.members ? Math.min(4.5, 2 + Math.log2(n.members.length) * .25) : hoveredPath === n.id ? r0 + .5 : r0;
      g.arc(p.x, p.y, radius, 0, Math.PI * 2);
      g.fillStyle = colours.node;
      g.fill();
    }

    g.globalAlpha = 1;

    // Keep the reading column clear: the map recedes behind text, never crosses it.
    if (!explore && readingRect) {
      const grad = g.createLinearGradient(readingRect.left - 32, 0, readingRect.left + readingRect.width + 32, 0);
      // Match the DOM theme; the reading mask must not become an old black slab.
      const theme = colours.background;
      const base = /^#[0-9a-f]{6}$/i.test(theme) ? theme : '#0b1b1e';
      grad.addColorStop(0, `${base}00`);
      grad.addColorStop(0.04, `${base}e6`);
      grad.addColorStop(0.96, `${base}e6`);
      grad.addColorStop(1, `${base}00`);
      g.fillStyle = grad;
      g.fillRect(readingRect.left - 32, 0, readingRect.width + 64, size.h);
    }
  };

  // Paint the camera's committed frame; scheduling another RAF here can cancel
  // every intermediate paint while React commits the next camera position.
  useLayoutEffect(() => { draw(); });

  // ── interaction (explore mode) ────────────────────────────────────────────
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean } | undefined>(undefined);
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

  const labels = useMemo(() => {
    if (!explore) return [];
    const accepted: { node: MapGroup; x: number; y: number; width: number }[] = [];
    // Cull before ranking: zooming into one region must not sort every file in a huge repo.
    const sorted = displayNodes.filter(n => {
      const p = project(n);
      return (n.opacity ?? 1) > .6 && p.x >= 6 && p.y >= 70 && p.x < size.w - 20 && p.y < size.h - 50;
    }).sort((a, b) =>
      Number(b.id === hoveredPath) - Number(a.id === hoveredPath) || Number(heatMap.has(b.id)) - Number(heatMap.has(a.id)) || (b.members?.length ?? 0) - (a.members?.length ?? 0));
    for (const node of sorted) {
      const p = project(node), width = Math.min(190, node.path.length * 6 + 24);
      if (p.x < 6 || p.y < 70 || p.x + width > size.w || p.y > size.h - 50) continue;
      if (accepted.some(a => Math.abs(a.y - p.y) < 24 && p.x < a.x + a.width && p.x + width > a.x)) continue;
      accepted.push({ node, ...p, width });
      if (accepted.length >= 48) break;
    }
    return accepted;
  }, [detail, explore, cam, size, hoveredPath, heatMap]);

  // Share exact renderer coordinates for a bounded working set, never a guessed graph origin.
  const anchors = [...heat].sort((a, b) => b.heat - a.heat).slice(0, 63).map((h) => h.path);
  if (hoveredPath && !anchors.includes(hoveredPath)) anchors.push(hoveredPath);
  const matches = query.trim() && graph ? graph.nodes.filter((node) => !(graph.temporal === 'current' && node.path.startsWith('.local/')) && node.path.toLowerCase().includes(query.trim().toLowerCase())) : [];

  return (
    <div
      ref={wrap}
      className={`map${explore ? ' exploring' : ''}`}
      onWheel={(e) => {
        if ((e.target as HTMLElement).closest('.map-tools, .map-zoom, .map-legend, .map-group')) return;
        if (!explore) return;
        const r = wrap.current!.getBoundingClientRect();
        const mx = e.clientX - r.left;
        const my = e.clientY - r.top;
        const c = cameraTarget.current;
        const k = Math.max(0.5, Math.min(8, c.k * Math.exp(-e.deltaY * 0.0015)));
        animateCam({ k, x: mx - ((mx - c.x) * k) / c.k, y: my - ((my - c.y) * k) / c.k });
      }}
      onPointerDown={(e) => {
        if (!explore) return;
        if ((e.target as HTMLElement).closest('.map-tools, .map-zoom, .map-legend, .map-group')) return;
        cancelAnimationFrame(cameraFrame.current);
        drag.current = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if ((e.target as HTMLElement).closest('.map-tools, .map-zoom, .map-legend, .map-group')) return;
        const r = wrap.current!.getBoundingClientRect();
        if (drag.current && explore) {
          const dx = e.clientX - drag.current.x;
          const dy = e.clientY - drag.current.y;
          if (Math.abs(dx) + Math.abs(dy) > 3) drag.current.moved = true;
          const target = { ...cam, x: drag.current!.cx + dx, y: drag.current!.cy + dy };
          cameraTarget.current = target; setCam(target);
          return;
        }
        if (!explore) return;
        const n = nearest(e.clientX - r.left, e.clientY - r.top);
        setTip(n ? { node: n, ...project(n) } : undefined);
        set({ hoveredPath: n?.id });
      }}
      onPointerUp={(e) => {
        if ((e.target as HTMLElement).closest('.map-tools, .map-zoom, .map-legend, .map-group')) return;
        const d = drag.current;
        drag.current = undefined;
        if (!explore || (d && d.moved)) return;
        const r = wrap.current!.getBoundingClientRect();
        const n = nearest(e.clientX - r.left, e.clientY - r.top);
        if (n?.members) {
          zoomGroup(n); return;
        }
        if (n) set(workspace?.approved ? { currentFile: n.path, filePanel: undefined } : { filePanel: n.id, currentFile: undefined });
      }}
      onPointerLeave={() => explore && (setTip(undefined), set({ hoveredPath: undefined }))}
      aria-hidden={!explore}
    >
      <canvas ref={canvas} style={{ width: size.w, height: size.h }} />
      {explore && <div className="map-tools">
        <button className="btn" onClick={() => set({ explore: false })}>Back to work</button>
        <input aria-label="Find a file on the map" placeholder="Find a file on the map…" value={query} onChange={(e) => setQuery(e.target.value)} />
        {query && <div className="map-matches" aria-label="Map file matches">
          {matches.slice(0, 30).map((node) => <button key={node.id} onFocus={() => set({ hoveredPath: node.id })} onMouseEnter={() => set({ hoveredPath: node.id })} onClick={() => {
            const x = fit.ox + node.x * fit.sx; const y = fit.oy + node.y * fit.sy;
            const k = graph && graph.nodes.length > 80 ? 6 : 2;
            animateCam({ k, x: size.w / 2 - x * k, y: size.h / 2 - y * k });
            setTip({ node, x: size.w / 2, y: size.h / 2 });
            set({ hoveredPath: node.id, follow: false });
          }}>{node.path}</button>)}
          <span className="muted small">{matches.length} matched files{matches.length > 30 ? ' · first 30 shown; refine the query' : ''}</span>
          {tip && <button className="btn" onClick={() => { set({ filePanel: tip.node.id, currentFile: undefined }); }}>Open recorded work on this file</button>}
        </div>}
      </div>}
      {explore && <div className="map-zoom" aria-label="Repository zoom">
        <button className="btn ghost" aria-label="Zoom into repository" onClick={() => zoomCamera(1.25)}>+</button>
        <button className="btn ghost" aria-label="Zoom out of repository" onClick={() => zoomCamera(1 / 1.25)}>−</button>
        <button className="btn ghost" onClick={() => { animateCam({ x: 0, y: 0, k: 1 }); setTip(undefined); setQuery(''); set({ hoveredPath: undefined }); }}>Fit</button>
      </div>}
      {anchors.map((path) => {
        const node = displayById.get(path);
        if (!node || (node.opacity ?? 1) < .95) return null;
        const p = project(node);
        const visible = displayById.has(path) && size.w > 0 && p.x >= 6 && p.y >= 6 && p.x < size.w - 6 && p.y < size.h - 6;
        return <span key={path} className="map-origin-point" data-origin-file={path} data-origin-visible={visible} style={{ left: p.x - 3, top: p.y - 3 }} aria-hidden="true" />;
      })}
      {anchors.slice(0, explore ? 24 : 12).map((path) => {
        const node = displayById.get(path);
        if (explore || !node || (node.opacity ?? 1) < .95 || !displayById.has(path)) return null;
        const p = project(node);
        if (p.x < 6 || p.y < 6 || p.x > size.w - 160 || p.y > size.h - 24) return null;
        if (!explore && readingRect && p.x + 155 > readingRect.left - 24 && p.x < readingRect.left + readingRect.width + 24) return null;
        return <span key={path} className="map-file-label" title={node.path} style={{ left: p.x + 9, top: p.y - 9 }}>{node.path}</span>;
      })}
      {labels.map(({ node, x, y }) => node.members
        ? <button className="map-group" key={node.id} style={{ left: x + 12, top: y - 9, opacity: node.opacity ?? 1 }} title={`${node.members.length} spatially grouped files · zoom to reveal`} onClick={() => zoomGroup(node)}><small>{node.path}</small><strong>{node.members.length}</strong></button>
        : <span className="map-file-label" key={node.id} title={node.path} style={{ left: x + 8, top: y - 9, opacity: node.opacity ?? 1 }}>{node.path}</span>)}
      {tip && (
        <div className="map-tip" style={{ left: tip.x + 12, top: tip.y + 8 }}>
          <div className="map-tip-path">{tip.node.path}</div>
          <div className="muted">
            {tip.node.members ? `${tip.node.members.length} files · ` : tip.node.lines ? `${tip.node.lines} lines · ` : ''}
            {heatMap.get(tip.node.id) ? 'touched in this run' : 'not touched in this run'}
          </div>
        </div>
      )}
      {graph && explore && (
        <div className="map-legend">
          <span title={`${detail?.depth === 99 ? 'Files' : 'Spatial density groups'} · ${displayNodes.length} map items · zoom for detail`}>{graph.nodes.length} files · {graph.edges.length} imports</span>

          <MapActions graph={graph} />
        </div>
      )}
    </div>
  );
}
