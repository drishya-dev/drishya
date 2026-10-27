import type {Page} from '@playwright/test';
interface Box { visible:boolean; wideDiff:boolean; id: string; l: number; r: number; t: number; b: number }
interface Passage { cards: Box[]; gap: number; room: number }
interface Wire { key: string; pts: { x: number; y: number }[] }
interface Snapshot { passages: Passage[]; wires: Wire[] }

export const snapshot = (page: Page): Promise<Snapshot> => page.evaluate(() => {
  const viewport=document.querySelector('.history')!.getBoundingClientRect();
  const passages = [...document.querySelectorAll<HTMLElement>('.history .ops-row')].map(row => {
    const style = getComputedStyle(row); const box = row.getBoundingClientRect();
    return {
      gap: parseFloat(style.columnGap) || 0,
      room: box.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
      cards: [...row.querySelectorAll<HTMLElement>('.op[data-op-id]')].map(card => { const r = card.getBoundingClientRect(); return { visible:r.bottom>viewport.top&&r.top<viewport.bottom-20&&r.right>viewport.left&&r.left<viewport.right,wideDiff:card.matches('.op-edit.shape-wide'),id: card.dataset.opId!, l: r.left, r: r.right, t: r.top, b: r.bottom }; }),
    };
  });
  const wires = [...document.querySelectorAll<SVGPathElement>('[data-flow-link]')].map(path => ({
    key: path.dataset.flowLink!,
    pts: [...path.getAttribute('d')!.matchAll(/[ML] (\S+) (\S+)/g)].map(m => ({ x: +m[1]!, y: +m[2]! })),
  }));
  return { passages, wires };
});

export const rowsOf = (cards: Box[]) => {
  const rows: Box[][] = [];
  for (const card of cards) { const last = rows.at(-1); if (last && Math.abs(last[0]!.t - card.t) < 4) last.push(card); else rows.push([card]); }
  return rows;
};
const onEdge = (p: { x: number; y: number }, c: Box) => {
  const inX = p.x >= c.l - .5 && p.x <= c.r + .5, inY = p.y >= c.t - .5 && p.y <= c.b + .5;
  return (inY && (Math.abs(p.x - c.l) < .5 || Math.abs(p.x - c.r) < .5)) || (inX && (Math.abs(p.y - c.t) < .5 || Math.abs(p.y - c.b) < .5));
};
/** Wires are orthogonal, so a segment hits a card exactly when it passes through the card's inset interior. */
const crosses = (p: { x: number; y: number }, q: { x: number; y: number }, c: Box) =>
  p.y === q.y
    ? p.y > c.t + 1 && p.y < c.b - 1 && Math.max(p.x, q.x) > c.l + 1 && Math.min(p.x, q.x) < c.r - 1
    : p.x > c.l + 1 && p.x < c.r - 1 && Math.max(p.y, q.y) > c.t + 1 && Math.min(p.y, q.y) < c.b - 1;

/** Everything the READ-4 contract requires of one frame; an empty list means it holds. */
export function violations({ passages, wires }: Snapshot): string[] {
  const found: string[] = []; const all = passages.flatMap(p => p.cards);
  passages.forEach((passage, pi) => {
    const { cards, gap, room } = passage; const rows = rowsOf(cards);
    // Row order is unambiguous: reading order is row-major, so a card's successor is either to its right on the
    // same row or the leftmost card of the next row down.
    for (let i = 1; i < cards.length; i++) {
      const a = cards[i - 1]!, b = cards[i]!;
      const sameRow = Math.abs(a.t - b.t) < 4;
      if (sameRow ? b.l < a.r : b.t <= a.t) found.push(`passage ${pi}: ${b.id} is out of reading order after ${a.id}`);
    }
    for(const row of rows) for(const card of row) if(card.wideDiff&&card!==row[0]) found.push(`passage ${pi}: wide diff must start a row`);
    // Deterministic wrap: a row only starts when its first card could not have joined the row above.
    rows.forEach((row, ri) => {
      const above = rows[ri - 1]; if (!above) return;
      const used = above.reduce((n, c) => n + c.r - c.l, 0) + gap * (above.length - 1);
      const first = row[0]!;
      if (!first.wideDiff && used + gap + (first.r - first.l) <= room + .5) found.push(`passage ${pi}: ${first.id} wrapped although it fits row ${ri - 1}`);
    });
    // Wires: one per consecutive pair, edge to edge, never through a card.
    for (let i = 1; i < cards.length; i++) {
      const a = cards[i - 1]!, b = cards[i]!;
      if(!a.visible||!b.visible)continue;
      const wire = wires.find(w => w.key === `${a.id}/${b.id}`);
      if (!wire) { found.push(`passage ${pi}: no wire ${a.id} -> ${b.id}`); continue; }
      const start = wire.pts[0]!, end = wire.pts.at(-1)!;
      if (!onEdge(start, a)) found.push(`wire ${a.id} -> ${b.id} does not leave the previous card's edge`);
      if (!onEdge(end, b)) found.push(`wire ${a.id} -> ${b.id} does not enter the next card's edge`);
      if(a.b<b.t&&Math.abs(a.l-b.l)<4&&(Math.abs(start.y-a.b)>.5||Math.abs(end.y-b.t)>.5))found.push(`wire ${a.id} -> ${b.id}: stacked cards must join bottom to top`);
      if (Math.abs(a.t - b.t) < 4 && !(wire.pts.length === 4 && start.y === end.y && Math.abs(start.x - a.r) < .5 && Math.abs(end.x - b.l) < .5)) found.push(`wire ${a.id} -> ${b.id}: neighbours on one row must join right edge to left edge`);
    }
  });
  for (const wire of wires) for (let k = 1; k < wire.pts.length; k++) for (const card of all)
    if (crosses(wire.pts[k - 1]!, wire.pts[k]!, card)) found.push(`wire ${wire.key} crosses ${card.id}`);
  return found;
}

