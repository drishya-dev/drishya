// LIVE-7b: a resumable fold of one recording (or a proven lineage of them) through the reducer.
//
// The reducer is a fold over observations in source-clock order (see `orderObservations`), and
// `createReducer` already keeps its state between `append` calls. This file is the seam that makes using
// that safe: it records exactly what has been folded (the HEAD, serialisable and versioned), decides whether
// a batch of newly stored observations may simply be appended to it, and otherwise says "rebuild".
//
// An append is equal to a full rebuild only when the new observations would sort AFTER everything already
// folded, and nothing that the reducer decided from the whole input has changed. That is checked here, in
// one place, instead of at each caller:
//
//   - the batch belongs to the last recording of the fold (an earlier lineage part has not changed);
//   - every observation is newer in `receivedSequence` than the fold's head, in the same source generation,
//     and none is a truncation marker (a new generation replays the file from its start);
//   - every observation's effective source clock (its own time, else the clock carried forward from the
//     previous observation of the same source, exactly as the store orders rows) is at or after the head's;
//   - no observation names a workspace root the fold has not seen (roots decide the path namespace of every
//     earlier operation), and `REDUCER_VERSION` and the head `format` are the ones this code folds with.
//
// When any check fails `append` changes nothing and returns false; the caller rebuilds with `ProjectionFold.build`.
//
// PERF-4's persisted checkpoint builds on this: `FoldHead` is the part that is already plain data. The reducer's
// own state (the maps and accumulators inside `createReducer`) is not yet serialisable; writing it out means
// moving those closure variables into one state object with a codec, versioned by `FOLD_FORMAT` + `REDUCER_VERSION`.
// A persisted state is valid for a journal exactly when its head passes `canAppend` for the stored tail.

import { createHash } from 'node:crypto';
import { deserialize, serialize } from 'node:v8';
import type { Observation, Projection } from '@drishya/contracts';
import { createReducer, REDUCER_VERSION, type BlobIO, type ReduceOptions } from './reduce.ts';

/** Bump when the head's shape or the meaning of a check changes; a checkpoint with another format is never resumed. */
export const FOLD_FORMAT = 1;

/** What a fold has consumed. Plain data, JSON-safe. */
/** A persistable fold: its head and the reducer's state as bytes (v8-serialized, keeping shared object identity). */
export interface FoldCheckpoint { head: FoldHead; state: Buffer; /** Blobs the state refers to by hash (captured file bases); a checkpoint is only good while they are still stored. */ blobs: string[] }

export interface FoldHead {
  format: number;
  reducerVersion: string;
  /** The recording whose projection this is (the last of `parts`). */
  recordingId: string;
  /** Recordings folded, ancestors first; one entry unless a proven lineage is folded. */
  parts: string[];
  /** Observations folded per recording. */
  counts: Record<string, number>;
  /** Highest `receivedSequence` folded per recording. */
  sequences: Record<string, number>;
  /** Effective source clock (ISO) of the last observation of the last part; '' before any. */
  clock: string;
  /**
   * Per "<recording>/<source>": the clock of its newest-by-sequence observation that carries its own time. An
   * observation without a time sorts by this carried clock, exactly as the store orders rows.
   */
  sourceClocks: Record<string, { sequence: number; clock: string }>;
  /** Source generation seen per "<recording>/<source>". */
  generations: Record<string, number>;
  /** Workspace roots seen in observations; a new one changes path namespacing everywhere. */
  roots: string[];
}

const clockTime = (time: string | undefined) => time && Number.isFinite(Date.parse(time)) ? new Date(time).toISOString() : undefined;

function rootsOf(o: Observation): string[] {
  const p = o.payload as { cwd?: unknown; intent?: { cwd?: unknown } };
  return [o.workspaceRoot, p.cwd, p.intent?.cwd].filter((r): r is string => typeof r === 'string' && r.length > 0);
}

export class ProjectionFold {
  private readonly reducer: ReturnType<typeof createReducer>;
  private readonly h: FoldHead;
  private readonly roots: Set<string>;

