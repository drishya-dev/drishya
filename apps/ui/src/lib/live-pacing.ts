import type { Projection } from '@drishya/contracts';

/**
 * Captured work is available immediately. This only decides whether the camera can keep
 * following it without skipping more than a reader can take in at once.
 */
export function stageIncomingWork(projection: Projection, fromStep: number, toStep: number): boolean {
  const added = Math.max(0, toStep - fromStep);
  if (added >= 4) return true;
  if (!added) return false;
  for (const item of projection.timeline.slice(fromStep, toStep)) {
    if (item.type === 'prose' && (projection.prose.find((entry) => entry.id === item.proseId)?.text.length ?? 0) > 320) return true;
    if (item.type === 'op-end') {
      const detail = projection.operations.find((entry) => entry.id === item.operationId)?.detail;
      if (detail && 'outputPreview' in detail && (detail.outputPreview?.length ?? 0) > 320) return true;
      if (detail && 'resultPreview' in detail && (detail.resultPreview?.length ?? 0) > 320) return true;
    }
  }
  return false;
}
