import { describe, expect, it } from 'vitest';
import { firstChangeOffset } from '../src/lib/change-preview.ts';
import type { Hunk } from '@drishya/contracts';

const hunk = (lines: string[]): Hunk => ({ oldStart: 1, newStart: 1, oldLines: lines.length, newLines: lines.length, lines });
describe('changed-line preview focus', () => {
  it('finds a change after long context without losing its patch offset', () => {
    expect(firstChangeOffset([hunk(Array.from({ length: 24 }, () => ' unchanged')), hunk([' context', '-old', '+new'])])).toBe(22);
  });
  it('preserves initial creations and context-only patches', () => {
    expect(firstChangeOffset([hunk(['+created'])])).toBe(0);
    expect(firstChangeOffset([hunk([' context'])])).toBe(0);
  });
});
