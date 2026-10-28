// Reconstruct only native result-confirmed task facts. The source's structured result has
// already passed redaction; input by itself never establishes a successful mutation.
import type { Observation, OperationDetail } from '@drishya/contracts';
type Rec = Record<string, unknown>;
type Plan = Extract<OperationDetail, { kind: 'plan' }>;
type Item = Plan['items'][number];
const object = (v: unknown): Rec => v && typeof v === 'object' && !Array.isArray(v) ? v as Rec : {};
const idOf = (v: unknown) => typeof v === 'string' && v.length > 0 ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : undefined;
const string = (v: unknown) => typeof v === 'string' ? v : undefined;

export class TaskPlans {
  private lists = new Map<string, { scope: string; origin: string; items: Map<string, Item>; sources: Map<string, { subject: string[]; status: string[] }> }>();

  apply(o: Observation, tool: string, input: unknown, raw: unknown, callId?: string): { detail: Plan; observations: string[] } | undefined {
    if (o.source.adapterId !== 'claude-code' || !['TaskCreate', 'TaskUpdate', 'TaskList', 'TaskGet'].includes(tool)) return;
    const result = object(raw), request = object(input);
    if (result.success === false) return;
    // Journals do not always retain the native list id. Isolate source generation and agent;
    // repeated creates are an evidence discontinuity, never an overwrite of an old identity.
    const nativeList = idOf(result.taskListId) ?? '';
    const key = JSON.stringify([o.recordingId, o.agentId, o.source.sourceId, o.source.generation, nativeList]);
    let list = this.lists.get(key);
    const task = object(result.task), id = idOf(tool === 'TaskUpdate' ? result.taskId : task.id);
    if (tool === 'TaskCreate' && (!id || typeof task.subject !== 'string')) return;
    if (tool === 'TaskUpdate' && (result.success !== true || !id)) return;
    if (tool === 'TaskGet' && (!id || typeof task.subject !== 'string')) return;
    if (tool === 'TaskList' && !Array.isArray(result.tasks)) return;
    if (!list || (tool === 'TaskCreate' && list.items.has(id!))) {
      list = { scope: `${key}/${o.id}`, origin: o.id, items: new Map(), sources: new Map() };
    }
    if (tool === 'TaskList') {
      const tasks = result.tasks as unknown[];
      // Malformed/duplicate identities cannot establish a complete replacement snapshot.
      const seen = new Set<string>();
      for (const value of tasks) {
        const row = object(value), rowId = idOf(row.id);
        if (!rowId || typeof row.subject !== 'string' || seen.has(rowId)) return;
        seen.add(rowId);
      }
      list.items.clear();
      list.sources.clear();
      for (const value of tasks) {
        const row = object(value), rowId = idOf(row.id)!;
        list.items.set(rowId, { id: rowId, text: row.subject as string, status: string(row.status) ?? '' });
        list.sources.set(rowId, { subject: [o.id], status: typeof row.status === 'string' ? [o.id] : [] });
      }
    } else if (tool === 'TaskCreate' || tool === 'TaskGet') {
      list.items.set(id!, { id: id!, text: task.subject as string, status: string(task.status) ?? (tool === 'TaskGet' ? list.items.get(id!)?.status : undefined) ?? '' });
      list.sources.set(id!, { subject: [o.id], status: typeof task.status === 'string' ? [o.id] : tool === 'TaskGet' ? list.sources.get(id!)?.status ?? [] : [] });
    } else {
      const change = object(result.statusChange);
      const fields = Array.isArray(result.updatedFields) ? result.updatedFields : [];
      const status = string(change.to) ?? (fields.includes('status') ? string(request.status) : undefined);
      const subject = string(task.subject) ?? (fields.includes('subject') ? string(request.subject) : undefined);
      const previous = list.items.get(id!);
      if (!previous && subject === undefined) return; // keep an unresolved update generic, without inventing a task title
      if (status === 'deleted') { list.items.delete(id!); list.sources.delete(id!); }
      else if (previous || subject !== undefined || status !== undefined) list.items.set(id!, {
        id: id!, text: subject ?? previous?.text ?? `Task ${id} (title not recorded)`, status: status ?? previous?.status ?? '',
      });
      else return;
      if (status !== 'deleted') {
        const previousSources = list.sources.get(id!);
        const confirmedInput = callId ? [callId, o.id] : [o.id];
        list.sources.set(id!, {
          subject: subject === undefined ? previousSources?.subject ?? [] : typeof task.subject === 'string' ? [o.id] : confirmedInput,
          status: status === undefined ? previousSources?.status ?? [] : typeof change.to === 'string' ? [o.id] : confirmedInput,
        });
      }
    }
    // Only current field authority is needed. Retaining every prior update per snapshot
    // would make provenance quadratic in a long session's number of revisions.
    this.lists.set(key, list);
    const observations = new Set([o.id, list.origin, ...(callId ? [callId] : [])]);
    for (const source of list.sources.values()) for (const id of [...source.subject, ...source.status]) observations.add(id);
    const all = [...list.items.values()].map(item => ({ ...item }));
    return { detail: { kind: 'plan', scope: list.scope, items: all.slice(0, 2000), ...(all.length > 2000 ? { omittedItems: all.length - 2000 } : {}) }, observations: [...observations] };
  }
}

