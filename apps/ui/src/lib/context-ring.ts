import type { ContextReading, Projection } from '@drishya/contracts';
import type { ContextReport } from './context-report.ts';

export interface ContextOccupancy { used: number; window: number; fraction: number; /** Set when the window comes from a /context report instead of the journal. */ reportTime?: string }

/** With sub-agents, the context that matters is the main agent's latest reading, never a sub-agent's or a blend. */
export function mainContextReading(projection: Pick<Projection, 'agents' | 'context'>, readings = projection.context?.readings): ContextReading | undefined {
  if (!readings?.length) return undefined;
  if (new Set(readings.map(r => r.agentId)).size === 1) return readings.at(-1);
  const main = projection.agents.find(agent => !agent.parentId)?.id;
  return readings.filter(r => r.agentId === main).at(-1);
}

/**
 * The last recorded request input relative to the recorded context window, from that request's
 * input tokens and the context window. Cumulative session tokens are usage, not occupied context, so they are never used.
 * Nothing is estimated: a harness that records no window (Claude Code) gets no ring from this.
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

/**
 * What the session line shows while watching: the harness's own window when it records one; otherwise, for Claude Code, the
 * window its latest /context report printed, against the last request's input (both recorded, the ratio computed and labelled so).
 */
export function liveContextOccupancy(projection: Pick<Projection, 'usage' | 'agents' | 'context'>, newest?: { report: ContextReport; time?: string }): ContextOccupancy | undefined {
  const recorded = contextOccupancy(projection.usage);
  if (recorded) return recorded;
  const reading = mainContextReading(projection), printed = newest?.report.total?.window;
  if (!reading || !newest || !printed) return undefined;
  return { used: reading.input.tokens, window: printed, fraction: Math.min(1, reading.input.tokens / printed), reportTime: newest.time ?? 'unknown time' };
}

export const contextLabel = (c: ContextOccupancy) => c.reportTime
  ? `Last request input: ${c.used.toLocaleString('en-US')} tokens (Claude message.usage input + cache read + cache write) of a ${c.window.toLocaleString('en-US')} token window as printed by your latest /context report. ${Math.round(c.fraction * 100)}% ratio, computed.`
  : `Last request input: ${c.used.toLocaleString('en-US')} of ${c.window.toLocaleString('en-US')} context window tokens. ${Math.round(c.fraction * 100)}% ratio, computed from the harness’s values.`;
