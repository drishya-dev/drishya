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
  '.history-inner, .workspace-header, .workspace-bar, .workspace-leading, .workspace-secondary, .modern-native-composer, .history-transport, .catalog-toggle, .modern-replay-transport, .queued-input-receipts';
