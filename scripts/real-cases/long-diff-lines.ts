import type { RealCase } from './types.ts';

// UI-44: an Edit or Write whose code has a line longer than a card is wide. The card has to wrap that line inside itself, as a Read does,
// not run it out of the card behind a sideways scroll. The scan finds journals that contain such lines; the browser check is a screen.
const LONG = 110;

const longLines = (lines: unknown) => Array.isArray(lines) ? lines.filter((line) => typeof line === 'string' && line.length > LONG).length : 0;
const longText = (text: unknown) => typeof text === 'string' ? longLines(text.split('\n')) : 0;

export const longDiffLines: RealCase = {
  name: 'long-diff-lines',
  about: 'Edits and Writes with a code line over 110 characters (a wide diff card that must wrap its lines)',
  harnesses: ['claude-code', 'codex'],
  prefilter: { 'claude-code': '"file_path"', codex: 'apply_patch' },
  scan(row, harness) {
    if (harness === 'claude-code') {
      const content = (row.message as { content?: unknown } | undefined)?.content;
      if (row.type !== 'assistant' || !Array.isArray(content)) return;
      let hits = 0;
      for (const block of content as { type?: string; name?: string; input?: Record<string, unknown> }[]) {
        if (block?.type !== 'tool_use' || !block.input) continue;
        if (block.name === 'Write') hits += longText(block.input.content);
        else if (block.name === 'Edit') hits += longText(block.input.new_string);
      }
      return hits ? { hits } : undefined;
    }
    const payload = row.payload as Record<string, unknown> | undefined;
    if (row.type !== 'response_item' || payload?.type !== 'custom_tool_call' || typeof payload.input !== 'string') return;
    if (!payload.input.includes('*** Begin Patch')) return;
    const hits = longLines(payload.input.split('\n').filter((line) => /^[+-]/.test(line)).map((line) => line.slice(1)));
    return hits ? { hits } : undefined;
  },
  verify(projection, found) {
    let edits = 0, wide = 0, longest = 0;
    for (const op of projection.operations) {
      if (op.detail.kind !== 'edit') continue;
      const lines = op.detail.hunks.flatMap((hunk) => hunk.lines as string[]);
      const max = lines.reduce((m, line) => Math.max(m, line.length - 1), 0);
      if (max > LONG) wide++;
      longest = Math.max(longest, max);
      edits++;
    }
    return [`${found.hits} journal lines over ${LONG} characters; ${edits} projected edits, ${wide} with a line over ${LONG} (longest ${longest})`];
  },
};