  private constructor(head: FoldHead, reducer: ReturnType<typeof createReducer>, roots: Set<string>) {
    this.h = head;
    this.reducer = reducer;
    this.roots = roots;
  }

  /**
   * Folds `ordered` (already in the store's reading order, ancestors first for a lineage) and keeps the state.
   * `opts.ordered` is forced on: the caller supplies the order and the fold records where it ended.
   */
  static build(parts: string[], ordered: Iterable<Observation>, io: BlobIO, opts: ReduceOptions): ProjectionFold {
    const recordingId = parts.at(-1)!;
    const head: FoldHead = { format: FOLD_FORMAT, reducerVersion: REDUCER_VERSION, recordingId, parts: [...parts], counts: Object.fromEntries(parts.map((p) => [p, 0])), sequences: Object.fromEntries(parts.map((p) => [p, -1])), clock: '', sourceClocks: {}, generations: {}, roots: [] };
    const roots = new Set<string>([...Object.values(opts.rootsHint?.byRecording ?? {}), ...(opts.rootsHint?.all ?? [])]);
    // The reducer reads its input three times (roots, then roots again, then the fold), so a lazy source such as a
    // database cursor would run its query three times; read it once.
    const list = Array.isArray(ordered) ? ordered : [...ordered];
    for (const o of list) track(head, roots, o);
    const reducer = createReducer(opts.lineage?.currentRecordingId ?? recordingId, list, io, { ...opts, ordered: true });
    return new ProjectionFold(head, reducer, roots);
  }

  /**
   * PERF-4: an empty fold to be fed the whole ordered input in slices with `feed` (a long history is folded between
   * yields to the event loop). `opts.rootsHint` must carry the whole input's root evidence: the reducer reads roots
   * up front, before any slice. The result equals `build` over the same input (parity-tested).
   */
  static start(parts: string[], io: BlobIO, opts: ReduceOptions): ProjectionFold {
    return ProjectionFold.build(parts, [], io, opts);
  }

  /**
   * Folds the next slice of an ordered stream begun with `start`. The caller owns the order (a store ordered
   * read); nothing is checked here, unlike `append`, which guards a fold that is resumed after the fact.
   */
  feed(ordered: readonly Observation[]): void {
    for (const o of ordered) track(this.h, this.roots, o);
    this.reducer.append(ordered);
  }

  /**
   * PERF-4: the fold as bytes. Valid for a recording only while `restore` accepts it (the caller also keys it by the
   * options the reducer ran with, the privacy policy and the blob store; see the history worker).
   */
  checkpoint(): FoldCheckpoint {
    const state = this.reducer.exportState();
    return { head: this.head, state: serialize(state), blobs: [...new Set(state.bases.values())] };
  }

  /**
   * A fold resumed from a checkpoint, or undefined when it is not one this code can resume (another format or reducer
   * version, or unreadable bytes). It is then equal to the fold that was checkpointed: `canAppend`/`append` continue from its head.
   */
  static restore(checkpoint: FoldCheckpoint, io: BlobIO, opts: ReduceOptions): ProjectionFold | undefined {
    const head = checkpoint.head;
    if (head.format !== FOLD_FORMAT || head.reducerVersion !== REDUCER_VERSION) return undefined;
    let state: ReturnType<ReturnType<typeof createReducer>['exportState']>;
    try { state = deserialize(checkpoint.state); } catch { return undefined; }
    const reducer = createReducer(opts.lineage?.currentRecordingId ?? head.recordingId, [], io, { ...opts, ordered: true, rootsHint: { byRecording: state.rootsByRecording, all: head.roots } });
    reducer.importState(state);
    const roots = new Set(head.roots);
    return new ProjectionFold(JSON.parse(JSON.stringify(head)) as FoldHead, reducer, roots);
  }

  get head(): FoldHead {
    return { ...this.h, parts: [...this.h.parts], counts: { ...this.h.counts }, sequences: { ...this.h.sequences }, sourceClocks: Object.fromEntries(Object.entries(this.h.sourceClocks).map(([k, v]) => [k, { ...v }])), generations: { ...this.h.generations }, roots: [...this.roots] };
  }

