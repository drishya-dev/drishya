import type { Projection } from '../../packages/contracts/src/index.ts';
import { redactText } from '../../packages/privacy/src/index.ts';
import type { RealCase } from './types.ts';

// Scan journal text for any redaction rule match (never printing or retaining matched secrets),
// then verify the imported projection leaves zero unredacted matches for any rule.
function collectRuleCounts(value: unknown, counts = new Map<string, number>()): Map<string, number> {
  if (typeof value === 'string') {
    for (const h of redactText(value).hits) counts.set(h.rule, (counts.get(h.rule) ?? 0) + h.count);
    return counts;
  }
  if (Array.isArray(value)) { for (const item of value) collectRuleCounts(item, counts); return counts; }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (obj.kind === 'captured-image') return counts;
    for (const [k, v] of Object.entries(obj)) {
      for (const h of redactText(k).hits) counts.set(h.rule, (counts.get(h.rule) ?? 0) + h.count);
      collectRuleCounts(v, counts);
    }
  }
  return counts;
}

function countRedactedMarkers(value: unknown): number {
  if (typeof value === 'string') return (value.match(/\[REDACTED:[a-z-]+\]/g) ?? []).length;
  if (Array.isArray(value)) return value.reduce((n, x) => n + countRedactedMarkers(x), 0);
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return Object.entries(obj).reduce((n, [k, v]) => n + countRedactedMarkers(k) + countRedactedMarkers(v), 0);
  }
  return 0;
}

export const redaction: RealCase = {
  name: 'redaction',
  about: 'secret/token patterns in real journals are redacted on ingest and absent from the imported projection',
  harnesses: ['claude-code', 'codex'],
  prefilter: '',
  scan(row) {
    const counts = collectRuleCounts(row);
    if (!counts.size) return;
    const hits = [...counts.values()].reduce((a, b) => a + b, 0);
    const strict = [...counts.keys()].some((k) => k !== 'secret-assignment' && k !== 'url-credentials' && k !== 'bearer') ? hits : 0;
    return { hits, only: strict };
  },
  verify(p: Projection, found) {
    const remaining = collectRuleCounts(p);
    const residual = [...remaining.entries()].map(([rule, n]) => `${rule}=${n}`).join(', ');
    const markers = countRedactedMarkers(p);
    return [
      `${found.hits} raw rule matches scanned in journal; ${markers} [REDACTED:...] markers kept in projection`,
      remaining.size ? `FAIL residual unredacted rule matches in projection: ${residual}` : 'PASS zero unredacted matches for all rules',
    ];
  },
};
