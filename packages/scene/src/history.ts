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
  selectedOperationId?: string;
  observationId?: string;
  filter?: ComposeInput['filter'];
  pinnedPassageIds?: string[];
}

export interface HistoryPage {
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
