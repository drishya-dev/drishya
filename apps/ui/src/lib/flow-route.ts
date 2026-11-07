export interface RouteRect { left: number; right: number; top: number; bottom: number }
type Point = { x: number; y: number };
/** Orthogonal gutter routes. An obstructed route is omitted, never painted over content. */
export function flowRoute(a: RouteRect, b: RouteRect, obstacles: RouteRect[], viewport?: RouteRect): string | undefined {
  const valid = (r: RouteRect) => [r.left, r.right, r.top, r.bottom].every(Number.isFinite) && r.right > r.left && r.bottom > r.top;
  if (!valid(a) || !valid(b) || viewport && !valid(viewport)) return;
  const onScreen = (p: Point) => !viewport || p.x >= viewport.left && p.x <= viewport.right && p.y >= viewport.top && p.y <= viewport.bottom;
  const ay = a.top + Math.min(18, (a.bottom - a.top) / 2);
  const by = b.top + Math.min(18, (b.bottom - b.top) / 2);
  const left = Math.min(...obstacles.map(r => r.left)) - 12;
  const right = Math.max(...obstacles.map(r => r.right)) + 12;
  const candidates: Point[][] = [
    [{ x: a.right, y: ay }, { x: (a.right + b.left) / 2, y: ay }, { x: (a.right + b.left) / 2, y: by }, { x: b.left, y: by }],
    [{ x: a.left, y: ay }, { x: left, y: ay }, { x: left, y: by }, { x: b.left, y: by }],
    [{ x: a.right, y: ay }, { x: right, y: ay }, { x: right, y: by }, { x: b.right, y: by }],
  ];
  // A wrapped passage must leave the previous row vertically before crossing
  // back to its first column. Prefer that bottom-to-top relationship for stacks too;
  // a side gutter is a fallback only when another card obstructs the row gap.
  if (a.bottom < b.top) {
    const gap = (a.bottom + b.top) / 2;
    const ax = (a.left + a.right) / 2;
    const bx = (b.left + b.right) / 2;
    candidates.unshift(
      [{ x: ax, y: a.bottom }, { x: ax, y: gap }, { x: bx, y: gap }, { x: bx, y: b.top }],
    );
    candidates.push(
      [{ x: a.right, y: ay }, { x: right, y: ay }, { x: right, y: b.top - 8 }, { x: bx, y: b.top - 8 }, { x: bx, y: b.top }],
    );
  }
  const crosses = (p: Point, q: Point, r: RouteRect) => p.y === q.y
    ? p.y > r.top - 2 && p.y < r.bottom + 2 && Math.max(p.x, q.x) > r.left + .1 && Math.min(p.x, q.x) < r.right - .1
    : p.x > r.left - 2 && p.x < r.right + 2 && Math.max(p.y, q.y) > r.top + .1 && Math.min(p.y, q.y) < r.bottom - .1;
  for (const points of candidates) {
    if (!onScreen(points[0]!) || !onScreen(points.at(-1)!)) continue;
    if (points.some((p, i) => i > 0 && obstacles.some(r => crosses(points[i - 1]!, p, r)))) continue;
    return points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');
  }
  return undefined;
}
