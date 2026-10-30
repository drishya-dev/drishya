import type { RealCase } from './types.ts';

/** HOME-1b: recorded Codex turn endings; Claude accounting is a separate, skipped harness. */
export const turnDetails: RealCase = {
  name: 'turn-details',
  about: 'Captured Codex turn outcomes and Claude accounting without fabricated turns',
  harnesses: ['claude-code', 'codex'],
  prefilter: { 'claude-code': 'cost-state', codex: 'event_msg' },
  scan(row, harness) {
    if (harness === 'claude-code') return row.type === 'cost-state' ? { hits: 1 } : undefined;
    const payload = row.payload as Record<string, unknown> | undefined;
    if (row.type !== 'event_msg' || !payload || typeof payload.turn_id !== 'string' || !payload.turn_id) return;
    return ['task_complete', 'turn_aborted'].includes(String(payload.type)) ? { hits: 1 } : undefined;
  },
  verify(projection, found) {
    const turns = projection.turns ?? [];
    if (projection.harnesses.includes('codex')) {
      const outcomes = turns.filter(turn => turn.outcome !== undefined).length;
      return [`${outcomes ? '' : 'FAIL '}${found.hits} recorded turn endings; ${outcomes} captured turns with outcomes; ${turns.filter(turn => turn.durationMs !== undefined).length} with duration`];
    }
    return [`${turns.length ? 'FAIL ' : ''}${found.hits} Claude accounting records; ${turns.length} captured turns (Claude is excluded from startup Codex rescans)`];
  },
};
