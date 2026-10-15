import { useEffect, useMemo, useRef, useState } from 'react';
import type { RepoGraph } from '../fresh/api';
import { mapPoints, groupMap } from './map-layout';

/** Repository topology is current static structure, never a model's reasoning graph. */
export function ModernMap({ graph, selectedPath, onFile }: { graph?: RepoGraph; selectedPath?: string; onFile: (path: string) => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1000, height: 600 });
  const [camera, setCamera] = useState({ zoom: 1, x: 0, y: 0 });
  const [query, setQuery] = useState('');
  const [hover, setHover] = useState<string>();
  const drag = useRef<{ id: number; x: number; y: number; cx: number; cy: number } | undefined>(undefined);
  const points = useMemo(() => mapPoints(graph?.nodes ?? []), [graph?.nodes]);
  const fit = Math.min(size.width / 1000, size.height / 700);
  const scale = fit * camera.zoom;
  const pan = { x: (size.width - 1000 * fit) / 2 + camera.x, y: (size.height - 700 * fit) / 2 + camera.y };
  const { groups, links, totalLinks } = useMemo(() => groupMap(points, graph?.edges ?? [], scale, pan, size.width, size.height), [points, graph?.edges, scale, pan.x, pan.y, size]);
  const matches = query.trim() ? points.filter(p => p.node.path.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8) : [];
  useEffect(() => { const el = root.current!; const obs = new ResizeObserver(() => setSize({ width: el.clientWidth, height: el.clientHeight })); obs.observe(el); return () => obs.disconnect(); }, []);
  const zoomAt = (factor: number, x = size.width / 2, y = size.height / 2) => setCamera(c => {
    const zoom = Math.max(.6, Math.min(18, c.zoom * factor)), ratio = zoom / c.zoom;
    const ox = (size.width - 1000 * fit) / 2, oy = (size.height - 700 * fit) / 2;
    return { zoom, x: x - ox - (x - ox - c.x) * ratio, y: y - oy - (y - oy - c.y) * ratio };
  });
  const focused = groups.find(g => g.key === hover || g.members.some(p => p.node.path === selectedPath));
  return <div className="md-map" ref={root} aria-label="Repository map" onPointerDown={e => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button,input,label')) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, cx: camera.x, cy: camera.y }; e.currentTarget.setPointerCapture(e.pointerId);
  }} onPointerMove={e => { const d = drag.current; if (d?.id === e.pointerId) setCamera(c => ({ ...c, x: d.cx + e.clientX - d.x, y: d.cy + e.clientY - d.y })); }} onPointerUp={() => { drag.current = undefined; }} onPointerCancel={() => { drag.current = undefined; }}>
    <div className="md-map-caption"><span>{graph?.temporal === 'current' ? 'CURRENT REPOSITORY' : 'CAPTURED FILES'}</span><h2>Find your way through the code.</h2><p>Drag to explore · open a group to look closer</p></div>
    <div className="md-map-search"><label><span>⌕</span><input aria-label="Find on repository map" placeholder="Find a file on the map…" value={query} onChange={e => setQuery(e.target.value)} /></label>{query && <div>{matches.map(p => <button key={p.node.path} onClick={() => { setCamera({ zoom: 4, x: size.width / 2 - p.x * fit * 4 - (size.width - 1000 * fit) / 2, y: size.height / 2 - p.y * fit * 4 - (size.height - 700 * fit) / 2 }); setQuery(''); onFile(p.node.path); }}>{p.node.path}</button>)}{!matches.length && <p>No indexed file matches.</p>}</div>}</div>
    <svg className="md-map-edges" aria-hidden="true" width={size.width} height={size.height}>{links.map((edge, i) => <line key={i} x1={edge.from.x} y1={edge.from.y} x2={edge.to.x} y2={edge.to.y} className={focused && (edge.from.key === focused.key || edge.to.key === focused.key) ? 'is-connected' : ''} />)}</svg>
    {groups.map(g => {
      const multiple = g.members.length > 1, path = g.members[0]!.node.path;
      const active = g.key === focused?.key;
      return <button key={g.key} className={`md-map-point ${multiple ? 'is-group' : ''} ${active ? 'is-focused' : ''}`} style={{ left: g.x, top: g.y }} data-fr-path={multiple ? undefined : path} aria-label={multiple ? `Explore ${g.members.length} nearby files` : `Read ${path}`} title={multiple ? `${g.members.length} spatially grouped files · zoom to separate` : path} onPointerEnter={() => setHover(g.key)} onPointerLeave={() => setHover(undefined)} onFocus={() => setHover(g.key)} onBlur={() => setHover(undefined)} onClick={() => multiple ? zoomAt(1.8, g.x, g.y) : onFile(path)}><i style={{ width: multiple ? Math.min(15, 5 + Math.sqrt(g.members.length)) : 4, height: multiple ? Math.min(15, 5 + Math.sqrt(g.members.length)) : 4 }} />{multiple ? <small>{g.members.length}</small> : <span className={active || camera.zoom > 2.5 && groups.length < 40 ? 'is-visible' : ''}>{path.split('/').at(-1)}</span>}</button>;
    })}
    {!points.length && <p className="md-map-empty">Files appear when captured or indexed. No relationships are invented.</p>}
    <div className="md-map-legend"><i />{points.length.toLocaleString()} files · {groups.length} visible points{(graph?.nodes.length ?? 0) > points.length && ' · bounded view'}<small>Spatial groups · {totalLinks > 1200 ? '1,200 visible import links (bounded)' : 'static import links'}</small></div>
    <div className="md-map-controls"><button aria-label="Zoom out" onClick={() => zoomAt(1 / 1.4)}>−</button><span>{Math.round(camera.zoom * 100)}%</span><button aria-label="Zoom in" onClick={() => zoomAt(1.4)}>+</button><button onClick={() => setCamera({ zoom: 1, x: 0, y: 0 })}>Fit</button></div>
  </div>;
}
