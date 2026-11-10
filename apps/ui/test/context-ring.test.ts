import { describe, expect, it } from 'vitest';
import type { Projection, UsagePayload } from '@drishya/contracts';
import { contextReport } from '../src/lib/context-report.ts';
import { contextLabel, contextOccupancy, liveContextOccupancy } from '../src/lib/context-ring.ts';

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
describe('live context with a /context report (USAGE-1)', () => {
  const reading = (tokens: number) => ({ id: 'c', agentId: 'a', source: 'claude-message-usage' as const, availableAfterStep: 1, observationIds: [], input: { tokens, basis: 'derived-request-input' as const } });
  const report = (line: string) => contextReport(`<local-command-stdout> Context Usage\n⛁ ⛁   model\n⛁ ⛁   ${line}\n⛁ ⛁   ⛁ System prompt: 2.3k tokens (0.2%)\n⛁ ⛁   ⛁ Messages: 266.9k tokens (26.7%)</local-command-stdout>`) && { report: contextReport(`<local-command-stdout> Context Usage\n⛁ ⛁   model\n⛁ ⛁   ${line}\n⛁ ⛁   ⛁ System prompt: 2.3k tokens (0.2%)\n⛁ ⛁   ⛁ Messages: 266.9k tokens (26.7%)</local-command-stdout>`)!, time: '2026-11-01T10:00:00Z' };
  const projection = (tokens = 293_000) => ({ agents: [{ id: 'a' }], usage: undefined, context: { readings: [reading(tokens)] } }) as any;
  it('takes the window the report printed, labelled as computed from it', () => {
    const c = liveContextOccupancy(projection(250_000), report('293k/1M tokens (29%)'))!;
    expect(c).toMatchObject({ used: 250_000, window: 1_000_000, fraction: .25 });
    expect(contextLabel(c)).toMatch(/\/context report.*25% ratio, computed\.$/);
  });
  it('shows nothing without a report, without a printed window, or without a reading', () => {
    expect(liveContextOccupancy(projection())).toBeUndefined();
    expect(liveContextOccupancy(projection(), report('no total here'))).toBeUndefined();
    expect(liveContextOccupancy({ ...projection(), context: { readings: [] } }, report('293k/1M tokens (29%)'))).toBeUndefined();
  });
  it('prefers a window the harness recorded itself', () => {
    const recorded = { latest: { source: 'codex-token-count', cumulative: true, contextWindow: 100_000 }, byTurn: { a: { source: 'codex-token-count', cumulative: false, tokens: { input: 50_000 }, contextWindow: 100_000 } } } as any;
    expect(liveContextOccupancy({ ...projection(), usage: recorded }, report('293k/1M tokens (29%)'))?.fraction).toBe(.5);
  });
});
