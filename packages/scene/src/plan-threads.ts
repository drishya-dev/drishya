// CONTENT-4: the plan/todo checklist an agent keeps rewriting, read as one evolving list.
//
// Every TodoWrite call carries the whole list again. Showing each as its own card repeats the
// list; here consecutive calls by one agent in one turn become a thread of revisions, and each
// revision says what changed since the one before it. Changes are matched by item text, so a
// reworded item is reported as removed plus added, never as the same item edited.

import type { Operation, Projection } from '@drishya/contracts';

export type PlanChange = 'added' | 'started' | 'completed' | 'reopened';
export interface PlanItem { text: string; status: string; change?: PlanChange }
export interface PlanRevision {
  operationId: string;
  sequence: number;
  items: PlanItem[];
  /** Items present in the previous revision and gone from this one. */
  removed: string[];
  done: number;
  total: number;
}
export interface PlanThread { id: string; agentId: string; turn: number; revisions: PlanRevision[] }
export interface PlanPosition { thread: PlanThread; index: number }

const rank = (status: string) => (status === 'completed' ? 2 : status === 'in_progress' ? 1 : 0);

function revision(op: Operation, previous?: PlanRevision): PlanRevision {
  const items = op.detail.kind === 'plan' ? op.detail.items : [];
  const before = new Map((previous?.items ?? []).map((item) => [item.text, item.status]));
  const now = new Set(items.map((item) => item.text));
  const marked = items.map((item): PlanItem => {
    if (!previous) return { text: item.text, status: item.status };
    const was = before.get(item.text);
    if (was === undefined) return { text: item.text, status: item.status, change: 'added' };
    if (was === item.status) return { text: item.text, status: item.status };
    const change: PlanChange = item.status === 'completed' ? 'completed' : item.status === 'in_progress' ? 'started' : rank(item.status) < rank(was) ? 'reopened' : 'started';
    return { text: item.text, status: item.status, change };
  });
  return {
    operationId: op.id, sequence: op.endSequence ?? op.startSequence, items: marked,
    removed: (previous?.items ?? []).map((item) => item.text).filter((text) => !now.has(text)),
    done: items.filter((item) => item.status === 'completed').length, total: items.length,
  };
}

/** Where every plan operation sits in its thread. Threads never cross a prompt or an agent. */
export function planThreads(p: Projection): Map<string, PlanPosition> {
  const turns = p.timeline.filter((item) => item.type === 'turn').map((item) => item.sequence).sort((a, b) => a - b);
  const turnOf = (sequence: number) => { let n = 0; while (n < turns.length && turns[n]! <= sequence) n++; return n; };
  const plans = p.operations.filter((o) => o.kind === 'plan' && o.detail.kind === 'plan').sort((a, b) => a.startSequence - b.startSequence || a.id.localeCompare(b.id));
  const threads = new Map<string, PlanThread>();
  const out = new Map<string, PlanPosition>();
  for (const op of plans) {
    const turn = turnOf(op.startSequence), key = `${op.agentId}/${turn}`;
    let thread = threads.get(key);
    if (!thread) threads.set(key, thread = { id: key, agentId: op.agentId, turn, revisions: [] });
    thread.revisions.push(revision(op, thread.revisions.at(-1)));
    out.set(op.id, { thread, index: thread.revisions.length - 1 });
  }
  return out;
}
