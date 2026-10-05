// P2-A "Since your last visit": what happened after a reading boundary, as deterministic facts.
// No model call and no inference: each item is a captured operation or gap with its own link.
// A boundary is an observation sequence (`receivedSequence`), stable across re-import.

import type { Operation, Projection } from '@drishya/contracts';

export interface SinceItem {
  kind: 'edit' | 'failure' | 'test' | 'unfinished' | 'gap';
  /** The operation to open; absent for a capture gap. */
  operationId?: string;
  /** Observation sequence the fact belongs to (an operation's result, else its start). */
  sequence: number;
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
  edits: SinceItem[];
  failures: SinceItem[];
  tests: SinceItem[];
  unfinished: SinceItem[];
  gaps: SinceItem[];
  editedFiles: string[];
}

/** Where an operation's outcome landed: its result if it has one, else where it started. */
const outcomeAt = (o: Operation) => o.endSequence ?? o.startSequence;

function item(kind: SinceItem['kind'], o: Operation): SinceItem {
  let detail: string | undefined;
  if (o.detail.kind === 'test' && o.detail.summary) detail = `${o.detail.summary.passed} passed, ${o.detail.summary.failed} failed`;
  else if (o.detail.kind === 'test' || o.detail.kind === 'shell') detail = o.detail.exitCode === undefined || o.detail.exitCode === null ? undefined : `exit ${o.detail.exitCode}`;
  return { kind, operationId: o.id, sequence: kind === 'unfinished' ? o.startSequence : outcomeAt(o), title: o.title, detail, paths: o.paths.map((p) => p.path), status: o.status };
}

/**
 * Everything whose outcome landed after `after` (exclusive), plus every operation still running.
 * An operation that started before the boundary but resolved after it counts: its outcome is new.
 */
export function sinceBoundary(p: Projection, after: number): SinceDigest {
  const resolvedAfter = p.operations.filter((o) => o.status !== 'running' && outcomeAt(o) > after);
  const bySeq = (a: SinceItem, b: SinceItem) => a.sequence - b.sequence;
  const edits = resolvedAfter.filter((o) => (o.kind === 'edit' || o.kind === 'write') && o.status !== 'error').map((o) => item('edit', o)).sort(bySeq);
  return {
    after,
    through: p.lastSequence,
    newSteps: p.timeline.filter((t) => t.sequence > after).length,
    edits,
    failures: resolvedAfter.filter((o) => o.status === 'error').map((o) => item('failure', o)).sort(bySeq),
    tests: resolvedAfter.filter((o) => o.kind === 'test').map((o) => item('test', o)).sort(bySeq),
    unfinished: p.operations.filter((o) => o.status === 'running').map((o) => item('unfinished', o)).sort(bySeq),
    gaps: p.gaps
      .filter((g) => g.sequence > after)
      .map((g) => ({ kind: 'gap' as const, sequence: g.sequence, title: `Capture gap: ${g.reason.replace(/-/g, ' ')}`, detail: g.detail, paths: [] }))
      .sort(bySeq),
    editedFiles: [...new Set(edits.flatMap((e) => e.paths))],
  };
}
