import type { ScenePassage } from '@drishya/scene';

/** How a passage shows while its turn is folded: the opening passage keeps the prompt and ledger, the rest take no space. */
export type Fold = 'header' | 'hidden' | undefined;

/** A folded opening passage is much shorter than the open one, so it keeps its own measured height. */
export const FOLDED_HEADER_ESTIMATE = 120;
const FOLDED = '#folded';

/**
 * Turns folded right now: the reader's stored folds (by the id of the passage that opens the turn, which stays put while
 * live work arrives) less any turn a reader must see, such as the one holding the selected action.
 */
export function foldedSteps(passages: readonly ScenePassage[], stored: ReadonlySet<string>, open: ReadonlySet<number>): Set<number> {
  const steps = new Set<number>();
  if (!stored.size) return steps;
  for (const ps of passages) if (ps.turnStep !== undefined && stored.has(ps.id) && !open.has(ps.turnStep)) steps.add(ps.turnStep);
  return steps;
}

export function foldOf(ps: ScenePassage, folded: ReadonlySet<number>): Fold {
  if (ps.inTurn === undefined || !folded.has(ps.inTurn)) return undefined;
  return ps.turnStep === ps.inTurn ? 'header' : 'hidden';
}

/** Where a slot's measured height is kept. The open height survives folding, so unfolding lands where it was. */
export const measureKey = (id: string, fold: Fold) => fold === 'header' ? id + FOLDED : id;

/** Heights for the virtual list: hidden passages are zero, folded openers use their folded measurement. */
export function foldedHeights(passages: readonly ScenePassage[], measured: ReadonlyMap<string, number>, folded: ReadonlySet<number>): ReadonlyMap<string, number> {
  if (!folded.size) return measured;
  const heights = new Map(measured);
  for (const ps of passages) {
    const fold = foldOf(ps, folded);
    if (fold === 'hidden') heights.set(ps.id, 0);
    else if (fold === 'header') heights.set(ps.id, measured.get(measureKey(ps.id, fold)) ?? FOLDED_HEADER_ESTIMATE);
  }
  return heights;
}
