import type { Operation } from '@drishya/contracts';
import { tallyOperation, type TurnLedger } from '../../../../packages/scene/src/turns.ts';
import { ledgerParts, type LedgerPart } from './turn-ledger.ts';

const parse = (iso?: string) => iso && Number.isFinite(Date.parse(iso)) ? Date.parse(iso) : undefined;

/**
 * What one run of tool operations did, counted from the same rules as the turn ledger (`tallyOperation`).
 * A run is the operations between two pieces of an agent's text; its duration runs from its first captured start
 * to its last captured end, and is left out when the capture holds no times.
 */
export function runLedger(operations: readonly Operation[]): TurnLedger {
  const ledger: TurnLedger = {
    step: 0, operations: 0, reads: 0, searches: 0, edits: { files: 0, added: 0, removed: 0 }, commands: 0,
    tests: { runs: 0, passed: 0, failed: 0 }, web: 0, mcp: 0, delegations: 0, failed: 0, declined: 0, open: 0,
  };
  const files = new Set<string>();
  let first: number | undefined, last: number | undefined;
  for (const op of operations) {
    tallyOperation(ledger, op, files);
    for (const at of [parse(op.startTime), parse(op.endTime)]) {
      if (at === undefined) continue;
      if (first === undefined || at < first) first = at;
      if (last === undefined || at > last) last = at;
    }
  }
  ledger.edits.files = files.size;
  if (first !== undefined && last !== undefined) ledger.durationMs = last - first;
  return ledger;
}

export interface RunLine {
  /** The words of the line, one part per thing that happened. Counts and outcomes only; never written by a model. */
  parts: LedgerPart[];
  text: string;
  /** Any operation in the run ended in an error, or a test run in it failed. The line keeps its mark either way. */
  failed: boolean;
  operations: number;
  /** Calls still without a result: the run is still going. */
  open: number;
}

/** The one line a folded run shows, in the turn ledger's own wording. */
export function runLine(operations: readonly Operation[]): RunLine {
  const ledger = runLedger(operations);
  const parts = ledgerParts(ledger);
  // Kinds the ledger has no word for (a plan, a question) still count as actions, so a line is never empty.
  if (!parts.length) parts.push({ text: `${ledger.operations} ${ledger.operations === 1 ? 'action' : 'actions'}` });
  return { parts, text: parts.map((part) => part.text).join(' · '), failed: ledger.failed > 0 || ledger.tests.failed > 0, operations: ledger.operations, open: ledger.open };
}
