import { useEffect, useMemo, useRef, useState } from 'react';
import type { RepoGraph } from '@drishya/contracts';
import type { HeatCell } from '@drishya/scene';
import { useApp } from '../state.ts';
import { mapPalette, useResolvedTheme } from '../lib/theme.ts';

/** A second view of the actual repository geometry, never a diagram of inferred reasoning. */
export function RepositoryLens({ graph, heat, focusPath }: { graph: RepoGraph; heat: HeatCell[]; focusPath?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const hovered = useApp((s) => s.hoveredPath);
  const theme = useResolvedTheme();
  const set = useApp((s) => s.set);
  const [width, setWidth] = useState(0);
  const height = 170;
  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph]);
  const activity = useMemo(() => new Map(heat.map((h) => [h.path, h])), [heat]);
  const labelPath = hovered ?? focusPath ?? heat.find((cell) => cell.active)?.path;
  const labelled = labelPath ? byId.get(labelPath) : undefined;
  const points = (node: { x: number; y: number }) => ({ x: 12 + node.x * Math.max(0, width - 24), y: 12 + node.y * (height - 24) });
  const anchors = heat.slice(0, 63).map((h) => h.path);
  if (labelPath && !anchors.includes(labelPath)) anchors.push(labelPath);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const c = canvas.current;
    if (!c || !width) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    c.width = Math.round(width * dpr); c.height = height * dpr;
    const g = c.getContext('2d')!;
    const colours = mapPalette(c);
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, width, height);
    for (const focused of [false, true]) {
      g.beginPath();
      for (const edge of graph.edges) {
        if ((!!labelPath && (edge.from === labelPath || edge.to === labelPath)) !== focused) continue;
        const from = byId.get(edge.from); const to = byId.get(edge.to);
        if (!from || !to) continue;
        const a = points(from); const b = points(to);
        g.moveTo(a.x, a.y); g.lineTo(b.x, b.y);
      }
      g.strokeStyle = focused ? colours.focus : colours.edge; g.stroke();
    }
    for (const node of graph.nodes) {
      const p = points(node); const h = activity.get(node.id);
      g.beginPath(); g.arc(p.x, p.y, labelPath === node.id ? 3.5 : h ? 2.3 : 1.2, 0, Math.PI * 2);
      g.fillStyle = h ? colours.tones[h.tone] : colours.node; g.fill();
      if (h?.edited || labelPath === node.id) {
        g.beginPath(); g.arc(p.x, p.y, 5.5, 0, Math.PI * 2);
        g.strokeStyle = labelPath === node.id ? colours.text : colours.tones.write; g.stroke();
      }
    }
  }, [graph, heat, labelPath, width, theme]);
  const nearest = (x: number, y: number) => {
    let found: RepoGraph['nodes'][number] | undefined;
    let distance = 12 ** 2;
    for (const node of graph.nodes) {
      const p = points(node); const next = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (next < distance) { found = node; distance = next; }
    }
    return found;
  };
  return <div className="repo-lens" ref={wrap}>
    <button className="repo-lens-head" onClick={() => set({ explore: true, follow: false, playing: false, held: true })} title="Explore the repository map">
      <span>Repository</span><span aria-hidden="true">↗</span>
    </button>
    <div className="repo-lens-world" style={{ height }} onMouseMove={(e) => {
      const r = e.currentTarget.getBoundingClientRect();
      set({ hoveredPath: nearest(e.clientX - r.left, e.clientY - r.top)?.id });
    }} onMouseLeave={() => set({ hoveredPath: undefined })} onClick={(e) => {
      const r = e.currentTarget.getBoundingClientRect(); const node = nearest(e.clientX - r.left, e.clientY - r.top);
      if (node) set({ filePanel: node.path, follow: false, playing: false, held: true });
    }}>
      <canvas ref={canvas} style={{ width, height }} aria-hidden="true" />
      {labelled && width > 0 && <span className="repo-lens-label" style={{ left: Math.max(8, Math.min(points(labelled).x + 6, width - 110)), top: Math.max(4, points(labelled).y - 22) }} title={labelled.path}>{labelled.path.split('/').at(-1)}</span>}
      {anchors.map((path) => {
        const node = byId.get(path); if (!node) return null;
        const p = points(node);
        return <span key={path} className="map-origin-point" data-origin-file={path} data-origin-visible={width > 0} data-origin-renderer="overview" style={{ left: p.x - 3, top: p.y - 3 }} aria-hidden="true" />;
      })}
    </div>
    <div className="repo-lens-caption">{graph.nodes.length.toLocaleString()} files · {graph.temporal === 'current' ? `${graph.edges.length.toLocaleString()} static imports` : 'recorded locations'}</div>
    <div className="repo-lens-focus" title={labelPath}>{labelPath ?? (graph.temporal === 'current' ? 'Hover a file to trace its imports' : 'Explore files touched in this run')}</div>
  </div>;
}
