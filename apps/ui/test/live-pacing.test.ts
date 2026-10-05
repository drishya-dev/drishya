import { describe, expect, it } from 'vitest';
import type { Projection } from '@drishya/contracts';
import { dwellFor } from '@drishya/scene';
import { stageIncomingWork } from '../src/lib/live-pacing.ts';

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
});
