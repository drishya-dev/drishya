import { describe, expect, it } from 'vitest';
import type { Projection } from '@drishya/contracts';
import { dwellFor } from '@drishya/scene';
import { stageIncomingWork, stageViewportGrowth } from '../src/lib/live-pacing.ts';

const projection = {
  timeline: [
    { type: 'op-start', operationId: 'call', sequence: 1 },
    { type: 'op-end', operationId: 'call', sequence: 2 },
    { type: 'prose', proseId: 'short', sequence: 3 },
    { type: 'prose', proseId: 'long', sequence: 4 },
  ],
  operations: [{ id: 'call', kind: 'shell', status: 'ok', detail: { kind: 'shell', command: 'echo done', outputPreview: 'done' } }],
  prose: [
    { id: 'short', role: 'assistant', text: 'Done.' },
    { id: 'long', role: 'assistant', text: 'A long captured explanation. '.repeat(30) },
  ],
} as unknown as Projection;

describe('presentation pacing', () => {
  it('follows short arrivals but stages a burst or a long captured explanation', () => {
    expect(stageIncomingWork(projection, 0, 1)).toBe(false);
    expect(stageIncomingWork(projection, 0, 3)).toBe(false);
    expect(stageIncomingWork(projection, 0, 4)).toBe(true);
    expect(stageIncomingWork(projection, 3, 4)).toBe(true);
  });

  it('gives the visible prose step reading time during optional replay', () => {
    expect(dwellFor(projection, 4)).toBeGreaterThan(dwellFor(projection, 2));
    expect(dwellFor(projection, 4, 2)).toBe(dwellFor(projection, 4) / 2);
  });

  it('stages prose in a paged timeline using its global step offset', () => {
    expect(stageIncomingWork(projection, 10_003, 10_004, 10_000)).toBe(true);
    expect(stageIncomingWork(projection, 10_002, 10_003, 10_000)).toBe(false);
  });

  it('holds for a large late material but permits a small resolution on a narrow viewport', () => {
    expect(stageViewportGrowth(1000, 1250, 720)).toBe(true);
    expect(stageViewportGrowth(1000, 1120, 360)).toBe(true);
    expect(stageViewportGrowth(1000, 1024, 360)).toBe(false);
    expect(stageViewportGrowth(1000, 900, 360)).toBe(false);
  });

  it('stages substantial MCP input without serializing its nested payload', () => {
    const input = { payload: { toJSON() { throw new Error('camera must not serialize tool input'); } } };
    const p = { ...projection, operations: [{ id: 'call', detail: { kind: 'mcp', input } }] } as unknown as Projection;
    expect(stageIncomingWork(p, 0, 1)).toBe(true);
  });
});
