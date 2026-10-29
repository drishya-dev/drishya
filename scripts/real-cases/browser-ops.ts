import type { RealCase } from './types.ts';

// CONTENT-2: browser tool calls and web fetch/search.
export const browserOps: RealCase = {
  name: 'browser-ops',
  about: 'Claude Code browser MCP, WebFetch and WebSearch tool calls',
  harnesses: ['claude-code'],
  prefilter: '"tool_use"',
  scan(row) {
    const content = (row.message as { content?: unknown } | undefined)?.content;
    if (!Array.isArray(content)) return;
    const hits = content.filter((b) => b?.type === 'tool_use' && (/browser|chrome|playwright|puppeteer/i.test(String(b.name)) || /^(WebFetch|WebSearch)$/.test(String(b.name)))).length;
    return hits ? { hits } : undefined;
  },
  verify(p, found) {
    const ops = p.operations.filter((op) => op.detail.kind === 'mcp' || op.detail.kind === 'web').length;
    return [`${found.hits} browser or web tool calls in the journal; ${ops} mcp/web operations in the projection (the History strips are checked by tests/browser/browser-evidence.spec.ts)`];
  },
};
