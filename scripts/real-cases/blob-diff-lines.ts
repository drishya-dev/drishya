import type { RealCase } from './types.ts';

// CONTENT-19: a diff line longer than the store's inline limit (16 KiB) is sealed into a blob reference. Every diff reader needs plain strings,
// so the projection must hand over the stored text (or an explicit marker), never the reference.
const LONG_LINE = 16 * 1024;

const longLines = (lines: unknown) => Array.isArray(lines) ? lines.filter((line) => typeof line === 'string' && line.length > LONG_LINE).length : 0;

export const blobDiffLines: RealCase = {
  name: 'blob-diff-lines',
  about: 'Edit diffs with a line past the 16 KiB inline limit (sealed blob lines); every projected hunk line must be a string',
  harnesses: ['claude-code', 'codex'],
  prefilter: { 'claude-code': 'structuredPatch', codex: 'apply_patch' },
  scan(row, harness) {
    if (harness === 'claude-code') {
      const patch = (row.toolUseResult as { structuredPatch?: unknown } | undefined)?.structuredPatch;
      if (!Array.isArray(patch)) return;
      const hits = patch.reduce((n: number, hunk: { lines?: unknown }) => n + longLines(hunk?.lines), 0);
      return hits ? { hits } : undefined;
    }
    const payload = row.payload as Record<string, unknown> | undefined;
    if (row.type !== 'response_item' || payload?.type !== 'custom_tool_call' || typeof payload.input !== 'string') return;
    if (!payload.input.includes('*** Begin Patch')) return;
    const hits = longLines(payload.input.split('\n').filter((line) => /^[+-]/.test(line)));
    return hits ? { hits } : undefined;
  },
  verify(projection, found) {
    let lines = 0, nonString = 0, incomplete = 0;
    for (const op of projection.operations) {
      if (op.detail.kind !== 'edit') continue;
      for (const hunk of op.detail.hunks) for (const line of hunk.lines as unknown[]) {
        lines++;
        if (typeof line !== 'string') nonString++;
        else if (line.endsWith('[Remaining captured text unavailable]') || line.endsWith('[Captured diff line unavailable]')) incomplete++;
      }
    }
    return [
      `${found.hits} journal diff lines past 16 KiB; ${lines} projected hunk lines, ${incomplete} marked incomplete`,
      nonString ? `FAIL ${nonString} projected hunk lines are not strings` : 'all projected hunk lines are strings',
    ];
  },
};
