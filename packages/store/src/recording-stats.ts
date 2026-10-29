import type { RecordingSummary, TurnDetailPayload, UsagePayload } from '@drishya/contracts';

const reportedNumber = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;

/** Input is newest first in journal order, independent of import sequence and timestamps. */
export function recordingStats(harness: 'claude-code' | 'codex', rows: Iterable<{ payload: string }>): RecordingSummary['stats'] {
  if (harness === 'claude-code') {
    for (const row of rows) {
      const work = (JSON.parse(row.payload) as UsagePayload).work;
      const stats: NonNullable<RecordingSummary['stats']> = { source: 'claude-cost-state' };
      for (const key of ['durationMs', 'linesAdded', 'linesRemoved'] as const) {
        if (reportedNumber(work?.[key])) stats[key] = work[key];
      }
      // The latest cumulative snapshot replaces the whole earlier snapshot, including missing fields.
      return Object.keys(stats).length > 1 ? stats : undefined;
    }
    return undefined;
  }
  const seen = new Set<string>();
  const stats: NonNullable<RecordingSummary['stats']> = { source: 'codex-turns' };
  let lastTurn = true;
  for (const row of rows) {
    const detail = JSON.parse(row.payload) as TurnDetailPayload;
    if (typeof detail.turnId !== 'string' || !detail.turnId || seen.has(detail.turnId)) continue;
    seen.add(detail.turnId);
    if (lastTurn) {
      if (detail.outcome === 'completed' || detail.outcome === 'aborted') stats.lastOutcome = detail.outcome;
      lastTurn = false;
    }
    if (reportedNumber(detail.durationMs)) stats.durationMs = (stats.durationMs ?? 0) + detail.durationMs;
  }
  return Object.keys(stats).length > 1 ? stats : undefined;
}
