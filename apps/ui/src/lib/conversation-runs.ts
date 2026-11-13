import type { ScenePassage } from '@drishya/scene';

/**
 * UI-41, Conversation view. A run is the consecutive tool operations of one agent between two pieces of its text,
 * inside one turn. A prompt, the agent's prose or reasoning, a compaction seam or a page not loaded yet ends it. The
 * history composer already puts one run in one passage (and splits a very long run into several ops-only passages),
 * so runs are built from the same passages the History renders, never from the DOM.
 */
export interface Run {
  /** The id of the passage that opens the run: it stays put while later operations arrive. */
  id: string;
  passageIds: string[];
  operationIds: string[];
  /** The turn it belongs to, by the step of the prompt that opened it. */
  turn?: number;
}

const hasOperations = (ps: ScenePassage) => ps.ops.length > 0 && !ps.unloaded;
/** What a passage shows besides its operations; a passage with any of it still takes space when its run is folded. */
const hasOtherContent = (ps: ScenePassage) =>
  ps.prose.length > 0 || (ps.notices?.length ?? 0) > 0 || (ps.compactionIds?.length ?? 0) > 0 || (ps.compactionSummaryIds?.length ?? 0) > 0 ||
  ps.turnPrompt !== undefined || (ps.turnImages?.length ?? 0) > 0 || ps.turnStep !== undefined;

export function conversationRuns(passages: readonly ScenePassage[]): Run[] {
  const runs: Run[] = [];
  // Agents interleave in sub-agent work: each keeps its own open run, so another agent's passage never splits it.
  const open = new Map<string, { run: Run; turn?: number }>();
  for (const ps of passages) {
    if (ps.unloaded || ps.turnStep !== undefined || (ps.compactionIds?.length ?? 0) > 0 || (ps.compactionSummaryIds?.length ?? 0) > 0) open.clear();
    if (!hasOperations(ps)) {
      // The agent's own text ends its run; a passage of a different agent does not.
      if (ps.prose.length > 0 || (ps.notices?.length ?? 0) > 0) open.delete(ps.agentId);
      continue;
    }
    let current = open.get(ps.agentId);
    if (!current || current.turn !== ps.inTurn || ps.turnStep !== undefined) {
      current = { run: { id: ps.id, passageIds: [], operationIds: [], turn: ps.inTurn }, turn: ps.inTurn };
      open.set(ps.agentId, current);
      runs.push(current.run);
    }
    current.run.passageIds.push(ps.id);
    for (const op of ps.ops) current.run.operationIds.push(op.id);
    // Prose lands beneath the operations of its own passage and closes the run.
    if (ps.prose.length > 0 || (ps.compactionIds?.length ?? 0) > 0 || (ps.compactionSummaryIds?.length ?? 0) > 0) open.delete(ps.agentId);
  }
  return runs;
}

/** How one passage presents its operations in Conversation mode. */
export interface RunView {
  runId: string;
  /** The first passage of its run: it carries the run's line. */
  lead: boolean;
  /** The reader opened this run (or was sent into it): its cards show exactly as they do in Work mode. */
  open: boolean;
}

export interface RunFold {
  views: ReadonlyMap<string, RunView>;
  /** Passages whose operations are folded away. They keep their prose and take their own measured height. */
  folded: ReadonlySet<string>;
  /** Folded passages with nothing else to show: they take no space at all, like a passage of a folded turn. */
  hidden: ReadonlySet<string>;
}

const NONE: RunFold = { views: new Map(), folded: new Set(), hidden: new Set() };

/**
 * Which runs fold. A run is folded unless its id is among the reader's open runs, or `forced` holds a passage of it
 * (the reader was sent to an action inside it, so it must be visible). Runs of folded turns are left to the turn fold.
 */
export function runFold(runs: readonly Run[], passages: readonly ScenePassage[], opened: ReadonlySet<string>, forced: ReadonlySet<string>, foldedTurns: ReadonlySet<number> = new Set()): RunFold {
  if (!runs.length) return NONE;
  const byId = new Map(passages.map((ps) => [ps.id, ps]));
  const views = new Map<string, RunView>(), folded = new Set<string>(), hidden = new Set<string>();
  for (const run of runs) {
    // A folded turn already shows only its opening line; its passages are not folded a second time.
    if (run.turn !== undefined && foldedTurns.has(run.turn)) continue;
    const open = opened.has(run.id) || run.passageIds.some((id) => forced.has(id));
    run.passageIds.forEach((id, index) => {
      views.set(id, { runId: run.id, lead: index === 0, open });
      if (open) return;
      folded.add(id);
      const ps = byId.get(id);
      if (index > 0 && ps && !hasOtherContent(ps)) hidden.add(id);
    });
  }
  return { views, folded, hidden };
}

/** A folded passage is one line plus whatever prose follows it; the estimate holds until its slot is measured. */
export const RUN_FOLDED_ESTIMATE = 72;
const RUN = '#run';

/** Where a folded passage's measured height is kept; the open height survives folding, so opening lands where it was. */
export const runMeasureKey = (id: string, folded: boolean) => folded ? id + RUN : id;

/** Heights for the virtual list: hidden passages take none, folded ones use their own measurement. */
export function runHeights(base: ReadonlyMap<string, number>, measured: ReadonlyMap<string, number>, fold: RunFold): ReadonlyMap<string, number> {
  if (!fold.folded.size) return base;
  const heights = new Map(base);
  for (const id of fold.folded) heights.set(id, fold.hidden.has(id) ? 0 : measured.get(id + RUN) ?? RUN_FOLDED_ESTIMATE);
  return heights;
}
