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
