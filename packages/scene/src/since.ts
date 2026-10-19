// P2-A "Since your last visit": what happened after a reading boundary, as deterministic facts.
// No model call and no inference: each item is a captured operation or gap with its own link.
// A boundary is an observation sequence (`receivedSequence`), stable across re-import.

import type { Operation, Projection } from '@drishya/contracts';
import {operationObservations} from './operation-observations.ts';

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
export interface SinceSnapshot extends SinceDigest {
  counts: Record<SinceGroup, number>;
  editedFileCount: number;
}

/** Whole-session facts with bounded previews for the reader; never count just a page. */
export function sinceSnapshot(p: Projection, after: number, page = 0): SinceSnapshot {
  const digest = sinceBoundary(p, after);
  const offset = Math.max(0, Math.floor(Number.isFinite(page) ? page : 0));
  const groups: SinceGroup[] = ['failures', 'edits', 'tests', 'unfinished', 'gaps'];
  const counts = Object.fromEntries(groups.map((key) => [key, digest[key].length])) as Record<SinceGroup, number>;
  return { ...digest, ...Object.fromEntries(groups.map((key) => [key, digest[key].slice(offset * 20, offset * 20 + 20)])), counts, editedFiles: digest.editedFiles.slice(offset * 50, offset * 50 + 50), editedFileCount: digest.editedFiles.length };
}

/** Where an operation's outcome landed: its result if it has one, else where it started. */
function item(kind: SinceItem['kind'], o: Operation, sequence:number,sequenceBasis:SinceItem['sequenceBasis']): SinceItem {
  let detail: string | undefined;
  if (o.detail.kind === 'test' && o.detail.summary) detail = `${o.detail.summary.passed} passed, ${o.detail.summary.failed} failed`;
  else if (o.detail.kind === 'test' || o.detail.kind === 'shell') detail = o.detail.exitCode === undefined || o.detail.exitCode === null ? undefined : `exit ${o.detail.exitCode}`;
  return { kind, operationId: o.id, sequence, sequenceBasis, title: o.title, detail, paths: o.paths.map((p) => p.path), status: o.status };
}

/**
 * Everything whose outcome landed after `after` (exclusive), plus every operation still running.
 * An operation that started before the boundary but resolved after it counts: its outcome is new.
 */
export function sinceBoundary(p: Projection, after: number): SinceDigest {
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
    failures: resolvedAfter.filter((o) => o.status === 'error').map((o) => make('failure', o)).sort(bySeq),
    tests: resolvedAfter.filter((o) => o.kind === 'test').map((o) => make('test', o)).sort(bySeq),
    unfinished: p.operations.filter((o) => o.status === 'running').map((o) => make('unfinished', o)).sort(bySeq),
    gaps: gaps
      .filter((g) => after<0||g.observation!==undefined&&g.observation>after)
      .map((g) => ({ kind: 'gap' as const, sequence: g.observation??g.sequence,sequenceBasis:g.observation===undefined?'timeline-position' as const:'captured-observation' as const, title: `Capture gap: ${g.reason.replace(/-/g, ' ')}`, detail: g.detail, paths: [] }))
      .sort(bySeq),
    editedFiles: [...new Set(edits.flatMap((e) => e.paths))],
  };
}
