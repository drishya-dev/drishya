import { describe, expect, it } from 'vitest';
import type { RepoGraph } from '@drishya/contracts';
import { importConnections, neighborhoodGraph, observedGraph } from '../src/lib/map-focus.ts';

const graph = { temporal: 'current', nodes: Array.from({ length: 100 }, (_, n) => ({ id: `f${n}`, path: `f${n}`, x: n / 100, y: .5 })), edges: Array.from({ length: 99 }, (_, n) => ({ from: 'f0', to: `f${n + 1}`, relation: 'static-import', basis: 'deterministic-rule' })) } as RepoGraph;
const small = { temporal: 'current', nodes: ['a.ts', 'b.ts', 'c.ts', 'd.ts'].map((id, i) => ({ id, path: id, dir: '', bytes: 20, x: i / 4, y: .5 })), edges: [{ from: 'a.ts', to: 'b.ts' }, { from: 'c.ts', to: 'a.ts' }, { from: 'b.ts', to: 'd.ts' }, { from: 'a.ts', to: 'missing.ts' }].map(edge => ({ ...edge, relation: 'static-import', basis: 'deterministic-rule', specifier: '' })) } as RepoGraph;
describe('bounded file neighborhood', () => {
  it('keeps exact coordinates and only actual imports between observed IDs', () => {
    const view = observedGraph(small, new Set(['a.ts', 'b.ts', 'unresolved.ts']));
    expect(view.nodes.map(node => node.id)).toEqual(['a.ts', 'b.ts']);
    expect(view.nodes[0]).toBe(small.nodes[0]);
    expect(view.edges).toEqual([small.edges[0]]);
    expect(small.nodes).toHaveLength(4);
    expect(small.edges).toHaveLength(4);
  });
  it('distinguishes both import directions and excludes unresolved locations', () => {
    const view = importConnections(small, 'a.ts');
    expect(view.root).toBe(small.nodes[0]);
    expect(view.neighbors.map(item => [item.node.id, item.direction])).toEqual([['b.ts', 'imports'], ['c.ts', 'imported by']]);
    expect(view.total).toBe(2);
    expect(importConnections(small, 'absent.ts').root).toBeUndefined();
  });
  it('bounds a dense file view while reporting its complete resolved degree', () => {
    const view = importConnections(small, 'a.ts', 1);
    expect(view.neighbors).toHaveLength(1);
    expect(view.total).toBe(2);
  });
  it('retains actual coordinates and limits high-degree neighborhoods with a truthful total', () => {
    expect(importConnections(graph, 'f0').total).toBe(99);
    const focused = neighborhoodGraph(graph, 'f0');
    expect(focused.nodes).toHaveLength(65);
    expect(focused.edges).toHaveLength(64);
    expect(focused.nodes[5]).toBe(graph.nodes[5]);
  });
  it('does not invent edges for missing files or a captured-files-only map', () => {
    expect(neighborhoodGraph(graph, 'absent').nodes).toEqual([]);
    const files = neighborhoodGraph({ ...graph, temporal: 'recording-files-only' }, 'f0');
    expect(files.nodes).toHaveLength(1);
    expect(files.edges).toEqual([]);
  });
});
