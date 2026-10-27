import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Store } from '@drishya/store';
import { Ingestor } from '@drishya/ingest';
import { intentOf as claudeIntent } from '../../adapter-claude/src/index.ts';
import { intentOf as codexIntent } from '../../adapter-codex/src/index.ts';
import type { Projection } from '@drishya/contracts';
import { asOfProjection, compose, pinnedPlans, planThreads } from '../src/index.ts';
import { PLAN_ITEMS, PLAN_REVISIONS, planItems, planPrompt, planRows } from '../../../tests/fixtures/plan-living.ts';

let dir: string, store: Store, projection: Projection;
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-living-plan-'));
  const path = join(dir, 'synthetic.jsonl');
  const rows = [planPrompt(dir, 'living-plan'), ...Array.from({ length: PLAN_REVISIONS }, (_, n) => planRows(dir, 'living-plan', n)).flat()];
  writeFileSync(path, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
  store = new Store(join(dir, 'store'));
  const ingest = new Ingestor(store);
  projection = ingest.projection((await ingest.importSource('claude-code', path)).recordingId);
});
afterAll(() => {
  store?.close();
  if (dir) {
    if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path');
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('CONTENT-4 living checklist acceptance', () => {
  it('receives omitted native item statuses as empty strings at the existing adapter boundary', () => {
    const expected = { kind: 'plan', items: [{ text: 'Literal item', status: '' }] };
    expect(claudeIntent('TodoWrite', { todos: [{ content: 'Literal item' }] })).toEqual(expected);
    expect(codexIntent('update_plan', { plan: [{ step: 'Literal item' }] })).toEqual(expected);
  });

  it('keeps all thirteen captured lists reachable in one thread and pins only the latest', () => {
    const positions = planThreads(projection);
    expect(positions.size).toBe(PLAN_REVISIONS);
    const threads = new Set([...positions.values()].map(position => position.thread));
    expect(threads.size).toBe(1);
    const thread = [...threads][0]!;
    expect(thread.revisions.map(revision => revision.done)).toEqual(Array.from({ length: PLAN_REVISIONS }, (_, n) => n));
    thread.revisions.forEach((revision, index) => {
      expect(revision.items.map(({ text, status }) => ({ text, status }))).toEqual(planItems(index).map(item => ({ text: item.content, status: item.status })));
      expect(revision.total).toBe(PLAN_ITEMS);
    });
    expect(pinnedPlans(projection).size).toBe(1);
    expect(pinnedPlans(projection).get(1)).toMatchObject({ revision: PLAN_REVISIONS, done: PLAN_ITEMS, total: PLAN_ITEMS });
  });

  it('shows exactly the recorded revision at every replay boundary, including rewind after completion', () => {
    const order = [...Array(PLAN_REVISIONS).keys(), ...Array(PLAN_REVISIONS).keys()].reverse();
    for (const index of order) {
      const op = projection.operations[index]!;
      const before = projection.timeline.findIndex(item => item.type === 'op-start' && item.operationId === op.id);
      expect(before).toBeGreaterThanOrEqual(0);
      const pins = compose(projection, { step: before + 1 }).passages.flatMap(passage => passage.turnPlan ? [passage.turnPlan] : []);
      expect(pins).toHaveLength(1);
      expect(pins[0]).toMatchObject({ revision: index + 1, revisions: index + 1, done: index, total: PLAN_ITEMS });
      expect(pins[0]!.items.map(item => item.status)).toEqual(planItems(index).map(item => item.status));
      const visible = asOfProjection(projection, before + 1);
      expect(planThreads(visible).size).toBe(index + 1);
      expect([...planThreads(visible).values()].every(position => position.thread.revisions.length === index + 1)).toBe(true);
    }
    expect(compose(projection, { step: 0 }).passages).toEqual([]);
  });

  it.each([
    ['waiting-for-review', 'pending'], ['pending', 'waiting-for-review'],
    ['', 'completed'], ['in_progress', ''], ['unknown', 'completed'], ['completed', 'unknown'],
  ])('does not derive a canonical transition from captured %j → %j', (before, after) => {
    const p = structuredClone(projection);
    const first = p.operations[0]!, second = p.operations[1]!;
    if (first.detail.kind !== 'plan' || second.detail.kind !== 'plan') throw new Error('Missing synthetic plan');
    first.detail.items = [{ text: 'Literal item', status: before }];
    second.detail.items = [{ text: 'Literal item', status: after }];
    const revision = planThreads(p).get(second.id)!.thread.revisions[1]!;
    expect(revision.items).toEqual([{ text: 'Literal item', status: after }]);
    expect(revision).toMatchObject({ done: after === 'completed' ? 1 : 0, total: 1 });
  });
});
