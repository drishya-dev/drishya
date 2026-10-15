/** An inner reader owns the wheel only while it can actually consume that direction. */
export function consumesVerticalWheel(target: EventTarget | null, boundary: HTMLElement, delta: number) {
  for (let node = target instanceof Element ? target : null; node && node !== boundary; node = node.parentElement) {
    if (!(node instanceof HTMLElement) || !/auto|scroll/.test(getComputedStyle(node).overflowY)) continue;
    if (node.scrollHeight <= node.clientHeight + 1) continue;
    if (delta < 0 ? node.scrollTop > 0 : node.scrollTop + node.clientHeight < node.scrollHeight - 1) return true;
  }
  return false;
}
