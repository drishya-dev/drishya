import type { GraphNode, GraphEdge } from '@drishya/contracts';

export interface MapPoint { node: GraphNode; x: number; y: number }
export interface MapGroup { key: string; x: number; y: number; members: MapPoint[] }

/** Stable coordinates, with coincident files separated for deliberate close reading. */
export function mapPoints(nodes: GraphNode[]): MapPoint[] {
  const bounded = nodes.slice(0, 5000);
  const occupied = new Map<string, number>();
  const points = bounded.map(node => {
    const x = Number.isFinite(node.x) ? node.x : 0, y = Number.isFinite(node.y) ? node.y : 0;
    const key = `${x}:${y}`, n = occupied.get(key) ?? 0; occupied.set(key, n + 1);
    return { node, x: x + Math.cos(n * 2.39996) * Math.sqrt(n) * 3, y: y + Math.sin(n * 2.39996) * Math.sqrt(n) * 3 };
  });
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const dx = Math.max(1, Math.max(...xs) - minX), dy = Math.max(1, Math.max(...ys) - minY);
  return points.map(p => ({ ...p, x: 90 + (p.x - minX) / dx * 820, y: 80 + (p.y - minY) / dy * 540 }));
}

/** Screen-space bins aggregate density, not folders or inferred dependency communities. */
export function groupMap(points: MapPoint[], edges: GraphEdge[], scale: number, pan: { x: number; y: number }, width: number, height: number) {
  const cells = new Map<string, MapGroup>(), membership = new Map<string, string>();
  for (const point of points) {
    const x = point.x * scale + pan.x, y = point.y * scale + pan.y;
    if (x < -35 || x > width + 35 || y < -35 || y > height + 35) continue;
    const key = `${Math.floor(x / 32)}:${Math.floor(y / 32)}`;
    let cell = cells.get(key);
    if (!cell) { cell = { key, x: 0, y: 0, members: [] }; cells.set(key, cell); }
    cell.x += x; cell.y += y; cell.members.push(point); membership.set(point.node.path, key);
  }
  const groups = [...cells.values()].map(c => ({ ...c, x: c.x / c.members.length, y: c.y / c.members.length }));
  const byKey = new Map(groups.map(g => [g.key, g]));
  const links = new Map<string, { from: MapGroup; to: MapGroup; count: number }>();
  for (const edge of edges) {
    const from = membership.get(edge.from), to = membership.get(edge.to);
    if (!from || !to || from === to) continue;
    const key = `${from}>${to}`, previous = links.get(key);
    if (previous) previous.count++;
    else links.set(key, { from: byKey.get(from)!, to: byKey.get(to)!, count: 1 });
  }
  return { groups, links: [...links.values()].slice(0, 1200), totalLinks: links.size };
}
