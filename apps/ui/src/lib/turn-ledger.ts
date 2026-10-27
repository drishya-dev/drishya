import type { TurnSettings } from '@drishya/contracts';
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
  const recorded = ledger.recorded;
  if (recorded?.outcome === 'aborted') parts.push({ text: recorded.reason ?? 'aborted' });
  if (recorded?.error) parts.push({ text: 'turn error', tone: 'bad' });
  // The harness's own duration wins over the one counted from captured times.
  const duration = recorded?.durationMs ?? ledger.durationMs;
  if (parts.length && duration !== undefined && duration >= 1000) parts.push({ text: elapsed(duration) });
  return parts;
}

const APPROVAL: Record<string, string> = { never: 'never asks', 'on-request': 'asks on request', 'on-failure': 'asks on failure', untrusted: 'asks unless trusted' };
const SANDBOX: Record<string, string> = { 'danger-full-access': 'full access', 'workspace-write': 'writes in workspace', 'read-only': 'read only', 'external-sandbox': 'external sandbox' };

/**
 * What a Codex turn ran under, as the harness recorded it, only for settings that changed since the agent's previous
 * turn (the whole set on its first). Values that merely restate the default (`default` mode, `user` reviewer,
 * `disabled` profile) stay out of the line and remain in the tooltip.
 */
export function settingsLine(change: TurnSettings): { text: string; title: string } | undefined {
  const quiet: [keyof TurnSettings, string][] = [['collaborationMode', 'default'], ['approvalsReviewer', 'user'], ['permissionProfile', 'disabled']];
  const shown: string[] = [];
  if (change.model) shown.push(change.model);
  if (change.effort) shown.push(`${change.effort} effort`);
  if (change.approvalPolicy) shown.push(APPROVAL[change.approvalPolicy] ?? change.approvalPolicy);
  if (change.sandbox) shown.push(SANDBOX[change.sandbox] ?? change.sandbox);
  for (const [key, usual] of quiet) { const value = change[key]; if (value && value !== usual) shown.push(key === 'collaborationMode' ? `${value} mode` : `${value}`); }
  if (change.personality) shown.push(change.personality);
  if (!shown.length) return undefined;
  const all = Object.entries(change).map(([key, value]) => `${key}: ${value}`).join(', ');
  return { text: shown.join(' · '), title: `Codex settings recorded for this turn, shown when they change (${all})` };
}

export const ledgerSummary = (ledger: TurnLedger) => ledgerParts(ledger).map((part) => part.text).join(' · ');

/** What the ledger means, so it never claims more than the capture shows. */
const COUNTED = 'Counted from the operations captured in this turn. Edited files come from captured patches; ';
const DERIVED_DURATION = 'the duration runs to the last captured time in the turn, because not every harness records where a turn ends.';

/** What the ledger means, so it never claims more than the capture shows. */
export const ledgerBasis = (ledger?: TurnLedger) => COUNTED + (ledger?.recorded?.durationMs !== undefined ? 'the duration is the one the harness recorded for this turn.' : DERIVED_DURATION);
