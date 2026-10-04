import { describe, expect, it } from 'vitest';
import { passageWindow } from '../src/lib/history-window.ts';

describe('measured history window', () => {
  const ids = Array.from({ length: 10_000 }, (_, i) => `p${i}`);

  it('mounts a bounded viewport and a distant selected passage without the gap', () => {
    const layout = passageWindow(ids, new Map(), 500_000, 900, new Set(['p5']));
    const mounted = layout.runs.reduce((n, run) => n + run.end - run.start, 0);
    expect(mounted).toBeLessThan(20);
    expect(layout.runs[0]).toMatchObject({ start: 5, end: 6 });
    expect(layout.runs.at(-1)!.start).toBeGreaterThan(2_000);
    expect(layout.runs.reduce((height, run) => height + run.before + layout.prefix[run.end]! - layout.prefix[run.start]!, 0)
      + layout.total - layout.prefix[layout.runs.at(-1)!.end]!).toBe(layout.total);
  });

  it('uses measured heights to place the same stable passage after an earlier passage grows', () => {
    const before = passageWindow(ids.slice(0, 10), new Map(), 850, 500, new Set());
    const after = passageWindow(ids.slice(0, 10), new Map([['p0', 480]]), 1_090, 500, new Set());
    expect(before.prefix[4]).toBe(960);
    expect(after.prefix[4]).toBe(1_200);
    expect(before.runs.at(-1)!.end).toBe(after.runs.at(-1)!.end);
  });

  it('handles empty history', () => expect(passageWindow([], new Map(), 0, 900, new Set())).toEqual({ prefix: [0], total: 0, runs: [] }));
});
