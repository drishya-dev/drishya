import type { Projection } from '@drishya/contracts';

/**
 * What one turn (from a user prompt to the next) did, counted from captured operations. Pure and clock-free.
 * Nothing here is inferred beyond counting: a turn's duration is derived from the last captured time inside it,
 * because not every harness records where a turn ends.
 */
export interface TurnLedger {
  /** Timeline step of the prompt that opens this turn; passages carry the same number as `turnStep`. */
  step: number;
  time?: string;
  endTime?: string;
  durationMs?: number;
  operations: number;
  reads: number;
  searches: number;
  edits: { files: number; added: number; removed: number };
  commands: number;
  tests: { runs: number; passed: number; failed: number };
  web: number;
  mcp: number;
  delegations: number;
  /** Operations that ended in an error. */
  failed: number;
  /** Calls still without a result inside this turn. */
  open: number;
}

const parse = (iso?: string) => iso && Number.isFinite(Date.parse(iso)) ? Date.parse(iso) : undefined;

export function turnLedgers(projection: Projection): TurnLedger[] {
  const scripts = new Set(projection.operations.map(op => op.parentOperationId).filter(Boolean));
  const ops = new Map(projection.operations.filter(op => !scripts.has(op.id)).map((op) => [op.id, op]));
  const starts: number[] = [];
  projection.timeline.forEach((item, index) => { if (item.type === 'turn') starts.push(index); });

  return starts.map((from, n) => {
    const to = starts[n + 1] ?? projection.timeline.length;
    const head = projection.timeline[from]!;
    const ledger: TurnLedger = {
      step: from, time: head.time, operations: 0, reads: 0, searches: 0, edits: { files: 0, added: 0, removed: 0 },
      commands: 0, tests: { runs: 0, passed: 0, failed: 0 }, web: 0, mcp: 0, delegations: 0, failed: 0, open: 0,
    };
    const files = new Set<string>();
    let last = parse(head.time);
    for (let i = from; i < to; i++) {
      const item = projection.timeline[i]!;
      const at = parse(item.time);
      if (at !== undefined && (last === undefined || at > last)) last = at;
      if (item.type !== 'op-start') continue;
      const op = ops.get(item.operationId);
      if (!op) continue;
      ledger.operations++;
      if (op.status === 'error') ledger.failed++;
      if (op.status === 'running') ledger.open++;
      const d = op.detail;
      switch (op.kind) {
        case 'read': ledger.reads++; break;
        case 'search': ledger.searches++; break;
        case 'shell': ledger.commands++; break;
        case 'web': ledger.web++; break;
        case 'mcp': ledger.mcp++; break;
        case 'spawn': ledger.delegations++; break;
        case 'test':
          ledger.tests.runs++;
          if (d.kind === 'test' && d.summary) { ledger.tests.passed += d.summary.passed; ledger.tests.failed += d.summary.failed; }
          break;
        case 'edit': case 'write':
          if (d.kind === 'edit' && op.status !== 'error') {
            files.add(d.path);
            for (const hunk of d.hunks) for (const line of hunk.lines) { if (line[0] === '+') ledger.edits.added++; else if (line[0] === '-') ledger.edits.removed++; }
          }
          break;
      }
    }
    ledger.edits.files = files.size;
    const start = parse(head.time);
    if (last !== undefined && start !== undefined && last >= start) { ledger.endTime = new Date(last).toISOString(); ledger.durationMs = last - start; }
    return ledger;
  });
}
