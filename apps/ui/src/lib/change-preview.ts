import type { Hunk } from '@drishya/contracts';

/** UI focus only: preserve patch coordinates and bytes while skipping initial unchanged context. */
export function firstChangeOffset(hunks: Hunk[], context = 3): number {
  let offset = 0;
  for (const hunk of hunks) {
    const changed = hunk.lines.findIndex(line => line.startsWith('+') || line.startsWith('-'));
    if (changed >= 0) return Math.max(0, offset + changed - context);
    offset += hunk.lines.length;
  }
  return 0;
}
