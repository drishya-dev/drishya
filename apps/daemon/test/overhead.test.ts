import { describe, expect, it } from 'vitest';
import { measureOverhead } from '../../../scripts/bench-overhead.ts';

// Keeps the B4 passive-overhead probe working: a tiny workload must run every condition and
// capture exactly what a fresh import of the finished journal yields. Timing is not asserted here;
// the real measurement is the full script run recorded in docs/review/07-b4-scale-install.md.
describe('passive capture overhead probe', () => {
  it('runs baseline and observer and loses no events', async () => {
    const { results, summary } = await measureOverhead({ runs: 1, records: 120, workMs: 0, browser: false, intervalMs: 20 });
    expect(results.map((r) => r.condition).sort()).toEqual(['baseline', 'observer']);
    const observed = results.find((r) => r.condition === 'observer')!;
    expect(observed.captured).toBeGreaterThan(120);
    expect(observed.captured).toBe(observed.expected);
    expect(summary.every((s) => s.lost === 0)).toBe(true);
  }, 60_000);
});
