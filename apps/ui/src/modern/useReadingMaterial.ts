import { flushSync } from 'react-dom';
import { useEffect, useRef, useState, type RefObject } from 'react';

/** The real card stays in its history slot: scrolling never pins a copy to the screen. */
export function useReadingMaterial(card: RefObject<HTMLButtonElement | null>) {
  const [reading, setReading] = useState(false);
  const open = useRef(() => {});
  useEffect(() => {
    const element = card.current;
    const slot = element?.parentElement;
    const stream = element?.closest<HTMLElement>('.fr-work-stream');
    if (!element || !slot || !stream) return;
    let expanded = false, returning = false;
    let dwell: ReturnType<typeof setTimeout> | undefined;
    let leave: ReturnType<typeof setTimeout> | undefined;
    let animation: Animation | undefined;
    let pointer: { x: number; y: number } | undefined;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const animateFrom = (from: DOMRect) => {
      const to = element.getBoundingClientRect();
      if (reduced.matches || element.closest('[data-modality=keyboard]')) return;
      animation = element.animate([
        { transform: `translate(${from.x - to.x}px,${from.y - to.y}px) scale(${from.width / to.width},${from.height / to.height})` },
        { transform: 'translate(0,0) scale(1,1)' },
      ], { duration: 300, easing: getComputedStyle(element).getPropertyValue('--fr-ease').trim() || 'ease-out' });
    };
    const restore = () => {
      returning = false;
      slot.style.height = '';
      slot.style.zIndex = '';
      element.removeAttribute('data-reading');
    };
    const close = (immediate = false) => {
      clearTimeout(dwell); clearTimeout(leave);
      if (!expanded && !returning) return;
      const from = element.getBoundingClientRect();
      animation?.cancel(); expanded = false; returning = true;
      flushSync(() => setReading(false));
      element.dataset.reading = 'returning';
      for (const name of ['width', 'height', 'left', 'top', 'position']) element.style.removeProperty(name);
      if (!immediate) animateFrom(from);
      const current = animation;
      if (!immediate && current?.playState === 'running') void current.finished.then(() => { if (!expanded && animation === current) restore(); }, () => {});
      else restore();
    };
    const contains = () => {
      if (!pointer) return false;
      const rect = element.getBoundingClientRect();
      return pointer.x >= rect.left && pointer.x <= rect.right && pointer.y >= rect.top && pointer.y <= rect.bottom;
    };
    const checkLeave = () => {
      clearTimeout(leave);
      if (expanded && !contains() && !getSelection()?.toString()) leave = setTimeout(() => { if (!contains()) close(); }, 160);
    };
    open.current = () => {
      clearTimeout(dwell); clearTimeout(leave);
      if (expanded || innerWidth < 820 || !matchMedia('(hover:hover) and (pointer:fine)').matches) return;
      dwell = setTimeout(() => {
        if (!element.matches(':hover') || getSelection()?.toString()) return;
        const from = element.getBoundingClientRect(), bounds = stream.getBoundingClientRect();
        const composer = document.querySelector('.md-app .fr-composer-wrap')?.getBoundingClientRect();
        const bottom = Math.min(bounds.bottom - 16, (composer?.top ?? bounds.bottom) - 16);
        const top = bounds.top + 12;
        if (bottom - top < 180) return;
        document.dispatchEvent(new CustomEvent('modern-reading-start', { detail: element }));
        animation?.cancel(); element.getAnimations().forEach(a => a.cancel());
        if (!returning) slot.style.height = `${slot.getBoundingClientRect().height}px`;
        expanded = true; returning = false;
        slot.style.zIndex = '6';
        element.dataset.reading = 'open';
        const origin = slot.getBoundingClientRect();
        const width = Math.min(Math.max(origin.width, 600), bounds.width - 40);
        const height = Math.min(Math.max(origin.height, 420), bottom - top);
        const left = Math.max(bounds.left + 20, Math.min(bounds.right - width - 20, origin.left - (width - origin.width) / 2));
        const y = Math.max(top, Math.min(bottom - height, origin.top));
        Object.assign(element.style, { position: 'absolute', width: `${width}px`, height: `${height}px`, left: `${left - origin.left}px`, top: `${y - origin.top}px` });
        animateFrom(from);
        setReading(true);
      }, 200);
    };
    const move = (event: PointerEvent) => { pointer = { x: event.clientX, y: event.clientY }; checkLeave(); };
    const other = (event: Event) => { if ((event as CustomEvent).detail !== element) close(); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape' || event.key === 'Tab') close(true); };
    const reset = () => close(true);
    document.addEventListener('pointermove', move);
    document.addEventListener('modern-reading-start', other);
    document.addEventListener('keydown', key);
    stream.addEventListener('scroll', checkLeave, { passive: true });
    window.addEventListener('resize', reset);
    window.addEventListener('blur', reset);
    reduced.addEventListener('change', reset);
    return () => {
      clearTimeout(dwell); clearTimeout(leave); animation?.cancel();
      document.removeEventListener('pointermove', move);
      document.removeEventListener('modern-reading-start', other);
      document.removeEventListener('keydown', key);
      stream.removeEventListener('scroll', checkLeave);
      window.removeEventListener('resize', reset); window.removeEventListener('blur', reset);
      reduced.removeEventListener('change', reset);
    };
  }, [card]);
  return { reading, onHeaderEnter: () => open.current() };
}
