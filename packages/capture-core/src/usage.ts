import type { UsagePayload } from '@drishya/contracts';

const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
export function usageTokens(value: unknown, keys: Record<string, keyof NonNullable<UsagePayload['tokens']>>): UsagePayload['tokens'] {
  if (!value || typeof value !== 'object') return undefined;
  const input = value as Record<string, unknown>;
  const tokens: NonNullable<UsagePayload['tokens']> = {};
  for (const [key, name] of Object.entries(keys)) if (count(input[key])) tokens[name] = input[key];
  return Object.keys(tokens).length ? tokens : undefined;
}

/** An allowlist: account IDs, credits, secondary windows and unrecognized fields never leave the adapter. */
export function primaryUsageLimits(value: unknown): UsagePayload['limits'] {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, any>, primary = raw.primary;
  if (!primary || typeof primary.used_percent !== 'number' || !Number.isFinite(primary.used_percent) || primary.used_percent < 0 ||
      !count(primary.window_minutes) || !count(primary.resets_at)) return undefined;
  return { usedPercent: primary.used_percent, windowMinutes: primary.window_minutes, resetsAt: primary.resets_at,
    ...(typeof raw.plan_type === 'string' && raw.plan_type.length <= 80 ? { plan: raw.plan_type } : {}) };
}
