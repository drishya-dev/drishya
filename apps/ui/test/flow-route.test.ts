import { expect, it } from 'vitest';
import { flowRoute } from '../src/lib/flow-route.ts';
const a = { left: 20, right: 120, top: 20, bottom: 120 };
const b = { left: 140, right: 240, top: 20, bottom: 120 };
it('joins adjacent cards through their free gutter', () => {
  expect(flowRoute(a, b, [a, b])).toBe('M 120 38 L 130 38 L 130 38 L 140 38');
});
it('joins stacked cards bottom to top without crossing their contents', () => {
  const below = { ...a, top: 140, bottom: 220 };
  expect(flowRoute(a, below, [a, b, below])).toBe('M 70 120 L 70 130 L 70 130 L 70 140');
});
it('omits routes when overlapping surfaces leave no unobstructed endpoint', () => {
  expect(flowRoute(a, b, [a, b, { left: 0, right: 260, top: 0, bottom: 130 }])).toBeUndefined();
});
it('retains the wrapped second-to-third connection when a fourth card fills the next row', () => {
  const c = { ...a, top: 140, bottom: 260 };
  const d = { ...b, top: 140, bottom: 280 };
  expect(flowRoute(b, c, [a, b, c, d])).toBe('M 190 120 L 190 130 L 70 130 L 70 140');
});
it('routes around a taller neighboring card when rows have unequal heights', () => {
  const tall = { ...a, bottom: 155 };
  const c = { ...a, top: 180, bottom: 300 };
  const d = { ...b, top: 180, bottom: 310 };
  expect(flowRoute(b, c, [tall, b, c, d])).toBe('M 240 38 L 252 38 L 252 172 L 70 172 L 70 180');
});
