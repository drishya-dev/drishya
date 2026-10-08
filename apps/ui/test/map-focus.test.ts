import { expect, it } from 'vitest';
import type { RepoGraph } from '@drishya/contracts';
import { importConnections, observedGraph } from '../src/lib/map-focus.ts';

const graph = {
  nodes: ['a.ts', 'b.ts', 'c.ts', 'd.ts'].map((id, i) => ({ id, path: id, dir: '', bytes: 20, x: i / 4, y: .5 })),
  edges: [{ from: 'a.ts', to: 'b.ts' }, { from: 'c.ts', to: 'a.ts' }, { from: 'b.ts', to: 'd.ts' }, { from: 'a.ts', to: 'missing.ts' }],
} as RepoGraph;

it('keeps exact coordinates and only actual imports between observed IDs', () => {
  const view = observedGraph(graph, new Set(['a.ts', 'b.ts', 'unresolved.ts']));
  expect(view.nodes.map(node => node.id)).toEqual(['a.ts', 'b.ts']);
  expect(view.nodes[0]).toBe(graph.nodes[0]);
  expect(view.edges).toEqual([graph.edges[0]]);
  expect(graph.nodes).toHaveLength(4);
  expect(graph.edges).toHaveLength(4);
});

it('distinguishes both import directions and excludes unresolved and unrelated locations', () => {
  const view = importConnections(graph, 'a.ts');
  expect(view.root).toBe(graph.nodes[0]);
  expect(view.neighbors.map(item => [item.node.id, item.direction])).toEqual([['b.ts', 'imports'], ['c.ts', 'imported by']]);
  expect(view.total).toBe(2);
  expect(importConnections(graph, 'absent.ts').root).toBeUndefined();
});

it('bounds a dense file view while reporting its complete resolved degree', () => {
  const view = importConnections(graph, 'a.ts', 1);
  expect(view.neighbors).toHaveLength(1);
  expect(view.total).toBe(2);
});
