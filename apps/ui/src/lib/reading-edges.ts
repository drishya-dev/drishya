const BOTTOM_CONTROL_SELECTOR = [
  '.catalog-toggle',
  '.history-transport > .btn',
  '.history-transport .workspace-follow',
  '.history-transport .follow-pill',
  '.follow-pill',
  '.modern-native-composer',
  '.modern-native-composer > .native-turn-details',
  '.modern-native-composer > .queued-input-receipts',
  '.modern-native-composer > .send-confirmation',
  '.queued-input-receipts',
  '.modern-replay-transport',
  '.prompt-composer:not(.modern-native-composer)',
].join(',');

export const READING_EDGE_FADE = 28;
const EDGE_BUFFER = 6;

export type ReadingEdges = {
  /** Opaque clearance in px from the top of `.viewer` covering overlapping fixed controls. */
  top: number;
  /** Opaque clearance in px from the bottom of `.viewer` covering overlapping fixed controls. */
  bottom: number;
};

function isVisibleControl(el: HTMLElement): boolean {
  const style = getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
  return el.getClientRects().length > 0;
}

/** Measures the top and bottom fixed-chrome extents over History so reading edges veil only what controls actually cover. */
export function measureReadingEdges(viewer: HTMLElement): ReadingEdges {
  const viewerRect = viewer.getBoundingClientRect();
  if (viewerRect.width <= 0 || viewerRect.height <= 0) return { top: 0, bottom: 0 };
  const column = viewer.querySelector<HTMLElement>('.history-inner') ?? viewer.querySelector<HTMLElement>('.history');
  const colRect = column?.getBoundingClientRect() ?? viewerRect;
  const overlapsColumn = (rect: DOMRect) => rect.width > 0 && rect.height > 0 && rect.right > colRect.left + 1 && rect.left < colRect.right - 1;

  let maxTopBottom = viewerRect.top;
  const headerControls = viewer.querySelectorAll<HTMLElement>('.modern-session-header :is(.modern-identity, .studio-session, .studio-actions, .session-connection), .workspace-header:not(:has(.modern-session-header)) > *');
  for (const control of headerControls) {
    if (!isVisibleControl(control)) continue;
    const rect = control.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    if (rect.top <= viewerRect.top + viewerRect.height * 0.45) maxTopBottom = Math.max(maxTopBottom, rect.bottom);
  }

  for (const control of viewer.querySelectorAll<HTMLElement>('.workspace-leading, .workspace-secondary, .modern-review-control > .git-open')) {
    if (!isVisibleControl(control)) continue;
    const rect = control.getBoundingClientRect();
    if (!overlapsColumn(rect)) continue;
    if (rect.top <= viewerRect.top + viewerRect.height * 0.45) maxTopBottom = Math.max(maxTopBottom, rect.bottom);
  }

  let minBottomTop = viewerRect.bottom;
  for (const control of viewer.querySelectorAll<HTMLElement>(BOTTOM_CONTROL_SELECTOR)) {
    if (!isVisibleControl(control)) continue;
    const rect = control.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    if (rect.bottom >= viewerRect.top + viewerRect.height * 0.45 && rect.top >= viewerRect.top + viewerRect.height * 0.3) {
      minBottomTop = Math.min(minBottomTop, rect.top);
    }
  }

  const top = maxTopBottom > viewerRect.top ? Math.min(Math.round(viewerRect.height * 0.48), Math.ceil(maxTopBottom - viewerRect.top + EDGE_BUFFER)) : 0;
  const bottom = minBottomTop < viewerRect.bottom ? Math.min(Math.round(viewerRect.height * 0.48), Math.ceil(viewerRect.bottom - minBottomTop + EDGE_BUFFER)) : 0;
  return { top, bottom };
}

export const READING_EDGE_OBSERVED_SELECTORS =
  '.history-inner, .workspace-header, .workspace-bar, .workspace-leading, .workspace-secondary, .modern-native-composer, .history-transport, .catalog-toggle, .modern-replay-transport, .queued-input-receipts, .folder-explorer, .modern-toolbox, .complete-prompt-rail, .history-prompt-marks, .history';

