import { expect, it } from 'vitest';
import { mapDetail } from '../src/lib/map-detail.ts';
import type { RepoGraph } from '@drishya/contracts';
const graph = { temporal: 'current', nodes: Array.from({ length: 240 }, (_, i) => ({ id: `pkg${i % 3}/src/f${i}.ts`, path: `pkg${i % 3}/src/f${i}.ts`, dir: `pkg${i % 3}/src`, x: (i % 20) / 20, y: Math.floor(i / 20) / 12 })), edges: [] } as unknown as RepoGraph;
graph.edges = [{ from: graph.nodes[0]!.id, to: graph.nodes[1]!.id, kind: 'import', specifier: './f1' } as RepoGraph['edges'][number], { from: graph.nodes[3]!.id, to: graph.nodes[4]!.id, kind: 'import', specifier: './f4' } as RepoGraph['edges'][number]];
it('groups spatial density across directories, preserving actual imports and zoom detail', () => {
  const overview = mapDetail(graph, 1);
  expect(overview.nodes.length).toBeLessThan(40);
  expect(overview.nodes.flatMap(n => n.members ?? [n.id]).sort()).toEqual(graph.nodes.map(n => n.id).sort());
  expect(overview.nodes.some(n => n.path === 'Mixed files')).toBe(true);
  expect(mapDetail(graph, 3).nodes.length).toBeGreaterThan(overview.nodes.length);
  expect(mapDetail(graph, 1)).toEqual(overview);
  const zoomed = mapDetail(graph, 6);
  expect(zoomed.nodes.map(n => n.id)).toEqual(graph.nodes.map(n => n.id));
  expect(zoomed.nodes.every(n => !n.members)).toBe(true);
  expect(zoomed.edges).toHaveLength(2);
});
it('keeps root configuration files individually identifiable', () => {
  const config = { ...graph.nodes[0]!, id: '.gitignore', path: '.gitignore' };
  expect(mapDetail({ ...graph, nodes: [...graph.nodes, config] }, 1).nodes.find(n => n.id === config.id)?.members).toBeUndefined();
});
it('excludes current private local caches without hiding recorded file evidence', () => {
  const cache = { ...graph.nodes[0]!, id: '.local/private.ts', path: '.local/private.ts' };
  expect(mapDetail({ ...graph, nodes: [...graph.nodes, cache] }, 6).nodes.some(n => n.id === cache.id)).toBe(false);
  expect(mapDetail({ ...graph, temporal: 'recorded' as RepoGraph['temporal'], nodes: [...graph.nodes, cache] }, 6).nodes.some(n => n.id === cache.id)).toBe(true);
});
