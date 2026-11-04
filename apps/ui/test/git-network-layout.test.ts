import {expect, it} from 'vitest';
import {gitNetworkLayout} from '../src/lib/git-network-layout.ts';

// Newest first, as Git history pages arrive: main m1..m4, a branch b1..b2 that left m1 and merged back at m4.
const commits = [
  {hash: 'm4', parents: ['m3', 'b2']},
  {hash: 'b2', parents: ['b1']},
  {hash: 'm3', parents: ['m2']},
  {hash: 'b1', parents: ['m1']},
  {hash: 'm2', parents: ['m1']},
  {hash: 'm1', parents: []},
];

it('runs time left to right with main on the top lane and the branch below it', () => {
  const layout = gitNetworkLayout(commits, 'm4', {step: 10, laneGap: 20, pad: 0});
  const at = new Map(layout.nodes.map(node => [node.hash, node]));
  expect(at.get('m1')!.x).toBeLessThan(at.get('m4')!.x);
  for (const hash of ['m1', 'm2', 'm3', 'm4']) {expect(at.get(hash)!.lane).toBe(0); expect(at.get(hash)!.main).toBe(true);}
  for (const hash of ['b1', 'b2']) {expect(at.get(hash)!.lane).toBeGreaterThan(0); expect(at.get(hash)!.main).toBe(false);}
  expect(layout.width).toBe(50);
});

it('draws only real parent links: a straight line on a lane, a corner where a branch leaves or rejoins', () => {
  const layout = gitNetworkLayout(commits, 'm4', {step: 10, laneGap: 20, pad: 0});
  expect(layout.edges).toHaveLength(6);
  const edge = (from: string, to: string) => layout.edges.find(item => item.from === from && item.to === to)!;
  expect(edge('m2', 'm3').path).toMatch(/^M\d+,\d+ H\d+$/);
  expect(edge('m2', 'm3').main).toBe(true);
  // Leaving main turns at the parent (vertical first); rejoining turns at the child (horizontal first).
  expect(edge('m1', 'b1').path).toMatch(/^M0,0 V/);
  expect(edge('b2', 'm4').path).toMatch(/ H\d+ Q/);
  expect(gitNetworkLayout([], undefined).nodes).toHaveLength(0);
});
