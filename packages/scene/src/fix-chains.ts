// READ-7 failure → fix chains: a failed command, the next recorded run of the same command, and
// the edits recorded between them.
//
// This is a "same command, later run" relationship by recorded order. It never says the edits
// caused the later outcome; a later pass may owe nothing to them, and a run of the same command
// elsewhere (another cwd, another agent) is still the same captured text.

import type { Operation, Projection } from '@drishya/contracts';
import { operationFailed } from '@drishya/contracts';
import { commandIdentity } from './review-insights.ts';

export interface FixChainRun {
  operationId: string;
  status: Operation['status'];
  sequence: number;
  /** Captured summary or exit code, e.g. "6 passed, 1 failed" or "exit 1". */
  detail?: string;
  agentId: string;
}
export interface FixChainEdit { operationId: string; title: string; sequence: number; paths: string[] }
export interface FixChainLink {
  from: FixChainRun;
  to: FixChainRun;
  /** Edits and writes recorded after `from` finished and before `to` started (at most 12). */
  edits: FixChainEdit[];
  totalEdits: number;
}
export interface FixChain {
  operationId: string;
  command: string;
  /** Links this run takes part in: the failure it follows and/or the later run of a failure. */
  links: FixChainLink[];
}

const outcomeAt = (o: Operation) => o.endSequence ?? o.startSequence;
const isCommand = (o: Operation) => o.detail.kind === 'shell' || o.detail.kind === 'test';
const isChange = (o: Operation) => o.kind === 'edit' || o.kind === 'write';

function run(o: Operation): FixChainRun {
  let detail: string | undefined;
  if (o.detail.kind === 'test' && o.detail.summary) detail = `${o.detail.summary.passed} passed, ${o.detail.summary.failed} failed`;
  else if ((o.detail.kind === 'test' || o.detail.kind === 'shell') && o.detail.exitCode !== undefined && o.detail.exitCode !== null) detail = `exit ${o.detail.exitCode}`;
  return { operationId: o.id, status: o.status, sequence: outcomeAt(o), detail, agentId: o.agentId };
}

/** The failure → later-run links around one shell/test operation, or undefined when it has none. */
export function fixChainFor(p: Projection, operationId: string): FixChain | undefined {
  const anchor = p.operations.find((o) => o.id === operationId);
  if (!anchor || !isCommand(anchor)) return undefined;
  const artifacts = new Map(p.artifacts.map((a) => [a.id, a]));
  const identity = commandIdentity(anchor, artifacts);
  if (!identity) return undefined;
  const order = (a: Operation, b: Operation) => a.startSequence - b.startSequence || a.id.localeCompare(b.id);
  const runs = p.operations.filter((o) => isCommand(o) && commandIdentity(o, artifacts) === identity).sort(order);
  const at = runs.findIndex((o) => o.id === anchor.id);
  const changes = p.operations.filter(isChange);
  const link = (from: Operation, to: Operation): FixChainLink => {
    const between = changes.filter((c) => c.startSequence > outcomeAt(from) && c.startSequence < to.startSequence).sort(order);
    return {
      from: run(from), to: run(to), totalEdits: between.length,
      edits: between.slice(0, 12).map((c) => ({ operationId: c.id, title: c.title, sequence: c.startSequence, paths: [...new Set(c.paths.filter((x) => x.role === 'write').map((x) => x.path))] })),
    };
  };
  const links: FixChainLink[] = [];
  const before = runs[at - 1], after = runs[at + 1];
  if (before && operationFailed(before)) links.push(link(before, anchor));
  if (operationFailed(anchor) && after) links.push(link(anchor, after));
  if (!links.length) return undefined;
  return { operationId, command: (anchor.detail as Extract<Operation['detail'], { kind: 'shell' | 'test' }>).command.slice(0, 240), links };
}
