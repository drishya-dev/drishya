import { describe, expect, it } from 'vitest';
import { outputPaths } from '../src/lib/output-paths.ts';

// LIVE-7: every live update re-renders the history, and each tool-output line asked this scan again. The
// answer is pure, so asking twice must cost nothing and give the same locations.
describe('outputPaths', () => {
  it('finds diagnostic locations and answers a repeat question from memory', () => {
    const text = 'src/checkout/guard.ts:12:5 error TS2322: bad';
    const first = outputPaths(text, '/home/dev/shop');
    expect(first.length).toBeGreaterThan(0);
    expect(first[0]!.path).toContain('guard.ts');
    expect(outputPaths(text, '/home/dev/shop')).toBe(first);
  });
  it('keeps answers for different limits and roots apart', () => {
    const text = 'a/b.ts:1 and c/d.ts:2';
    const one = outputPaths(text, undefined, 1), two = outputPaths(text, undefined, 8);
    expect(one.length).toBe(1);
    expect(two.length).toBe(2);
  });
  it('does not scan very long text', () => {
    expect(outputPaths('x'.repeat(5000) + ' a/b.ts:1')).toEqual([]);
  });
});
