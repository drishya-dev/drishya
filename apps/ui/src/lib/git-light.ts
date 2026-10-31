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
  /** Keeps the geometry between frames; without one it is built for exactly this view. */
  cache?: LightCache;
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

/** The cached world-space geometry (GIT-6): built for a tile around the view and reused while the view stays inside it. */
export interface LightRange { start: number; end: number; from: string; to: string }
export interface LightCache {
  parts?: unknown[];
  tile?: { x0: number; x1: number; y0: number; y1: number };
  base?: Float32Array;
  ranges?: LightRange[];
  scratch?: Float32Array;
  /** Lightning sparks for the tile, in world pixels. */
  sparks?: number[];
  /** Bumps whenever `base` is replaced, so a renderer can keep what it already uploaded. */
  serial: number;
  /** How many times the tile was rebuilt, and how many focus frames were drawn from it. */
  builds: number;
  frames: number;
}
export const lightCache = (): LightCache => ({ serial: 0, builds: 0, frames: 0 });

const same = (a: unknown[] | undefined, b: unknown[]) => !!a && a.length === b.length && a.every((value, index) => value === b[index]);

/** One growable run of line segments (12 floats each: x, y, r, g, b, a for both ends). No allocation per segment. */
class Lines {
  data = new Float32Array(1 << 18);
  length = 0;
  ranges: LightRange[] = [];
  push(ax: number, ay: number, bx: number, by: number, r: number, g: number, b: number, a: number) {
    if (this.length + 12 > this.data.length) { const next = new Float32Array(this.data.length * 2); next.set(this.data); this.data = next; }
    const d = this.data, i = this.length;
    d[i] = ax; d[i + 1] = ay; d[i + 2] = r; d[i + 3] = g; d[i + 4] = b; d[i + 5] = a;
    d[i + 6] = bx; d[i + 7] = by; d[i + 8] = r; d[i + 9] = g; d[i + 10] = b; d[i + 11] = a;
    this.length = i + 12;
  }
}
const SCRATCH: [number, number, number] = [0, 0, 0];
function colourInto(t: number) {
  t = clamp(t, 0, 1) * (PALETTE.length - 1);
  const i = Math.min(PALETTE.length - 2, Math.floor(t)), f = t - i, a = PALETTE[i]!, b = PALETTE[i + 1]!;
  SCRATCH[0] = a[0] + (b[0] - a[0]) * f; SCRATCH[1] = a[1] + (b[1] - a[1]) * f; SCRATCH[2] = a[2] + (b[2] - a[2]) * f;
}

/** Brightness of a strand while a commit or branch is focused: its own and its neighbours' brighter, the rest dimmer. */
function focusFactor(focus: ReadonlySet<string> | undefined, mix: number | undefined, from: string, to: string) {
  if (!focus || !mix) return 1;
  const k = focus.has(from) && focus.has(to) ? 1.7 : .45;
  return 1 + (k - 1) * mix;
}

/**
 * The light geometry for one tile, in world pixels (the layout at this scale, no view offset): every parent edge that
 * crosses the tile becomes a bundle of filaments. Hover and selection are not in here, so panning, hovering and focusing
 * never rebuild it.
 */