/** The reading column's equal side gap (Yash, 13 Nov: "same equal padding from both ends on both toggle and untoggle states"). */
export const READING_SIDE_GAP = 24;

/** The file reader (peek) is a portal on the document, not inside `.viewer`; it is the one panel that docks over History's side. */
export const FILE_READER_SELECTOR = '.file-peek-reader[open]';

/**
 * Margins that place History's reading column between the persistent side chrome with the same gap on both sides:
 * from the Files panel's right edge (or, when Files is minimised, its Files/Repository chips) to the Toolbox's left
 * edge (or the prompt rail). The column keeps its own padding and spans the whole space at every width (UI-42, Yash,
 * 13 Nov): rows of cards gain from width, so the 1280 px cap is lifted wherever this placement holds, while prose keeps
 * its 75ch measure on the column's left edge (reading-type.css). The header islands and the composer only sit at the
 * top and bottom and carry their own surfaces, so they do not bound it. Measured, not assumed, so it holds at every
 * browser zoom.
 *
 * UI-45 (Yash, 13 Nov: "some glitch here after zooming out and the file explorer where some box gets cutoff"): the
 * file reader opens over the Toolbox and `.history` itself shrinks to end before it (use-file-peek-layout.ts), so the
 * reader is chrome on the side it sits, and a margin never pushes the column past the edge `.history` already pulled
 * in for it. Without that the Toolbox behind the reader set a margin of several hundred pixels the wrong way and the
 * column's last card and the prompt ran under the reader.
 */
export function measureReadingSides(viewer: HTMLElement): { left: number; right: number } | undefined {
  const history = viewer.querySelector<HTMLElement>('.history'), column = viewer.querySelector<HTMLElement>('.history-inner');
  if (!history || !column) return;
  const rects = (selector: string, root: ParentNode = viewer) => [...root.querySelectorAll<HTMLElement>(selector)].filter(isVisibleControl).map(el => el.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0);
  const leftChrome = rects('.workspace-leading > *, .folder-explorer');
  const rightChrome = rects('.modern-toolbox, .complete-prompt-rail, .history-prompt-marks');
  const readers = rects(FILE_READER_SELECTOR, document);
  // The same rule as use-file-peek-layout.ts: the reader is on the side with more room behind it.
  const readerLeft = readers.filter(r => r.left < innerWidth - r.right), readerRight = readers.filter(r => !(r.left < innerWidth - r.right));
  if (!leftChrome.length || !rightChrome.length) return;
  const h = history.getBoundingClientRect(), hs = getComputedStyle(history), cs = getComputedStyle(column);
  const containerLeft = h.left + parseFloat(hs.borderLeftWidth) + parseFloat(hs.paddingLeft);
  const containerRight = h.left + parseFloat(hs.borderLeftWidth) + history.clientWidth - parseFloat(hs.paddingRight);
  const padLeft = parseFloat(cs.paddingLeft), padRight = parseFloat(cs.paddingRight);
  // The column's text starts one gap after the left chrome and ends one gap before the right chrome.
  const start = Math.max(...leftChrome.map(r => r.right), ...readerLeft.map(r => r.right)) + READING_SIDE_GAP - padLeft;
  const end = Math.min(...rightChrome.map(r => r.left), ...readerRight.map(r => r.left)) - READING_SIDE_GAP + padRight;
  // The stylesheet lifts its cap once these margins are set, so the column is not read for a maximum here: the
  // placement must not depend on the cap it removes.
  if (end - start < 320 + padLeft + padRight) return; // too tight to place by the chrome: keep the stylesheet's own placement
  // Where a reader docks, `.history` already ends (or starts) beside it: the margin may only pull the column in from there.
  const left = Math.round(start - containerLeft), right = Math.round(containerRight - end);
  return { left: readerLeft.length ? Math.max(0, left) : left, right: readerRight.length ? Math.max(0, right) : right };
}
