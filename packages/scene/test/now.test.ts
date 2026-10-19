import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Projection } from '@drishya/contracts';
import { Ingestor } from '@drishya/ingest';
import { Store } from '@drishya/store';
import { nowFacts } from '../src/now.ts';

// "Now" facts come from captured evidence only: open calls, the newest event and the turn so far.
const fixtures = fileURLToPath(new URL('../../../fixtures/synthetic', import.meta.url));
let dir: string;
let store: Store;
let p: Projection;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-now-'));
  store = new Store(dir);
  const ingest = new Ingestor(store);
  p = ingest.projection((await ingest.importSource('claude-code', join(fixtures, 'claude/checkout-fix.jsonl'))).recordingId);
});
afterAll(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

const withOpen = (projection: Projection, patch: (op: Projection['operations'][number]) => void, index = projection.operations.length - 1): Projection => {
  const copy = structuredClone(projection);
  copy.operations[index]!.status = 'running';
  patch(copy.operations[index]!);
  return copy;
};

describe('nowFacts', () => {
  it('reports a finished recording as having nothing open and names its newest event', () => {
    const facts = nowFacts(p);
    expect(facts.openCount).toBe(0);
    expect(facts.open).toEqual([]);
    expect(facts.last).toBeDefined();
    expect(facts.agents).toBe(p.agents.length);
  });

  it('counts the turn so far from the newest user prompt', () => {
    const facts = nowFacts(p);
    expect(facts.turn.operations).toBeGreaterThan(0);
    expect(facts.turn.operations).toBeLessThanOrEqual(p.operations.length);
  });

  it('lists a call with no result as open, newest first, with the fields a sentence can name', () => {
    const copy = withOpen(p, () => {});
    const fact = nowFacts(copy).open[0]!;
    const op = copy.operations.at(-1)!;
    expect(fact).toMatchObject({ id: op.id, kind: op.kind, tool: op.tool, title: op.title, sequence: op.startSequence, asking: false });
    expect(fact.agentLabel).toBe(copy.agents.find((agent) => agent.id === op.agentId)?.label);
  });

  it('bounds how many open calls it returns but still counts them all', () => {
    const copy = structuredClone(p);
    for (const op of copy.operations) op.status = 'running';
    const facts = nowFacts(copy, 2);
    expect(facts.open).toHaveLength(2);
    expect(facts.openCount).toBe(copy.operations.length);
    expect(facts.open[0]!.sequence).toBeGreaterThan(facts.open[1]!.sequence);
  });

  it('marks an open question to the person as asking, and only that', () => {
    expect(nowFacts(withOpen(p, (op) => { op.tool = 'AskUserQuestion'; })).open[0]!.asking).toBe(true);
    expect(nowFacts(withOpen(p, (op) => { op.tool = 'request_user_input_async'; })).open[0]!.asking).toBe(true);
    expect(nowFacts(withOpen(p, (op) => { op.tool = 'Bash'; })).open[0]!.asking).toBe(false);
  });

  it('keeps captured fields bounded and never copies a whole input', () => {
    const copy = withOpen(p, (op) => { op.detail = { kind: 'shell', command: 'x'.repeat(5000) }; op.kind = 'shell'; });
    expect(nowFacts(copy).open[0]!.command!.length).toBeLessThanOrEqual(200);
  });

  it('is deterministic and empty-safe', () => {
    expect(nowFacts(p)).toEqual(nowFacts(p));
    const empty = structuredClone(p);
    empty.operations = []; empty.timeline = []; empty.prose = [];
    expect(nowFacts(empty)).toMatchObject({ open: [], openCount: 0, turn: { operations: 0 }, last: undefined });
  });
});
