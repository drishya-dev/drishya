import { describe, expect, it } from 'vitest';
import type { Operation, Projection } from '@drishya/contracts';
import { pinnedPlans, planThreads } from '../src/index.ts';

// CONTENT-4: repeated TodoWrite lists become one thread of revisions per agent and turn.
const plan = (id: string, seq: number, items: [string, string][], agentId = 'a'): Operation => ({
  id, agentId, kind: 'plan', tool: 'TodoWrite', title: 'Plan', titleProvenance: 'derived', origin: { type: 'native', tool: 'TodoWrite' }, status: 'ok',
  startSequence: seq, paths: [], artifactIds: [], observationIds: [], classification: 'derived',
  detail: { kind: 'plan', items: items.map(([text, status]) => ({ text, status })) },
} as unknown as Operation);
const turn = (sequence: number) => ({ type: 'turn', id: `t${sequence}`, sequence, agentId: 'a' });
const projection = (operations: Operation[], turns: number[]) => ({ operations, timeline: Array.from({ length: Math.max(0, ...turns) + 1 }, (_, sequence) => turns.includes(sequence) ? turn(sequence) : { type: 'gap', id: `g${sequence}`, sequence, reason: 'fixture padding' }) }) as unknown as Projection;

describe('planThreads', () => {
  it('chains rewrites in one turn and says what changed', () => {
    const found = planThreads(projection([
      plan('p1', 2, [['Read code', 'in_progress'], ['Fix bug', 'pending']]),
      plan('p2', 5, [['Read code', 'completed'], ['Fix bug', 'in_progress'], ['Add test', 'pending']]),
      plan('p3', 9, [['Read code', 'completed'], ['Add test', 'pending']]),
    ], [1]));
    const last = found.get('p3')!;
    expect(last.thread.revisions).toHaveLength(3);
    expect(last.index).toBe(2);
    const second = found.get('p2')!.thread.revisions[1]!;
    expect(second.items.map((i) => i.change)).toEqual(['completed', 'started', 'added']);
    expect(second.done).toBe(1);
    expect(last.thread.revisions[2]!.removed).toEqual(['Fix bug']);
    expect(found.get('p1')!.thread.revisions[0]!.items.every((i) => i.change === undefined)).toBe(true);
  });

  it('does not claim an unchanged duplicate label was reopened', () => {
    const items: [string,string][] = [['Run tests','pending'],['Run tests','completed']];
    const found = planThreads(projection([plan('p1',2,items),plan('p2',4,items)], [1]));
    const last = found.get('p2')!.thread.revisions[1]!;
    expect(last.items.map(item=>item.change)).toEqual([undefined,undefined]);
    expect(last.items.map(({text,status})=>({text,status}))).toEqual(items.map(([text,status])=>({text,status})));
    expect(last).toMatchObject({done:1,total:2,removed:[]});
  });

  it.each(['previous','current','both'])('keeps ambiguous %s labels literal while comparing unique neighbors', where => {
    const duplicates: [string,string][] = [['Repeat','pending'],['Repeat','completed']];
    const first = where === 'current' ? [['Repeat','completed']] as [string,string][] : duplicates;
    const second = where === 'previous' ? [['Repeat','pending']] as [string,string][] : [...duplicates].reverse();
    const found = planThreads(projection([
      plan('p1',2,[...first,['Unique','pending']]),
      plan('p2',4,[...second,['Unique','completed']]),
    ],[1]));
    const items=found.get('p2')!.thread.revisions[1]!.items;
    expect(items.filter(item=>item.text==='Repeat').every(item=>item.change===undefined)).toBe(true);
    expect(items.find(item=>item.text==='Unique')!.change).toBe('completed');
    expect(items).toHaveLength(second.length+1);
  });

  it('marks genuinely new duplicate labels as added and resumes unique comparisons later', () => {
    const found=planThreads(projection([
      plan('p1',2,[['Existing','pending']]),
      plan('p2',4,[['New','pending'],['New','completed']]),
      plan('p3',6,[['New','pending']]),
      plan('p4',8,[['New','completed']]),
    ],[1]));
    const revisions=found.get('p4')!.thread.revisions;
    expect(revisions[1]!.items.map(item=>item.change)).toEqual(['added','added']);
    expect(revisions[2]!.items[0]!.change).toBeUndefined();
    expect(revisions[3]!.items[0]!.change).toBe('completed');
  });

  it('starts a new thread for a new prompt and for another agent', () => {
    const found = planThreads(projection([
      plan('p1', 2, [['A', 'pending']]), plan('p2', 12, [['A', 'completed']]), plan('p3', 13, [['B', 'pending']], 'b'),
    ], [1, 10]));
    expect(found.get('p1')!.thread.id).not.toBe(found.get('p2')!.thread.id);
    expect(found.get('p2')!.thread.id).not.toBe(found.get('p3')!.thread.id);
    expect(found.get('p2')!.index).toBe(0);
  });

  it('marks a list item that went backwards as reopened', () => {
    const found = planThreads(projection([plan('p1', 2, [['A', 'completed']]), plan('p2', 3, [['A', 'pending']])], [1]));
    expect(found.get('p2')!.thread.revisions[1]!.items[0]!.change).toBe('reopened');
  });
});

describe('pinnedPlans', () => {
  it('pins the newest list of the agent the prompt went to, per turn', () => {
    const ops = [
      plan('p1', 2, [['A', 'in_progress'], ['B', 'pending']]), plan('p2', 4, [['A', 'completed'], ['B', 'in_progress']]),
      plan('s1', 5, [['Sub', 'pending']], 'sub'), plan('p3', 12, [['C', 'pending']]),
    ];
    const pins = pinnedPlans(projection(ops, [1, 10]));
    expect([...pins.keys()]).toEqual([1, 2]);
    expect(pins.get(1)).toMatchObject({ operationId: 'p2', revision: 2, revisions: 2, done: 1, total: 2 });
    expect(pins.get(2)!.items.map((i) => i.text)).toEqual(['C']);
  });

  it('counts only the lists it is allowed to see, and leaves lists before any prompt unpinned', () => {
    const ops = [plan('p0', 0, [['Early', 'pending']]), plan('p1', 2, [['A', 'pending']]), plan('p2', 4, [['A', 'completed']])];
    const pins = pinnedPlans(projection(ops, [1]), (op) => op.id !== 'p2');
    expect([...pins.keys()]).toEqual([1]);
    expect(pins.get(1)).toMatchObject({ operationId: 'p1', revision: 1, done: 0 });
  });
});
