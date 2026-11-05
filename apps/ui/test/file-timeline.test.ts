import { fileOperationPage } from '../../../packages/scene/src/file-timeline.ts';
import type { Operation } from '@drishya/contracts';
import { describe, expect, it } from 'vitest';
import { fileTimeline, timelineStep } from '../src/lib/file-timeline.ts';

const PATH = 'src/total.ts';
const read = (id: string): Operation => ({ id, kind: 'read', title: `Read ${id}`, artifactIds: [], paths: [{ path: PATH }], detail: { kind: 'read', path: PATH, startLine: 1, lineCount: 3, excerptArtifactId: `${id}_excerpt` } }) as unknown as Operation;
const edit = (id: string, hunks = 1): Operation => ({ id, kind: 'edit', title: `Edit ${id}`, artifactIds: [`${id}_before`, `${id}_after`], paths: [{ path: PATH }], detail: { kind: 'edit', path: PATH, hunks: Array.from({ length: hunks }, () => ({})) } }) as unknown as Operation;
const search = (id: string): Operation => ({ id, kind: 'search', title: `Search ${id}`, artifactIds: [], paths: [{ path: PATH }], detail: { kind: 'search', hits: [{ path: PATH, line: 2, text: 'total' }] } }) as unknown as Operation;

describe('file timeline', () => {
  const operations = [read('r1'), search('s1'), edit('e1'), edit('e2', 0), edit('other')];
  it('keeps one step per read or edit in order, preferring the patch and skipping searches', () => {
    const steps = fileTimeline(operations.slice(0, 4), PATH);
    expect(steps.map((step) => step.key)).toEqual(['r1/read', 'e1/patch', 'e2/before']);
    expect(fileTimeline([edit('x'), read('y')], 'elsewhere.ts')).toEqual([]);
  });
  it('steps by operation so any evidence of an operation counts as its position', () => {
    const steps = fileTimeline(operations.slice(0, 4), PATH);
    const after = { ...steps[1]!, key: 'e1/after' };
    expect(timelineStep(steps, after)).toMatchObject({ position: 2, total: 3, previous: steps[0], next: steps[2] });
    expect(timelineStep(steps, steps[0])).toMatchObject({ position: 1, previous: undefined, next: steps[1] });
    expect(timelineStep(steps, steps[2])).toMatchObject({ position: 3, next: undefined, previous: steps[1] });
  });
  it('lets a selection outside the sequence enter it at either end', () => {
    const steps = fileTimeline(operations.slice(0, 4), PATH);
    const outside = { ...steps[0]!, operation: search('s1') };
    expect(timelineStep(steps, outside)).toEqual({ total: 3, previous: steps[2], next: steps[0] });
    expect(timelineStep([], undefined)).toEqual({ total: 0, previous: undefined, next: undefined });
  });
});


describe('whole-session file timeline metadata', () => {
  const actions = [read('first'), ...Array.from({ length: 52 }, (_, n) => search(`s${n}`)), edit('last')];
  it('counts the whole path without shipping every operation and skips search-only pages directly', () => {
    const first = fileOperationPage(actions, PATH, 0, 24, '', 'first');
    expect(first.total).toBe(54);
    expect(first.operations).toHaveLength(24);
    expect(first.timeline).toEqual({ total: 2, positions: { first: 1 }, first: { operationId: 'first', start: 0 }, last: { operationId: 'last', start: 48 }, selected: { operationId: 'first', position: 1, previous: undefined, next: { operationId: 'last', start: 48 } } });
    const middle = fileOperationPage(actions, PATH, 24, 24, '', 'last');
    expect(middle.timeline.positions).toEqual({});
    expect(middle.timeline.selected).toMatchObject({ position: 2, previous: { operationId: 'first', start: 0 }, next: undefined });
  });
  it('counts only material of this exact path, not multi-path search hits or unavailable reads', () => {
    const missing = read('missing'); if (missing.detail.kind === 'read') delete missing.detail.excerptArtifactId;
    const unrelated = read('other'); if (unrelated.detail.kind === 'read') unrelated.detail.path = 'other.ts';
    const page = fileOperationPage([read('one'), missing, unrelated, search('match'), edit('two')], PATH, 0, 24);
    expect(page.total).toBe(5);
    expect(page.timeline.total).toBe(2);
    expect(page.timeline.positions).toEqual({ one: 1, two: 2 });
    expect(fileOperationPage([missing], PATH, 0, 24).timeline.total).toBe(0);
  });
  it('respects the active action filter without exposing selected metadata from outside it', () => {
    expect(fileOperationPage(actions, PATH, 0, 24, 'last', 'first')).toMatchObject({ total: 1, timeline: { total: 1, positions: { last: 1 }, selected: undefined } });
    expect(fileOperationPage(actions, 'other.ts', 0, 24, '', 'first')).toMatchObject({ total: 0, timeline: { total: 0, selected: undefined } });
  });
  it('recomputes the count when a previously missing read result arrives', () => {
    const pending = read('pending'); if (pending.detail.kind === 'read') delete pending.detail.excerptArtifactId;
    expect(fileOperationPage([pending, edit('e')], PATH, 0, 24).timeline.total).toBe(1);
    expect(fileOperationPage([read('pending'), edit('e')], PATH, 0, 24).timeline.positions).toEqual({ pending: 1, e: 2 });
  });
});
