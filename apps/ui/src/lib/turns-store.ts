import { create } from 'zustand';
import type { TurnLedger } from '../../../../packages/scene/src/turns.ts';

/** What each turn did, keyed by the timeline step of its prompt. Shared by every chapter header. */
export const useTurns = create<{ byStep: Map<number, TurnLedger>; lastStep?: number }>(() => ({ byStep: new Map() }));

export function publishTurns(ledgers: TurnLedger[]) {
  const previous = useTurns.getState().byStep;
  const same = previous.size === ledgers.length && ledgers.every((l) => { const p = previous.get(l.step); return p && JSON.stringify(p) === JSON.stringify(l); });
  if (same) return;
  useTurns.setState({ byStep: new Map(ledgers.map((l) => [l.step, l])), lastStep: ledgers.at(-1)?.step });
}

/**
 * PERF-4: the whole history replaces the recent-first page, and every step number now counts from the start of the history
 * instead of from the start of the latest work. The turns already counted are the same turns, so they are renumbered at
 * once (the daemon's fresh count follows and, being the same, changes nothing) rather than reading as unknown for a moment.
 */
export function shiftTurns(by: number) {
  if (!by) return;
  const previous = useTurns.getState();
  useTurns.setState({ byStep: new Map([...previous.byStep.values()].map((l) => [l.step + by, { ...l, step: l.step + by }])), lastStep: previous.lastStep === undefined ? undefined : previous.lastStep + by });
}
