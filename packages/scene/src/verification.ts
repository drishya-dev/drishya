// P2-C verification freshness: for one captured change, the test runs recorded after it and
// whether the same file changed again after the last of them.
//
// This states order, never coverage. A run recorded after a change may not exercise it, a
// passing run is not "safe to merge", and "no run recorded" means none in the available capture,
// not that none happened. A captured failure that names the changed file is reported as exactly
// that: a reference, not proof of cause.

import type { Operation, Projection } from '@drishya/contracts';

export interface VerificationCheck {
  operationId: string;
  title: string;
  sequence: number;
  status: Operation['status'];
  /** Captured summary, e.g. "6 passed, 1 failed", or the exit code. */
  detail?: string;
  /** A captured failure in this run names one of the changed files. */
  namesChangedFile: boolean;
  sameAgent: boolean;
}

export interface VerificationTrail {
  operationId: string;
  /** Files this change touched. */
  paths: string[];
  /** Test runs whose result was recorded after this change, oldest first (at most 20). */
  checks: VerificationCheck[];
  totalChecks: number;
  /** The last recorded run after this change, if any. */
  lastCheck?: VerificationCheck;
  /** Later changes to the same files, after this one (at most 20). */
  laterChanges: { operationId: string; title: string; sequence: number }[];
  verdict: 'no-check-recorded' | 'checked-after' | 'changed-after-last-check';
}

const outcomeAt = (o: Operation) => o.endSequence ?? o.startSequence;
const isChange = (o: Operation) => o.kind === 'edit' || o.kind === 'write';
const writtenPaths = (o: Operation) => [...new Set(o.paths.filter((p) => p.role === 'write').map((p) => p.path))];

function check(o: Operation, changed: Set<string>, agentId: string): VerificationCheck {
  let detail: string | undefined;
  let namesChangedFile = false;
  if (o.detail.kind === 'test') {
    if (o.detail.summary) {
      detail = `${o.detail.summary.passed} passed, ${o.detail.summary.failed} failed`;
      namesChangedFile = o.detail.summary.failures.some((f) => !!f.file && [...changed].some((p) => f.file === p || f.file!.endsWith(`/${p}`) || p.endsWith(`/${f.file}`)));
    } else if (o.detail.exitCode !== undefined && o.detail.exitCode !== null) detail = `exit ${o.detail.exitCode}`;
  }
  return { operationId: o.id, title: o.title, sequence: outcomeAt(o), status: o.status, detail, namesChangedFile, sameAgent: o.agentId === agentId };
}

/** The verification trail for a change, or undefined when the operation is not a captured change. */
export function verificationFor(p: Projection, operationId: string): VerificationTrail | undefined {
  const change = p.operations.find((o) => o.id === operationId);
  if (!change || !isChange(change)) return undefined;
  const at = outcomeAt(change);
  const paths = writtenPaths(change).length ? writtenPaths(change) : [...new Set(change.paths.map((x) => x.path))];
  const changed = new Set(paths);
  const runs = p.operations
    .filter((o) => o.kind === 'test' && o.status !== 'running' && outcomeAt(o) > at)
    .sort((a, b) => outcomeAt(a) - outcomeAt(b))
    .map((o) => check(o, changed, change.agentId));
  const lastCheck = runs.at(-1);
  const later = p.operations
    .filter((o) => o.id !== change.id && isChange(o) && outcomeAt(o) > at && o.paths.some((x) => changed.has(x.path)))
    .sort((a, b) => outcomeAt(a) - outcomeAt(b));
  const changedAfterLast = !!lastCheck && later.some((o) => outcomeAt(o) > lastCheck.sequence);
  return {
    operationId,
    paths,
    checks: runs.slice(0, 20),
    totalChecks: runs.length,
    lastCheck,
    laterChanges: later.slice(0, 20).map((o) => ({ operationId: o.id, title: o.title, sequence: outcomeAt(o) })),
    verdict: !lastCheck ? 'no-check-recorded' : changedAfterLast ? 'changed-after-last-check' : 'checked-after',
  };
}
