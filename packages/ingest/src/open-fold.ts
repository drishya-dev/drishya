// PERF-4: opening a large recording. Two readers over the same store rows and the same reducer:
//
//   - `buildTail` reduces only the last prompts of the recording (a few hundred observations) so the whole
//     interface can be shown within about a second, while
//   - `ChunkedFold` folds the entire recording in slices the caller can interleave with other work, so a long
//     history never holds a thread for seconds.
//
// Both are given the WHOLE recording's workspace-root evidence (`rootsHint`): roots decide the path namespace of
// every operation, so a reducer that sees only part of the input must not learn them from that part. A tail is
// labelled `complete: false` unless it happens to hold the entire recording; what it shows is real captured
// material with the same identities as the full projection, but facts that need the whole session (the file
// list, counts, totals, the step numbering) are the full fold's to give.

import type { Observation, SessionLineageView } from '@drishya/contracts';
import { orderObservations, ProjectionFold, type BlobIO, type ReduceOptions } from '@drishya/projection';
import type { Store } from '@drishya/store';

type LineageReader = ReturnType<Store['lineageReader']>;

/** Prompts a tail starts from, and the most observations it will hold (the last ones win when a prompt is huge). */
export const TAIL_PROMPTS = 20;
export const TAIL_OBSERVATIONS = 3000;

/** Root evidence of every recording the projection reads, taken from the stored rows. */
export function rootsHintFor(store: Store, ids: string[]): NonNullable<ReduceOptions['rootsHint']> {
  const byRecording: Record<string, string> = {};
  const all = new Set<string>();
  for (const id of ids) {
    const evidence = store.rootEvidence(id);
    if (evidence.first) byRecording[id] = evidence.first;
    for (const root of evidence.all) all.add(root);
  }
  return { byRecording, all: [...all] };
}

export interface Tail {
  fold: ProjectionFold;
  /** True when the tail holds every observation of the only recording read: it is then the full projection. */
  complete: boolean;
  /** Observations the tail reduced. */
  observations: number;
}

/** The reducer over the last `prompts` prompts of the last recording, in reading order. */
export function buildTail(store: Store, ids: string[], io: BlobIO, opts: ReduceOptions, limits: { prompts?: number; observations?: number } = {}): Tail {
  const last = ids.at(-1)!;
  const { observations, complete } = store.tailObservations(last, limits.prompts ?? TAIL_PROMPTS, limits.observations ?? TAIL_OBSERVATIONS);
  // The identity facts set early in a recording (its workspace root, branch, title, first prompt, agent model) come
  // from the observations before the tail; a reducer that starts mid-way gets those first, in their own order.
  const inTail = new Set(observations.map((o) => o.id));
  const prelude: Observation[] = [];
  if (!complete) ids.forEach((id, i) => { for (const o of store.preludeObservations(id, i === 0)) if (!inTail.has(o.id)) prelude.push(o); });
  const fold = ProjectionFold.build(ids, orderObservations([...prelude, ...observations]), io, { ...opts, ordered: true, rootsHint: rootsHintFor(store, ids) });
  return { fold, complete: complete && ids.length === 1, observations: observations.length + prelude.length };
}

/**
 * The whole recording folded in slices. `step(limit)` reads and folds up to `limit` observations and returns
 * whether the fold is finished; between calls the caller is free to serve other requests. The first call runs the
 * ordering query for the first part (the one stretch that cannot be split). `onObservation` sees each observation
 * as it is read (the history worker uses it to note captured blob references).
 */
export class ChunkedFold {
  readonly fold: ProjectionFold;
  /** The lineage reader, kept after the read: it holds the repeat check a followed lineage's new observations pass through. */
  readonly lineage: LineageReader | undefined;
  private readonly reader: { read(limit: number): Observation[]; readonly done: boolean };
  private finished = false;
  private readonly onObservation: ((o: Observation) => void) | undefined;

  constructor(store: Store, ids: string[], io: BlobIO, opts: ReduceOptions, onObservation?: (o: Observation) => void) {
    this.onObservation = onObservation;
    const view: SessionLineageView | undefined = ids.length > 1 ? store.lineageForIds(ids) : undefined;
    const lineage = view;
    const rootsHint = rootsHintFor(store, ids);
    this.fold = ProjectionFold.start(ids, io, { ...opts, ...(lineage ? { lineage } : {}), ordered: true, rootsHint });
    this.lineage = lineage ? store.lineageReader(lineage) : undefined;
    if (this.lineage) this.reader = this.lineage;
    else {
      const rows = store.orderedRowIds(ids);
      let at = 0;
      const self = store;
      this.reader = {
        get done() { return at >= rows.length; },
        read(limit: number) {
          const out: Observation[] = [];
          while (out.length < limit && at < rows.length) { const o = self.observationByRowId(rows[at++]!); if (o) out.push(o); }
          return out;
        },
      };
    }
  }

  get done(): boolean { return this.finished; }

  step(limit: number): boolean {
    if (this.finished) return true;
    const slice = this.reader.read(limit);
    if (this.onObservation) for (const o of slice) this.onObservation(o);
    if (slice.length) this.fold.feed(slice);
    if (this.reader.done) this.finished = true;
    return this.finished;
  }
}
