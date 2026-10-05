// The repository map, behind everything. Canvas 2D in this base UI (Pixi replaces it in the
// frontend pass). The canvas draws shapes only; every label is DOM. It redraws on change,
// never on a continuous loop, so an idle screen costs nothing.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { GraphNode, RepoGraph } from '@drishya/contracts';
import type { HeatCell } from '@drishya/scene';
import { useApp } from '../state.ts';

const TONE: Record<HeatCell['tone'], string> = {
  read: '#C8C8D0',
  search: '#8B9BFF',
  write: '#E6B98A',
  fail: '#F2706A',
  pass: '#4FC38A',
};

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
  const hoveredPath = useApp((s) => s.hoveredPath);
  const set = useApp((s) => s.set);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [cam, setCam] = useState<Cam>({ x: 0, y: 0, k: 1 });
  const [tip, setTip] = useState<{ node: GraphNode; x: number; y: number }>();
  const [query, setQuery] = useState('');
  const heatMap = useMemo(() => new Map(heat.map((h) => [h.path, h])), [heat]);
  const byId = useMemo(() => new Map(graph?.nodes.map((n) => [n.id, n]) ?? []), [graph]);

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

  // Fit the unit-square layout into the view, leaving room for the frame.
  const fit = useMemo(() => {
    const pad = 48;
    const s = Math.max(40, Math.min(size.w, size.h) - pad * 2);
    return { s, ox: (size.w - s) / 2, oy: (size.h - s) / 2 };
  }, [size]);
  const project = (n: { x: number; y: number }) => ({ x: (fit.ox + n.x * fit.s) * cam.k + cam.x, y: (fit.oy + n.y * fit.s) * cam.k + cam.y });

  const draw = () => {
    const c = canvas.current;
    if (!c || !graph) return false;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== Math.round(size.w * dpr) || c.height !== Math.round(size.h * dpr)) {
      c.width = size.w * dpr;
      c.height = size.h * dpr;
    }
    const g = c.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, size.w, size.h);

    g.lineWidth = 1;
    g.strokeStyle = 'rgba(255,255,255,0.05)';
    g.beginPath();
    for (const e of graph.edges) {
      const a = byId.get(e.from);
      const b = byId.get(e.to);
      if (!a || !b) continue;
      const pa = project(a);
      const pb = project(b);
      g.moveTo(pa.x, pa.y);
      g.lineTo(pb.x, pb.y);
    }
    g.stroke();

    if (hoveredPath) {
      g.beginPath();
      for (const edge of graph.edges) {
        if (edge.from !== hoveredPath && edge.to !== hoveredPath) continue;
        const a = byId.get(edge.from); const b = byId.get(edge.to);
        if (!a || !b) continue;
        const pa = project(a); const pb = project(b);
        g.moveTo(pa.x, pa.y); g.lineTo(pb.x, pb.y);
      }
      g.strokeStyle = 'rgba(139,155,255,.55)'; g.stroke();
    }

    const r0 = Math.max(1.6, Math.min(3.2, 1.2 * Math.sqrt(cam.k) * (explore ? 1.6 : 1.2)));
    for (const n of graph.nodes) {
      const p = project(n);
      if (p.x < -10 || p.y < -10 || p.x > size.w + 10 || p.y > size.h + 10) continue;
      const h = heatMap.get(n.id);
      g.beginPath();
      g.arc(p.x, p.y, r0, 0, Math.PI * 2);
      g.fillStyle = h ? '#71717A' : '#3F3F46';
      g.fill();
      if (h && h.heat > 0.02) {
        g.globalAlpha = Math.min(1, 0.25 + h.heat);
        g.beginPath();
        g.arc(p.x, p.y, r0 + 1.2 + h.heat * 2.2, 0, Math.PI * 2);
        g.fillStyle = TONE[h.tone];
        g.fill();
        g.globalAlpha = 1;
      }
      if (h?.edited) {
        g.beginPath();
        g.arc(p.x, p.y, r0 + 4.5, 0, Math.PI * 2);
        g.strokeStyle = 'rgba(230,185,138,0.75)';
        g.stroke();
      }
      if (h?.tone === 'fail') {
        g.beginPath();
        g.arc(p.x, p.y, r0 + 6.5, 0, Math.PI * 2);
        g.strokeStyle = 'rgba(242,112,106,0.8)';
        g.stroke();
      }
      if (hoveredPath === n.id) {
        g.beginPath();
        g.arc(p.x, p.y, r0 + 8, 0, Math.PI * 2);
        g.strokeStyle = '#EDEDEF';
        g.stroke();
      }
    }

    // Keep the reading column clear: the map recedes behind text, never crosses it.
    if (!explore && readingRect) {
      const grad = g.createLinearGradient(readingRect.left - 32, 0, readingRect.left + readingRect.width + 32, 0);
      grad.addColorStop(0, 'rgba(10,10,12,0)');
      grad.addColorStop(0.04, 'rgba(10,10,12,0.9)');
      grad.addColorStop(0.96, 'rgba(10,10,12,0.9)');
      grad.addColorStop(1, 'rgba(10,10,12,0)');
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
    let best: GraphNode | undefined;
    let bd = 14 * 14;
    for (const n of graph.nodes) {
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
    if (!graph || !explore) return [];
    const dirs = new Map<string, { x: number; y: number; n: number }>();
    for (const n of graph.nodes) {
      const d = dirs.get(n.dir) ?? { x: 0, y: 0, n: 0 };
      d.x += n.x;
      d.y += n.y;
      d.n++;
      dirs.set(n.dir, d);
    }
    return [...dirs].filter(([, d]) => d.n >= 2).map(([dir, d]) => ({ dir, x: d.x / d.n, y: d.y / d.n }));
  }, [graph, explore]);

  // Share exact renderer coordinates for a bounded working set, never a guessed graph origin.
  const anchors = [...heat].sort((a, b) => b.heat - a.heat).slice(0, 63).map((h) => h.path);
  if (hoveredPath && !anchors.includes(hoveredPath)) anchors.push(hoveredPath);
  const matches = query.trim() && graph ? graph.nodes.filter((node) => node.path.toLowerCase().includes(query.trim().toLowerCase())) : [];

  return (
    <div
      ref={wrap}
      className={`map${explore ? ' exploring' : ''}`}
      onWheel={(e) => {
        if ((e.target as HTMLElement).closest('.map-tools, .map-legend')) return;
        if (!explore) return;
        const r = wrap.current!.getBoundingClientRect();
        const mx = e.clientX - r.left;
        const my = e.clientY - r.top;
        const k = Math.max(0.5, Math.min(8, cam.k * Math.exp(-e.deltaY * 0.0015)));
        setCam({ k, x: mx - ((mx - cam.x) * k) / cam.k, y: my - ((my - cam.y) * k) / cam.k });
      }}
      onPointerDown={(e) => {
        if (!explore) return;
        if ((e.target as HTMLElement).closest('.map-tools, .map-legend')) return;
        drag.current = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if ((e.target as HTMLElement).closest('.map-tools, .map-legend')) return;
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
        if ((e.target as HTMLElement).closest('.map-tools, .map-legend')) return;
        const d = drag.current;
        drag.current = undefined;
        if (!explore || (d && d.moved)) return;
        const r = wrap.current!.getBoundingClientRect();
        const n = nearest(e.clientX - r.left, e.clientY - r.top);
        if (n) set({ filePanel: n.id });
      }}
      onPointerLeave={() => explore && (setTip(undefined), set({ hoveredPath: undefined }))}
      aria-hidden={!explore}
    >
      <canvas ref={canvas} style={{ width: size.w, height: size.h }} />
      {explore && <div className="map-tools">
        <input aria-label="Find a file on the map" placeholder="Find a file on the map…" value={query} onChange={(e) => setQuery(e.target.value)} />
        {query && <div className="map-matches" aria-label="Map file matches">
          {matches.slice(0, 30).map((node) => <button key={node.id} onFocus={() => set({ hoveredPath: node.id })} onMouseEnter={() => set({ hoveredPath: node.id })} onClick={() => {
            const x = fit.ox + node.x * fit.s; const y = fit.oy + node.y * fit.s;
            setCam({ k: 2, x: size.w / 2 - x * 2, y: size.h / 2 - y * 2 });
            setTip({ node, x: size.w / 2, y: size.h / 2 });
            set({ hoveredPath: node.id, follow: false, playing: false, held: true });
          }}>{node.path}</button>)}
          <span className="muted small">{matches.length} matched files{matches.length > 30 ? ' · first 30 shown; refine the query' : ''}</span>
          {tip && <button className="btn" onClick={() => { set({ filePanel: tip.node.id, explore: false }); }}>Open recorded work on this file</button>}
        </div>}
      </div>}
      {anchors.map((path) => {
        const node = byId.get(path);
        if (!node) return null;
        const p = project(node);
        const visible = size.w > 0 && p.x >= 6 && p.y >= 6 && p.x < size.w - 6 && p.y < size.h - 6;
        return <span key={path} className="map-origin-point" data-origin-file={path} data-origin-visible={visible} style={{ left: p.x - 3, top: p.y - 3 }} aria-hidden="true" />;
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
            {tip.node.lines ? `${tip.node.lines} lines · ` : ''}
            {heatMap.get(tip.node.id) ? 'touched in this run' : 'not touched in this run'}
          </div>
        </div>
      )}
      {graph && explore && (
        <div className="map-legend">
          <span>{graph.nodes.length} files · {graph.edges.length} imports</span>
          <span className="muted">{graph.temporal === 'current' ? 'Map of the workspace as it is now' : 'Only files this recording touched'}</span>
          <MapActions graph={graph} />
        </div>
      )}
    </div>
  );
}
