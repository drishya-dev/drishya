import type { RealCase } from './types.ts';

// UI-42: a passage is the run of actions between two pieces of prose; its cards wrap left to right across History's width.
// A run of eight or more actions fills more than one row at any width, so it is the case where a wider column saves rows.
const LONG_RUN = 8;
let run = 0;

export const widePassages: RealCase = {
  name: 'wide-passages',
  about: `Passages of ${LONG_RUN}+ actions with no prose between them (rows of cards that wrap across History's width)`,
  harnesses: ['claude-code', 'codex'],
  prefilter: { 'claude-code': '"type":"assistant"', codex: '"type":"response_item"' },
  reset() { run = 0; },
  scan(row, harness) {
    let calls = 0, said = false;
    if (harness === 'claude-code') {
      const content = (row.message as { content?: unknown } | undefined)?.content;
      if (row.type !== 'assistant' || !Array.isArray(content)) return;
      for (const block of content as { type?: string; text?: string }[]) {
        if (block?.type === 'tool_use') calls++;
        else if (block?.type === 'text' && block.text?.trim()) said = true;
      }
    } else {
      const payload = row.payload as { type?: string; role?: string } | undefined;
      if (row.type !== 'response_item' || !payload) return;
      if (payload.type === 'function_call' || payload.type === 'custom_tool_call' || payload.type === 'web_search_call') calls++;
      else if (payload.type === 'message' && payload.role === 'assistant') said = true;
    }
    if (said) run = 0;
    const before = run;
    run += calls;
    return before < LONG_RUN && run >= LONG_RUN ? { hits: 1 } : undefined;
  },
  verify(projection, found) {
    const sizes = projection.passages.map((passage) => passage.operationIds.length);
    const long = sizes.filter((n) => n >= LONG_RUN).length;
    const line = `${found.hits} journal runs of ${LONG_RUN}+ actions; ${projection.passages.length} passages, ${long} with ${LONG_RUN}+ cards (largest ${Math.max(0, ...sizes)})`;
    return [long ? line : `FAIL ${line}`];
  },
};
