import { hasFileTimelineEvidence } from '../../../../packages/scene/src/file-timeline.ts';
import type { Operation } from '@drishya/contracts';
import { fileEvidence, type FileEvidence } from './file-evidence.ts';

/**
 * One step per captured read or edit of the file, in the order the operations arrive. Each step shows the
 * operation's first captured evidence (an edit's patch, else its before/after reference; a read's excerpt),
 * the same choice the action list makes. Search matches stay reachable through the list, not the stepper.
 */
export function fileTimeline(operations: readonly Operation[], path: string): FileEvidence[] {
  const steps: FileEvidence[] = [];
  for (const op of operations) {
    if (!hasFileTimelineEvidence(op, path)) continue;
    const first = fileEvidence(op, path)[0];
    if (first) steps.push(first);
  }
  return steps;
}

export interface TimelineStep {
  /** 1-based position of the selected operation, or undefined when the selection is outside the sequence. */
  position?: number;
  total: number;
  previous?: FileEvidence;
  next?: FileEvidence;
}

/** A selection outside the sequence (a search match, a retained item) steps to the first or last captured step. */
export function timelineStep(steps: readonly FileEvidence[], current: FileEvidence | undefined): TimelineStep {
  const index = current ? steps.findIndex((step) => step.operation.id === current.operation.id) : -1;
  if (index < 0) return { total: steps.length, previous: steps.at(-1), next: steps[0] };
  return { position: index + 1, total: steps.length, previous: steps[index - 1], next: steps[index + 1] };
}
