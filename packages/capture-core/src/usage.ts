import type { UsagePayload } from '@drishya/contracts';

const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
export function usageTokens(value: unknown, keys: Record<string, keyof NonNullable<UsagePayload['tokens']>>): UsagePayload['tokens'] {
  if (!value || typeof value !== 'object') return undefined;
  const input = value as Record<string, unknown>;
  const tokens: NonNullable<UsagePayload['tokens']> = {};
  for (const [key, name] of Object.entries(keys)) if (count(input[key])) tokens[name] = input[key];
  return Object.keys(tokens).length ? tokens : undefined;
}

const usageWindow = (window: any) => window && typeof window.used_percent === 'number' && Number.isFinite(window.used_percent) && window.used_percent >= 0 &&
  count(window.window_minutes) && count(window.resets_at) ? { usedPercent: window.used_percent as number, windowMinutes: window.window_minutes as number, resetsAt: window.resets_at as number } : undefined;
/** An allowlist: account IDs, credits and unrecognized fields never leave the adapter. */
export function primaryUsageLimits(value: unknown): UsagePayload['limits'] {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, any>, primary = usageWindow(raw.primary);
  return primary && { ...primary, ...(typeof raw.plan_type === 'string' && raw.plan_type.length <= 80 ? { plan: raw.plan_type } : {}) };
}
/** USAGE-1: the second window Codex reports (its weekly limit) through the same allowlist; the plan stays on the primary. */
export function secondaryUsageLimits(value: unknown): UsagePayload['secondaryLimits'] {
  if (!value || typeof value !== 'object') return undefined;
  return usageWindow((value as Record<string, any>).secondary);
}
