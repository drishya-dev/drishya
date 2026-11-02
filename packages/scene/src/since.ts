// P2-A "Since your last visit": what happened after a reading boundary, as deterministic facts.
// No model call and no inference: each item is a captured operation or gap with its own link.
// A boundary is an observation sequence (`receivedSequence`), stable across re-import.

import type { Operation, Projection } from '@drishya/contracts';
import { materialOperations, operationFailed } from '@drishya/contracts';
import {operationObservations} from './operation-observations.ts';
import {sessionDiff, type SessionDiff} from './session-diff.ts';

export interface SinceItem {
  kind: 'edit' | 'failure' | 'test' | 'unfinished' | 'gap';
  /** The operation to open; absent for a capture gap. */
  operationId?: string;
  /** Observation sequence the fact belongs to (an operation's result, else its start). */
  sequence: number;
  sequenceBasis?:'captured-observation'|'timeline-position';
  title: string;
  /** Short captured detail, e.g. a test summary or the failing tool's status. */
  detail?: string;
  paths: string[];
  status?: Operation['status'];
}

export interface SinceDigest {
  after: number;
  through: number;
  /** Timeline steps after the boundary. */
  newSteps: number;
  /** Entries without an exact observation position cannot be assigned to a reading boundary. */
  unplacedCount?:number;
  edits: SinceItem[];
  failures: SinceItem[];
  tests: SinceItem[];
  unfinished: SinceItem[];
  gaps: SinceItem[];
  editedFiles: string[];
}

export type SinceGroup = 'failures' | 'edits' | 'tests' | 'unfinished' | 'gaps';
/** READ-5: one captured edit of a file, attributed only by its own captured position. */
export interface SinceFileEdit {
  operationId: string;
  /** 1-based prompt turn of the editing agent at this edit's own captured position; absent when that position was not captured (unattributed). */
  turn?: number;
  added: number;
  removed: number;
  /** The first recorded test run by the same agent after this edit and before its next prompt; absent when none is recorded (never inferred). */
  nextTest?: { operationId: string; outcome: 'passed' | 'failed' | 'unknown' };
}
/** Captured patch size of one edited file, and the prompt turn of the last captured edit to it. */
export interface SinceFileStat { added: number; removed: number; edits: number; /** 1-based turn of the agent's prompts at the last captured edit. */ turn?: number; /** Captured edits in capture order, at most `FILE_EDIT_LIMIT`; `edits` is the full count. */ fileEdits?: SinceFileEdit[]; netDiff?: SessionDiff }
export interface SinceSnapshot extends SinceDigest {
  counts: Record<SinceGroup, number>;
  editedFileCount: number;
  /** For the files on this page only. Counts come from captured hunks, so a patch that was not captured counts as 0. */
  fileStats?: Record<string, SinceFileStat>;
  /** Capture gaps across the whole recording grouped by what they say, so nine identical gaps read as one line. */
  gapGroups?: { title: string; count: number }[];
}

/** Edits listed per file; the rest are counted in `SinceFileStat.edits`. */
export const FILE_EDIT_LIMIT = 20;

/** Per-file +/- from captured hunks and each edit's turn and next test run, in capture order. */
/** A gap is named by what it means to a reader. */
const gapTitle = (reason: string) => reason === 'compaction' ? 'Earlier context compacted' : reason === 'unsupported-record' ? 'Record Drishya does not read yet' : `Gap: ${reason.replace(/-/g, ' ')}`;

export function sinceFileStats(p: Projection, edits: SinceItem[], paths: string[]): Record<string, SinceFileStat> {
  const wanted = new Set(paths), ops = new Map(p.operations.map((o) => [o.id, o])), stats: Record<string, SinceFileStat> = {};
  const { starts, ends } = operationObservations(p);
  const turnsByAgent = new Map<string, number[]>(), testsByAgent = new Map<string, { start: number; op: Operation }[]>();
  for (const item of p.timeline) if (item.type === 'turn') (turnsByAgent.get(item.agentId) ?? turnsByAgent.set(item.agentId, []).get(item.agentId)!).push(item.sequence);
  for (const op of p.operations) {
    const start = starts.get(op.id);
    if (op.kind === 'test' && !op.declined && start !== undefined) (testsByAgent.get(op.agentId) ?? testsByAgent.set(op.agentId, []).get(op.agentId)!).push({ start, op });
  }
  for (const list of testsByAgent.values()) list.sort((a, b) => a.start - b.start);
  for (const edit of [...edits].sort((a, b) => a.sequence - b.sequence)) {
    const op = edit.operationId ? ops.get(edit.operationId) : undefined;
    if (!op || op.detail.kind !== 'edit' || !wanted.has(op.detail.path)) continue;
    const stat = stats[op.detail.path] ??= { added: 0, removed: 0, edits: 0 };
    let added = 0, removed = 0;
    for (const hunk of op.detail.hunks) for (const line of hunk.lines) { if (line.startsWith('+')) added++; else if (line.startsWith('-')) removed++; }
    stat.added += added; stat.removed += removed; stat.edits++;
    // Operation sequences are timeline offsets; only the op-start observation compares with turn sequences.
    const position = starts.get(op.id), turns = turnsByAgent.get(op.agentId) ?? [];
    const turn = position === undefined ? undefined : turns.filter((sequence) => sequence <= position).length || undefined;
    if (turn) stat.turn = turn;
    if (stat.edits > FILE_EDIT_LIMIT) continue;
    const entry: SinceFileEdit = { operationId: op.id, turn, added, removed };
    if (position !== undefined && turn) {
      const after = ends.get(op.id) ?? position, turnEnd = turns.find((sequence) => sequence > position) ?? Infinity;
      const test = testsByAgent.get(op.agentId)?.find((t) => t.start > after && t.start < turnEnd);
      if (test) entry.nextTest = { operationId: test.op.id, outcome: test.op.status === 'ok' ? 'passed' : operationFailed(test.op) ? 'failed' : 'unknown' };
    }
    (stat.fileEdits ??= []).push(entry);
  }
  return stats;
}

