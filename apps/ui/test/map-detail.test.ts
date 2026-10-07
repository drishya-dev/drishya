import { expect, it } from 'vitest';
import { mapDetail } from '../src/lib/map-detail.ts';
import type { RepoGraph } from '@drishya/contracts';
const graph = { temporal: 'current', nodes: Array.from({ length: 240 }, (_, i) => ({ id: `pkg${i % 3}/src/f${i}.ts`, path: `pkg${i % 3}/src/f${i}.ts`, dir: `pkg${i % 3}/src`, x: (i % 20) / 20, y: Math.floor(i / 20) / 12 })), edges: [] } as unknown as RepoGraph;
graph.edges = [{ from: graph.nodes[0]!.id, to: graph.nodes[1]!.id, kind: 'import', specifier: './f1' } as RepoGraph['edges'][number], { from: graph.nodes[3]!.id, to: graph.nodes[4]!.id, kind: 'import', specifier: './f4' } as RepoGraph['edges'][number]];
it('aggregates actual folder memberships and imports then reveals original files on zoom', () => {
  const overview = mapDetail(graph, 1);
  expect(overview.nodes).toHaveLength(3);
  expect(overview.nodes.every(n => n.members?.length === 80)).toBe(true);
  expect(overview.edges).toEqual([{ from: 'pkg0', to: 'pkg1', count: 2 }]);
  const zoomed = mapDetail(graph, 6);
  expect(zoomed.nodes.map(n => n.id)).toEqual(graph.nodes.map(n => n.id));
  expect(zoomed.nodes.every(n => !n.members)).toBe(true);
  expect(zoomed.edges).toHaveLength(2);
});
it('excludes current private local caches without hiding recorded file evidence', () => {
  const cache = { ...graph.nodes[0]!, id: '.local/private.ts', path: '.local/private.ts' };
  expect(mapDetail({ ...graph, nodes: [...graph.nodes, cache] }, 6).nodes.some(n => n.id === cache.id)).toBe(false);
  expect(mapDetail({ ...graph, temporal: 'recorded' as RepoGraph['temporal'], nodes: [...graph.nodes, cache] }, 6).nodes.some(n => n.id === cache.id)).toBe(true);
});
