import type { TurnLedger } from '../../../../packages/scene/src/turns.ts';
import { elapsed } from './now-state.ts';

export interface LedgerPart { text: string; tone?: 'good' | 'bad' }

const n = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/** The one-line account of a turn. Only things that happened are named; every count is from captured operations. */
export function ledgerParts(ledger: TurnLedger): LedgerPart[] {
  const parts: LedgerPart[] = [];
  if (ledger.reads) parts.push({ text: `read ${ledger.reads}` });
  if (ledger.searches) parts.push({ text: `searched ${ledger.searches}` });
  if (ledger.edits.files) parts.push({ text: `edited ${n(ledger.edits.files, 'file')} (+${ledger.edits.added} −${ledger.edits.removed})` });
  if (ledger.commands) parts.push({ text: n(ledger.commands, 'command') });
  if (ledger.tests.runs) {
    const { passed, failed } = ledger.tests;
    parts.push({ text: passed || failed ? `tests ${passed}✓${failed ? ` ${failed}✗` : ''}` : n(ledger.tests.runs, 'test run'), tone: failed ? 'bad' : passed ? 'good' : undefined });
  }
  if (ledger.web) parts.push({ text: `web ${ledger.web}` });
  if (ledger.mcp) parts.push({ text: n(ledger.mcp, 'MCP call') });
  if (ledger.delegations) parts.push({ text: `delegated ${ledger.delegations}` });
  if (ledger.failed) parts.push({ text: `${ledger.failed} failed`, tone: 'bad' });
  if (ledger.declined) parts.push({ text: `${ledger.declined} declined` });
  if (parts.length && ledger.durationMs !== undefined && ledger.durationMs >= 1000) parts.push({ text: elapsed(ledger.durationMs) });
  return parts;
}

export const ledgerSummary = (ledger: TurnLedger) => ledgerParts(ledger).map((part) => part.text).join(' · ');

/** What the ledger means, so it never claims more than the capture shows. */
export const LEDGER_BASIS = 'Counted from the operations captured in this turn. Edited files come from captured patches; the duration runs to the last captured time in the turn, because not every harness records where a turn ends.';
