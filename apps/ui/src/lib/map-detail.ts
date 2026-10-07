import type { GraphNode, RepoGraph } from '@drishya/contracts';

export interface MapGroup extends GraphNode { members?: string[] }
/** A derived navigation grouping. Edges aggregate actual imports, never inferred causality. */
export function mapDetail(graph: RepoGraph, zoom: number, baseDepth = 0): { nodes: MapGroup[]; edges: { from: string; to: string; count: number }[]; depth: number } {
  const source = graph.temporal === 'current' ? graph.nodes.filter(n => !n.path.startsWith('.local/')) : graph.nodes;
  const depth = source.length <= 80 || zoom >= 5.5 ? 99 : baseDepth + (zoom >= 3 ? 3 : zoom >= 1.7 ? 2 : 1);
  const groups = new Map<string, MapGroup>();
  const member = new Map<string, string>();
  for (const node of source) {
    const parts = node.path.split('/');
    const key = parts.length > depth ? parts.slice(0, depth).join('/') : node.id;
    member.set(node.id, key);
    const existing = groups.get(key);
    if (existing) { existing.members!.push(node.id); existing.x += node.x; existing.y += node.y; }
    else groups.set(key, parts.length > depth ? { ...node, id: key, path: key, dir: key, members: [node.id] } : { ...node });
  }
  const nodes = [...groups.values()];
  for (const node of nodes) if (node.members) { node.x /= node.members.length; node.y /= node.members.length; }
  // At overview, use a legible spatial navigation layout rather than overlapping centroids.
  if (depth === baseDepth + 1 && nodes.length > 1) {
    const columns = Math.ceil(Math.sqrt(nodes.length)); const rows = Math.ceil(nodes.length / columns);
    nodes.forEach((node, i) => { node.x = (i % columns + .5) / columns; node.y = (Math.floor(i / columns) + .5) / rows; });
  }
  const edges = new Map<string, { from: string; to: string; count: number }>();
  for (const edge of graph.edges) {
    const from = member.get(edge.from), to = member.get(edge.to);
    if (!from || !to || from === to) continue;
    const key = `${from}→${to}`; const prior = edges.get(key);
    if (prior) prior.count++; else edges.set(key, { from, to, count: 1 });
  }
  return { nodes, edges: [...edges.values()], depth };
}
