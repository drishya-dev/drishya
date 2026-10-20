import type { Operation, Projection } from '@drishya/contracts';

export interface ReadingQuery {
  kind: 'operation' | 'edit' | 'failure' | 'turn';
  direction: 1 | -1;
  from?: string;
  turnFrom?: string;
  at?: number;
  edge?: 'first' | 'last';
  agent?: string;
  tool?: string;
  server?: string;
  operationKind?: string;
}
export interface ReadingTarget { type: 'operation' | 'turn'; step: number; id?: string; turnKey?: string }
const indexes = new WeakMap<Projection, { operations: Operation[]; turns: ReadingTarget[] }>();

/** A compact cursor over all captured history, independent of the resident page. */
export function readingTarget(p: Projection, q: ReadingQuery): ReadingTarget | null {
  let index = indexes.get(p);
  if (!index) {
    index = {
      operations: [...p.operations].sort((a, b) => a.startSequence - b.startSequence),
      turns: p.timeline.flatMap((item, step) => item.type === 'turn' ? [{ type: 'turn' as const, step, turnKey: item.id }] : []),
    };
    indexes.set(p, index);
  }
  const from = index.operations.find(op => op.id === q.from);
  const fromTurn = index.turns.find(turn => turn.turnKey === q.turnFrom);
  const at = from?.startSequence ?? fromTurn?.step ?? q.at;
  const operations = index.operations.filter(op =>
    (!q.agent || op.agentId === q.agent) && (!q.tool || op.tool === q.tool) &&
    (!q.server || op.origin.type === 'mcp' && op.origin.server === q.server) &&
    (!q.operationKind || op.kind === q.operationKind) &&
    (q.kind !== 'edit' || op.kind === 'edit' || op.kind === 'write') &&
    (q.kind !== 'failure' || op.status === 'error' || op.detail.kind === 'test' && !!op.detail.summary?.failed));
  const rows = q.kind === 'turn' ? index.turns : operations.map(op => ({ type: 'operation' as const, id: op.id, step: op.startSequence }));
  if (q.edge === 'first') return rows[0] ?? null;
  if (q.edge === 'last') return rows.at(-1) ?? null;
  if (at === undefined) return (q.direction > 0 ? rows[0] : rows.at(-1)) ?? null;
  return (q.direction > 0 ? rows.find(row => row.step > at) : rows.findLast(row => row.step < at)) ?? null;
}
