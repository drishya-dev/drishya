import type { gitThreadLayout } from './git-thread-layout.ts';

/**
 * Sacred Timeline light (GIT-1, review 124): every real parent edge in view becomes a bundle of hair-fine filaments in
 * screen space, for the light renderer. Topology is the layout's, unchanged: no invented branches. Lightning splits only
 * at a branch head that a ref points at, and it fades, so it never reads as more history.
 */
type Graph = ReturnType<typeof gitThreadLayout>;
export interface LightView { scale: number; ox: number; oy: number; width: number; height: number }
export interface LightOptions {
  /** Commits whose strands brighten while one is hovered or focused; the rest dim. */
  focus?: ReadonlySet<string>;
  focusMix?: number;
  /** Branch heads with a ref and no loaded child: the only places lightning appears. */
  heads?: ReadonlySet<string>;
  selected?: string;
  lowResource?: boolean;
  /** Fixes the starfield to the repository. */
  seed?: number;
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
export const riverWidth = (scale: number) => clamp(34 * Math.sqrt(scale / .6), 16, 46);

/**
 * The layout's lane offsets are world units, so at fit zoom a branch would sit inside the river. Keep each branch commit
 * clear of the river in screen pixels at any zoom, in the same order and on the same side; x and topology are unchanged.
 * Commit buttons use these positions too, so the DOM stays on the light.
 */
export function lightNodes(graph: Graph, scale: number) {
  const mainW = riverWidth(scale);
  const primary = graph.nodes.filter((node) => node.primary).sort((a, b) => a.x - b.x);
  const riverAt = (x: number) => {
    if (!primary.length) return graph.height / 2;
    let i = 0;
    while (i < primary.length - 1 && primary[i + 1]!.x < x) i++;
    const a = primary[i]!, b = primary[Math.min(primary.length - 1, i + 1)]!;
    return a.x === b.x ? a.y : a.y + (b.y - a.y) * clamp((x - a.x) / (b.x - a.x), 0, 1);
  };
  return graph.nodes.map((node) => {
    if (node.primary) return node;
    const river = riverAt(node.x), dy = node.y - river, side = Math.sign(dy) || 1;
    const clear = (mainW * .7 + 14 + Math.floor(node.lane / 2) * 12) / scale;
    return { ...node, y: river + side * Math.max(Math.abs(dy), clear) };
  });
}

export function gitLight(graph: Graph, view: LightView, options: LightOptions = {}) {
  const { scale, ox, oy, width: W, height: H } = view;
  const nodes = new Map(lightNodes(graph, scale).map((node) => [node.hash, node]));
  const sx = (x: number) => ox + x * scale, sy = (y: number) => oy + y * scale;
  const mainW = riverWidth(scale);
  const lines: number[] = [], points: number[] = [];
  const budget = options.lowResource ? 8000 : 40000;

  // Only edges that cross the view, with a sample every ~6 px of screen length.
  const edges = graph.edges.flatMap((edge) => {
    const a = nodes.get(edge.from), b = nodes.get(edge.to);
    if (!a || !b) return [];
    const ax = sx(a.x), bx = sx(b.x), ay = sy(a.y), by = sy(b.y);
    if (Math.max(ax, bx) < -160 || Math.min(ax, bx) > W + 160 || Math.max(ay, by) < -200 || Math.min(ay, by) > H + 200) return [];
    const samples = Math.max(3, Math.min(160, Math.ceil(Math.hypot(bx - ax, by - ay) / 6)));
    const w = edge.primary ? mainW : mainW * clamp(.16 + .3 * (edge.width - 2) / 14, .16, .5);
    return [{ edge, a, b, ax, ay, bx, by, samples, w }];
  });
  const mainSamples = edges.reduce((n, e) => n + (e.edge.primary ? e.samples : 0), 0);
  // Budget: about 55% for the river, 30% for branches and the rest for lightning, so a frame stays near the cap.
  const mainCount = clamp(Math.floor(budget * .55 / Math.max(1, mainSamples)), 12, options.lowResource ? 120 : 380);
  const branchWanted = edges.reduce((n, e) => n + (e.edge.primary ? 0 : e.samples * mainCount * .6 * e.w / mainW), 0);
  const branchFactor = Math.min(1, budget * .3 / Math.max(1, branchWanted));

  const push = (ax: number, ay: number, bx: number, by: number, c: readonly number[], alpha: number) => { lines.push(ax, ay, c[0]!, c[1]!, c[2]!, alpha, bx, by, c[0]!, c[1]!, c[2]!, alpha); };
  const focusFactor = (from: string, to: string) => {
    if (!options.focus || !options.focusMix) return 1;
    const k = options.focus.has(from) && options.focus.has(to) ? 1.6 : .5;
    return 1 + (k - 1) * options.focusMix;
  };

  /**
   * One bundle along a sampled centre line. Each filament's lane, seeds and noise come from the bundle key and its index,
   * and noise runs along world-anchored x, so consecutive edges of one strand join without a seam.
   */
  function bundle(centre: [number, number][], widths: number[], fades: number[], count: number, key: number, gain: number) {
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
      // The centre lanes carry more light, so the core burns white while the rims keep their colour.
      const alpha = (.04 + .06 * r()) * (1 + 1.2 * (1 - Math.abs(u) * 2) ** 2) * (fray ? .45 : 1) * lead * gain;
      let px = 0, py = 0;
      for (let i = 0; i < n; i++) {
        const [cx, cy] = centre[i]!, [nx, ny] = normals[i]!, X = cx - ox;
        const off = widths[i]! * (u + BRAID * noise(X / period + s1) + HAIR * noise(X / 9 + s2));
        const x = cx + nx * off, y = cy + ny * off;
        if (i > 0) {
          const z = Math.sin(X / (240 / TWIST) + u * 5 + phase);
          push(px, py, x, y, colour(u + .5 + .08 * Math.sin(X / 300 + phase)), alpha * (.7 + .3 * z) * fades[i]!);
        }
        px = x; py = y;
      }
    }
  }

