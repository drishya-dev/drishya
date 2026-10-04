/** Height estimates are replaced by ResizeObserver measurements as passages enter view. */
export const ESTIMATED_PASSAGE_HEIGHT = 240;
export const PASSAGE_OVERSCAN = 900;

export interface PassageRun { start: number; end: number; before: number }
export interface PassageWindow { prefix: number[]; total: number; runs: PassageRun[] }

function passageAt(prefix: number[], position: number): number {
  let lo = 0;
  let hi = prefix.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (prefix[mid]! <= position) lo = mid;
    else hi = mid - 1;
  }
  return Math.min(lo, prefix.length - 2);
}

/** Return only viewport passages plus disjoint selected/focused/anchor passages. */
export function passageWindow(ids: string[], measured: ReadonlyMap<string, number>, top: number, viewportHeight: number, pinned: ReadonlySet<string>): PassageWindow {
  const prefix = new Array<number>(ids.length + 1);
  prefix[0] = 0;
  for (let i = 0; i < ids.length; i++) prefix[i + 1] = prefix[i]! + (measured.get(ids[i]!) ?? ESTIMATED_PASSAGE_HEIGHT);
  const total = prefix[ids.length]!;
  if (!ids.length) return { prefix, total, runs: [] };
  const first = passageAt(prefix, Math.max(0, top - PASSAGE_OVERSCAN));
  const last = passageAt(prefix, Math.min(total, top + viewportHeight + PASSAGE_OVERSCAN));
  const wanted = new Set<number>();
  for (let i = first; i <= last; i++) wanted.add(i);
  for (let i = 0; i < ids.length; i++) if (pinned.has(ids[i]!)) wanted.add(i);
  const indexes = [...wanted].sort((a, b) => a - b);
  const runs: PassageRun[] = [];
  for (const index of indexes) {
    const lastRun = runs.at(-1);
    if (lastRun?.end === index) lastRun.end++;
    else runs.push({ start: index, end: index + 1, before: prefix[index]! - (lastRun ? prefix[lastRun.end]! : 0) });
  }
  return { prefix, total, runs };
}
