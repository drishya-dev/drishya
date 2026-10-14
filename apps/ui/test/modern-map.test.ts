import { describe, it, expect } from 'vitest';
import { mapPoints, groupMap } from '../src/modern/map-layout';
import type { GraphNode, GraphEdge } from '@drishya/contracts';
const file = (path: string, x: number, y: number): GraphNode => ({ id: path, path, dir: '', bytes: 0, x, y });
const edge = (from: string, to: string): GraphEdge => ({ from, to, relation: 'static-import', basis: 'deterministic-rule', specifier: to });

describe('Modern repository density', () => {
  it('separates coincident coordinates deterministically without changing file identity', () => {
    const nodes = Array.from({ length: 200 }, (_, i) => file(`${i}.ts`, 0, 0));
    const points = mapPoints(nodes);
    expect(points).toEqual(mapPoints(nodes));
    expect(new Set(points.map(p => `${p.x}:${p.y}`)).size).toBe(200);
    expect(points.map(p => p.node)).toEqual(nodes);
  });
  it('reveals density with zoom, preserving memberships and only actual import links', () => {
    const nodes = [file('a', 100, 100), file('b', 102, 101), file('c', 200, 200)];
    const points = nodes.map(node => ({ node, x: node.x, y: node.y }));
    const grouped = groupMap(points, [edge('a', 'c'), edge('b', 'c'), edge('a', 'missing')], 1, { x: 0, y: 0 }, 500, 500);
    expect(grouped.groups.map(g => g.members.length).sort()).toEqual([1, 2]);
    expect(grouped.links).toHaveLength(1); expect(grouped.links[0]!.count).toBe(2);
    const closer = groupMap(points, [], 20, { x: -1950, y: -1950 }, 500, 500);
    expect(closer.groups).toHaveLength(2);
    expect(closer.groups.flatMap(g => g.members.map(m => m.node.path))).toEqual(['a', 'b']);
    expect(closer.links).toEqual([]);
  });
  it('bounds nodes and excludes offscreen points without synthesizing links', () => {
    expect(mapPoints(Array.from({ length: 6000 }, (_, i) => file(String(i), i, i)))).toHaveLength(5000);
    const points = mapPoints([file('a', 0, 0), file('b', 1, 1)]);
    expect(groupMap(points, [edge('a', 'b')], 1, { x: 9000, y: 9000 }, 300, 300).groups).toEqual([]);
  });
});