function buildTile(graph: Graph, layout: LightLayout, tile: { x0: number; x1: number; y0: number; y1: number }, scale: number, areaFactor: number, options: LightOptions) {
  const { byHash: nodes, mainW, branchOf, ordinal } = layout;
  const sx = (x: number) => x * scale, sy = (y: number) => y * scale;
  const out = new Lines();
  const budget = (options.lowResource ? 8000 : 40000) * areaFactor;
  const cap = (options.lowResource ? 8000 : 40000) * areaFactor;

  // Only edges that cross the tile, with a sample every ~6 px of length.
  // Squash merges join the drawing as edges from the branch head into the primary commit that wrote its contents.
  const squashEdges = layout.branches.filter((branch) => branch.squash && branch.merge).map((branch) => ({ ...graph.edges[0]!, from: branch.head, to: branch.merge!, primary: false, lane: 0, width: 2 }));
  const edges = [...graph.edges, ...squashEdges].flatMap((edge) => {
    const a = nodes.get(edge.from), b = nodes.get(edge.to);
    if (!a || !b) return [];
    const ax = sx(a.x), bx = sx(b.x), ay = sy(a.y), by = sy(b.y);
    if (Math.max(ax, bx) < tile.x0 - 160 || Math.min(ax, bx) > tile.x1 + 160 || Math.max(ay, by) < tile.y0 - 200 || Math.min(ay, by) > tile.y1 + 200) return [];
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

  /**
   * One bundle along a sampled centre line. Each filament's lane, seeds and noise come from the bundle key and its index,
   * and noise runs along world-anchored x, so consecutive edges of one strand join without a seam. Filaments from
   * `entering` on are new at this commit and fade in, which is how a strand visibly gains width.
   */
  function bundle(centre: [number, number][], widths: number[], fades: number[], count: number, key: number, gain: number, from: string, to: string, entering = count) {
    const n = centre.length, start = out.length;
    const nx = new Float64Array(n), ny = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const a = centre[Math.max(0, i - 1)]!, b = centre[Math.min(n - 1, i + 1)]!, dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      nx[i] = -dy / l; ny[i] = dx / l;
    }
    for (let f = 0; f < count; f++) {
      if (out.length / 12 > cap * 1.5) break;
      const r = rng(key * 7919 + f * 104729);
      // Most lanes sit inside the band, denser at the centre for a white-hot core; a few fray past the edge, and a few
      // lead strands are brighter, so single filaments stay visible inside the light.
      const q = r() * 2 - 1, fray = r() < .12, u = Math.sign(q) * Math.pow(Math.abs(q), 1.2) * (fray ? .95 : .5);
      const s1 = r() * 900, s2 = r() * 900, period = 90 + r() * 140, phase = r() * 6.28;
      const lead = r() < .07 ? 3 : 1;
      const alpha = (.04 + .06 * r()) * (1 + 1.2 * (1 - Math.abs(u) * 2) ** 2) * (fray ? .45 : 1) * lead * gain;
      const twist = 240 / TWIST;
      let px = 0, py = 0;
      for (let i = 0; i < n; i++) {
        const c = centre[i]!, X = c[0];
        const off = widths[i]! * (u + BRAID * noise(X / period + s1) + HAIR * noise(X / 9 + s2));
        const x = c[0] + nx[i]! * off, y = c[1] + ny[i]! * off;
        if (i > 0) {
          const z = Math.sin(X / twist + u * 5 + phase), born = f >= entering ? smooth(0, .45, i / (n - 1)) : 1;
          colourInto(u + .5 + .08 * Math.sin(X / 300 + phase));
          out.push(px, py, x, y, SCRATCH[0], SCRATCH[1], SCRATCH[2], alpha * (.7 + .3 * z) * fades[i]! * born);
        }
        px = x; py = y;
      }
    }
    if (out.length > start) out.ranges.push({ start, end: out.length, from, to });
  }

  // The river does not stop dead: it fades out a little past the newest primary commit, and fades in from the left when
  // older history exists beyond the loaded window.
  const primary = layout.nodes.filter((node) => node.primary).sort((a, b) => a.x - b.x);
  if (primary.length) {
    const tail = (from: LayoutNode, dir: number, fadeIn: boolean) => {
      const x0 = sx(from.x), y0 = sy(from.y), length = 70, lo = Math.min(x0, x0 + dir * length), hi = Math.max(x0, x0 + dir * length);
      if (hi < tile.x0 - 40 || lo > tile.x1 + 40) return;
      const centre: [number, number][] = [], widths: number[] = [], fades: number[] = [];
      for (let i = 0; i <= 12; i++) { const t = i / 12, x = dir > 0 ? x0 + t * length : x0 - length + t * length; centre.push([x, y0]); widths.push(mainW * (fadeIn ? .7 + .3 * t : 1 - .3 * t)); fades.push(fadeIn ? smooth(0, 1, t) : smooth(1, 0, t)); }
      bundle(centre, widths, fades, mainCount, 1, 1, '', '');
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
    bundle(centre, widths, fades, count, main ? 1 : 1000 + hashSeed(branch?.key ?? edge.to), main ? 1 : 1.25, edge.from, edge.to, before);
  }

  // Lightning at real branch heads only: thin, angular, fading bundles that end in sparks. Each head's split is seeded
  // (how many arms, how far, which way up), so heads differ the way real branches do; a longer branch reaches further.
  const sparks: number[] = [];
  for (const hash of options.heads ?? []) {
    const node = nodes.get(hash), branch = branchOf.get(hash);
    if (!node || node.primary || !branch) continue;
    const x0 = sx(node.x), y0 = sy(node.y);
    if (x0 < tile.x0 - 200 || x0 > tile.x1 + 200 || y0 < tile.y0 - 200 || y0 > tile.y1 + 200) continue;
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
        bundle(dense, dense.map((_, i) => width * (1 - i / dense.length * .6)), dense.map((_, i) => (1 - i / dense.length * .85) * 1.5), Math.max(3, Math.round(count)), hashSeed(hash) + level * 31 + k, 1, hash, hash);
        if (r() < .7) sparks.push(cx, cy, 1, 1, 1, .3 + r() * .35, 4 + r() * 2);
        if (level > 1 && r() < .8) grow(cx, cy, ca, len * .6, width * .55, count * .5, level - 1);
      }
    };
    grow(x0, y0, branch.side * (.15 + r() * .45), reach, base, filaments, depth);
  }
  return { data: out.data.slice(0, out.length), ranges: out.ranges, sparks };
}