/** Whole-session facts with bounded previews for the reader; never count just a page. */
export function sinceSnapshot(p: Projection, after: number, page = 0): SinceSnapshot {
  const digest = sinceBoundary(p, after);
  const offset = Math.max(0, Math.floor(Number.isFinite(page) ? page : 0));
  const groups: SinceGroup[] = ['failures', 'edits', 'tests', 'unfinished', 'gaps'];
  const counts = Object.fromEntries(groups.map((key) => [key, digest[key].length])) as Record<SinceGroup, number>;
  const pageFiles = digest.editedFiles.slice(offset * 50, offset * 50 + 50), gapCounts = new Map<string, number>();
  for (const gap of digest.gaps) gapCounts.set(gap.title, (gapCounts.get(gap.title) ?? 0) + 1);
  const fileStats = sinceFileStats(p, digest.edits, pageFiles);
  let remainingLines = 10_000, remainingCharacters = 1_000_000;
  for (const path of pageFiles) if (fileStats[path]) {
    const diff = sessionDiff(p, path, after);
    const characters = diff.lines.reduce((n, line) => n + line.text.length, 0);
    if (diff.lines.length > remainingLines || characters > remainingCharacters) fileStats[path].netDiff = {basis:'derived',status:'unavailable',lines:[],note:'This review page exceeds the bounded net-diff material limit; inspect the individual edits.'};
    else { fileStats[path].netDiff = diff; remainingLines -= diff.lines.length; remainingCharacters -= characters; }
  }
  return { fileStats, gapGroups: [...gapCounts].map(([title, count]) => ({ title, count })).sort((a, b) => b.count - a.count), ...digest, ...Object.fromEntries(groups.map((key) => [key, digest[key].slice(offset * 20, offset * 20 + 20)])), counts, editedFiles: digest.editedFiles.slice(offset * 50, offset * 50 + 50), editedFileCount: digest.editedFiles.length };
}

/** Where an operation's outcome landed: its result if it has one, else where it started. */
function item(kind: SinceItem['kind'], o: Operation, sequence:number,sequenceBasis:SinceItem['sequenceBasis']): SinceItem {
  let detail: string | undefined;
  if (o.detail.kind === 'test' && o.detail.summary && o.detail.summary.passed + o.detail.summary.failed > 0) detail = `${o.detail.summary.passed} passed, ${o.detail.summary.failed} failed`;
  else if (o.detail.kind === 'test' || o.detail.kind === 'shell') detail = o.detail.exitCode === undefined || o.detail.exitCode === null ? undefined : `exit ${o.detail.exitCode}`;
  if (kind === 'failure' && o.failure) detail = detail ? `${detail} · ${o.failure}` : o.failure;
  return { kind, operationId: o.id, sequence, sequenceBasis, title: o.title, detail, paths: o.paths.map((p) => p.path), status: o.status };
}

/**
 * Everything whose outcome landed after `after` (exclusive), plus every operation still running.
 * An operation that started before the boundary but resolved after it counts: its outcome is new.
 */
export function sinceBoundary(p: Projection, after: number): SinceDigest {
  p = { ...p, operations: materialOperations(p.operations) };
  const observations=operationObservations(p);
  const position=(o:Operation,outcome=true)=>outcome?observations.ends.get(o.id)??observations.starts.get(o.id):observations.starts.get(o.id);
  const resolvedAfter = p.operations.filter((o) => {const sequence=position(o);return o.status !== 'running' && (after<0||sequence!==undefined&&sequence>after);});
  const make=(kind:SinceItem['kind'],o:Operation)=>{const sequence=position(o,kind!=='unfinished');return item(kind,o,sequence??(kind==='unfinished'?o.startSequence:o.endSequence??o.startSequence),sequence===undefined?'timeline-position':'captured-observation');};
  const gaps=p.gaps.map(g=>{const entry=p.timeline[g.sequence];return {...g,observation:entry?.type==='gap'&&entry.reason===g.reason?entry.sequence:undefined};});
  const bySeq = (a: SinceItem, b: SinceItem) => a.sequence - b.sequence;
  const edits = resolvedAfter.filter((o) => (o.kind === 'edit' || o.kind === 'write') && o.status !== 'error').map((o) => make('edit', o)).sort(bySeq);
  return {
    after,
    through: p.lastSequence,
    newSteps: p.timeline.filter((t) => t.sequence > after).length,
    unplacedCount:p.operations.filter(o=>position(o)===undefined).length+gaps.filter(g=>g.observation===undefined).length,
    edits,
    failures: resolvedAfter.filter(operationFailed).map((o) => make('failure', o)).sort(bySeq),
    tests: resolvedAfter.filter((o) => o.kind === 'test').map((o) => make('test', o)).sort(bySeq),
    unfinished: p.operations.filter((o) => o.status === 'running').map((o) => make('unfinished', o)).sort(bySeq),
    gaps: gaps
      .filter((g) => after<0||g.observation!==undefined&&g.observation>after)
      .map((g) => ({ kind: 'gap' as const, sequence: g.observation??g.sequence,sequenceBasis:g.observation===undefined?'timeline-position' as const:'captured-observation' as const, title: gapTitle(g.reason), detail: g.detail, paths: [] }))
      .sort(bySeq),
    editedFiles: [...new Set(edits.flatMap((e) => e.paths))],
  };
}
