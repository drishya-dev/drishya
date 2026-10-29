/**
 * A code-mode wrapper sometimes retains the plan only as literal source. Decode
 * one whole awaited call, never execute JavaScript or infer computed arguments.
 */
export function literalPlan(source: string): { text: string; status: string }[] | undefined {
  if (source.length > 2 * 1024 * 1024) return;
  const trimmed = source.trim().replace(/;$/, '').trimEnd();
  const prefix = /^(text\s*\(\s*)?await\s+tools\s*\.\s*update_plan\s*\(\s*/.exec(trimmed);
  if (!prefix) return;
  const suffix = prefix[1] ? /\)\s*\)\s*$/ : /\)\s*$/;
  const ending = suffix.exec(trimmed);
  if (!ending || ending.index < prefix[0].length) return;
  let value: unknown;
  try { value = JSON.parse(trimmed.slice(prefix[0].length, ending.index)); } catch { return; }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const request = value as Record<string, unknown>;
  if (Object.keys(request).some(key => !['plan', 'explanation'].includes(key)) ||
      request.explanation !== undefined && typeof request.explanation !== 'string' ||
      !Array.isArray(request.plan) || request.plan.length > 2000) return;
  const items: { text: string; status: string }[] = [];
  for (const row of request.plan) {
    if (!row || typeof row !== 'object' || Array.isArray(row) ||
        Object.keys(row).some(key => !['step', 'status'].includes(key)) ||
        typeof row.step !== 'string' || typeof row.status !== 'string') return;
    items.push({ text: row.step, status: row.status });
  }
  return items;
}
