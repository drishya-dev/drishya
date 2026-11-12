import type {GitCommit} from '../../../daemon/src/git-types.ts';
import {commitRail} from './commit-rail.ts';

export interface NetworkNode {hash: string; x: number; y: number; lane: number; main: boolean}
export interface NetworkEdge {from: string; to: string; lane: number; main: boolean; path: string; squash?: boolean}
export interface NetworkLayout {nodes: NetworkNode[]; edges: NetworkEdge[]; width: number; height: number; lanes: number}

/**
 * UI-8 (Yash, 3 Nov): a plain network graph. Time runs left to right (oldest left), the main line keeps lane 0 at the top,
 * and every other lane sits below it. Lanes come from actual parent IDs (commitRail), never from branch names.
 * Edges between lanes leave the parent straight down (a branch starting) or rise into the child (a merge), with rounded corners.
 */
export function gitNetworkLayout(commits: Pick<GitCommit, 'hash' | 'parents'>[], mainTip = commits[0]?.hash, {step = 44, laneGap = 34, pad = 28, radius = 8, squash}: {step?: number; laneGap?: number; pad?: number; radius?: number; squash?: ReadonlyMap<string, string>} = {}): NetworkLayout {
  const main = new Set<string>(), byHash = new Map(commits.map(commit => [commit.hash, commit]));
  for (let cursor = mainTip; cursor && byHash.has(cursor) && !main.has(cursor);) {main.add(cursor); cursor = byHash.get(cursor)!.parents[0];}
  const rail = commitRail(commits);
  // The lane that carries the main line becomes lane 0; the others keep their order below it.
  const counts = new Map<number, number>();
  rail.rows.forEach((row, index) => {if (main.has(commits[index]!.hash)) counts.set(row.lane, (counts.get(row.lane) ?? 0) + 1);});
  const mainLane = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
  const laneOf = (lane: number) => lane === mainLane ? 0 : lane < mainLane ? lane + 1 : lane;
  const count = commits.length;
  // Every main-line commit sits on lane 0, wherever the rail first met it; anything else the rail put there gets a lane of its own.
  const spare = Math.max(1, rail.lanes);
  const laneAt = (index: number) => main.has(commits[index]!.hash) ? 0 : rail.rows[index]!.lane === mainLane ? spare : laneOf(rail.rows[index]!.lane);
  const lanes = Math.max(1, ...commits.map((_, index) => laneAt(index) + 1));
  const width = pad * 2 + Math.max(0, count - 1) * step, height = pad * 2 + (lanes - 1) * laneGap;
  const nodes = commits.map((commit, index) => {
    const lane = laneAt(index);
    return {hash: commit.hash, x: pad + (count - 1 - index) * step, y: pad + lane * laneGap, lane, main: main.has(commit.hash)};
  });
  const at = new Map(nodes.map(node => [node.hash, node]));
  const edges: NetworkEdge[] = [];
  for (const commit of commits) for (const parent of commit.parents) {
    const from = at.get(parent), to = at.get(commit.hash);
    if (!from || !to) continue;
    let path: string;
    if (from.y === to.y) path = `M${from.x},${from.y} H${to.x}`;
    else {
      const r = Math.min(radius, Math.abs(to.y - from.y) / 2, Math.abs(to.x - from.x) / 2), down = to.y > from.y ? 1 : -1;
      // Moving away from the main line: turn at the parent. Returning towards it: turn at the child.
      path = to.lane > from.lane
        ? `M${from.x},${from.y} V${to.y - down * r} Q${from.x},${to.y} ${from.x + r},${to.y} H${to.x}`
        : `M${from.x},${from.y} H${to.x - r} Q${to.x},${from.y} ${to.x},${from.y + down * r} V${to.y}`;
    }
    edges.push({from: parent, to: commit.hash, lane: Math.max(from.lane, to.lane), main: from.main && to.main, path});
  }
  if (squash) {
    for (const [head, target] of squash) {
      const from = at.get(head), to = at.get(target);
      if (!from || !to || from.hash === to.hash) continue;
      let path: string;
      if (from.y === to.y) path = `M${from.x},${from.y} H${to.x}`;
      else if (to.x >= from.x) {
        const r = Math.min(radius, Math.abs(to.y - from.y) / 2, Math.abs(to.x - from.x) / 2), down = to.y > from.y ? 1 : -1;
        path = to.lane > from.lane
          ? `M${from.x},${from.y} V${to.y - down * r} Q${from.x},${to.y} ${from.x + r},${to.y} H${to.x}`
          : `M${from.x},${from.y} H${to.x - r} Q${to.x},${from.y} ${to.x},${from.y + down * r} V${to.y}`;
      } else {
        const midX = (from.x + to.x) / 2;
        path = `M${from.x},${from.y} C${midX},${from.y} ${midX},${to.y} ${to.x},${to.y}`;
      }
      edges.push({from: from.hash, to: to.hash, lane: Math.max(from.lane, to.lane), main: false, path, squash: true});
    }
  }
  return {nodes, edges, width, height, lanes};
}
