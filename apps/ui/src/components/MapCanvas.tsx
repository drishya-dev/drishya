// The repository map, behind everything. Canvas 2D in this base UI (Pixi replaces it in the
// frontend pass). The canvas draws shapes only; every label is DOM. It redraws on change,
// never on a continuous loop, so an idle screen costs nothing.

import { useEffect, useMemo, useRef, useState } from 'react';
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
  const { workspace } = useSessionWorkspace();
  useResolvedTheme();
  const hoveredPath = useApp((s) => s.hoveredPath);
  const set = useApp((s) => s.set);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [cam, setCam] = useState<Cam>({ x: 0, y: 0, k: 1 });
  const [tip, setTip] = useState<{ node: MapGroup; x: number; y: number }>();
  const [query, setQuery] = useState('');
  const [directory, setDirectory] = useState('');
  const focusedGraph = useMemo(() => {
    if (!graph || !directory) return graph;
    const nodes = graph.nodes.filter(n => n.path.startsWith(directory + '/'));
    const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
    const minX = Math.min(...xs), minY = Math.min(...ys);
    const dx = Math.max(.01, Math.max(...xs) - minX), dy = Math.max(.01, Math.max(...ys) - minY);
    return { ...graph, nodes: nodes.map(n => ({ ...n, x: .1 + .8 * (n.x - minX) / dx, y: .1 + .8 * (n.y - minY) / dy })) };
  }, [graph, directory]);
  const detail = useMemo(() => focusedGraph ? mapDetail(focusedGraph, cam.k, directory ? directory.split('/').length : 0) : undefined, [focusedGraph, cam.k, directory]);
  const openDirectory = (path: string) => { setDirectory(path); setCam({ x: 0, y: 0, k: 1 }); setTip(undefined); };
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
    if (!explore) setCam({ x: 0, y: 0, k: 1 });
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
    g.beginPath();
    for (const e of (detail?.edges ?? []).slice(0, 600)) {
      const a = displayById.get(e.from);
      const b = displayById.get(e.to);
      if (!a || !b) continue;
      const pa = project(a);
      const pb = project(b);
      g.moveTo(pa.x, pa.y);
      g.lineTo(pb.x, pb.y);
    }
    g.stroke();

    if (hoveredPath) {
      g.beginPath();
      for (const edge of (detail?.edges ?? []).slice(0, 600)) {
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

    const r0 = explore ? Math.max(5, Math.min(10, 5 * Math.sqrt(cam.k))) : Math.max(2, Math.min(4, 2.4 * Math.sqrt(cam.k)));
    for (const n of displayNodes) {
      const p = project(n);
      if (p.x < -10 || p.y < -10 || p.x > size.w + 10 || p.y > size.h + 10) continue;
      const h = heatMap.get(n.id) ?? (n.members ? n.members.map(id => heatMap.get(id)).find(Boolean) : undefined);
      g.beginPath();
      g.roundRect(p.x - r0, p.y - r0 * 1.3, r0 * 2, n.members ? r0 * 1.8 : r0 * 2.6, 1.5);
      g.fillStyle = h && h.heat > 0.02 ? colours.tones[h.tone] : h ? colours.active : colours.node;
      g.fill();
      if (explore && r0 >= 4) {
        g.strokeStyle = colours.background; g.lineWidth = 1;
        g.beginPath(); g.moveTo(p.x - r0 / 2, p.y); g.lineTo(p.x + r0 / 2, p.y); g.moveTo(p.x - r0 / 2, p.y + r0 / 2); g.lineTo(p.x + r0 / 3, p.y + r0 / 2); g.stroke();
        g.lineWidth = 1.2;
      }
      if (h?.edited) {
        g.beginPath();
        g.roundRect(p.x - r0 - 3, p.y - r0 * 1.3 - 3, r0 * 2 + 6, r0 * 2.6 + 6, 3);
        g.strokeStyle = colours.tones.write;
        g.stroke();
      }
      if (h?.tone === 'fail') {
        g.beginPath();
        g.roundRect(p.x - r0 - 5, p.y - r0 * 1.3 - 5, r0 * 2 + 10, r0 * 2.6 + 10, 4);
        g.strokeStyle = colours.tones.fail;
        g.stroke();
      }
      if (hoveredPath === n.id) {
        g.beginPath();
        g.roundRect(p.x - r0 - 7, p.y - r0 * 1.3 - 7, r0 * 2 + 14, r0 * 2.6 + 14, 4);
        g.strokeStyle = colours.text;
        g.stroke();
      }
    }

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

  useEffect(() => {
    // Origins owns finite arrival choreography and its cancellation.
    const raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  });

  // ── interaction (explore mode) ────────────────────────────────────────────
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean } | undefined>(undefined);
  const nearest = (mx: number, my: number) => {
    if (!graph) return undefined;
    let best: MapGroup | undefined;
    let bd = 14 * 14;
    for (const n of displayNodes) {
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
    if (!graph || !explore || detail?.depth !== 99) return [];
    const dirs = new Map<string, { x: number; y: number; n: number }>();
    for (const n of displayNodes) {
      const d = dirs.get(n.dir) ?? { x: 0, y: 0, n: 0 };
      d.x += n.x;
      d.y += n.y;
      d.n++;
      dirs.set(n.dir, d);
    }
    return [...dirs].filter(([, d]) => d.n >= 2).map(([dir, d]) => ({ dir, x: d.x / d.n, y: d.y / d.n }));
  }, [graph, explore, detail]);

  // Share exact renderer coordinates for a bounded working set, never a guessed graph origin.
  const anchors = [...heat].sort((a, b) => b.heat - a.heat).slice(0, 63).map((h) => h.path);
  if (hoveredPath && !anchors.includes(hoveredPath)) anchors.push(hoveredPath);
  const matches = query.trim() && graph ? graph.nodes.filter((node) => !(graph.temporal === 'current' && node.path.startsWith('.local/')) && node.path.toLowerCase().includes(query.trim().toLowerCase())) : [];

  return (
    <div
      ref={wrap}
      className={`map${explore ? ' exploring' : ''}`}
      onWheel={(e) => {
        if ((e.target as HTMLElement).closest('.map-tools, .map-legend, .map-group')) return;
        if (!explore) return;
        const r = wrap.current!.getBoundingClientRect();
        const mx = e.clientX - r.left;
        const my = e.clientY - r.top;
        const k = Math.max(0.5, Math.min(8, cam.k * Math.exp(-e.deltaY * 0.0015)));
        setCam({ k, x: mx - ((mx - cam.x) * k) / cam.k, y: my - ((my - cam.y) * k) / cam.k });
      }}
      onPointerDown={(e) => {
        if (!explore) return;
        if ((e.target as HTMLElement).closest('.map-tools, .map-legend, .map-group')) return;
        drag.current = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if ((e.target as HTMLElement).closest('.map-tools, .map-legend, .map-group')) return;
        const r = wrap.current!.getBoundingClientRect();
        if (drag.current && explore) {
          const dx = e.clientX - drag.current.x;
          const dy = e.clientY - drag.current.y;
          if (Math.abs(dx) + Math.abs(dy) > 3) drag.current.moved = true;
          setCam((c) => ({ ...c, x: drag.current!.cx + dx, y: drag.current!.cy + dy }));
          return;
        }
        if (!explore) return;
        const n = nearest(e.clientX - r.left, e.clientY - r.top);
        setTip(n ? { node: n, ...project(n) } : undefined);
        set({ hoveredPath: n?.id });
      }}
      onPointerUp={(e) => {
        if ((e.target as HTMLElement).closest('.map-tools, .map-legend, .map-group')) return;
        const d = drag.current;
        drag.current = undefined;
        if (!explore || (d && d.moved)) return;
        const r = wrap.current!.getBoundingClientRect();
        const n = nearest(e.clientX - r.left, e.clientY - r.top);
        if (n?.members) {
          openDirectory(n.path); return;
        }
        if (n) set(workspace?.approved ? { currentFile: n.path } : { filePanel: n.id });
      }}
      onPointerLeave={() => explore && (setTip(undefined), set({ hoveredPath: undefined }))}
      aria-hidden={!explore}
    >
      <canvas ref={canvas} style={{ width: size.w, height: size.h }} />
      {explore && <div className="map-tools">{directory && <button className="btn ghost" onClick={() => openDirectory(directory.includes('/') ? directory.slice(0, directory.lastIndexOf('/')) : '')}>↑ {directory} · parent</button>}
        <button className="btn" onClick={() => set({ explore: false })}>Back to work</button>
        <button className="btn ghost" aria-label="Zoom into repository" onClick={() => setCam(c => ({ ...c, k: Math.min(8, c.k * 1.25) }))}>+</button>
        <button className="btn ghost" aria-label="Zoom out of repository" onClick={() => setCam(c => ({ ...c, k: Math.max(.5, c.k / 1.25) }))}>−</button>
        <button className="btn ghost" onClick={() => { openDirectory(''); setQuery(''); set({ hoveredPath: undefined }); }}>Fit</button>
        <input aria-label="Find a file on the map" placeholder="Find a file on the map…" value={query} onChange={(e) => setQuery(e.target.value)} />
        {query && <div className="map-matches" aria-label="Map file matches">
          {matches.slice(0, 30).map((node) => <button key={node.id} onFocus={() => set({ hoveredPath: node.id })} onMouseEnter={() => set({ hoveredPath: node.id })} onClick={() => {
            const x = fit.ox + node.x * fit.sx; const y = fit.oy + node.y * fit.sy;
            setDirectory(''); const k = graph && graph.nodes.length > 80 ? 6 : 2;
            setCam({ k, x: size.w / 2 - x * k, y: size.h / 2 - y * k });
            setTip({ node, x: size.w / 2, y: size.h / 2 });
            set({ hoveredPath: node.id, follow: false, playing: false, held: true });
          }}>{node.path}</button>)}
          <span className="muted small">{matches.length} matched files{matches.length > 30 ? ' · first 30 shown; refine the query' : ''}</span>
          {tip && <button className="btn" onClick={() => { set({ filePanel: tip.node.id, explore: false }); }}>Open recorded work on this file</button>}
        </div>}
      </div>}
      {anchors.map((path) => {
        const node = displayById.get(path);
        if (!node) return null;
        const p = project(node);
        const visible = displayById.has(path) && size.w > 0 && p.x >= 6 && p.y >= 6 && p.x < size.w - 6 && p.y < size.h - 6;
        return <span key={path} className="map-origin-point" data-origin-file={path} data-origin-visible={visible} style={{ left: p.x - 3, top: p.y - 3 }} aria-hidden="true" />;
      })}
      {anchors.slice(0, explore ? 24 : 12).map((path) => {
        const node = displayById.get(path);
        if (!node || !displayById.has(path)) return null;
        const p = project(node);
        if (p.x < 6 || p.y < 6 || p.x > size.w - 160 || p.y > size.h - 24) return null;
        if (!explore && readingRect && p.x + 155 > readingRect.left - 24 && p.x < readingRect.left + readingRect.width + 24) return null;
        return <span key={path} className={`map-file-label tone-${heatMap.get(path)?.tone}`} title={node.path} style={{ left: p.x + 9, top: p.y - 9 }}>{node.path}</span>;
      })}
      {explore && displayNodes.filter(n => n.members).slice(0, 48).map(n => {
        const p = project(n); if (p.x < 0 || p.y < 0 || p.x > size.w - 100 || p.y > size.h - 40) return null;
        return <button className="map-group" key={n.id} style={{ left: p.x + 14, top: p.y - 12 }} onClick={() => openDirectory(n.path)}><strong>{n.path}</strong><small>{n.members!.length} files · zoom in</small></button>;
      })}
      {labels.map((l) => {
        const p = project(l);
        return (
          <div key={l.dir} className="map-label" style={{ left: p.x, top: p.y - 18 }}>
            {l.dir}
          </div>
        );
      })}
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
          <span>{graph.nodes.length} files · {graph.edges.length} imports</span><span className="muted">{detail?.depth === 99 ? 'Files' : `Folder depth ${detail?.depth}`} · {displayNodes.length} map items · zoom for detail</span>
          <span className="muted">{graph.temporal === 'current' ? 'Map of the workspace as it is now' : 'Only files this recording touched'}</span>
          <MapActions graph={graph} />
        </div>
      )}
    </div>
  );
}
