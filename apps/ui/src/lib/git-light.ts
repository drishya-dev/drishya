import type { gitThreadLayout } from './git-thread-layout.ts';

/**
 * Sacred Timeline light (GIT-1, review 124): every real parent edge in view becomes a bundle of hair-fine filaments in
 * screen space, for the light renderer. Topology and time order are the layout's, unchanged: no invented branches, and
 * x is still oldest → newest. Only the vertical placement is presentation: which side a branch takes, how far out and
 * how it drifts are seeded per branch, so the picture is stable but not a grid. Lightning splits only at a branch head
 * that a ref points at, opens forward and fades, so it never reads as more history.
 */
type Graph = ReturnType<typeof gitThreadLayout>;
type LayoutNode = Graph['nodes'][number];
export interface LightView { scale: number; ox: number; oy: number; width: number; height: number }
export interface LightOptions {
  /** Commits whose strands brighten while one or a branch is hovered or focused; the rest dim. */
  focus?: ReadonlySet<string>;
  focusMix?: number;
  /** Branch heads with a ref and no loaded child: the only places lightning appears. */
  heads?: ReadonlySet<string>;
  selected?: string;
  lowResource?: boolean;
  /** Fixes the starfield to the repository. */
  seed?: number;
  /** Older history exists beyond the loaded window, so the river fades in from the left rather than starting. */
  olderBeyond?: boolean;
}
/** One run of non-primary commits: from the commit it left (fork) to the primary commit it was merged into, if any. */
export interface LightBranch {
  key: string; members: string[]; fork?: string; merge?: string; head: string; side: number; tier: number;
  /** The merge is a squash: no parent link in Git, but that primary commit wrote exactly this branch's file contents. */
  squash?: boolean;
}
export interface LightLayout {
  nodes: LayoutNode[];
  byHash: Map<string, LayoutNode>;
  branches: LightBranch[];
  branchOf: Map<string, LightBranch>;
  /** 1 for a branch's first commit, 2 for its second…: the strand thickens with each. */
  ordinal: Map<string, number>;
  /** World height that holds every placed commit, with the river on its middle line. */
  height: number;
  scale: number;
  mainW: number;
}

const PALETTE = ['#ff3fcf', '#a24dff', '#5a6bff', '#2fd9ff', '#f2fbff', '#2fd9ff', '#7a50ff', '#ff4fc8'].map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number]);
const BRAID = .4, HAIR = .045, TWIST = 1.4;

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const lattice = (() => { const r = rng(7), a = new Float32Array(1024); for (let i = 0; i < a.length; i++) a[i] = r() * 2 - 1; return a; })();
function noise(x: number) { const i = Math.floor(x), f = x - i, s = f * f * (3 - 2 * f); return lattice[i & 1023]! * (1 - s) + lattice[(i + 1) & 1023]! * s; }
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const hashSeed = (text: string) => Array.from(text).reduce((a, ch) => Math.imul(a, 31) + ch.charCodeAt(0) | 0, 7);
function colour(t: number) {
  t = clamp(t, 0, 1) * (PALETTE.length - 1);
  const i = Math.min(PALETTE.length - 2, Math.floor(t)), f = t - i, a = PALETTE[i]!, b = PALETTE[i + 1]!;
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f] as const;
}

/** Main-strand width in CSS pixels for a zoom: wide enough to read as a river, never wider than ~46 px. */
export const riverWidth = (scale: number) => clamp(56 * scale, 14, 120);
/** A branch starts thin and gains width with every commit, never more than half the river. */
export const branchWidth = (mainW: number, ordinal: number) => Math.min(mainW * .5, mainW * (.1 + .065 * ordinal));

/**
 * Places commits for the light. x is the layout's (time order). The river meanders gently; each branch takes a seeded
 * side, the nearest free tier on it (so branches that overlap in time never collide), a seeded extra distance and a slow
 * drift along its length. Distances are screen pixels at this zoom, so a branch never sinks into the river when zoomed out.
 */
