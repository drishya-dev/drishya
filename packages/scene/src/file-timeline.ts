import type { Operation } from '@drishya/contracts';

export interface FileStepTarget { operationId: string; start: number }
export interface FileTimelineCount {
  total: number;
  positions: Record<string, number>;
  first?: FileStepTarget;
  last?: FileStepTarget;
  selected?: { operationId: string; position: number; previous?: FileStepTarget; next?: FileStepTarget };
}
export interface FileOperationPage { operations: Operation[]; total: number; timeline: FileTimelineCount }

/** The same evidence boundary as the reader: no invented version for an action without captured material. */
export function hasFileTimelineEvidence(op: Operation, path: string): boolean {
  const detail = op.detail;
  return detail.kind === 'read' ? detail.path === path && !!detail.excerptArtifactId
    : detail.kind === 'edit' && detail.path === path && (detail.hunks.length > 0 || op.artifactIds.some(id => /_(before|after)$/.test(id)));
}

/** Whole-session counts stay beside the worker's projection; only the requested page and thin navigation cross HTTP. */
export function fileOperationPage(operations: readonly Operation[], path: string, start: number, count: number, query = '', selectedOperationId?: string): FileOperationPage {
  const matches = operations.filter(op => op.paths.some(ref => ref.path === path) && (!query || `${op.title} ${op.kind}`.toLowerCase().includes(query.toLowerCase())));
  const offset = Math.max(0, start), size = Math.min(200, Math.max(1, count));
  const steps = matches.flatMap((op, index) => hasFileTimelineEvidence(op, path) ? [{ operationId: op.id, start: Math.floor(index / size) * size, action: index }] : []);
  const selectedIndex = selectedOperationId ? steps.findIndex(item => item.operationId === selectedOperationId) : -1;
  const target = (index: number): FileStepTarget | undefined => { const item = steps[index]; return item && { operationId: item.operationId, start: item.start }; };
  const positions = Object.fromEntries(steps.flatMap((item, index) => item.action >= offset && item.action < offset + size ? [[item.operationId, index + 1]] : []));
  return { total: matches.length, operations: matches.slice(offset, offset + size), timeline: {
    total: steps.length, positions, first: target(0), last: target(steps.length - 1),
    selected: selectedIndex < 0 ? undefined : { operationId: selectedOperationId!, position: selectedIndex + 1, previous: target(selectedIndex - 1), next: target(selectedIndex + 1) },
  } };
}
