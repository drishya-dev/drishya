import type { GraphNode, RepoGraph } from '@drishya/contracts';

/** Keep native file IDs and coordinates when narrowing the view to captured locations. */
export function observedGraph(graph: RepoGraph, paths: ReadonlySet<string>): RepoGraph {
  const nodes = graph.nodes.filter(node => paths.has(node.id));
  const ids = new Set(nodes.map(node => node.id));
  return { ...graph, nodes, edges: graph.edges.filter(edge => ids.has(edge.from) && ids.has(edge.to)) };
}

/** Direct static imports only. Their order never asserts agent execution or causality. */
export function importConnections(graph: RepoGraph, id: string, limit = 64) {
  const byId = new Map(graph.nodes.map(node => [node.id, node]));
  const root = byId.get(id);
  const neighbors: { node: GraphNode; direction: 'imports' | 'imported by' }[] = [];
  let total = 0;
  for (const edge of graph.edges) {
    if (graph.temporal !== 'current' || edge.relation !== 'static-import' || edge.basis !== 'deterministic-rule') continue;
    if (edge.from !== id && edge.to !== id) continue;
    const node = byId.get(edge.from === id ? edge.to : edge.from);
    if (!node) continue;
    total++;
    if (neighbors.length < limit) neighbors.push({ node, direction: edge.from === id ? 'imports' : 'imported by' });
  }
  return { root, neighbors, total };
}

/** A bounded direct neighborhood, retaining the indexed file coordinates. */
export function neighborhoodGraph(graph: RepoGraph, id: string, limit = 64): RepoGraph {
  const { root, neighbors } = importConnections(graph, id, limit);
  const ids = new Set([...(root ? [root.id] : []), ...neighbors.map(item => item.node.id)]);
  return { ...graph, nodes: graph.nodes.filter(node => ids.has(node.id)), edges: graph.edges.filter(edge => graph.temporal === 'current' && edge.relation === 'static-import' && edge.basis === 'deterministic-rule' && (edge.from === id || edge.to === id) && ids.has(edge.from) && ids.has(edge.to)) };
}
