import type { RealCase } from './types.ts';

const complete = (text: unknown) => typeof text === 'string' && text.length <= 262144 && /^\s*[[{]/.test(text) && (() => { try { JSON.parse(text); return true; } catch { return false; } })();

// CONTENT-10: a tool result that is one complete JSON value reads in place. The screen is checked by tests/browser/inline-json-reading.spec.ts.
export const completeJson: RealCase = {
  name: 'complete-json',
  about: 'tool results that are one complete JSON value (Claude tool_result, Codex function output)',
  harnesses: ['claude-code', 'codex'],
  prefilter: { 'claude-code': '"tool_result"', codex: '_output' },
  scan(row, harness) {
    if (harness === 'claude-code') {
      const content = (row.message as { content?: unknown } | undefined)?.content;
      if (!Array.isArray(content)) return;
      const text = (b: { content?: unknown }) => typeof b.content === 'string' ? b.content : Array.isArray(b.content) ? b.content.map((x: { text?: string }) => x?.text ?? '').join('') : '';
      const hits = content.filter((b) => b?.type === 'tool_result' && complete(text(b))).length;
      return hits ? { hits } : undefined;
    }
    const payload = row.payload as { type?: string; output?: unknown } | undefined;
    if (payload?.type !== 'function_call_output' && payload?.type !== 'custom_tool_call_output') return;
    let text = payload.output;
    try { const inner = JSON.parse(String(text)) as { output?: unknown }; if (typeof inner?.output === 'string') text = inner.output; } catch { /* plain text output */ }
    return complete(text) ? { hits: 1 } : undefined;
  },
  verify(p, found) {
    const previews = p.operations.filter((op) => { const d = op.detail as { resultPreview?: string; outputPreview?: string }; return complete(d.resultPreview ?? d.outputPreview); });
    return [`${found.hits} complete-JSON results in the journal; ${previews.length} operations whose stored preview is still complete JSON (previews are bounded, so fewer is normal)`];
  },
};
