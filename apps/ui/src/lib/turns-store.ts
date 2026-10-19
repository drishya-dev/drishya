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
