import type { Hunk, Operation } from '@drishya/contracts';

const added = (hunks: Hunk[]) => hunks.flatMap(h => h.lines.filter(line => line.startsWith('+')).map(line => line.slice(1)));

/** One or two stray braces would match half the session; require some substance before claiming a source. */
const distinctive = (lines: string[]) => lines.join('').replace(/\s/g, '').length >= 12;

/**
 * GIT-4: the captured edits whose added lines contain this Git hunk's added lines exactly, as one contiguous run in
 * order. Same file, edits that did not fail or get declined. It is evidence of where the text was written, not proof it
 * is still what the file holds; a hunk with nothing distinctive to compare, or with no match, is unattributed.
 */
export function recordedEditsForHunk(hunk: Hunk, path: string, operations: Operation[]): Operation[] {
  const wanted = added([hunk]);
  if (!distinctive(wanted)) return [];
  return operations.filter(op => {
    if (op.detail.kind !== 'edit' || op.detail.path !== path || op.status === 'error') return false;
    const written = added(op.detail.hunks);
    for (let at = 0; at + wanted.length <= written.length; at++) if (wanted.every((line, n) => written[at + n] === line)) return true;
    return false;
  });
}

/** The file panel selects an edit's captured patch by this key. */
export const patchEvidenceKey = (op: Operation) => `${op.id}/patch`;
