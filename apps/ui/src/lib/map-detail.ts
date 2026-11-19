import type { GraphNode, RepoGraph } from '@drishya/contracts';

export interface MapGroup extends GraphNode { members?: string[]; opacity?: number }
/** A derived navigation grouping. Edges aggregate actual imports, never inferred causality. */
function mapLevel(graph: RepoGraph, depth: number): { nodes: MapGroup[]; edges: { from: string; to: string; count: number }[]; depth: number } {
  const source = graph.temporal === 'current' ? graph.nodes.filter(n => !n.path.startsWith('.local/')) : graph.nodes;
  // Screen-density bins preserve the repository's spatial layout. Folder names are
  // labels only: membership never depends on the directory hierarchy.
  const groups = new Map<string, MapGroup>();
  const member = new Map<string, string>();
  for (const node of source) {
    const individual = depth === 99 || !node.path.includes('/');
    const key = individual ? node.id : `density:${depth}:${Math.floor(node.x * depth)}:${Math.floor(node.y * depth)}`;
    member.set(node.id, key);
    const existing = groups.get(key);
    if (existing) { existing.members!.push(node.id); existing.x += node.x; existing.y += node.y; }
    else groups.set(key, individual ? { ...node } : { ...node, id: key, members: [node.id] });
  }
  const pathsById = new Map(source.map(n => [n.id, n.path.split('/')]));
  const nodes = [...groups.values()];
  for (const node of nodes) if (node.members) {
    node.x /= node.members.length; node.y /= node.members.length;
    if (node.members.length === 1) {
      member.set(node.members[0]!, node.members[0]!);
      node.id = node.members[0]!; delete node.members;
    } else {
      const paths = node.members.map(id => pathsById.get(id)!);
      let length = 0;
      while (length < paths[0]!.length && paths.every(p => p[length] === paths[0]![length])) length++;
      const common = paths[0]!.slice(0, length).join('/');
      node.path = common || 'Mixed files';
    }
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

/**
 * What a spatial group holds, for the hover that tells two "Mixed files" apart: members this run touched first,
 * then the rest in path order. Captured paths only; a group is navigation, never a claim about the code.
 */
export function groupMemberPaths(members: readonly string[], pathOf: (id: string) => string | undefined, touched: (id: string) => boolean, take = 4): { paths: string[]; more: number } {
  const entries = members.flatMap(id => { const path = pathOf(id); return path === undefined ? [] : [{ path, touched: touched(id) }]; });
  entries.sort((a, b) => Number(b.touched) - Number(a.touched) || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { paths: entries.slice(0, take).map(entry => entry.path), more: Math.max(0, entries.length - take) };
}

const levels = new WeakMap<RepoGraph, Map<number, ReturnType<typeof mapLevel>>>();
const sourceCounts = new WeakMap<RepoGraph, number>();
function level(graph: RepoGraph, depth: number) {
  let cache = levels.get(graph);
  if (!cache) { cache = new Map(); levels.set(graph, cache); }
  let result = cache.get(depth);
  if (!result) { result = mapLevel(graph, depth); cache.set(depth, result); }
  return result;
}

/** Nested spatial bins split continuously; a group is navigation, not a source file. */
export function mapDetail(graph: RepoGraph, zoom: number): ReturnType<typeof mapLevel> {
  let count = sourceCounts.get(graph);
  if (count === undefined) { count = graph.nodes.filter(n => !(graph.temporal === 'current' && n.path.startsWith('.local/'))).length; sourceCounts.set(graph, count); }
  if (count <= 80 || zoom >= 8) return level(graph, 99);
  const position = Math.max(0, Math.log2(Math.max(1, zoom)));
  const index = Math.min(2, Math.floor(position));
  const phase = Math.min(1, position - index);
  const t = phase * phase * (3 - 2 * phase);
  const coarse = level(graph, 4 * 2 ** index);
  if (t === 0) return coarse;
  const fine = level(graph, index === 2 ? 99 : 8 * 2 ** index);
  const parents = new Map<string, MapGroup>();
  for (const node of coarse.nodes) for (const member of node.members ?? [node.id]) parents.set(member, node);
  const coarseIds = new Set(coarse.nodes.map(n => n.id));
  const unchanged = new Set(fine.nodes.filter(n => coarseIds.has(n.id)).map(n => n.id));
  const nodes = coarse.nodes.filter(n => !unchanged.has(n.id)).map(n => ({ ...n, opacity: 1 - t }));
  for (const node of fine.nodes) {
    const parent = parents.get(node.members?.[0] ?? node.id);
    nodes.push({ ...node, x: parent ? parent.x + (node.x - parent.x) * t : node.x,
      y: parent ? parent.y + (node.y - parent.y) * t : node.y, opacity: unchanged.has(node.id) ? 1 : t });
  }
  return { nodes, edges: [...coarse.edges.filter(e => !unchanged.has(e.from) || !unchanged.has(e.to)), ...fine.edges], depth: fine.depth };
}

/** Bounded presentation of the composer's step-derived heat, shared by live and replay.
 * Inactive heat below .04 is cold; active locations always qualify. No clock or new history. */
export function mapActivity(graph: RepoGraph | undefined, heat: readonly import('@drishya/scene').HeatCell[]) {
  if (!graph) return [];
  const byId = new Map(graph.nodes.map(node => [node.id, node]));
  return heat.filter(cell => byId.has(cell.path) && (cell.active || cell.heat >= .04))
    .sort((a, b) => Number(b.active) - Number(a.active) || b.heat - a.heat || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
    .slice(0, 3).map(cell => ({ node: byId.get(cell.path)!, cell }));
}