  for (const { edge, ax, ay, bx, by, samples, w } of edges) {
    const fork = !edge.primary && nodes.get(edge.from)!.primary, merge = !edge.primary && nodes.get(edge.to)!.primary;
    const bend = Math.max(20, (bx - ax) * .45);
    const centre: [number, number][] = [], widths: number[] = [], fades: number[] = [];
    for (let i = 0; i < samples; i++) {
      const t = i / (samples - 1), u = 1 - t;
      const x = u * u * u * ax + 3 * u * u * t * (ax + bend) + 3 * u * t * t * (bx - bend) + t * t * t * bx;
      let y = u * u * u * ay + 3 * u * u * t * ay + 3 * u * t * t * by + t * t * t * by;
      // A fork leaves from inside the river's outer rim, and a merge returns into it, never through its core.
      if (fork) y += (Math.sign(by - ay) || 1) * mainW * .42 * (1 - t) ** 2;
      if (merge) y += (Math.sign(ay - by) || 1) * mainW * .42 * t ** 2;
      centre.push([x, y]);
      widths.push(w * (fork ? .3 + .7 * smooth(0, .35, t) : merge ? .3 + .7 * smooth(1, .65, t) : 1));
      fades.push((fork ? smooth(0, .12, t) : 1) * (merge ? 1 - .55 * smooth(.7, 1, t) : 1));
    }
    const count = edge.primary ? mainCount : Math.max(6, Math.round(mainCount * .6 * w / mainW * branchFactor));
    bundle(centre, widths, fades, count, edge.primary ? 1 : 1000 + edge.lane, focusFactor(edge.from, edge.to) * (edge.primary ? 1 : 1.25));
  }