export function lightLayout(graph: Graph, scale: number, squash: ReadonlyMap<string, string> = new Map()): LightLayout {
  const mainW = riverWidth(scale);
  const nodes0 = new Map(graph.nodes.map((node) => [node.hash, node]));
  const firstParent = new Map<string, string>(), children = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (!firstParent.has(edge.to)) firstParent.set(edge.to, edge.from);
    children.set(edge.from, [...children.get(edge.from) ?? [], edge.to]);
  }
  // Group non-primary commits into runs: walk first parents until the primary line, a fork shared by several children, or
  // the edge of the loaded window.
  const keyOf = new Map<string, string>();
  for (const node of graph.nodes) {
    if (node.primary) continue;
    let key = node.hash;
    const seen = new Set<string>();
    while (!seen.has(key)) {
      seen.add(key);
      const parent = firstParent.get(key);
      if (!parent || nodes0.get(parent)?.primary !== false || (children.get(parent)?.length ?? 0) > 1) break;
      key = parent;
    }
    keyOf.set(node.hash, key);
  }
  const runs = new Map<string, LayoutNode[]>();
  for (const [hash, key] of keyOf) runs.set(key, [...runs.get(key) ?? [], nodes0.get(hash)!]);
  const branches: LightBranch[] = [...runs.entries()].map(([key, members]) => {
    members.sort((a, b) => a.x - b.x);
    const last = members.at(-1)!;
    const merge = (children.get(last.hash) ?? []).find((child) => nodes0.get(child)?.primary);
    const into = squash.get(last.hash), squashed = !merge && !children.has(last.hash) && into && nodes0.get(into)?.primary ? into : undefined;
    return { key, members: members.map((m) => m.hash), fork: firstParent.get(key), merge: merge ?? squashed, head: last.hash, side: 1, tier: 0, squash: !!squashed };
  }).sort((a, b) => nodes0.get(a.members[0]!)!.x - nodes0.get(b.members[0]!)!.x);
  const branchOf = new Map<string, LightBranch>(), ordinal = new Map<string, number>();
  for (const branch of branches) branch.members.forEach((hash, i) => { branchOf.set(hash, branch); ordinal.set(hash, i + 1); });

  // Tiers: per side, the intervals (in world x) already taken. A nested branch goes outside the branch it left.
  const taken: Record<string, [number, number][][]> = { '-1': [], '1': [] };
  const pad = 30 / scale;
  const freeTier = (side: number, from: number, to: number, min: number) => {
    const tiers = taken[String(side)]!;
    for (let t = min; ; t++) if (!(tiers[t] ?? []).some(([a, b]) => from < b + pad && to > a - pad)) return t;
  };
  for (const branch of branches) {
    const xs = branch.members.map((h) => nodes0.get(h)!.x);
    const from = branch.fork && nodes0.has(branch.fork) ? nodes0.get(branch.fork)!.x : xs[0]!;
    const to = branch.merge ? nodes0.get(branch.merge)!.x : xs.at(-1)! + 90 / scale;
    const parent = branch.fork ? branchOf.get(branch.fork) : undefined;
    const r = rng(hashSeed(branch.key));
    let side = parent ? parent.side : r() < .5 ? -1 : 1;
    const min = parent ? parent.tier + 1 : 0;
    // Prefer the seeded side, but take the other when it is clearly emptier, so the river is not lopsided.
    if (!parent && freeTier(side, from, to, 0) > freeTier(-side, from, to, 0) + 1) side = -side;
    const tier = freeTier(side, from, to, min);
    (taken[String(side)]![tier] ??= []).push([from, to]);
    branch.side = side; branch.tier = tier;
  }

  const riverY = (x: number) => (22 * noise(x / 1900 + 3.1) + 9 * noise(x / 640 + 7.7)) / scale;
  let reach = 0;
  const offsets = new Map<string, number>();
  // A strand sits just outside the river's rim (or outside the strands already on that side), so it peels off at a
  // shallow angle within one commit's spacing instead of climbing a step.
  const lane = mainW * .32 + 8;
  for (const branch of branches) {
    const r = rng(hashSeed(branch.key) ^ 0x5bd1e995), extra = r() * 7, phase = r() * 100;
    for (const hash of branch.members) {
      const x = nodes0.get(hash)!.x;
      const px = mainW * .5 + 7 + branch.tier * lane + extra + 3 * noise(x * scale / 220 + phase);
      offsets.set(hash, branch.side * px / scale);
      reach = Math.max(reach, px + 40);
    }
  }
  const height = Math.max(graph.height, (reach * 2 + 60) / scale), middle = height / 2;
  const nodes = graph.nodes.map((node) => ({ ...node, y: middle + riverY(node.x) + (node.primary ? 0 : offsets.get(node.hash) ?? 0) }));
  return { nodes, byHash: new Map(nodes.map((node) => [node.hash, node])), branches, branchOf, ordinal, height, scale, mainW };
}

