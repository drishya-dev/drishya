import type { Operation } from '@drishya/contracts';
import { toolOutputText } from './tool-output.ts';

const object = (value: unknown): Record<string, unknown> | undefined => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const text = (value: unknown) => typeof value === 'string' ? value : undefined;
const tools = new Set(['navigate','computer','read_page','get_page_text','find','browser_batch','preview_start','resize_window','browser_navigate','browser_snapshot','browser_take_screenshot','browser_click','browser_type','browser_press_key','browser_evaluate','browser_tabs','browser_find']);

export function safeWebUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value)) return false;
  try { const url = new URL(value); return (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password; } catch { return false; }
}

/** Extract a safe leading URL metadata line reported in returned page text when the input omitted `url`. */
function resultPageUrl(tool: string, excerpt: string | undefined): string | undefined {
  if (!excerpt) return;
  const decoded = toolOutputText(excerpt).text;
  const lines = decoded.split(/\r?\n/);
  let checked = 0;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line === '---' || /^Tab Context:/i.test(line)) break;
    const header = /^(?:[-*]\s*)?(?:Page\s+)?URL\s*:\s*(https?:\/\/\S+)/i.exec(line);
    if (header) {
      const candidate = header[1]!.replace(/[>,;]+$/, '');
      if (safeWebUrl(candidate)) return candidate;
    }
    if (tool === 'get_page_text' && /^(https?:\/\/\S+)$/i.test(line)) {
      const candidate = line.replace(/[>,;]+$/, '');
      if (safeWebUrl(candidate)) return candidate;
    }
    checked++;
    if (checked >= 10) break;
  }
  return;
}

/** Display only literal captured input fields (and leading returned page URL metadata when absent). Never execute script input or infer a current page. */
export function browserStep(op: Operation) {
  const d = op.detail;
  // Claude Code's own `computer` tool is recorded as an ordinary tool; it reads like the browser's (SCREEN-1).
  if (d.kind !== 'mcp' && d.kind !== 'other') return;
  if (d.kind === 'mcp' ? !/(?:browser|chrome|playwright)/i.test(d.server) || !tools.has(d.tool) : op.tool !== 'computer' && op.tool !== 'webview_browser') return;
  const server = d.kind === 'mcp' ? d.server : op.tool, tool = d.kind === 'mcp' ? d.tool : op.tool;
  const nativeBrowser = d.kind === 'other' && op.tool === 'webview_browser';
  let value = d.input;
  if (typeof value === 'string' && value.length <= 131072) { try { value = JSON.parse(value); } catch { /* Incomplete or literal input stays in the raw reader. */ } }
  const input = object(value);
  const actions = Array.isArray(input?.actions) ? input.actions : undefined;
  const batch = actions?.slice(0, 12).map(item => { const entry = object(item), fields = object(entry?.input); return { name: text(entry?.name), action: text(fields?.action), url: text(fields?.url) }; });
  const action = nativeBrowser ? typeof input?.script === 'string' ? 'Run browser script' : 'Browser action' : text(input?.action) ?? tool.replace(/^browser_/, '').replace(/_/g, ' ');
  const query = text(input?.query) ?? text(input?.text);
  // A script can touch several pages. Do not infer the active page or actions from its code.
  const urls = nativeBrowser && Array.isArray(input?.urls) ? input.urls : undefined;
  const inputUrl = nativeBrowser ? urls?.length === 1 ? text(urls[0]) : undefined : text(input?.url);
  const fallbackUrl = inputUrl ? undefined : resultPageUrl(tool, d.resultPreview);
  return { server, action, batch, batchCount: actions?.length, url: inputUrl ?? fallbackUrl, urlFromResult: !inputUrl && !!fallbackUrl, query, tab: text(input?.tabId) ?? (typeof input?.tabId === 'number' ? String(input.tabId) : undefined), excerpt: d.resultPreview };
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
