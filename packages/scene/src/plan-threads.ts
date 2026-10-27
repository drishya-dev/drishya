// CONTENT-4: the plan/todo checklist an agent keeps rewriting, read as one evolving list.
//
// Every TodoWrite call carries the whole list again. Showing each as its own card repeats the
// list; here consecutive calls by one agent in one turn become a thread of revisions, and each
// revision says what changed since the one before it. Changes are matched by unique item text, so a
// reworded item is reported as removed plus added, never as the same item edited.

import type { Operation, Projection } from '@drishya/contracts';

export type PlanChange = 'added' | 'started' | 'completed' | 'reopened';
export interface PlanItem { id?: string; text: string; status: string; change?: PlanChange }
export interface PlanRevision {
  operationId: string;
  sequence: number;
  items: PlanItem[];
  /** Items present in the previous revision and gone from this one. */
  removed: string[];
  done: number;
  total: number;
  omittedItems?: number;
}
export interface PlanThread {
  id: string; agentId: string; turn: number; revisions: PlanRevision[];
  /** The agent the prompt went to: its list is the turn's checklist, pinned under the prompt. */
  lead: boolean;
}
export interface PlanPosition { thread: PlanThread; index: number }

const rank = (status: string) => (status === 'completed' ? 2 : status === 'in_progress' ? 1 : 0);
const knownStates = new Set(['pending', 'in_progress', 'completed']);

/** Repeated labels do not identify individual tasks; their literal states stay readable. */
function repeatedLabels(items: readonly { text: string }[]): Set<string> {
  const seen = new Set<string>(), repeated = new Set<string>();
  for (const { text } of items) {
    if (seen.has(text)) repeated.add(text);
    seen.add(text);
  }
  return repeated;
}

function revision(op: Operation, previous?: PlanRevision): PlanRevision {
  const items = op.detail.kind === 'plan' ? op.detail.items : [];
  const identity = (item: { id?: string; text: string }) => item.id === undefined ? `text:${item.text}` : `id:${item.id}`;
  const before = new Map((previous?.items ?? []).map((item) => [identity(item), item.status]));
  const now = new Set(items.map(identity));
  const ambiguous = new Set([...repeatedLabels(previous?.items ?? []), ...repeatedLabels(items)]);
  const marked = items.map((item): PlanItem => {
    if (!previous) return { ...item };
    const was = before.get(identity(item));
    if (was === undefined) return { ...item, change: 'added' };
    // An empty or unfamiliar state supplies no evidence for a canonical state transition.
    if ((item.id === undefined && ambiguous.has(item.text)) || was === item.status || !knownStates.has(was) || !knownStates.has(item.status)) return { ...item };
    const change: PlanChange = item.status === 'completed' ? 'completed' : item.status === 'in_progress' ? 'started' : rank(item.status) < rank(was) ? 'reopened' : 'started';
    return { ...item, change };
  });
  return {
    operationId: op.id, sequence: op.endSequence ?? op.startSequence, items: marked,
    ...(op.detail.kind === 'plan' && op.detail.omittedItems ? { omittedItems: op.detail.omittedItems } : {}),
    removed: (previous?.items ?? []).filter(item => !now.has(identity(item))).map(item => item.text),
    done: items.filter((item) => item.status === 'completed').length, total: items.length,
  };
}

/** Where every plan operation sits in its thread. Threads never cross a prompt or an agent. */
export function planThreads(p: Projection, include: (op: Operation) => boolean = () => true): Map<string, PlanPosition> {
  // Paged history retains a suffix of the timeline while operation steps stay absolute.
  const operations = new Map(p.operations.map(op => [op.id, op]));
  let offset = 0;
  for (const [position, item] of p.timeline.entries()) {
    if (item.type !== 'op-start') continue;
    const op = operations.get(item.operationId);
    if (op) { offset = op.startSequence - position; break; }
  }
  const turnItems = p.timeline.map((item, position) => ({ ...item, position: position + offset })).filter((item) => item.type === 'turn');
  const turns = turnItems.map((item) => item.position);
  const turnOf = (sequence: number) => { let n = 0; while (n < turns.length && turns[n]! <= sequence) n++; return n; };
  const plans = p.operations.filter((o) => o.kind === 'plan' && o.detail.kind === 'plan' && !o.detail.document && (!o.detail.scope || o.endSequence !== undefined) && include(o)).sort((a, b) => (a.detail.kind === 'plan' && a.detail.scope ? a.endSequence! : a.startSequence) - (b.detail.kind === 'plan' && b.detail.scope ? b.endSequence! : b.startSequence) || a.id.localeCompare(b.id));
  const threads = new Map<string, PlanThread>();
  const out = new Map<string, PlanPosition>();
  for (const op of plans) {
    const turn = turnOf(op.startSequence), key = `${op.agentId}/${turn}${op.detail.kind === 'plan' && op.detail.scope ? `/${op.detail.scope}` : ''}`;
    let thread = threads.get(key);
    if (!thread) threads.set(key, thread = { id: key, agentId: op.agentId, turn, revisions: [], lead: turn > 0 && turnItems[turn - 1]!.agentId === op.agentId });
    thread.revisions.push(revision(op, thread.revisions.at(-1)));
    out.set(op.id, { thread, index: thread.revisions.length - 1 });
  }
  return out;
}

export interface PinnedPlan {
  operationId: string;
  /** 1-based number of the newest revision shown, and how many the turn has so far. */
  revision: number;
  revisions: number;
  items: PlanItem[];
  done: number;
  total: number;
  omittedItems?: number;
}

/** The newest list of each turn's lead agent, by turn ordinal (1 = the first prompt). Sub-agents' lists stay where they arrived. */
export function pinnedPlans(p: Projection, include?: (op: Operation) => boolean): Map<number, PinnedPlan> {
  const out = new Map<number, PinnedPlan>();
  for (const { thread } of planThreads(p, include).values()) {
    if (!thread.lead) continue;
    const latest = thread.revisions.at(-1)!;
    out.set(thread.turn, { operationId: latest.operationId, revision: thread.revisions.length, revisions: thread.revisions.length, items: latest.items, done: latest.done, total: latest.total, ...(latest.omittedItems ? { omittedItems: latest.omittedItems } : {}) });
  }
  return out;
}
