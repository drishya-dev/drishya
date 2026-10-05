import type { Hunk } from '@drishya/contracts';

export interface ChangeLine { number?: number; text: string; kind: 'context' | 'removed' | 'added' }
export interface ChangeRow { before?: ChangeLine; after?: ChangeLine }

/** Patch-order alignment, not a reconstructed whole file. Paging counts original patch lines. */
export function splitDiffRows(hunks: Hunk[], skip = 0, count = 120): ChangeRow[] {
  const rows: ChangeRow[] = [];
  let index = 0;
  for (const hunk of hunks) {
    let old = hunk.oldStart;
    let next = hunk.newStart;
    let removed: ChangeLine[] = [];
    let added: ChangeLine[] = [];
    const flush = () => {
      for (let i = 0; i < Math.max(removed.length, added.length); i++) rows.push({ before: removed[i], after: added[i] });
      removed = []; added = [];
    };
    for (const line of hunk.lines) {
      const kind = line[0];
      const before = kind === '+' ? undefined : { number: hunk.oldStart ? old++ : undefined, text: line.slice(1), kind: kind === '-' ? 'removed' as const : 'context' as const };
      const after = kind === '-' ? undefined : { number: hunk.newStart ? next++ : undefined, text: line.slice(1), kind: kind === '+' ? 'added' as const : 'context' as const };
      const visible = index >= skip && index < skip + count;
      index++;
      if (!visible) continue;
      if (kind === ' ') { flush(); rows.push({ before, after }); }
      else if (kind === '-') { if (added.length) flush(); removed.push(before!); }
      else added.push(after!);
    }
    flush();
    if (index >= skip + count) break;
  }
  return rows;
}
