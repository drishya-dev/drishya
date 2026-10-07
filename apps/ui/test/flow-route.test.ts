import { expect, it } from 'vitest';
import { flowRoute } from '../src/lib/flow-route.ts';
const a = { left: 20, right: 120, top: 20, bottom: 120 };
const b = { left: 140, right: 240, top: 20, bottom: 120 };
it('joins adjacent cards through their free gutter', () => {
  expect(flowRoute(a, b, [a, b])).toBe('M 120 38 L 130 38 L 130 38 L 140 38');
});
it('uses an outer margin for wrapped cards without crossing their contents', () => {
  const below = { ...a, top: 140, bottom: 220 };
  expect(flowRoute(a, below, [a, b, below])).toBe('M 20 38 L 8 38 L 8 158 L 20 158');
});
it('omits routes when overlapping surfaces leave no unobstructed endpoint', () => {
  expect(flowRoute(a, b, [a, b, { left: 0, right: 260, top: 0, bottom: 130 }])).toBeUndefined();
});
