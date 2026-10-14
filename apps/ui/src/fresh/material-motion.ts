import { useLayoutEffect, useRef } from 'react';

/** One real material, one transform; absent/occluded origins do not get invented. */
export function useMaterialMotion(node: React.RefObject<HTMLButtonElement | null>, options: {
  arrival: boolean; path?: string; tool: string; revision: unknown;
}) {
  const previous = useRef<DOMRect | undefined>(undefined);
  const motion = useRef<Animation | undefined>(undefined);
  const arrived = useRef(false);
  useLayoutEffect(() => {
    const element = node.current;
    if (!element) return;
    const target = element.getBoundingClientRect();
    const last = previous.current;
    previous.current = target;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const keyboard = element.closest('.fresh-app')?.getAttribute('data-modality') === 'keyboard';
    const stage = element.closest('.fr-work-stream')?.getBoundingClientRect();
    if (reduced || keyboard || document.hidden || !stage || target.bottom <= stage.top || target.top >= stage.bottom) { motion.current?.cancel(); return; }
    let source: DOMRect | undefined;
    if (options.arrival && !arrived.current) {
      arrived.current = true;
      const candidates = [...document.querySelectorAll<HTMLElement>('[data-fr-path],[data-fr-tool]')];
      const anchor = candidates.find(candidate => options.path && candidate.dataset.frPath === options.path && visible(candidate))
        ?? candidates.find(candidate => candidate.dataset.frTool?.split('\n').includes(options.tool) && visible(candidate));
      source = anchor?.getBoundingClientRect();
    } else if (last && (Math.abs(last.width - target.width) > 1 || Math.abs(last.height - target.height) > 1)) source = new DOMRect(target.x, target.y, last.width, last.height);
    if (!source || !target.width || !target.height) return;
    motion.current?.cancel();
    // Cap scale so a tiny dock/file icon does not reduce actual source to an unreadable speck.
    const scaleX = Math.max(.92, Math.min(1.08, source.width / target.width));
    const scaleY = Math.max(.92, Math.min(1.08, source.height / target.height));
    element.style.transformOrigin = 'top left';
    const animation = element.animate([
      { transform: `translate(${source.x - target.x}px, ${source.y - target.y}px) scale(${scaleX}, ${scaleY})`, opacity: .5 },
      { transform: 'translate(0px, 0px) scale(1, 1)', opacity: 1 },
    ], { duration: 240, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
    motion.current = animation;
    return () => animation.cancel();
  }, [node, options.arrival, options.path, options.tool, options.revision]);
  useLayoutEffect(() => () => motion.current?.cancel(), []);
}

function visible(element: HTMLElement) {
  const bounds = element.getBoundingClientRect();
  if (bounds.width <= 0 || bounds.height <= 0 || bounds.bottom <= 0 || bounds.top >= innerHeight || bounds.right <= 0 || bounds.left >= innerWidth) return false;
  const hit = document.elementFromPoint(Math.min(innerWidth - 1, Math.max(0, bounds.x + bounds.width / 2)), Math.min(innerHeight - 1, Math.max(0, bounds.y + bounds.height / 2)));
  return !!hit && (element.contains(hit) || hit.contains(element));
}