export interface LightFrameData { lines: Float32Array; points: Float32Array; segments: number; offset: [number, number]; linesKey: number }

export function gitLight(graph: Graph, layout: LightLayout, view: LightView, options: LightOptions & { cache?: LightCache } = {}): LightFrameData {
  const { scale, ox, oy, width: W, height: H } = view;
  const cache = options.cache;
  // The geometry depends on these and not on the pan position, the hover or the selection.
  const parts = [graph, layout, scale, options.heads, options.seed, options.lowResource, options.olderBeyond, W, H];
  const visible = { x0: -ox, x1: -ox + W, y0: -oy, y1: -oy + H };
  const holds = (tile: NonNullable<LightCache['tile']>) => tile.x0 + W * .25 <= visible.x0 && visible.x1 <= tile.x1 - W * .25 && tile.y0 + H * .15 <= visible.y0 && visible.y1 <= tile.y1 - H * .15;
  let geometry: { base: Float32Array; ranges: LightRange[]; sparks: number[]; serial: number };
  if (cache && cache.base && cache.tile && same(cache.parts, parts) && holds(cache.tile)) geometry = { base: cache.base, ranges: cache.ranges!, sparks: cache.sparks ?? [], serial: cache.serial };
  else {
    // One viewport of margin either side: panning a viewport and a half in either direction costs nothing.
    const tile = cache ? { x0: visible.x0 - W, x1: visible.x1 + W, y0: visible.y0 - H * .6, y1: visible.y1 + H * .6 } : visible;
    const built = buildTile(graph, layout, tile, scale, clamp((tile.x1 - tile.x0) / Math.max(1, W), 1, 3.2), options);
    if (cache) {
      cache.parts = parts; cache.tile = tile; cache.base = built.data; cache.ranges = built.ranges; cache.sparks = built.sparks; cache.serial++; cache.builds++;
      geometry = { base: built.data, ranges: built.ranges, sparks: built.sparks, serial: cache.serial };
    } else {
      // Without a cache the geometry is built for exactly this view, so hand it over in screen space.
      const data = built.data;
      for (let i = 0; i < data.length; i += 6) { data[i] = data[i]! + ox; data[i + 1] = data[i + 1]! + oy; }
      geometry = { base: data, ranges: built.ranges, sparks: built.sparks, serial: 0 };
    }
  }
  const screen = !cache;
  let lines = geometry.base, linesKey = geometry.serial;
  if (options.focus && options.focusMix) {
    const scratch = cache ? (cache.scratch = cache.scratch && cache.scratch.length >= lines.length ? cache.scratch : new Float32Array(lines.length)) : new Float32Array(lines.length);
    scratch.set(lines);
    for (const range of geometry.ranges) {
      const factor = focusFactor(options.focus, options.focusMix, range.from, range.to);
      if (factor !== 1) for (let i = range.start + 5; i < range.end; i += 6) scratch[i] = scratch[i]! * factor;
    }
    lines = scratch.subarray(0, geometry.base.length);
    // A focus frame is new data every time; the key is negative so it never matches a plain tile's key.
    linesKey = cache ? -(++cache.frames) : -1;
  }

  // What does depend on the view: the stars drift against panning, and commit points sit on their strand's core.
  const points: number[] = [];
  const sx = (x: number) => ox + x * scale, sy = (y: number) => oy + y * scale;
  for (let i = 0; i < geometry.sparks.length; i += 7) points.push(geometry.sparks[i]! + ox, geometry.sparks[i + 1]! + oy, geometry.sparks[i + 2]!, geometry.sparks[i + 3]!, geometry.sparks[i + 4]!, geometry.sparks[i + 5]!, geometry.sparks[i + 6]!);
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
  return { lines, points: new Float32Array(points), segments: lines.length / 12, offset: screen ? [0, 0] : [ox, oy], linesKey };
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
