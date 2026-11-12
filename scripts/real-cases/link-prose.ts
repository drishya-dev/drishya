import { commitCandidate, githubTarget, splitUrls } from '../../apps/ui/src/lib/link-kinds.ts';
import type { RealCase } from './types.ts';

// LINK-1: agent prose that names web addresses, GitHub pull requests or issues, and commit ids. Counts only; nothing is printed.
const facts = (text: string) => {
  const urls = splitUrls(text).filter((part): part is { url: string } => 'url' in part).map((part) => part.url);
  const commits = [...text.matchAll(/[0-9a-f]{7,40}/gi)].filter((match) => !/[0-9a-f]/i.test(text[match.index! - 1] ?? ' ') && !/[0-9a-f]/i.test(text[match.index! + match[0].length] ?? ' ') && commitCandidate(match[0])).length;
  return { urls: urls.length, github: urls.filter((url) => githubTarget(url)).length, commits };
};

export const linkProse: RealCase = {
  name: 'link-prose',
  about: 'Agent prose with web addresses, GitHub PR/issue links and commit ids (LINK-1 hover cards)',
  harnesses: ['claude-code', 'codex'],
  prefilter: { 'claude-code': '"type":"text"', codex: 'output_text' },
  scan(row, harness) {
    let text = '';
    if (harness === 'claude-code') {
      const content = (row.message as { role?: string; content?: unknown } | undefined)?.content;
      if (row.type !== 'assistant' || !Array.isArray(content)) return;
      text = content.map((block) => block?.type === 'text' && typeof block.text === 'string' ? block.text : '').join('\n');
    } else {
      const payload = row.payload as { type?: string; role?: string; content?: { text?: string }[] } | undefined;
      if (row.type !== 'response_item' || payload?.type !== 'message' || payload.role !== 'assistant' || !Array.isArray(payload.content)) return;
      text = payload.content.map((block) => typeof block?.text === 'string' ? block.text : '').join('\n');
    }
    const f = facts(text);
    const hits = f.urls + f.commits;
    // `only` ranks sessions that hold a GitHub item and a commit as well as plain addresses.
    return hits ? { hits, only: (f.github ? 1 : 0) + (f.commits ? 1 : 0) + (f.urls > f.github ? 1 : 0) } : undefined;
  },
  verify(projection, found) {
    const prose = projection.prose.filter((p) => p.role === 'assistant');
    let urls = 0, github = 0, commits = 0;
    for (const p of prose) { const f = facts(p.text); urls += f.urls; github += f.github; commits += f.commits; }
    return [
      `${found.hits} address/commit mentions in the journal; ${prose.length} projected agent prose blocks hold ${urls} addresses (${github} GitHub items) and ${commits} commit-like ids`,
      urls + commits ? 'prose carries linkable material' : 'FAIL no linkable material reached the projected prose',
    ];
  },
};
