import { describe, expect, it } from 'vitest';
import { gitThreadLayout } from '../src/lib/git-thread-layout.ts';
import { gitLight, lightNodes, riverWidth } from '../src/lib/git-light.ts';

// main: base → m1 → merge → m3; feature (2 commits) forks at base and merges; spike (1 commit) forks at m1, unmerged.
const commits = [
  { hash: 'm3', parents: ['merge'] }, { hash: 'spike', parents: ['m1'] }, { hash: 'merge', parents: ['m1', 'f2'] },
  { hash: 'f2', parents: ['f1'] }, { hash: 'm1', parents: ['base'] }, { hash: 'f1', parents: ['base'] }, { hash: 'base', parents: [] },
];
const graph = gitThreadLayout(commits, 'm3');
const view = (scale: number) => ({ scale, ox: 24, oy: 24, width: graph.width * scale + 48, height: graph.height * scale + 48 });

describe('Sacred Timeline light (GIT-1)', () => {
  it('keeps topology and order: x and sides unchanged, branches clear of the river at any zoom', () => {
    for (const scale of [.08, .24, .6, 1.5]) {
      const placed = lightNodes(graph, scale);
      expect(placed.map((node) => [node.hash, node.x, node.primary])).toEqual(graph.nodes.map((node) => [node.hash, node.x, node.primary]));
      for (const node of placed.filter((n) => !n.primary)) {
        const before = graph.nodes.find((n) => n.hash === node.hash)!, river = graph.nodes.filter((n) => n.primary);
        const nearest = river.reduce((a, b) => Math.abs(b.x - node.x) < Math.abs(a.x - node.x) ? b : a);
        expect(Math.sign(node.y - nearest.y)).toBe(Math.sign(before.y - nearest.y) || 1);
        // Measured against the nearest commit rather than the interpolated river line, so allow a little slack.
        expect(Math.abs(node.y - nearest.y) * scale).toBeGreaterThanOrEqual((riverWidth(scale) * .7 + 14) * .9);
      }
    }
  });

  it('stays inside the segment budget, lower in low-resource mode', () => {
    const full = gitLight(graph, view(.6), { heads: new Set(['spike']) });
    const lite = gitLight(graph, view(.6), { heads: new Set(['spike']), lowResource: true });
    expect(full.segments).toBeGreaterThan(1000);
    expect(full.segments).toBeLessThanOrEqual(48000);
    expect(lite.segments).toBeLessThanOrEqual(10000);
    expect(lite.segments).toBeLessThan(full.segments);
  });

  it('adds lightning only at a named branch head, never on the primary line', () => {
    const plain = gitLight(graph, view(.6)).segments;
    expect(gitLight(graph, view(.6), { heads: new Set(['spike']) }).segments).toBeGreaterThan(plain);
    expect(gitLight(graph, view(.6), { heads: new Set(['m3']) }).segments).toBe(plain);
  });

  it('opens lightning forward only, so a head never reads as flowing right to left', () => {
    const plain = gitLight(graph, view(.6)).segments, built = gitLight(graph, view(.6), { heads: new Set(['spike']) });
    const head = lightNodes(graph, .6).find((node) => node.hash === 'spike')!, x0 = 24 + head.x * .6;
    for (let i = plain * 12; i < built.lines.length; i += 6) expect(built.lines[i]!).toBeGreaterThanOrEqual(x0 - 6);
  });

  it('draws only what is in view and is deterministic', () => {
    const away = gitLight(graph, { ...view(.6), ox: -100000 });
    expect(away.segments).toBe(0);
    expect([...gitLight(graph, view(.6)).lines.slice(0, 64)]).toEqual([...gitLight(graph, view(.6)).lines.slice(0, 64)]);
  });
});