/** The Claude desktop app's own checklist tool. */
export const DESKTOP_PLAN_TOOL = 'mcp__ccd_turn__update_plan';

/**
 * Lists kept by the Claude desktop app's `update_plan`. A call with `items` carries the whole list as recorded; its
 * `advance`, `done` and `start` calls carry no list, only a change to the previous one, so they are applied to the
 * last list of the same agent and source. A change with nothing to apply to, or with an index outside the list, stays a
 * generic call: Drishya never invents a list the harness did not record.
 */
export class DesktopChecklists {
  private lists = new Map<string, Item[]>();

  apply(o: Observation, tool: string, input: unknown): Plan | undefined {
    if (o.source.adapterId !== 'claude-code' || tool !== DESKTOP_PLAN_TOOL) return;
    const request = object(input);
    const key = JSON.stringify([o.recordingId, o.agentId, o.source.sourceId, o.source.generation]);
    let next: Item[];
    if (Array.isArray(request.items)) {
      next = [];
      for (const value of request.items) {
        const row = object(value);
        if (typeof row.content !== 'string' || typeof row.status !== 'string') return;
        next.push({ text: row.content, status: row.status });
      }
    } else {
      const previous = this.lists.get(key);
      if (!previous) return;
      next = previous.map(item => ({ ...item }));
      let changed = false;
      if (Array.isArray(request.done)) {
        for (const n of request.done) {
          if (!Number.isInteger(n) || (n as number) < 1 || (n as number) > next.length) return;
          next[(n as number) - 1]!.status = 'completed'; changed = true;
        }
      }
      if (request.start !== undefined) {
        const n = request.start;
        if (!Number.isInteger(n) || (n as number) < 1 || (n as number) > next.length) return;
        next[(n as number) - 1]!.status = 'in_progress'; changed = true;
      }
      if (request.advance === true) {
        const running = next.findIndex(item => item.status === 'in_progress');
        if (running >= 0) next[running]!.status = 'completed';
        const following = next.findIndex(item => item.status === 'pending');
        if (following >= 0) next[following]!.status = 'in_progress';
        changed = true;
      }
      if (!changed) return;
    }
    this.lists.set(key, next);
    // `scope` keeps each change out of view until its result is recorded, and out of other agents' lists.
    return { kind: 'plan', scope: key, items: next.slice(0, 2000).map(item => ({ ...item })), ...(next.length > 2000 ? { omittedItems: next.length - 2000 } : {}) };
  }
}

/** Claude's ExitPlanMode puts the plan text, as Markdown, in its input; that text is what the person is asked to approve. */
export function exitPlanText(input: unknown): string | undefined {
  const plan = object(input).plan;
  return typeof plan === 'string' && plan.trim() ? plan : undefined;
}

/** Only Codex's complete explicit marker establishes plan material, not a Markdown heading. */
export function proposedPlan(o: Observation, text: string): string | undefined {
  if (o.source.adapterId !== 'codex' || o.kind !== 'message.assistant') return;
  const match = /^\s*<proposed_plan>\s*\n?([\s\S]*?)\n?\s*<\/proposed_plan>\s*$/.exec(text);
  return match && !/<\/?proposed_plan>/.test(match[1]!) ? match[1]!.trim() : undefined;
}
