import { diffTexts } from '../../../../packages/projection/src/patch.ts';

/** A local reading aid, never a captured patch or a claim about today's disk. */
export function compareDraft(base: string, text: string) {
  const withinLines = (value: string) => {
    let offset = -1;
    for (let n = 0; n < 5000; n++) {
      offset = value.indexOf('\n', offset + 1);
      if (offset < 0) return true;
    }
    return false;
  };
  if (!withinLines(base) || !withinLines(text)) return { kind: 'texts' as const };
  // Bound the LCS table to 4MiB. Unrelated/large files keep complete native text
  // readers instead of blocking the UI or pretending a truncated patch is whole.
  const hunks = diffTexts(base, text, 3, 1_000_000);
  if (!hunks) return { kind: 'texts' as const };
  let added = 0, removed = 0;
  for (const hunk of hunks) for (const line of hunk.lines) {
    if (line.startsWith('+')) added++;
    if (line.startsWith('-')) removed++;
  }
  return { kind: 'patch' as const, hunks, added, removed };
}
