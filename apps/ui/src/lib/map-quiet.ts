// SHIP-8: the map recedes beneath reading material. Pure geometry so dots and import lines can be dimmed
// without touching the camera, the evidence or the rotation rules. Presentation only: no wall-clock reads.

export interface QuietZone { left: number; top: number; right: number; bottom: number }
export interface QuietPoint { t: number; x: number; y: number; factor: number }

/** Width of the soft edge around a zone, so the dimming reads as a gentle falloff and not a hard box. */
export const QUIET_FEATHER = 72;
/**
 * Remaining strength of a file dot / an import line directly beneath reading material. MAP-4: SHIP-8's .3 / .08 compounded
 * with the .38 canvas dim and left nothing visible under the column; these keep the shapes translucent but present, and
 * still clearly below the margins.
 */
/** MAP-4: strength of dots and lines at rest, in the margins. The canvas is no longer dimmed to 38 % on top of this. */
export const MAP_REST_ALPHA = .85;
export const QUIET_NODE_FLOOR = .38;
export const QUIET_EDGE_FLOOR = .3;

/** 1 outside the feather band, `floor` inside the zone, a straight ramp between. */
export function quietFactor(x: number, y: number, zones: readonly QuietZone[], floor: number, feather = QUIET_FEATHER): number {
  let factor = 1;
  for (const zone of zones) {
    const outside = Math.max(zone.left - x, x - zone.right, zone.top - y, y - zone.bottom, 0);
    if (outside >= feather) continue;
    factor = Math.min(factor, floor + (1 - floor) * (outside / feather));
  }
  return factor;
}

/** Parametric span of a segment inside a rectangle (slab method), or undefined when it misses. */
function span(ax: number, ay: number, bx: number, by: number, r: QuietZone): [number, number] | undefined {
  let t0 = 0, t1 = 1;
  for (const [p, d, lo, hi] of [[ax, bx - ax, r.left, r.right], [ay, by - ay, r.top, r.bottom]] as const) {
    if (d === 0) { if (p < lo || p > hi) return undefined; continue; }
    let near = (lo - p) / d, far = (hi - p) / d;
    if (near > far) [near, far] = [far, near];
    t0 = Math.max(t0, near); t1 = Math.min(t1, far);
    if (t0 > t1) return undefined;
  }
  return [t0, t1];
}

/**
 * Cuts an import line where it enters and leaves each zone's soft edge and its core. A GPU line interpolates its end
 * alphas linearly, so these cut points give a faithful ramp-down, a flat quiet run and a ramp-up. A line that never
 * touches a zone comes back as the one segment it was.
 */
export function quietEdgePoints(ax: number, ay: number, bx: number, by: number, zones: readonly QuietZone[], floor: number, feather = QUIET_FEATHER): QuietPoint[] {
  const cuts = new Set([0, 1]);
  for (const zone of zones) {
    const outer = { left: zone.left - feather, top: zone.top - feather, right: zone.right + feather, bottom: zone.bottom + feather };
    for (const rect of [outer, zone]) {
      const hit = span(ax, ay, bx, by, rect);
      if (hit) { cuts.add(hit[0]); cuts.add(hit[1]); }
    }
  }
  return [...cuts].sort((a, b) => a - b).map(t => {
    const x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
    return { t, x, y, factor: quietFactor(x, y, zones, floor, feather) };
  });
}
