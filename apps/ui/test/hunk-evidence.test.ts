import { describe, expect, it } from 'vitest';
import type { Hunk, Operation, TimelineItem } from '@drishya/contracts';
import { patchEvidenceKey, recordedEditsForHunk, recordedPicks } from '../src/lib/hunk-evidence.ts';

const hunk = (...lines: string[]): Hunk => ({ oldStart: 1, oldLines: 1, newStart: 1, newLines: lines.length, lines });
const edit = (id: string, path: string, hunks: Hunk[], status: Operation['status'] = 'ok', extra: Partial<Operation> = {}): Operation => ({ id, kind: 'edit', status, title: `Edited ${path}`, agentId: 'main', startSequence: 0, detail: { kind: 'edit', path, hunks }, ...extra } as unknown as Operation);
const turn = (sequence: number, agentId = 'main'): TimelineItem => ({ type: 'turn', id: `t${sequence}`, sequence, agentId });

const body = ['+export const total = (cart: Cart) => {', '+  return cart.items.reduce((sum, item) => sum + item.price, 0);', '+};'];

describe('recorded edits for a Git hunk', () => {
  it('finds the captured edit that wrote exactly those lines, even with context and removals around them', () => {
    const wrote = edit('e1', 'src/total.ts', [hunk(' // old', '-return 0;', ...body)]);
    const other = edit('e2', 'src/other.ts', [hunk(...body)]);
    expect(recordedEditsForHunk(hunk(' context', ...body), 'src/total.ts', [other, wrote])).toEqual([wrote]);
    expect(patchEvidenceKey(wrote)).toBe('e1/patch');
  });
  it('lists several edits when several wrote the same lines, and none when the lines differ', () => {
    const a = edit('a', 'f.ts', [hunk(...body)]), b = edit('b', 'f.ts', [hunk(...body)]);
    expect(recordedEditsForHunk(hunk(...body), 'f.ts', [a, b]).map(op => op.id)).toEqual(['a', 'b']);
    expect(recordedEditsForHunk(hunk(...body.slice(0, 2), '+};  // changed'), 'f.ts', [a, b])).toEqual([]);
  });
  it('needs the lines in order and contiguous in the edit', () => {
    const spread = edit('s', 'f.ts', [hunk(body[0]!, '+  const extra = 1;', body[1]!, body[2]!)]);
    expect(recordedEditsForHunk(hunk(...body), 'f.ts', [spread])).toEqual([]);
  });
  it('ignores failed edits and a hunk with nothing distinctive', () => {
    expect(recordedEditsForHunk(hunk(...body), 'f.ts', [edit('x', 'f.ts', [hunk(...body)], 'error')])).toEqual([]);
    const braces = edit('b', 'f.ts', [hunk('+}', '+}')]);
    expect(recordedEditsForHunk(hunk('+}', '+}'), 'f.ts', [braces])).toEqual([]);
    expect(recordedEditsForHunk(hunk(' only context', '-gone'), 'f.ts', [braces])).toEqual([]);
  });
});

describe('recorded work picker entries', () => {
  const a = edit('a', 'f.ts', [hunk(...body)], 'ok', { startSequence: 5 }), b = edit('b', 'f.ts', [hunk(...body)], 'ok', { startSequence: 12 });
  it('lists the newest edit first and counts turns from the edit agent captured prompts', () => {
    const picks = recordedPicks([a, b], [turn(1), turn(10), turn(20)]);
    expect(picks.map(pick => [pick.key, pick.turn, pick.label])).toEqual([['b/patch', 2, 'Turn 2 · Edited f.ts'], ['a/patch', 1, 'Turn 1 · Edited f.ts']]);
    expect(picks.some(pick => pick.twin)).toBe(false);
  });
  it('labels by title alone when no prompt of that agent precedes the edit', () => {
    const sub = edit('s', 'f.ts', [hunk(...body)], 'ok', { startSequence: 7, agentId: 'sub' });
    expect(recordedPicks([sub], [turn(1)]).map(pick => [pick.turn, pick.label])).toEqual([[undefined, 'Edited f.ts']]);
    expect(recordedPicks([a], [turn(9)]).map(pick => pick.label)).toEqual(['Edited f.ts']);
  });
  it('marks entries that read identically so the menu can add their captured time', () => {
    const picks = recordedPicks([a, b], [turn(1)]);
    expect(picks.map(pick => pick.twin)).toEqual([true, true]);
  });
});
