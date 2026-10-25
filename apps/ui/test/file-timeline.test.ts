import type { Operation } from '@drishya/contracts';
import { describe, expect, it } from 'vitest';
import { fileTimeline, timelineStep } from '../src/lib/file-timeline.ts';

const PATH = 'src/total.ts';
const read = (id: string): Operation => ({ id, kind: 'read', title: `Read ${id}`, artifactIds: [], paths: [{ path: PATH }], detail: { kind: 'read', path: PATH, startLine: 1, lineCount: 3, excerptArtifactId: `${id}_excerpt` } }) as unknown as Operation;
const edit = (id: string, hunks = 1): Operation => ({ id, kind: 'edit', title: `Edit ${id}`, artifactIds: [`${id}_before`, `${id}_after`], paths: [{ path: PATH }], detail: { kind: 'edit', path: PATH, hunks: Array.from({ length: hunks }, () => ({})) } }) as unknown as Operation;
const search = (id: string): Operation => ({ id, kind: 'search', title: `Search ${id}`, artifactIds: [], paths: [{ path: PATH }], detail: { kind: 'search', hits: [{ path: PATH, line: 2, text: 'total' }] } }) as unknown as Operation;

describe('file timeline', () => {
  const operations = [read('r1'), search('s1'), edit('e1'), edit('e2', 0), edit('other')];
  it('keeps one step per captured read or edit in order, preferring the patch and skipping searches', () => {
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
