import { describe, expect, it } from 'vitest';
import type { Operation } from '@drishya/contracts';
import type { ScenePassage } from '@drishya/scene';
import { conversationRuns, runFold, runHeights, runMeasureKey, RUN_FOLDED_ESTIMATE } from '../src/lib/conversation-runs.ts';
import { runLedger, runLine } from '../src/lib/run-ledger.ts';

const passage = (id: string, patch: Partial<ScenePassage> & { ops?: string[]; prose?: string[] } = {}): ScenePassage => {
  const { ops = [], prose = [], ...rest } = patch;
  return {
    id, agentId: 'a', settled: false, matchesFilter: true, inTurn: 1,
    ops: ops.map((opId) => ({ id: opId, kind: 'read', title: opId, tool: 'Read', state: 'ok', phase: 'settled', resolving: false, origin: { type: 'native', tool: 'Read' }, paths: [], matchesFilter: true, selected: false }) as ScenePassage['ops'][number]),
    prose: prose.map((proseId) => ({ id: proseId, role: 'message', exposure: 'full', arriving: false }) as ScenePassage['prose'][number]),
    ...rest,
  };
};
const prompt = (id: string, turn: number): ScenePassage => passage(id, { turnPrompt: 'do it', turnStep: turn, inTurn: turn });

describe('conversationRuns', () => {
  it('ends a run at the agent\'s text and starts the next at the next operation', () => {
    const runs = conversationRuns([prompt('p1', 1), passage('a', { ops: ['o1', 'o2'], prose: ['m1'] }), passage('b', { ops: ['o3'], prose: ['m2'] })]);
    expect(runs.map((run) => [run.id, run.operationIds])).toEqual([['a', ['o1', 'o2']], ['b', ['o3']]]);
  });

  it('keeps one run across the ops-only passages the composer splits a very long run into', () => {
    const runs = conversationRuns([passage('a', { ops: ['o1'] }), passage('b', { ops: ['o2'] }), passage('c', { ops: ['o3'], prose: ['m'] })]);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ id: 'a', passageIds: ['a', 'b', 'c'], operationIds: ['o1', 'o2', 'o3'] });
  });

  it('never carries a run over a prompt, a compaction seam or a page that is not loaded', () => {
    expect(conversationRuns([passage('a', { ops: ['o1'] }), passage('b', { ops: ['o2'], turnStep: 5, inTurn: 5, turnPrompt: 'next' })]).map((run) => run.id)).toEqual(['a', 'b']);
    expect(conversationRuns([passage('a', { ops: ['o1'] }), passage('seam', { compactionIds: ['c1'] }), passage('b', { ops: ['o2'] })]).map((run) => run.id)).toEqual(['a', 'b']);
    expect(conversationRuns([passage('a', { ops: ['o1'] }), passage('gap', { unloaded: true }), passage('b', { ops: ['o2'] })]).map((run) => run.id)).toEqual(['a', 'b']);
  });

  it('lets two agents work at once without splitting each other\'s run', () => {
    const runs = conversationRuns([passage('a1', { ops: ['o1'] }), passage('b1', { agentId: 'sub', ops: ['s1'], prose: ['sm'] }), passage('a2', { ops: ['o2'], prose: ['m'] })]);
    expect(runs.map((run) => [run.id, run.operationIds])).toEqual([['a1', ['o1', 'o2']], ['b1', ['s1']]]);
  });

  it('does not start a run for a passage that only talks', () => {
    expect(conversationRuns([passage('t', { prose: ['m'] })])).toEqual([]);
  });
});

