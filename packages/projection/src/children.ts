import type { Agent, Artifact, Operation, Prose, TimelineItem } from '@drishya/contracts';

/** Put typed children inside their recorded parent window, including late enrichment receipts.
 * This is presentation order, never an assertion about when a nested process started. */
export function placeChildren(operations: Operation[], timeline: TimelineItem[], artifacts: Artifact[], prose: Prose[], agents: Agent[], receipts: Map<string, number>) {
  const children = new Map<string, Operation[]>();
  for (const op of operations) if (op.parentOperationId) {
    const group = children.get(op.parentOperationId) ?? [];
    group.push(op); children.set(op.parentOperationId, group);
  }
  if (!children.size) return { operations, timeline, artifacts, prose, agents };
  const positions = new Map<number, number>(), next: TimelineItem[] = [];
  const existingStarts = new Set(timeline.filter(it => it.type === 'op-start').map(it => it.operationId));
  const byId = new Map(operations.map(op => [op.id, op]));
  const startsAt = new Map<number, Operation[]>(), endsAt = new Map<number, Operation[]>();
  const orphanEnds = new Map<number, Operation[]>();
  for (const [parentId, group] of children) {
    const parent = byId.get(parentId)!;
    for (const child of group.filter(op => !existingStarts.has(op.id))) {
      startsAt.set(parent.startSequence, [...(startsAt.get(parent.startSequence) ?? []), child]);
      if (parent.endSequence !== undefined) endsAt.set(parent.endSequence, [...(endsAt.get(parent.endSequence) ?? []), child]);
      else {
        const at = child.endSequence ?? timeline.length;
        orphanEnds.set(at, [...(orphanEnds.get(at) ?? []), child]);
      }
    }
  }
  const finishAt = (index: number) => { for (const child of orphanEnds.get(index) ?? []) next.push({ type: 'op-end', id: `e_${child.id}`, operationId: child.id, agentId: child.agentId, sequence: receipts.get(child.id)!, time: child.endTime }); };
  timeline.forEach((item, index) => {
    finishAt(index);
    positions.set(index, next.length);
    for (const child of endsAt.get(index) ?? []) next.push({ type: 'op-end', id: `e_${child.id}`, operationId: child.id, agentId: child.agentId, sequence: receipts.get(child.id)!, time: child.endTime });
    next.push(item);
    for (const child of startsAt.get(index) ?? []) next.push({ type: 'op-start', id: `s_${child.id}`, operationId: child.id, agentId: child.agentId, sequence: receipts.get(child.id)!, time: child.startTime });
  });
  finishAt(timeline.length);
  const starts = new Map<string, number>(), ends = new Map<string, number>();
  next.forEach((it, index) => { if (it.type === 'op-start') starts.set(it.operationId, index); else if (it.type === 'op-end') ends.set(it.operationId, index); });
  const at = (n: number) => positions.get(n) ?? next.length;
  return {
    operations: operations.map(op => ({ ...op, startSequence: starts.get(op.id) ?? at(op.startSequence), ...(ends.has(op.id) ? { endSequence: ends.get(op.id) } : op.endSequence !== undefined ? { endSequence: at(op.endSequence) } : {}) })).sort((a,b) => a.startSequence-b.startSequence || a.id.localeCompare(b.id)),
    timeline: next,
    artifacts: artifacts.map(a => ({ ...a, observedAtSequence: at(a.observedAtSequence) })),
    prose: prose.map(p => ({ ...p, sequence: at(p.sequence) })),
    agents: agents.map(a => ({ ...a, firstSequence: at(a.firstSequence), lastSequence: at(a.lastSequence), ...(a.stoppedSequence !== undefined ? { stoppedSequence: at(a.stoppedSequence) } : {}) })),
  };
}
