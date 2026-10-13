import { expect, it } from 'vitest';
import { fitProjectedMap, mapReadingArea } from '../src/lib/map-fit.ts';
it('fits endpoints and fixed label space into an unobscured reading region', () => {
  const area = mapReadingArea({ left: 0, top: 0, right: 1000, bottom: 800 }, [{ left: 0, top: 0, right: 1000, bottom: 80 }, { left: 700, top: 80, right: 1000, bottom: 800 }]);
  expect(area).toEqual({ left: 0, top: 80, right: 700, bottom: 800 });
  const points = [{ x: -100, y: 20 }, { x: 1200, y: 900 }], camera = fitProjectedMap(points, area);
  for (const point of points) {
    expect(point.x * camera.k + camera.x).toBeGreaterThanOrEqual(area.left);
    expect(point.x * camera.k + camera.x + 190).toBeLessThanOrEqual(area.right);
    expect(point.y * camera.k + camera.y).toBeGreaterThanOrEqual(area.top);
    expect(point.y * camera.k + camera.y).toBeLessThanOrEqual(area.bottom);
  }
});
it('handles empty/degenerate and 100k-point maps without spread-stack overflow', () => {
  const area = { left: 0, top: 0, right: 390, bottom: 600 };
  expect(fitProjectedMap([], area)).toEqual({ x: 0, y: 0, k: 1 });
  expect(Number.isFinite(fitProjectedMap([{ x: 10, y: 10 }], area).k)).toBe(true);
  function* points() { for (let n = 0; n < 100_000; n++) yield { x: n / 100, y: n % 800 }; }
  expect(fitProjectedMap(points(), area).k).toBeLessThan(1);
});
