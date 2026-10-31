import type { Projection } from '@drishya/contracts';

export interface ContextOccupancy { used: number; window: number; fraction: number }

/**
 * The last recorded request input relative to the recorded context window, from that request's
 * input tokens and the context window. Cumulative session tokens are usage, not occupied context, so they are never used.
 * Nothing is estimated: a harness that records neither (Claude Code records no window) gets no ring.
 */
export function contextOccupancy(usage: Projection['usage']): ContextOccupancy | undefined {
  if (!usage) return undefined;
  const requests = Object.values(usage.byTurn).filter(point => !point.cumulative && Number.isSafeInteger(point.tokens?.input));
  const last = requests.at(-1);
  const used = last?.tokens?.input;
  const window = last?.contextWindow ?? usage.latest?.contextWindow;
  if (used === undefined || !Number.isSafeInteger(window) || !window || window <= 0) return undefined;
  return { used, window, fraction: Math.min(1, used / window) };
}

export const contextLabel = (c: ContextOccupancy) =>
  `Last request input: ${c.used.toLocaleString('en-US')} of ${c.window.toLocaleString('en-US')} recorded window tokens. ${Math.round(c.fraction * 100)}% ratio, derived from the harness's recorded values.`;