  // Lightning at real branch heads only: thinner, angular, fading bundles that end in sparks. Its size follows the
  // branch's loaded width, so a one-commit head gets a small spark and a long-lived branch a full split.
  const incoming = new Map(graph.edges.map((edge) => [edge.to, edge.width]));
  const tipBudget = (options.lowResource ? 1500 : 6000) / Math.max(1, (options.heads?.size ?? 0));
  for (const hash of options.heads ?? []) {
    const node = nodes.get(hash);
    if (!node || node.primary) continue;
    const x0 = sx(node.x), y0 = sy(node.y);
    if (x0 < -200 || x0 > W + 200 || y0 < -200 || y0 > H + 200) continue;
    const weight = clamp(((incoming.get(hash) ?? 2) - 2) / 14, 0, 1);
    const r = rng(hashSeed(hash)), side = Math.sign(node.y - (graph.height / 2)) || -1, base = mainW * (.16 + .14 * weight), reach = (34 + 46 * weight) * clamp(scale / .6, .6, 1.4);
    const filaments = clamp(tipBudget / 60, 5, mainCount * (.1 + .15 * weight));
    const grow = (x: number, y: number, angle: number, length: number, width: number, count: number, depth: number) => {
      const kids = 2 + (r() < .5 ? 1 : 0);
      for (let k = 0; k < kids; k++) {
        // A head is the newest end of its branch, and time runs left to right, so lightning only ever opens forward;
        // a tip curling back would read as history flowing the wrong way.
        const forward = (value: number) => clamp(value, -.95, .95);
        const a = forward(angle + (k - (kids - 1) / 2) * (.42 + r() * .25) + (r() - .5) * .2), len = length * (.7 + r() * .5);
        const steps = 4 + Math.floor(r() * 3), path: [number, number][] = [[x, y]];
        let cx = x, cy = y, ca = a;
        for (let i = 1; i <= steps; i++) { ca = forward(ca + (r() - .5) * .55); cx += Math.cos(ca) * len / steps; cy += Math.sin(ca) * len / steps; path.push([cx, cy]); }
        const dense: [number, number][] = [path[0]!];
        for (let i = 1; i < path.length; i++) for (const f of [.25, .5, .75, 1]) dense.push([path[i - 1]![0] + (path[i]![0] - path[i - 1]![0]) * f, path[i - 1]![1] + (path[i]![1] - path[i - 1]![1]) * f]);
        bundle(dense, dense.map((_, i) => width * (1 - i / dense.length * .6)), dense.map((_, i) => (1 - i / dense.length * .85) * 1.6), Math.max(5, Math.round(count)), hashSeed(hash) + depth * 31 + k, focusFactor(hash, hash));
        points.push(cx, cy, .85, .92, 1, .35 + r() * .35, 5);
        if (depth > 1) grow(cx, cy, ca, len * .62, width * .55, count * .45, depth - 1);
      }
    };
    grow(x0, y0, side * .35, reach, base, filaments, options.lowResource || weight < .2 ? 1 : 2);
  }

  // Stars at three depths, fixed to the repository, drifting slightly against panning.
  const stars = rng(options.seed ?? 7), area = W * H / 1.3e6;
  for (const [n, size, light, drift] of [[300, 1.6, .22, .02], [110, 2.4, .42, .04], [28, 3.6, .8, .07]] as const) for (let i = 0; i < n * area; i++) {
    const tint = stars(), x = ((stars() * W * 1.5 + ox * drift) % W + W) % W, y = stars() * H;
    points.push(x, y, .75 + tint * .25, .82 + tint * .1, 1, light * (.4 + stars() * .6), size * (.7 + stars() * .6));
  }
  // Commit points sit on their strand's core; a ref'd head is the brightest point on its strand.
  for (const node of graph.nodes) {
    const x = sx(node.x), y = sy(node.y);
    if (x < -20 || x > W + 20 || y < -20 || y > H + 20) continue;
    const head = options.heads?.has(node.hash), chosen = node.hash === options.selected;
    points.push(x, y, .9, .96, 1, chosen ? 1.8 : head ? 1.5 : node.primary ? .9 : .75, chosen ? 14 : head ? 13 : node.primary ? 9 : 8);
  }
  return { lines: new Float32Array(lines), points: new Float32Array(points), segments: lines.length / 12 };
}
