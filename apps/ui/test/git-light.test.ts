import { describe, expect, it } from 'vitest';
import { gitThreadLayout } from '../src/lib/git-thread-layout.ts';
import { branchAt, branchWidth, gitLight, lightLayout, riverWidth } from '../src/lib/git-light.ts';

// main: base → m1 → merge → m3; feature (2 commits) forks at base and merges; spike (3 commits) forks at m1, unmerged;
// nested (1 commit) leaves spike's second commit.
const commits = [
  { hash: 'm3', parents: ['merge'] }, { hash: 's3', parents: ['s2'] }, { hash: 'n1', parents: ['s2'] }, { hash: 's2', parents: ['s1'] },
  { hash: 's1', parents: ['m1'] }, { hash: 'merge', parents: ['m1', 'f2'] }, { hash: 'f2', parents: ['f1'] }, { hash: 'm1', parents: ['base'] },
  { hash: 'f1', parents: ['base'] }, { hash: 'base', parents: [] },
];
const graph = gitThreadLayout(commits, 'm3');
const view = (scale: number, layout = lightLayout(graph, scale)) => ({ scale, ox: 24, oy: 24, width: graph.width * scale + 48, height: layout.height * scale + 48 });

describe('Sacred Timeline light (GIT-1)', () => {
  it('keeps time order and topology: x unchanged, runs found from first parents, merges and forks from Git', () => {
    const layout = lightLayout(graph, .6);
    expect(layout.nodes.map((node) => [node.hash, node.x, node.primary])).toEqual(graph.nodes.map((node) => [node.hash, node.x, node.primary]));
    const run = (hash: string) => layout.branchOf.get(hash)!;
    expect(run('f2').members).toEqual(['f1', 'f2']);
    expect([run('f1').fork, run('f1').merge]).toEqual(['base', 'merge']);
    expect(run('s1').members.length).toBeGreaterThanOrEqual(2);
    expect(run('s1').merge).toBeUndefined();
    expect(run('n1').fork).toBe('s2');
    expect([...layout.ordinal.entries()].filter(([h]) => h.startsWith('f'))).toEqual([['f1', 1], ['f2', 2]]);
  });

  it('keeps every branch clear of the river at any zoom, with a nested branch outside the one it left', () => {
    for (const scale of [.08, .24, .6, 1.5]) {
      const layout = lightLayout(graph, scale), main = layout.nodes.filter((n) => n.primary).sort((a, b) => a.x - b.x);
      // The river meanders, so measure from it where the branch commit is, interpolated between primary commits.
      const river = (x: number) => { const i = Math.max(0, main.findLastIndex((n) => n.x <= x)), a = main[i]!, b = main[Math.min(main.length - 1, i + 1)]!; return a.x === b.x ? a.y : a.y + (b.y - a.y) * Math.min(1, Math.max(0, (x - a.x) / (b.x - a.x))); };
      for (const node of layout.nodes.filter((n) => !n.primary)) expect(Math.abs(node.y - river(node.x)) * scale).toBeGreaterThan(riverWidth(scale) * .5);
      const nested = layout.branchOf.get('n1')!, parent = layout.branchOf.get('s2')!;
      expect(nested.side).toBe(parent.side);
      expect(nested.tier).toBeGreaterThan(parent.tier);
    }
  });

  it('is seeded, not arranged: the same graph places the same way every time', () => {
    expect(lightLayout(graph, .6).nodes).toEqual(lightLayout(graph, .6).nodes);
  });

  it('thickens a branch with each commit, never past half the river', () => {
    const w = riverWidth(.6);
    expect(branchWidth(w, 2)).toBeGreaterThan(branchWidth(w, 1));
    expect(branchWidth(w, 50)).toBe(w / 2);
  });

  it('stays inside the segment budget, lower in low-resource mode', () => {
    const layout = lightLayout(graph, .6);
    const full = gitLight(graph, layout, view(.6, layout), { heads: new Set(['s3']) });
    const lite = gitLight(graph, layout, view(.6, layout), { heads: new Set(['s3']), lowResource: true });
    expect(full.segments).toBeGreaterThan(1000);
    expect(full.segments).toBeLessThanOrEqual(48000);
    expect(lite.segments).toBeLessThanOrEqual(10000);
  });

  it('adds forward-only lightning at a named branch head, never on the primary line', () => {
    const layout = lightLayout(graph, .6), v = view(.6, layout);
    const plain = gitLight(graph, layout, v).segments, built = gitLight(graph, layout, v, { heads: new Set(['s3']) });
    expect(built.segments).toBeGreaterThan(plain);
    expect(gitLight(graph, layout, v, { heads: new Set(['m3']) }).segments).toBe(plain);
    const x0 = v.ox + layout.byHash.get('s3')!.x * .6;
    for (let i = plain * 12; i < built.lines.length; i += 6) expect(built.lines[i]!).toBeGreaterThanOrEqual(x0 - 8);
  });

  it('finds the branch under a point on its strand, and nothing in empty space', () => {
    const layout = lightLayout(graph, .6), v = view(.6, layout), f1 = layout.byHash.get('f1')!, f2 = layout.byHash.get('f2')!;
    const mid = [v.ox + (f1.x + f2.x) / 2 * .6, v.oy + (f1.y + f2.y) / 2 * .6] as const;
    expect(branchAt(layout, v, mid[0], mid[1])?.key).toBe(layout.branchOf.get('f1')!.key);
    expect(branchAt(layout, v, mid[0], mid[1] + 400)).toBeUndefined();
  });

  it('draws only what is in view', () => {
    const layout = lightLayout(graph, .6);
    expect(gitLight(graph, layout, { ...view(.6, layout), ox: -100000 }).segments).toBe(0);
  });
});
