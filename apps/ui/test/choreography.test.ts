import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Projection, ReplayBundle } from '@drishya/contracts';
import { asOfProjection, compose, type Scene } from '@drishya/scene';
import { choreographyBetween, frameOf } from '../src/lib/choreography.ts';
import { splitDiffRows } from '../src/lib/split-diff.ts';

const bundle = JSON.parse(readFileSync(new URL('../public/demo/bundle.json', import.meta.url), 'utf8')) as ReplayBundle;
const p = bundle.projection;
describe('semantic choreography', () => {
  it('does not replay arrivals on initial load, same-step page changes or rewind', () => {
    const end = compose(p, { step: p.timeline.length });
    const frame = frameOf(end);
    for (const prior of [undefined, frame]) expect(choreographyBetween(prior, end, p)).toEqual({ arrivals: [], outcomes: [], prose: [], settle: [] });
    expect(choreographyBetween(frame, compose(p, { step: 1 }), asOfProjection(p, 1)).arrivals).toEqual([]);
  });
  it('resolves once at the actual outcome and surfaces only recorded prose', () => {
    const result = p.timeline.findIndex((item) => item.type === 'op-end');
    const before = compose(p, { step: result });
    const after = compose(p, { step: result + 1 });
    const plan = choreographyBetween(frameOf(before), after, asOfProjection(p, result + 1));
    expect(plan.outcomes).toEqual([(p.timeline[result] as { operationId: string }).operationId]);
    expect(plan.arrivals).toEqual([]);
    const prose = p.timeline.findIndex((item) => item.type === 'prose');
    expect(choreographyBetween(frameOf(compose(p, { step: prose })), compose(p, { step: prose + 1 }), asOfProjection(p, prose + 1)).prose).toEqual([(p.timeline[prose] as { proseId: string }).proseId]);
  });
  it('settles only a known passage that actually becomes earlier work', () => {
    const transitions = p.timeline.map((_, i) => choreographyBetween(frameOf(compose(p, { step: i })), compose(p, { step: i + 1 }), asOfProjection(p, i + 1)));
    expect(transitions.some((change) => change.settle.length > 0)).toBe(true);
  });
  it('uses a trailing page offset rather than repeated source sequence numbers', () => {
    const index = p.timeline.findIndex((item) => item.type === 'op-end');
    const partial = { ...asOfProjection(p, index + 1), timeline: p.timeline.slice(index, index + 1) };
    expect(choreographyBetween(frameOf(compose(p, { step: index })), compose(p, { step: index + 1 }), partial, index).outcomes)
      .toEqual([(p.timeline[index] as { operationId: string }).operationId]);
  });
});
describe('captured patch columns', () => {
  const hunks = [{ oldStart: 10, oldLines: 3, newStart: 20, newLines: 3, lines: [' same', '-old one', '-old two', '+new one', '+new two'] }];
  it('keeps captured text and old/new numbers, pairing by patch order', () => {
    expect(splitDiffRows(hunks)).toEqual([
      { before: { number: 10, text: 'same', kind: 'context' }, after: { number: 20, text: 'same', kind: 'context' } },
      { before: { number: 11, text: 'old one', kind: 'removed' }, after: { number: 21, text: 'new one', kind: 'added' } },
      { before: { number: 12, text: 'old two', kind: 'removed' }, after: { number: 22, text: 'new two', kind: 'added' } },
    ]);
  });
  it('does not synthesize a missing side at a page boundary', () => {
    const rows = splitDiffRows(hunks, 3, 1);
    expect(rows).toEqual([{ before: undefined, after: { number: 21, text: 'new one', kind: 'added' } }]);
  });
});

describe('visible beginning of a staged burst', () => {
  const projection = { timeline: Array.from({ length: 12 }, (_, i) => ({ type: 'op-start', operationId: `call-${i}`, sequence: i })) } as unknown as Projection;
  const scene = { step: 12, passages: [] } as unknown as Scene;
  it('spends its finite arrival budget on the beginning rather than off-screen final calls', () => {
    expect(choreographyBetween({ step: 0, settled: new Map() }, scene, projection).arrivals).toEqual(['call-0', 'call-1', 'call-2']);
    expect(choreographyBetween({ step: 10_000, settled: new Map() }, { ...scene, step: 10_012 }, projection, 10_000).arrivals).toEqual(['call-0', 'call-1', 'call-2']);
  });
  it('does not replay a historical mount or a backwards seek', () => {
    expect(choreographyBetween({ step: 12, settled: new Map() }, scene, projection).arrivals).toEqual([]);
    expect(choreographyBetween({ step: 15, settled: new Map() }, scene, projection).arrivals).toEqual([]);
  });
});
