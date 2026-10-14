import { useMemo } from 'react';
import type { RepoGraph } from '../fresh/api';
import { mapPoints } from './map-layout';

/** A quiet, bounded sample of actual topology; the detailed map owns navigation. */
export function ModernBackdrop({ graph }: { graph?: RepoGraph }) {
  const points = useMemo(() => mapPoints((graph?.nodes ?? []).slice(0, 180)), [graph?.nodes]);
  const byPath = new Map(points.map(p => [p.node.path, p]));
  const links = (graph?.edges ?? []).filter(e => byPath.has(e.from) && byPath.has(e.to)).slice(0, 240);
  return <svg className="md-topology" viewBox="0 0 1000 700" aria-hidden="true">
    {links.map((edge, i) => { const a = byPath.get(edge.from)!, b = byPath.get(edge.to)!; return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />; })}
    {points.map(point => <circle key={point.node.path} cx={point.x} cy={point.y} r="1.8" />)}
  </svg>;
}
