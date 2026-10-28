import type { Operation } from '@drishya/contracts';

const object = (value: unknown): Record<string, unknown> | undefined => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const text = (value: unknown) => typeof value === 'string' ? value : undefined;
const tools = new Set(['navigate','computer','read_page','get_page_text','find','browser_batch','preview_start','resize_window','browser_navigate','browser_snapshot','browser_take_screenshot','browser_click','browser_type','browser_press_key','browser_evaluate','browser_tabs','browser_find']);

export function safeWebUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value)) return false;
  try { const url = new URL(value); return (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password; } catch { return false; }
}

/** Display only literal captured input fields. Never execute script input or infer a current page. */
export function browserStep(op: Operation) {
  const d = op.detail;
  if (d.kind !== 'mcp' || !/(?:browser|chrome|playwright)/i.test(d.server) || !tools.has(d.tool)) return;
  let value = d.input;
  if (typeof value === 'string' && value.length <= 131072) { try { value = JSON.parse(value); } catch { /* Incomplete or literal input stays in the raw reader. */ } }
  const input = object(value);
  const actions = Array.isArray(input?.actions) ? input.actions : undefined;
  const batch = actions?.slice(0, 12).map(item => { const entry = object(item), fields = object(entry?.input); return { name: text(entry?.name), action: text(fields?.action), url: text(fields?.url) }; });
  const action = text(input?.action) ?? d.tool.replace(/^browser_/, '').replace(/_/g, ' ');
  const query = text(input?.query) ?? text(input?.text);
  return { server: d.server, action, batch, batchCount: actions?.length, url: text(input?.url), query, tab: text(input?.tabId) ?? (typeof input?.tabId === 'number' ? String(input.tabId) : undefined), excerpt: d.resultPreview };
}

/** A passage already defines captured order and prose boundaries; do not group across it. */
export function groupBrowserSteps<T extends { id: string; matchesFilter?: boolean }>(items: readonly T[], ops: ReadonlyMap<string, Operation>): T[][] {
  const groups: T[][] = [];
  let previous: Operation | undefined;
  let previousMatches: boolean | undefined;
  for (const item of items) {
    const op = ops.get(item.id), step = op && browserStep(op), prior = previous && browserStep(previous);
    if (step && prior && op!.agentId === previous!.agentId && step.server === prior.server && item.matchesFilter === previousMatches) groups[groups.length - 1]!.push(item);
    else groups.push([item]);
    previous = op;
    previousMatches = item.matchesFilter;
  }
  return groups;
}
