import type { Projection } from '../../packages/contracts/src/index.ts';
import { contextReport, newestContextReport } from '../../apps/ui/src/lib/context-report.ts';
import { liveContextOccupancy } from '../../apps/ui/src/lib/context-ring.ts';
import type { RealCase } from './types.ts';

type Raw = Record<string, any>;
const text = (content: unknown): string => typeof content === 'string' ? content : Array.isArray(content) ? content.map(part => typeof part?.text === 'string' ? part.text : '').join('') : '';
const window = (w: Raw | undefined) => !!w && typeof w.used_percent === 'number' && w.used_percent >= 0 && Number.isSafeInteger(w.window_minutes) && Number.isSafeInteger(w.resets_at);

// USAGE-1. Claude Code: a genuine /context report in the journal (strict: it also prints the used/window line). Codex: token_count
// records carrying a rate-limit window (strict: both the primary and the weekly one). Counts only; no journal text is printed.
export const usageContext: RealCase = {
  name: 'usage-context', about: 'Claude /context reports with their printed window; Codex records with both rate-limit windows',
  harnesses: ['claude-code', 'codex'], prefilter: { 'claude-code': 'local-command-stdout', codex: '"rate_limits"' },
  scan(row: Raw, harness) {
    if (harness === 'claude-code') {
      // Claude Code writes the command output as a system `local_command` row (older journals: a user row).
      if (row.isSidechain || (row.type !== 'user' && !(row.type === 'system' && row.subtype === 'local_command'))) return;
      const report = contextReport(text(row.type === 'system' ? row.content : row.message?.content));
      return report ? { hits: 1, only: report.total ? 1 : 0 } : undefined;
    }
    const p = row.payload ?? {};
    if (row.type !== 'event_msg' || p.type !== 'token_count') return;
    const primary = window(p.rate_limits?.primary), secondary = window(p.rate_limits?.secondary);
    return primary || secondary ? { hits: 1, only: primary && secondary ? 1 : 0 } : undefined;
  },
  verify(p: Projection, found) {
    if (p.agents.some(agent => agent.harness === 'codex')) {
      const points = [...Object.values(p.usage?.byTurn ?? {}), ...(p.usage?.latest ? [p.usage.latest] : [])];
      const both = points.filter(point => point.limits && point.secondaryLimits).length, weekly = points.filter(point => point.secondaryLimits).length;
      return [`${found.hits} records with a window (${found.only} with both); the projection keeps ${weekly} weekly windows, ${both} alongside a primary`,
        `${found.only === 0 || weekly > 0 ? 'PASS' : 'FAIL'} a recorded weekly window survives ingest`, `latest reading: ${p.usage?.latest?.limits ? 'primary' : 'no primary'} + ${p.usage?.latest?.secondaryLimits ? 'weekly' : 'no weekly'}`];
    }
    const report = newestContextReport(p.timeline), ring = liveContextOccupancy(p);
    return [`${found.hits} reports in the journal (${found.only} print their window); newest has ${report?.report.rows.length ?? 0} categories, ${report?.report.sections.length ?? 0} lists, printed window ${report?.report.total?.window ?? 'none'}`,
      `${report ? 'PASS' : 'FAIL'} the newest report is found in the loaded history`, `session ring from the report: ${ring?.reportTime ? `${Math.round(ring.fraction * 100)}%` : 'none (no reading or no printed window)'}`];
  },
};
