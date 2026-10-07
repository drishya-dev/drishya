import type { Projection } from '@drishya/contracts';

function inputNeedsReading(input: unknown): boolean {
  if (typeof input === 'string') return input.length > 320;
  if (!input || typeof input !== 'object') return false;
  let budget = 320;
  let fields = 0;
  // A camera decision must not serialize or traverse a potentially huge tool input.
  for (const key in input) {
    if (!Object.hasOwn(input, key)) continue;
    if (++fields > 16) return true;
    const value = (input as Record<string, unknown>)[key];
    if (value && typeof value === 'object') return true;
    budget -= key.length + (typeof value === 'string' ? value.length : 24);
    if (budget < 0) return true;
  }
  return false;
}

/**
 * Captured work is available immediately. This only decides whether the camera can keep
 * following it without skipping more than a reader can take in at once.
 */
export function stageIncomingWork(projection: Projection, fromStep: number, toStep: number, timelineStart = 0): boolean {
  const added = Math.max(0, toStep - fromStep);
  if (added >= 4) return true;
  if (!added) return false;
  for (const item of projection.timeline.slice(Math.max(0, fromStep - timelineStart), Math.max(0, toStep - timelineStart))) {
    if (item.type === 'prose' && (projection.prose.find((entry) => entry.id === item.proseId)?.text.length ?? 0) > 320) return true;
    if (item.type === 'op-start') {
      const detail = projection.operations.find((entry) => entry.id === item.operationId)?.detail;
      if (detail && 'command' in detail && detail.command.length > 320) return true;
      if (detail?.kind === 'mcp' && inputNeedsReading(detail.input)) return true;
    }
    if (item.type === 'op-end') {
      const detail = projection.operations.find((entry) => entry.id === item.operationId)?.detail;
      if (detail && 'outputPreview' in detail && (detail.outputPreview?.length ?? 0) > 320) return true;
      if (detail && 'resultPreview' in detail && (detail.resultPreview?.length ?? 0) > 320) return true;
    }
  }
  return false;
}

/** One late artifact can occupy more reading space than a whole short burst. */
export function stageViewportGrowth(before: number, after: number, viewportHeight: number): boolean {
  // Compact previews still need to hold a substantial late reveal at its input.
  return after - before > Math.max(72, Math.min(120, viewportHeight / 5));
}