describe('runFold', () => {
  const passages = [prompt('p1', 1), passage('a', { ops: ['o1'] }), passage('b', { ops: ['o2'], prose: ['m'] }), passage('c', { ops: ['o3'], prose: ['m2'] })];
  const runs = conversationRuns(passages);

  it('folds every run unless the reader opened it', () => {
    const fold = runFold(runs, passages, new Set(), new Set());
    expect([...fold.folded]).toEqual(['a', 'b', 'c']);
    expect(fold.views.get('a')).toEqual({ runId: 'a', lead: true, open: false });
    expect(fold.views.get('b')).toEqual({ runId: 'a', lead: false, open: false });
    expect(runFold(runs, passages, new Set(['a']), new Set()).folded.has('a')).toBe(false);
  });

  it('opens the run of a passage the reader was sent to, whichever of its passages that is', () => {
    const fold = runFold(runs, passages, new Set(), new Set(['b']));
    expect(fold.views.get('a')!.open).toBe(true);
    expect(fold.views.get('c')!.open).toBe(false);
  });

  it('hides a later passage of a folded run only when it has nothing else to show', () => {
    const split = [passage('a', { ops: ['o1'] }), passage('b', { ops: ['o2'] }), passage('c', { ops: ['o3'], prose: ['m'] })];
    const fold = runFold(conversationRuns(split), split, new Set(), new Set());
    expect([...fold.hidden]).toEqual(['b']);
  });

  it('leaves the runs of a folded turn to the turn fold', () => {
    expect(runFold(runs, passages, new Set(), new Set(), new Set([1])).folded.size).toBe(0);
  });

  it('gives the virtual list its own heights: hidden none, folded their measurement, unmeasured the estimate', () => {
    const split = [passage('a', { ops: ['o1'] }), passage('b', { ops: ['o2'] }), passage('c', { ops: ['o3'], prose: ['m'] })];
    const fold = runFold(conversationRuns(split), split, new Set(), new Set());
    const heights = runHeights(new Map([['a', 900], ['b', 500], ['c', 700], ['c#run', 130]]), new Map([['a', 900], ['b', 500], ['c', 700], ['c#run', 130]]), fold);
    expect([heights.get('a'), heights.get('b'), heights.get('c')]).toEqual([RUN_FOLDED_ESTIMATE, 0, 130]);
    expect(runMeasureKey('c', true)).toBe('c#run');
    expect(runMeasureKey('c', false)).toBe('c');
  });
});

const op = (patch: Partial<Operation>): Operation => ({
  id: 'x', agentId: 'a', kind: 'read', tool: 'Read', title: 'x', titleProvenance: 'captured', origin: { type: 'native', tool: 'Read' }, status: 'ok',
  startSequence: 0, paths: [], detail: { kind: 'other' }, artifactIds: [], observationIds: [], classification: 'captured', ...patch,
}) as unknown as Operation;

describe('runLine', () => {
  it('writes the turn ledger\'s wording for the run', () => {
    const edit = op({ kind: 'edit', tool: 'Edit', detail: { kind: 'edit', path: 'a.ts', hunks: [{ lines: ['+one', '+two', '-three', ' same'] }] } as never });
    const line = runLine([
      op({ id: '1', startTime: '2026-11-13T10:00:00Z', endTime: '2026-11-13T10:00:02Z' }), op({ id: '2' }), op({ id: '3', kind: 'search' }), edit,
      op({ id: '5', kind: 'shell', tool: 'Bash', status: 'error', endTime: '2026-11-13T10:01:25Z' }),
    ]);
    expect(line.text).toBe('read 2 · searched 1 · edited 1 file (+2 −1) · 1 command · 1 failed · 1 m 25 s');
    expect(line.failed).toBe(true);
  });

  it('keeps the failure mark off a clean run and on a run with a failed command', () => {
    expect(runLine([op({ id: '1' })]).failed).toBe(false);
    expect(runLine([op({ id: '1' }), op({ id: '2', kind: 'shell', status: 'error' })]).failed).toBe(true);
  });

  it('does not call a permission decision a failure', () => {
    const line = runLine([op({ id: '1', kind: 'shell', status: 'error', declined: { by: 'person' } })]);
    expect(line.failed).toBe(false);
    expect(line.text).toBe('1 command · 1 declined');
  });

  it('never writes an empty line, and says nothing the capture does not hold', () => {
    expect(runLine([op({ id: '1', kind: 'plan' })]).text).toBe('1 action');
    expect(runLedger([op({ id: '1' })]).durationMs).toBeUndefined();
  });
});