export function gitLight(graph: Graph, layout: LightLayout, view: LightView, options: LightOptions = {}) {
  const { scale, ox, oy, width: W, height: H } = view;
  const { byHash: nodes, mainW, branchOf, ordinal } = layout;
  const sx = (x: number) => ox + x * scale, sy = (y: number) => oy + y * scale;
  const lines: number[] = [], points: number[] = [];
  const budget = options.lowResource ? 8000 : 40000;

  // Only edges that cross the view, with a sample every ~6 px of screen length.
  // Squash merges join the drawing as edges from the branch head into the primary commit that wrote its contents.
  const squashEdges = layout.branches.filter((branch) => branch.squash && branch.merge).map((branch) => ({ ...graph.edges[0]!, from: branch.head, to: branch.merge!, primary: false, lane: 0, width: 2 }));
  const edges = [...graph.edges, ...squashEdges].flatMap((edge) => {
    const a = nodes.get(edge.from), b = nodes.get(edge.to);
    if (!a || !b) return [];
    const ax = sx(a.x), bx = sx(b.x), ay = sy(a.y), by = sy(b.y);
    if (Math.max(ax, bx) < -160 || Math.min(ax, bx) > W + 160 || Math.max(ay, by) < -200 || Math.min(ay, by) > H + 200) return [];
    const samples = Math.max(3, Math.min(160, Math.ceil(Math.hypot(bx - ax, by - ay) / 6)));
    // Width at each end: the river; or the branch's width before and after this commit, so it thickens commit by commit.
    const into = a.primary && b.primary ? undefined : b.primary ? a.hash : b.hash;
    const w1 = into ? branchWidth(mainW, ordinal.get(into) ?? 1) : mainW;
    const w0 = into && !b.primary ? (a.primary || branchOf.get(a.hash) !== branchOf.get(b.hash) ? w1 * .35 : branchWidth(mainW, (ordinal.get(a.hash) ?? 0))) : w1;
    return [{ edge, a, b, ax, ay, bx, by, samples, w0, w1 }];
  });
  const mainSamples = edges.reduce((n, e) => n + (e.a.primary && e.b.primary ? e.samples : 0), 0);
  const mainCount = clamp(Math.floor(budget * .55 / Math.max(1, mainSamples)), 12, options.lowResource ? 120 : 380);
  const density = mainCount / mainW;
  const branchWanted = edges.reduce((n, e) => n + (e.a.primary && e.b.primary ? 0 : e.samples * density * .75 * e.w1), 0);
  const branchFactor = Math.min(1, budget * .3 / Math.max(1, branchWanted));

  const push = (ax: number, ay: number, bx: number, by: number, c: readonly number[], alpha: number) => { lines.push(ax, ay, c[0]!, c[1]!, c[2]!, alpha, bx, by, c[0]!, c[1]!, c[2]!, alpha); };
  const focusFactor = (from: string, to: string) => {
    if (!options.focus || !options.focusMix) return 1;
    const k = options.focus.has(from) && options.focus.has(to) ? 1.7 : .45;
    return 1 + (k - 1) * options.focusMix;
  };

  /**
   * One bundle along a sampled centre line. Each filament's lane, seeds and noise come from the bundle key and its index,
   * and noise runs along world-anchored x, so consecutive edges of one strand join without a seam. Filaments from
   * `entering` on are new at this commit and fade in, which is how a strand visibly gains width.
   */
  function bundle(centre: [number, number][], widths: number[], fades: number[], count: number, key: number, gain: number, entering = count) {
    const n = centre.length;
    const normals = centre.map((_, i) => {
      const a = centre[Math.max(0, i - 1)]!, b = centre[Math.min(n - 1, i + 1)]!, dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      return [-dy / l, dx / l] as const;
    });
    for (let f = 0; f < count; f++) {
      const r = rng(key * 7919 + f * 104729);
      // Most lanes sit inside the band, denser at the centre for a white-hot core; a few fray past the edge, and a few
      // lead strands are brighter, so single filaments stay visible inside the light.
      const q = r() * 2 - 1, fray = r() < .12, u = Math.sign(q) * Math.pow(Math.abs(q), 1.2) * (fray ? .95 : .5);
      const s1 = r() * 900, s2 = r() * 900, period = 90 + r() * 140, phase = r() * 6.28;
      const lead = r() < .07 ? 3 : 1;
      const alpha = (.04 + .06 * r()) * (1 + 1.2 * (1 - Math.abs(u) * 2) ** 2) * (fray ? .45 : 1) * lead * gain;
      let px = 0, py = 0;
      for (let i = 0; i < n; i++) {
        const [cx, cy] = centre[i]!, [nx, ny] = normals[i]!, X = cx - ox;
        const off = widths[i]! * (u + BRAID * noise(X / period + s1) + HAIR * noise(X / 9 + s2));
        const x = cx + nx * off, y = cy + ny * off;
        if (i > 0) {
          const z = Math.sin(X / (240 / TWIST) + u * 5 + phase);
          const born = f >= entering ? smooth(0, .45, i / (n - 1)) : 1;
          push(px, py, x, y, colour(u + .5 + .08 * Math.sin(X / 300 + phase)), alpha * (.7 + .3 * z) * fades[i]! * born);
        }
        px = x; py = y;
      }
    }
  }

  // The river does not stop dead: it fades out a little past the newest primary commit, and fades in from the left when
  // older history exists beyond the loaded window.
  const primary = layout.nodes.filter((node) => node.primary).sort((a, b) => a.x - b.x);
  if (primary.length) {
    const tail = (from: LayoutNode, dir: number, fadeIn: boolean) => {
      const x0 = sx(from.x), y0 = sy(from.y), length = 70, lo = Math.min(x0, x0 + dir * length), hi = Math.max(x0, x0 + dir * length);
      if (hi < -40 || lo > W + 40) return;
      const centre: [number, number][] = [], widths: number[] = [], fades: number[] = [];
      for (let i = 0; i <= 12; i++) { const t = i / 12, x = dir > 0 ? x0 + t * length : x0 - length + t * length; centre.push([x, y0]); widths.push(mainW * (fadeIn ? .7 + .3 * t : 1 - .3 * t)); fades.push(fadeIn ? smooth(0, 1, t) : smooth(1, 0, t)); }
      bundle(centre, widths, fades, mainCount, 1, focusFactor('', ''));
    };
    tail(primary.at(-1)!, 1, false);
    if (options.olderBeyond) tail(primary[0]!, -1, true);
  }

  for (const { edge, a, b, ax, ay, bx, by, samples, w0, w1 } of edges) {
    const main = a.primary && b.primary;
    const fork = !main && !b.primary && (a.primary || branchOf.get(a.hash) !== branchOf.get(b.hash));
    const merge = !main && b.primary;
    // A fork leaves from inside its parent's outer rim, and a merge returns into the river's rim, never through a core.
    const parentW = a.primary ? mainW : branchWidth(mainW, ordinal.get(a.hash) ?? 1);
    // A fork rises early and a merge drops late, so a long branch travels beside the river and flows in at its merge.
    const span = bx - ax;
    const c1 = merge ? ax + span * .62 : fork ? ax + Math.max(Math.min(20, span * .5), span * .25) : ax + Math.max(20, span * .5);
    const c2 = merge ? bx - Math.max(Math.min(20, span * .5), span * .2) : fork ? ax + Math.min(span * .6, span * .25 + 40) : bx - Math.max(20, span * .5);
    const centre: [number, number][] = [], widths: number[] = [], fades: number[] = [];
    for (let i = 0; i < samples; i++) {
      const t = i / (samples - 1), u = 1 - t;
      const x = u * u * u * ax + 3 * u * u * t * c1 + 3 * u * t * t * c2 + t * t * t * bx;
      let y = u * u * u * ay + 3 * u * u * t * ay + 3 * u * t * t * by + t * t * t * by;
      if (fork) y += (Math.sign(by - ay) || 1) * parentW * .42 * (1 - t) ** 2;
      if (merge) y += (Math.sign(ay - by) || 1) * mainW * .42 * t ** 2;
      centre.push([x, y]);
      widths.push(fork ? w1 * (.3 + .7 * smooth(0, .4, t)) : merge ? w1 * (.3 + .7 * smooth(1, .6, t)) : w0 + (w1 - w0) * smooth(0, 1, t));
      fades.push((fork ? smooth(0, .12, t) : 1) * (merge ? 1 - .55 * smooth(.7, 1, t) : 1));
    }
    const branch = branchOf.get(merge ? a.hash : b.hash);
    const count = main ? mainCount : Math.max(5, Math.round(density * .75 * w1 * branchFactor));
    const before = main || fork || merge ? count : Math.max(5, Math.round(density * .75 * w0 * branchFactor));
    bundle(centre, widths, fades, count, main ? 1 : 1000 + hashSeed(branch?.key ?? edge.to), focusFactor(edge.from, edge.to) * (main ? 1 : 1.25), before);
  }

  // Lightning at real branch heads only: thin, angular, fading bundles that end in sparks. Each head's split is seeded
  // (how many arms, how far, which way up), so heads differ the way real branches do; a longer branch reaches further.
  for (const hash of options.heads ?? []) {
    const node = nodes.get(hash), branch = branchOf.get(hash);
    if (!node || node.primary || !branch) continue;
    const x0 = sx(node.x), y0 = sy(node.y);
    if (x0 < -200 || x0 > W + 200 || y0 < -200 || y0 > H + 200) continue;
    const r = rng(hashSeed(hash)), size = Math.min(5, branch.members.length);
    const base = branchWidth(mainW, branch.members.length) * .5, reach = (26 + 12 * size) * (.75 + r() * .6) * clamp(scale / .6, .5, 3);
    const filaments = clamp(mainCount * (.05 + .03 * size), 4, 40), depth = options.lowResource || size < 2 ? 1 : size < 4 ? 2 : 3;
    const forward = (value: number) => clamp(value, -.95, .95);
    const grow = (x: number, y: number, angle: number, length: number, width: number, count: number, level: number) => {
      const kids = 2 + (r() < .45 ? 1 : 0);
      for (let k = 0; k < kids; k++) {
        // A head is the newest end of its branch and time runs left to right, so lightning only ever opens forward.
        const a = forward(angle + (k - (kids - 1) / 2) * (.35 + r() * .45) + (r() - .5) * .3), len = length * (.55 + r() * .8);
        const steps = 3 + Math.floor(r() * 4), path: [number, number][] = [[x, y]];
        let cx = x, cy = y, ca = a;
        for (let i = 1; i <= steps; i++) { ca = forward(ca + (r() - .5) * .7); cx += Math.cos(ca) * len / steps; cy += Math.sin(ca) * len / steps; path.push([cx, cy]); }
        const dense: [number, number][] = [path[0]!];
        for (let i = 1; i < path.length; i++) for (const f of [.25, .5, .75, 1]) dense.push([path[i - 1]![0] + (path[i]![0] - path[i - 1]![0]) * f, path[i - 1]![1] + (path[i]![1] - path[i - 1]![1]) * f]);
        bundle(dense, dense.map((_, i) => width * (1 - i / dense.length * .6)), dense.map((_, i) => (1 - i / dense.length * .85) * 1.5), Math.max(3, Math.round(count)), hashSeed(hash) + level * 31 + k, focusFactor(hash, hash));
        if (r() < .7) points.push(cx, cy, 1, 1, 1, .3 + r() * .35, 4 + r() * 2);
        if (level > 1 && r() < .8) grow(cx, cy, ca, len * .6, width * .55, count * .5, level - 1);
      }
    };
    grow(x0, y0, branch.side * (.15 + r() * .45), reach, base, filaments, depth);
  }

  // Deep space: white stars at three depths, fixed to the repository, drifting slightly against panning.
  const stars = rng(options.seed ?? 7), area = W * H / 1.3e6;
  for (const [n, size, light, drift] of [[420, 1.3, .2, .015], [140, 2, .38, .035], [26, 3.2, .75, .06]] as const) for (let i = 0; i < n * area; i++) {
    const x = ((stars() * W * 1.5 + ox * drift) % W + W) % W, y = stars() * H;
    points.push(x, y, 1, 1, 1, light * (.35 + stars() * .65), size * (.7 + stars() * .6));
  }
  // Commit points sit on their strand's core; a ref'd head is the brightest point on its strand.
  const small = scale < .35;
  for (const node of layout.nodes) {
    const x = sx(node.x), y = sy(node.y);
    if (x < -20 || x > W + 20 || y < -20 || y > H + 20) continue;
    const head = options.heads?.has(node.hash), chosen = node.hash === options.selected;
    points.push(x, y, .9, .96, 1, chosen ? 1.8 : head ? 1.5 : node.primary ? (small ? .55 : .85) : .75, chosen ? 14 : head ? 13 : node.primary ? (small ? 6 : 9) : 8);
  }
  return { lines: new Float32Array(lines), points: new Float32Array(points), segments: lines.length / 12 };
}

/**
 * The branch under a point, for hover: the nearest strand (fork → commits → merge, as straight runs) within `reach`
 * pixels. Coordinates are the same screen space as `gitLight`'s view.
 */
export function branchAt(layout: LightLayout, view: Pick<LightView, 'scale' | 'ox' | 'oy'>, x: number, y: number, reach = 12): LightBranch | undefined {
  let best: LightBranch | undefined, bestD = reach;
  const at = (hash: string | undefined) => { const n = hash ? layout.byHash.get(hash) : undefined; return n ? [view.ox + n.x * view.scale, view.oy + n.y * view.scale] as const : undefined; };
  for (const branch of layout.branches) {
    const pts = [at(branch.fork), ...branch.members.map(at), at(branch.merge)].filter((p): p is readonly [number, number] => !!p);
    if (pts.length < 2 || pts[0]![0] > x + reach || pts.at(-1)![0] < x - reach) continue;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1]!, [bx, by] = pts[i]!, dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy || 1;
      const t = clamp(((x - ax) * dx + (y - ay) * dy) / l, 0, 1), d = Math.hypot(ax + dx * t - x, ay + dy * t - y);
      if (d < bestD) { bestD = d; best = branch; }
    }
  }
  return best;
}
