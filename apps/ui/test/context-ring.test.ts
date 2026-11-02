import { describe, expect, it } from 'vitest';
import type { Projection, UsagePayload } from '@drishya/contracts';
import { contextLabel, contextOccupancy } from '../src/lib/context-ring.ts';

const request = (input: number, contextWindow?: number): UsagePayload => ({ source: 'codex-token-count', cumulative: false, tokens: { input }, ...(contextWindow ? { contextWindow } : {}) });
const cumulative = (total: number, contextWindow?: number): UsagePayload => ({ source: 'codex-token-count', cumulative: true, tokens: { total, input: total }, ...(contextWindow ? { contextWindow } : {}) });
const usage = (byTurn: Record<string, UsagePayload>, latest?: UsagePayload): Projection['usage'] => ({ byTurn, ...(latest ? { latest } : {}) });

describe('context occupancy', () => {
  it('is the last request’s input over the context window', () => {
    const c = contextOccupancy(usage({ a: request(40_000, 258_400), b: request(129_200, 258_400) }, cumulative(900_000, 258_400)));
    expect(c).toEqual({ used: 129_200, window: 258_400, fraction: .5 });
    expect(contextLabel(c!)).toContain('50%');
    expect(contextLabel(c!)).toContain('129,200 of 258,400 context window tokens');
    expect(contextLabel(c!)).toContain('ratio, computed');
    expect(contextLabel(c!)).not.toContain('Context in use');
  });
  it('takes the window from the session point when the request carries none', () => {
    expect(contextOccupancy(usage({ a: request(1_000) }, cumulative(5_000, 100_000)))?.fraction).toBe(.01);
  });
  it('never treats cumulative session tokens as occupied context', () => {
    expect(contextOccupancy(usage({ a: cumulative(900_000, 258_400) }, cumulative(900_000, 258_400)))).toBeUndefined();
  });
  it('shows nothing when the harness recorded no window or no usage (Claude Code)', () => {
    expect(contextOccupancy(usage({ a: request(1_000) }))).toBeUndefined();
    expect(contextOccupancy(undefined)).toBeUndefined();
    expect(contextOccupancy(usage({}))).toBeUndefined();
    expect(contextOccupancy(usage({ a: request(1_000, 0) }))).toBeUndefined();
  });
  it('clamps an over-full request to the whole ring', () => {
    expect(contextOccupancy(usage({ a: request(300_000, 258_400) }))?.fraction).toBe(1);
  });
});