  /** The highest `receivedSequence` folded for a recording (-1 before any): what a caller fetches "after". */
  sequenceOf(recordingId: string): number {
    return this.h.sequences[recordingId] ?? -1;
  }

  /** Observations folded so far across all parts. */
  get observationCount(): number {
    return Object.values(this.h.counts).reduce((n, c) => n + c, 0);
  }

  /**
   * Whether `added` (the stored observations after this fold's head, in `receivedSequence` order) may be
   * appended without changing what a full rebuild would produce. Pure: nothing is changed.
   */
  canAppend(added: readonly Observation[]): boolean {
    return this.plan(added) !== undefined;
  }

  /** Appends `added` when `canAppend` says it is equal to a rebuild; otherwise changes nothing and returns false. */
  append(added: readonly Observation[]): boolean {
    const plan = this.plan(added);
    if (!plan) return false;
    for (const o of plan.bySequence) track(this.h, this.roots, o);
    this.reducer.append(plan.ordered);
    return true;
  }

  snapshot(live: boolean): Projection {
    return this.reducer.snapshot(live);
  }

  private plan(added: readonly Observation[]): { bySequence: Observation[]; ordered: Observation[] } | undefined {
    const h = this.h;
    if (h.format !== FOLD_FORMAT || h.reducerVersion !== REDUCER_VERSION) return undefined;
    const last = h.recordingId;
    // Antigravity replaces a step's receipt in place (same id and sequence), orders by its own step index rather than a
    // clock, and adds side-file observations without a journal line. None of that is an append, so it is always rebuilt.
    if (added.some(o => o.source.adapterId === 'antigravity')) return undefined;
    const bySequence = [...added].sort((a, b) => a.receivedSequence - b.receivedSequence);
    const carry = new Map(Object.entries(h.sourceClocks).map(([k, v]) => [k, v.clock]));
    let sequence = h.sequences[last] ?? -1;
    const keyed: { o: Observation; t: string; i: number }[] = [];
    for (let i = 0; i < bySequence.length; i++) {
      const o = bySequence[i]!;
      if (o.recordingId !== last || o.receivedSequence <= sequence) return undefined;
      sequence = o.receivedSequence;
      const src = `${o.recordingId}/${o.source.sourceId}`;
      const known = h.generations[src];
      if (known !== undefined && known !== o.source.generation) return undefined;
      if (o.kind === 'capture.gap' && (o.payload as { reason?: unknown }).reason === 'source-truncated') return undefined;
      for (const root of rootsOf(o)) if (!this.roots.has(root)) return undefined;
      const own = clockTime(o.sourceTime);
      if (own) carry.set(src, own);
      const t = own ?? carry.get(src) ?? '';
      if (t < h.clock) return undefined;
      keyed.push({ o, t, i });
    }
    keyed.sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : a.i - b.i));
    return { bySequence, ordered: keyed.map((k) => k.o) };
  }
}

/** Advances the head over one observation. Called in `receivedSequence` order within each source, so "newest" below means highest sequence. */
function track(h: FoldHead, roots: Set<string>, o: Observation): void {
  const src = `${o.recordingId}/${o.source.sourceId}`;
  const own = clockTime(o.sourceTime);
  if (own) {
    const known = h.sourceClocks[src];
    if (!known || o.receivedSequence > known.sequence) h.sourceClocks[src] = { sequence: o.receivedSequence, clock: own };
    if (o.recordingId === h.parts.at(-1) && own > h.clock) h.clock = own;
  }
  h.counts[o.recordingId] = (h.counts[o.recordingId] ?? 0) + 1;
  h.sequences[o.recordingId] = Math.max(h.sequences[o.recordingId] ?? -1, o.receivedSequence);
  h.generations[src] = o.source.generation;
  for (const root of rootsOf(o)) roots.add(root);
}

/** A stable digest of a projection, for the developer-switch check that an incremental result equals a rebuild. */
export function projectionDigest(projection: Projection): string {
  return createHash('sha256').update(JSON.stringify(projection)).digest('hex');
}
