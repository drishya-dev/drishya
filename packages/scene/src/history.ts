import type { Projection } from '@drishya/contracts';
import { materialOperations, operationFailed } from '@drishya/contracts';
import type { ComposeInput, Marker, Scene } from './index.ts';

/** Local reader API, separate from the immutable capture/event schema. */
export interface HistoryQuery {
  /** Locate the first reading passage after a captured turn; does not limit evidence. */
  promptStep?: number;
  start?: number;
  count?: number;
  step?: number;
  /** Last composed applied boundary for a live update. Omit for single-step replay. */
  since?: number;
  /** Preserve the preceding interval if this request finds no new timeline entry. */
  previousSince?: number;
  selectedOperationId?: string;
  observationId?: string;
  filter?: ComposeInput['filter'];
  pinnedPassageIds?: string[];
  /**
   * PERF-4: the caller (the open page) can show a recent-first view of a large recording while the whole history
   * is folded in the background; the reply then carries `partial`. Omitted, the reply always waits for the whole view.
   */
  tailFirst?: boolean;
  /** PERF-4: begin the window at this passage (the swap from the recent-first page to the whole one keeps the reader's place). */
  anchorPassageId?: string;
}

export interface HistoryPage {
  /**
   * PERF-4: this page is composed from the recording's latest work alone (the whole history is still being folded).
   * Its operations, prose and passages are the real ones, with their final identities; step numbers count from the
   * start of that work, and anything that needs the whole session (file list, totals, counts, earlier history) is
   * not final. The whole page replaces it, once, when the fold completes.
   */
  partial?: { observations: number };
  /** Effective live change interval, retained through same-step paging/re-renders. */
  since?: number;
  /** Last queue event visible at the exact replay cursor, even outside the resident timeline tail. */
  queueBoundary?: {ownerRecordingId: string; observationId: string};
  operationCount: number;
  summary: HistorySummary;
  references: Record<string, { title: string; step: number }>;
  projection: Projection;
  scene: Scene;
  start: number;
  loadedPassageIds: string[];
  revisions: Record<string, number>;
  /** Compact filmstrip samples; marker navigation is queried against the full disk index. */
  markers: Marker[];
  dwell: number;
}

export type HistorySummary = ReturnType<typeof historySummary>;
export function historySummary(p: Projection, from = 0) {
  const ops = materialOperations(p.operations).filter((op) => op.startSequence >= from);
  const editedFiles = [...new Set(ops.filter((op) => (op.kind === 'edit' || op.kind === 'write') && op.status === 'ok').flatMap((op) => op.paths.map((ref) => ref.path)))];
  const tests = ops.filter((op) => op.kind === 'test');
  const last = tests.at(-1);
  const lastTest = last?.detail.kind === 'test' ? last.detail.summary ? `${last.detail.summary.passed} passed, ${last.detail.summary.failed} failed` : last.status : undefined;
  return { edits: editedFiles.length, editedFiles, tests: tests.length, lastTest, errors: ops.filter(operationFailed).length, agents: new Set(ops.map((op) => op.agentId)).size };
}
