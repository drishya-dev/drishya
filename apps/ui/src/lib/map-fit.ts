export interface FitRect { left: number; top: number; right: number; bottom: number }
export interface MapFrame { w: number; h: number; sx: number; sy: number; ox: number; oy: number }
/** A reader reallocates the canvas, not the user's chosen location in the world. */
export function rebaseMapCamera(camera: { x: number; y: number; k: number }, before: MapFrame, after: MapFrame, anchor?: { x: number; y: number }) {
  if (![before.w, before.h, before.sx, before.sy, after.w, after.h].every(value => value > 0)) return camera;
  const point = anchor ?? { x: ((before.w / 2 - camera.x) / camera.k - before.ox) / before.sx, y: ((before.h / 2 - camera.y) / camera.k - before.oy) / before.sy };
  const xRatio = ((before.ox + point.x * before.sx) * camera.k + camera.x) / before.w;
  const yRatio = ((before.oy + point.y * before.sy) * camera.k + camera.y) / before.h;
  return { k: camera.k, x: xRatio * after.w - (after.ox + point.x * after.sx) * camera.k, y: yRatio * after.h - (after.oy + point.y * after.sy) * camera.k };
}
/** Largest usable axis-aligned region after removing measured visible chrome. */
export function mapReadingArea(bounds: FitRect, obstacles: FitRect[]): FitRect {
  let areas = [bounds];
  for (const block of obstacles) {
    areas = areas.flatMap(area => {
      const left = Math.max(area.left, block.left), right = Math.min(area.right, block.right), top = Math.max(area.top, block.top), bottom = Math.min(area.bottom, block.bottom);
      if (left >= right || top >= bottom) return [area];
      return [
        { ...area, right: left }, { ...area, left: right },
        { ...area, bottom: top }, { ...area, top: bottom },
      ].filter(rect => rect.right - rect.left >= 40 && rect.bottom - rect.top >= 40);
    }).sort((a, b) => (b.right - b.left) * (b.bottom - b.top) - (a.right - a.left) * (a.bottom - a.top)).slice(0, 64);
    if (!areas.length) return bounds;
  }
  return areas[0] ?? bounds;
}
/** Points are already projected into untransformed renderer pixels. Labels stay
 * DOM; reserve their fixed pixel footprint independently of camera scale. */
export function fitProjectedMap(points: Iterable<{ x: number; y: number }>, area: FitRect, labelWidth = 190) {
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    left = Math.min(left, point.x); right = Math.max(right, point.x); top = Math.min(top, point.y); bottom = Math.max(bottom, point.y);
  }
  if (!Number.isFinite(left)) return { x: 0, y: 0, k: 1 };
  const width = Math.max(40, area.right - area.left), height = Math.max(40, area.bottom - area.top);
  const label = Math.min(labelWidth, Math.max(0, width - 36));
  const k = Math.max(.1, Math.min(8, (width - label - 16) / Math.max(20, right - left), (height - 28) / Math.max(20, bottom - top)));
  return { k, x: area.left + (width - label) / 2 - (left + right) / 2 * k, y: area.top + height / 2 - (top + bottom) / 2 * k };
}
