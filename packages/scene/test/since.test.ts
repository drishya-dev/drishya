import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Projection } from '@drishya/contracts';
import { Ingestor } from '@drishya/ingest';
import { Store } from '@drishya/store';
import { sinceBoundary } from '../src/index.ts';
import { sinceSnapshot } from '../src/since.ts';

// P2-A "Since your last visit": deterministic facts after a reading boundary, each linked to its
// operation. Facts only: what changed, what failed, what ran, what is unfinished, what is missing.
const fixtures = fileURLToPath(new URL('../../../fixtures/synthetic', import.meta.url));
let dir: string;
let store: Store;
let p: Projection;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-since-'));
  store = new Store(dir);
  const ingest = new Ingestor(store);
  p = ingest.projection((await ingest.importSource('claude-code', join(fixtures, 'claude/checkout-fix.jsonl'))).recordingId);
});
afterAll(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

const tests = () => p.operations.filter((o) => o.kind === 'test');

describe('sinceBoundary', () => {
  it('pages bounded review groups by position without losing outcomes with the same sequence', () => {
    const operation = tests()[0]!;
    const projection = { ...p, operations: Array.from({ length: 45 }, (_, index) => ({ ...operation, id: `same-outcome-${index}` })) };
    const first = sinceSnapshot(projection, -1), next = sinceSnapshot(projection, -1, 1), last = sinceSnapshot(projection, -1, 2);
    expect(first.tests).toHaveLength(20); expect(next.tests).toHaveLength(20); expect(last.tests).toHaveLength(5);
    expect(next.counts.tests).toBe(45);
    expect(new Set([...first.tests, ...next.tests, ...last.tests].map(item => item.operationId)).size).toBe(45);
    expect(sinceSnapshot(projection, -1, -1).tests).toEqual(first.tests);
  });
  it('with no boundary, reports the whole recording', () => {
    const d = sinceBoundary(p, -1);
    expect(d.newSteps).toBe(p.timeline.length);
    expect(d.tests.map((t) => t.status)).toEqual(['error', 'ok']);
    expect(d.failures.map((f) => f.operationId)).toContain(tests()[0]!.id);
    expect(d.edits.length).toBeGreaterThan(0);
    expect(d.editedFiles).toContain('src/checkout/guard.ts');
  });

  it('at the latest sequence, reports nothing new', () => {
    const d = sinceBoundary(p, p.lastSequence);
    expect(d.newSteps).toBe(0);
    expect([...d.edits, ...d.failures, ...d.tests, ...d.unfinished, ...d.gaps]).toHaveLength(0);
  });

  it('after the failing test, shows the edit and the passing rerun but not the old failure', () => {
    const failed = tests()[0]!;
    const boundary=p.timeline[failed.endSequence!]!.sequence;
    const d = sinceBoundary(p, boundary);
    expect(d.failures.map((f) => f.operationId)).not.toContain(failed.id);
    expect(d.tests.map((t) => t.operationId)).toEqual([tests()[1]!.id]);
    expect(d.tests[0]!.detail).toMatch(/passed/);
    expect(d.editedFiles).toContain('src/checkout/guard.ts');
    expect(d.newSteps).toBeLessThan(p.timeline.length);
    // Every item links to a real operation and sits after the boundary, in order.
    const items = [...d.edits, ...d.tests];
    expect(items.every((i) => i.sequence > boundary && p.operations.some((o) => o.id === i.operationId))).toBe(true);
  });

  it('counts an operation that resolved after the boundary even if it started before', () => {
    const rerun = tests()[1]!;
    const d = sinceBoundary(p, p.timeline[rerun.startSequence]!.sequence);
    expect(d.tests.map((t) => t.operationId)).toContain(rerun.id);
  });

  it('lists still-running operations and capture gaps after the boundary', () => {
    const q = structuredClone(p);
    const op = q.operations.at(-1)!;
    op.status = 'running';
    op.endSequence = undefined;
    q.lastSequence++;
    q.gaps.push({ sequence: q.timeline.length, reason: 'malformed-record' });
    q.timeline.push({type:'gap',id:'synthetic-gap',sequence:q.lastSequence,agentId:op.agentId,reason:'malformed-record'});
    const d = sinceBoundary(q, q.lastSequence - 1);
    expect(d.unfinished.map((u) => u.operationId)).toContain(op.id);
    expect(d.gaps).toEqual([expect.objectContaining({ sequence: q.lastSequence, title: expect.stringMatching(/malformed/) })]);
  });
  it('uses captured observation sequences across metadata and late results, not timeline offsets',()=>{
    const op={...tests()[0]!,startSequence:0,endSequence:1};
    const q={...p,operations:[op],gaps:[],lastSequence:42,timeline:[{type:'op-start' as const,id:'s',operationId:op.id,sequence:40,agentId:op.agentId},{type:'op-end' as const,id:'e',operationId:op.id,sequence:42,agentId:op.agentId}]};
    expect(sinceBoundary(q,41).tests).toEqual([expect.objectContaining({operationId:op.id,sequence:42,sequenceBasis:'captured-observation'})]);
    expect(sinceBoundary(q,42).tests).toHaveLength(0);
    const missing={...q,timeline:[]};expect(sinceBoundary(missing,10).unplacedCount).toBe(1);expect(sinceBoundary(missing,10).tests).toHaveLength(0);expect(sinceBoundary(missing,-1).tests[0]!.sequenceBasis).toBe('timeline-position');
  });
});

describe('REVIEW-1 Changes facts', () => {
  it('counts captured +/- per edited file with the turn of its last edit, and groups repeated gaps', () => {
    const snapshot = sinceSnapshot(p, -1);
    const stats = snapshot.fileStats ?? {};
    for (const path of snapshot.editedFiles) {
      expect(stats[path]).toBeDefined();
      expect(stats[path]!.added).toBeGreaterThanOrEqual(0);
      expect(stats[path]!.edits).toBeGreaterThan(0);
    }
    const added = Object.values(stats).reduce((sum, stat) => sum + stat.added, 0);
    expect(added).toBeGreaterThan(0);
    expect(snapshot.gapGroups?.reduce((sum, group) => sum + group.count, 0)).toBe(snapshot.counts.gaps);
  });
});

it('reads nine identical capture gaps as one grouped line', () => {
  const gaps = Array.from({ length: 9 }, (_, i) => ({ sequence: i, reason: 'source-truncated' }));
  const snapshot = sinceSnapshot({ ...p, gaps } as Projection, -1);
  expect(snapshot.counts.gaps).toBe(9);
  expect(snapshot.gapGroups).toEqual([{ title: expect.stringContaining('source truncated'), count: 9 }]);
});

describe('READ-5 per-file edits by turn', () => {
  const edit = (id: string, path: string, lines: string[]) => ({ ...p.operations.find((o) => o.kind === 'edit')!, id, agentId: 'a', status: 'ok' as const, paths: [{ path, role: 'write' as const, basis: 'captured' as const }], detail: { kind: 'edit' as const, path, hunks: [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines }], created: false, reconstruction: 'available' as const } });
  const test = (id: string, status: 'ok' | 'error' | 'running', declined = false) => ({ ...tests()[0]!, id, agentId: 'a', status, declined: declined ? ({} as never) : undefined });
  const tl = (type: 'op-start' | 'op-end', operationId: string, sequence: number) => ({ type, id: `${type}-${operationId}`, operationId, sequence, agentId: 'a' });
  const turn = (sequence: number) => ({ type: 'turn' as const, id: `turn-${sequence}`, sequence, agentId: 'a' });
  // Operation start/end offsets are deliberately wrong: only observation sequences may place an edit.
  const build = () => {
  const ops = [edit('e1', 'a.ts', ['+x', '+y', '-z']), test('t1', 'error'), edit('e2', 'a.ts', ['+q']), test('t-declined', 'ok', true), edit('e3', 'a.ts', ['-w']), test('t-late', 'ok'), edit('lost', 'a.ts', ['+l'])].map((o) => ({ ...o, startSequence: 0, endSequence: 0 }));
  const q = { ...p, gaps: [], lastSequence: 40, operations: ops, timeline: [turn(1), tl('op-start', 'e1', 2), tl('op-end', 'e1', 3), tl('op-start', 't1', 4), tl('op-end', 't1', 5), tl('op-start', 'e2', 6), tl('op-end', 'e2', 7), tl('op-start', 't-declined', 8), turn(10), tl('op-start', 'e3', 11), tl('op-end', 'e3', 12), turn(20), tl('op-start', 't-late', 21), tl('op-end', 't-late', 22), tl('op-end', 'lost', 30)] } as unknown as Projection;
  return q;
  };
  const stat = () => sinceSnapshot(build(), -1).fileStats!['a.ts']!;

  it('attributes each edit to its own turn with its recorded +/-', () => {
    expect(stat().fileEdits!.slice(0, 3).map((e) => [e.operationId, e.turn, e.added, e.removed])).toEqual([['e1', 1, 2, 1], ['e2', 1, 1, 0], ['e3', 2, 0, 1]]);
    expect(stat()).toMatchObject({ added: 4, removed: 2, edits: 4 });
  });
  it('links the next test run only when it is recorded in the same turn after the edit', () => {
    const [e1, e2, e3] = stat().fileEdits!;
    expect(e1!.nextTest).toEqual({ operationId: 't1', outcome: 'failed' });
    expect(e2!.nextTest).toBeUndefined(); // the only later test in this turn was declined, so it never ran
    expect(e3!.nextTest).toBeUndefined(); // t-late belongs to the next prompt
  });
  it('shows an edit with no captured start position as unattributed', () => {
    const lost = stat().fileEdits!.find((e) => e.operationId === 'lost')!;
    expect(lost.turn).toBeUndefined();
    expect(lost.nextTest).toBeUndefined();
  });
  it('lists at most the edit limit but counts every edit', () => {
    const many = Array.from({ length: 25 }, (_, i) => edit(`m${i}`, 'm.ts', ['+a']));
    const r = { ...build(), operations: many, timeline: [turn(1), ...many.map((o, i) => tl('op-start', o.id, 2 + i))] } as unknown as Projection;
    const s = sinceSnapshot(r, -1).fileStats!['m.ts']!;
    expect(s.edits).toBe(25); expect(s.fileEdits).toHaveLength(20); expect(s.added).toBe(25);
  });
});
