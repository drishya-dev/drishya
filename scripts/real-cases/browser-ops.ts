import type { RealCase } from './types.ts';

// CONTENT-2: browser tool calls and web fetch/search.
export const browserOps: RealCase = {
  name: 'browser-ops',
  about: 'Claude Code browser MCP/fetch/search and native Codex web/browser records',
  harnesses: ['claude-code', 'codex'],
  prefilter: { 'claude-code': '"tool_use"', codex: '"payload"' },
  scan(row, harness) {
    if (harness === 'codex') {
      const p = row.payload as { type?: string; name?: string; item?: { type?: string; kind?: string; server?: string } } | undefined;
      const web = row.type === 'response_item' && (p?.type === 'web_search_call' || p?.type === 'function_call' && p.name === 'web_search');
      const item = row.type === 'event_msg' && p?.type === 'item_completed' ? p.item : undefined;
      const typedWeb = item?.type === 'Extension' && item.kind === 'web.search';
      const browser = item?.type === 'McpToolCall' && /browser|chrome|playwright/i.test(item.server ?? '');
      return web || typedWeb || browser ? { hits: 1 } : undefined;
    }
    const content = (row.message as { content?: unknown } | undefined)?.content;
    if (!Array.isArray(content)) return;
    const hits = content.filter((b) => b?.type === 'tool_use' && (/browser|chrome|playwright|puppeteer/i.test(String(b.name)) || /^(WebFetch|WebSearch)$/.test(String(b.name)))).length;
    return hits ? { hits } : undefined;
  },
  verify(p, found) {
    const ops = p.operations.filter((op) => op.detail.kind === 'mcp' || op.detail.kind === 'web').length;
    const web = p.operations.filter(op => op.detail.kind === 'web').length;
    return [`${found.hits} native browser/web records; ${web} web operations; ${ops} total mcp/web operations (typed completions may enrich an existing call)`, ...(ops ? ['PASS browser/web evidence survives projection; real screen checks are recorded in the CONTENT-2 report'] : ['FAIL no browser/web operations survived projection'])];
  },
};
