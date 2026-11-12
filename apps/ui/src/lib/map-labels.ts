// SHIP-8: label placement from real label boxes. Every label is DOM; this only decides which ones fit
// without touching each other. Pure: widths come from an injected measurer, never from the clock or the DOM.

export interface LabelCandidate {
  id: string;
  x: number;
  y: number;
  kind: 'group' | 'file';
  text: string;
  /** Files in a spatial group; its count shares the label's line. */
  count?: number;
  /** Explicit working-set labels (selected file and its imports): placed first and never dropped for room. */
  pinned?: boolean;
}
export interface LabelRect { left: number; top: number; right: number; bottom: number }
export interface PlacedLabel extends LabelCandidate { rect: LabelRect }

/** Box geometry mirrors the stylesheet: .map-group is one 18 px line, .map-file-label is a 25 px target. */
export const LABEL_BOX = {
  group: { height: 18, padX: 6, gap: 5, offsetX: 12 },
  file: { height: 25, padX: 12, gap: 0, offsetX: 8 },
  maxWidth: 190,
  offsetY: -9,
  /** Breathing room between two visible labels. */
  margin: 4,
};

export function labelRect(c: LabelCandidate, measure: (text: string) => number): LabelRect {
  const box = LABEL_BOX[c.kind];
  const text = measure(c.text);
  const width = Math.min(LABEL_BOX.maxWidth, box.padX + text + (c.kind === 'group' ? box.gap + measure(String(c.count ?? '')) : 0));
  const left = c.x + box.offsetX, top = c.y + LABEL_BOX.offsetY;
  return { left, top, right: left + width, bottom: top + box.height };
}

const overlaps = (a: LabelRect, b: LabelRect, margin: number) =>
  a.left < b.right + margin && b.left < a.right + margin && a.top < b.bottom + margin && b.top < a.bottom + margin;

/**
 * Greedy by priority (caller order, pinned first): a label is shown only when its whole box is inside the map,
 * clear of map controls and clear of every label already shown. Nothing visible ever overlaps.
 */
export function placeLabels(candidates: readonly LabelCandidate[], map: { width: number; height: number }, obstacles: readonly LabelRect[], measure: (text: string) => number, limit: number): PlacedLabel[] {
  const placed: PlacedLabel[] = [];
  const ordered = [...candidates.filter(c => c.pinned), ...candidates.filter(c => !c.pinned)];
  for (const c of ordered) {
    const rect = labelRect(c, measure);
    const top = c.pinned ? 6 : 70 - 9;
    if (rect.left < 6 || rect.top < top || rect.right > map.width - 6 || rect.bottom > (c.pinned ? map.height - 6 : map.height - 50 + 9)) continue;
    if (obstacles.some(o => overlaps(rect, o, 0))) continue;
    if (placed.some(p => overlaps(rect, p.rect, LABEL_BOX.margin))) continue;
    placed.push({ ...c, rect });
    if (!c.pinned && placed.length >= limit) break;
  }
  return placed;
}
