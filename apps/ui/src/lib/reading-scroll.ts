/** A result's own scroll is local reading, not navigation through the session. */
export function scrollsInsideMaterial(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  let node = target.closest<HTMLElement>('.command-request, .tool-input, .result-content, .query, .op-body, .op-expanded, .code, .output, .terminal-preview');
  while (node && !node.classList.contains('history')) {
    const style = getComputedStyle(node);
    if ((/auto|scroll/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1) || (/auto|scroll/.test(style.overflowX) && node.scrollWidth > node.clientWidth + 1)) return true;
    node = node.parentElement;
  }
  return false;
}
