import { describe, expect, it } from 'vitest';
import type { ScenePassage } from '@drishya/scene';
import { FOLDED_HEADER_ESTIMATE, foldedHeights, foldedSteps, foldOf, measureKey } from '../src/lib/turn-fold.ts';

const passage = (id: string, inTurn?: number, opens = false): ScenePassage => ({ id, agentId: 'a', ops: [], prose: [], settled: false, matchesFilter: true, inTurn, ...(opens ? { turnStep: inTurn, turnPrompt: id } : {}) });
// Work before any prompt, then two turns at steps 3 and 9.
const passages = [passage('pre'), passage('t1', 3, true), passage('t1a', 3), passage('t1b', 3), passage('t2', 9, true), passage('t2a', 9)];

describe('turn folding', () => {
  it('folds stored turns by their opening passage, less the turns a reader must see', () => {
    expect(foldedSteps(passages, new Set(['t1', 't2']), new Set())).toEqual(new Set([3, 9]));
    expect(foldedSteps(passages, new Set(['t1', 't2']), new Set([9]))).toEqual(new Set([3]));
    // An id that is not an opening passage folds nothing.
    expect(foldedSteps(passages, new Set(['t1a', 'pre']), new Set())).toEqual(new Set());
  });

  it('keeps the opener as a header and hides the rest of its turn only', () => {
    const folded = new Set([3]);
    expect(passages.map((ps) => foldOf(ps, folded))).toEqual([undefined, 'header', 'hidden', 'hidden', undefined, undefined]);
  });

  it('gives hidden passages no height and keeps the open measurement for unfolding', () => {
    const measured = new Map([['t1', 400], ['t1a', 300], ['t1b', 200], [measureKey('t1', 'header'), 90]]);
    const heights = foldedHeights(passages, measured, new Set([3]));
    expect([heights.get('t1'), heights.get('t1a'), heights.get('t1b')]).toEqual([90, 0, 0]);
    expect(measured.get('t1')).toBe(400);
    expect(foldedHeights(passages, measured, new Set())).toBe(measured);
    expect(foldedHeights(passages, new Map(), new Set([9])).get('t2')).toBe(FOLDED_HEADER_ESTIMATE);
  });
});
