export interface RouteRect { left: number; right: number; top: number; bottom: number }
type Point = { x: number; y: number };
/** Orthogonal gutter routes. An obstructed route is omitted, never painted over content. */
export function flowRoute(a: RouteRect, b: RouteRect, obstacles: RouteRect[]): string | undefined {
  const ay = a.top + Math.min(18, (a.bottom - a.top) / 2);
  const by = b.top + Math.min(18, (b.bottom - b.top) / 2);
  const left = Math.min(...obstacles.map(r => r.left)) - 12;
  const right = Math.max(...obstacles.map(r => r.right)) + 12;
  const candidates: Point[][] = [
    [{ x: a.right, y: ay }, { x: (a.right + b.left) / 2, y: ay }, { x: (a.right + b.left) / 2, y: by }, { x: b.left, y: by }],
    [{ x: a.left, y: ay }, { x: left, y: ay }, { x: left, y: by }, { x: b.left, y: by }],
    [{ x: a.right, y: ay }, { x: right, y: ay }, { x: right, y: by }, { x: b.right, y: by }],
  ];
  const crosses = (p: Point, q: Point, r: RouteRect) => p.y === q.y
    ? p.y > r.top - 2 && p.y < r.bottom + 2 && Math.max(p.x, q.x) > r.left + .1 && Math.min(p.x, q.x) < r.right - .1
    : p.x > r.left - 2 && p.x < r.right + 2 && Math.max(p.y, q.y) > r.top + .1 && Math.min(p.y, q.y) < r.bottom - .1;
  for (const points of candidates) {
    if (points.some((p, i) => i > 0 && obstacles.some(r => crosses(points[i - 1]!, p, r)))) continue;
    return points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');
  }
  return undefined;
}
