import { useEffect, type RefObject } from 'react';
import { useApp } from '../state.ts';
import { materialIsMoving, moveMaterial } from './material-motion.ts';

/** Enlarge one real DOM preview. Its resting slot stays in history; no evidence is copied. */
export function useHoverReading(history: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const root = history.current;
    if (!root) return;
    type Focus = { card: HTMLElement; slot: HTMLElement; animation?: Animation; returning: boolean };
    let active: Focus | undefined;
    let candidate: HTMLElement | undefined;
    let dwell: ReturnType<typeof setTimeout> | undefined;
    let leave: ReturnType<typeof setTimeout> | undefined;
    const focuses = new Set<Focus>();
    const clearTimers = () => { clearTimeout(dwell); clearTimeout(leave); dwell = leave = undefined; candidate = undefined; };
    const restore = (focus: Focus) => {
      focus.animation?.cancel();
      if (focus.card.matches(':popover-open')) focus.card.hidePopover();
      focus.card.removeAttribute('popover'); focus.card.removeAttribute('data-hover-reading');
      for (const name of ['--hover-left', '--hover-top', '--hover-width', '--hover-height']) focus.card.style.removeProperty(name);
      focus.slot.remove(); focuses.delete(focus);
      if (useApp.getState().hoveredOp === focus.card.dataset.opId && !focus.card.matches(':hover')) useApp.setState({ hoveredOp: undefined, hoveredPath: undefined });
      window.dispatchEvent(new Event('drishya-material-layout'));
    };
    const close = (focus: Focus, immediate = false) => {
      if (focus.returning) { if (immediate) restore(focus); return; }
      focus.returning = true;
      if (active === focus) active = undefined;
      if (immediate || !focus.card.isConnected || !focus.slot.isConnected || !useApp.getState().motion || matchMedia('(prefers-reduced-motion: reduce)').matches) { restore(focus); return; }
      const from = focus.card.getBoundingClientRect(), to = focus.slot.getBoundingClientRect();
      focus.animation?.cancel();
      focus.card.dataset.hoverReading = 'returning';
      focus.card.style.setProperty('--hover-left', `${to.left}px`); focus.card.style.setProperty('--hover-top', `${to.top}px`);
      focus.card.style.setProperty('--hover-width', `${to.width}px`); focus.card.style.setProperty('--hover-height', `${to.height}px`);
      focus.animation = moveMaterial(focus.card, from, 320, 'reading-focus-return');
      const animation = focus.animation;
      const finish = () => { if (focus.returning && focus.animation === animation) restore(focus); };
      void animation.finished.then(finish, finish);
    };
    const reset = () => { clearTimers(); for (const focus of [...focuses]) close(focus, true); };
    const permitted = () => {
      const state = useApp.getState();
      return state.hoverReading && !state.lowResource && !state.explore && !state.selectedOp && !state.expandedOp && !state.settingsOpen && !state.searchOpen && !state.currentFile && !state.filePanel && innerWidth > 820 && matchMedia('(hover: hover)').matches && typeof HTMLElement.prototype.showPopover === 'function';
    };
    const open = (card: HTMLElement) => {
      const previous = [...focuses].find(focus => focus.card === card);
      if (!permitted() || !card.isConnected || card === active?.card || (!previous?.returning && (materialIsMoving(card) || card.dataset.materialSettling === 'true'))) return;
      const from = card.getBoundingClientRect();
      const viewport = root.getBoundingClientRect();
      if (from.bottom < viewport.top + 80 || from.top > viewport.bottom - 80) return;
      const crown = document.querySelector('.workspace-header')?.getBoundingClientRect();
      const composer = document.querySelector('.prompt-composer.open')?.getBoundingClientRect();
      const top = Math.max(viewport.top + 16, (crown?.bottom ?? 0) + 16);
      const bottom = Math.min(viewport.bottom - 24, (composer?.top ?? innerHeight) - 16);
      if (bottom - top < 120 || viewport.width < 240) return;
      if (active) close(active);
      previous?.animation?.cancel();
      const slot = previous?.slot ?? document.createElement('div'); slot.className = 'hover-reading-slot'; slot.setAttribute('aria-hidden', 'true');
      if (!previous) { slot.style.width = `${from.width}px`; slot.style.height = `${from.height}px`; slot.style.flex = `0 0 ${from.width}px`; card.before(slot); }
      card.setAttribute('popover', 'manual'); card.dataset.hoverReading = 'focused';
      const width = Math.min(Math.max(from.width, 520), viewport.width - 32);
      const left = Math.max(viewport.left + 16, Math.min(viewport.right - width - 16, from.left + (from.width - width) / 2));
      card.style.setProperty('--hover-width', `${width}px`); card.style.setProperty('--hover-height', 'auto');
      card.style.setProperty('--hover-left', `${left}px`); card.style.setProperty('--hover-top', `${top}px`);
      if (!card.matches(':popover-open')) card.showPopover();
      // Keep the reading space near its source and clamp to real available bounds.
      const style = getComputedStyle(card);
      // scrollHeight omits the border: allocating it verbatim leaves a tiny
      // overflow and an unnecessary scrollbar even when all content fits.
      const needed = Math.ceil(card.scrollHeight + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth) + 2);
      const height = Math.min(bottom - top, innerHeight * .72, Math.max(from.height, needed));
      card.style.setProperty('--hover-height', `${height}px`);
      card.style.setProperty('--hover-top', `${Math.max(top, Math.min(bottom - height, from.top + (from.height - height) / 2))}px`);
      const focus: Focus = previous ?? { card, slot, returning: false }; focus.returning = false; active = focus; focuses.add(focus);
      if (useApp.getState().motion && !matchMedia('(prefers-reduced-motion: reduce)').matches) focus.animation = moveMaterial(card, from, 360, 'reading-focus-arrive');
      window.dispatchEvent(new Event('drishya-material-layout'));
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || event.buttons || !permitted()) return;
      if (getSelection()?.toString()) { clearTimers(); return; }
      const target = (event.target as Element).closest<HTMLElement>('.op[data-op-id]') ?? [...focuses].find(focus => event.target === focus.slot)?.card;
      const own = target === active?.card || event.target === active?.slot;
      if (own) { clearTimers(); return; }
      if (target && root.contains(target) && target.dataset.hoverReading !== 'focused') {
        clearTimeout(leave);
        if (candidate === target) return;
        clearTimeout(dwell); candidate = target;
        const began = performance.now();
        const attempt = () => {
          if (candidate !== target || !target.isConnected) return;
          if ((materialIsMoving(target) || target.dataset.materialSettling === 'true') && performance.now() - began < 2200) { dwell = setTimeout(attempt, 120); return; }
          candidate = undefined; open(target);
        };
        dwell = setTimeout(attempt, 240);
      } else {
        clearTimeout(dwell); candidate = undefined;
        if (active && !leave && !getSelection()?.toString()) leave = setTimeout(() => { leave = undefined; if (active) close(active); }, 180);
      }
    };
    const wheel = (event: WheelEvent) => {
      const card = active?.card;
      if (!card || !(event.target instanceof Element) || !card.contains(event.target)) return;
      // Let a real nested result consume the wheel; at its boundary return to history.
      for (let node: Element | null = event.target; node && node !== card; node = node.parentElement) {
        if (!(node instanceof HTMLElement)) continue;
        const style = getComputedStyle(node);
        if (/auto|scroll/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1 &&
            (event.deltaY < 0 ? node.scrollTop > 0 : node.scrollTop + node.clientHeight < node.scrollHeight - 1)) return;
      }
      event.preventDefault(); event.stopPropagation(); reset();
      root.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: event.deltaY, deltaX: event.deltaX, deltaMode: event.deltaMode }));
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? root.clientHeight : 1;
      root.scrollBy({ top: event.deltaY * unit, left: event.deltaX * unit });
    };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') reset(); };
    const scroll = () => { if (active || focuses.size) reset(); };
    const unsubscribe = useApp.subscribe(() => { if (!permitted()) reset(); });
    const observer = new MutationObserver(() => { for (const focus of [...focuses]) if (!focus.card.isConnected) close(focus, true); });
    observer.observe(root, { childList: true, subtree: true });
    document.addEventListener('wheel', wheel, { capture: true, passive: false }); document.addEventListener('pointermove', move); document.addEventListener('keydown', key);
    root.addEventListener('scroll', scroll, { passive: true }); window.addEventListener('resize', reset); window.addEventListener('blur', reset);
    return () => { reset(); observer.disconnect(); unsubscribe(); document.removeEventListener('wheel', wheel, true); document.removeEventListener('pointermove', move); document.removeEventListener('keydown', key); root.removeEventListener('scroll', scroll); window.removeEventListener('resize', reset); window.removeEventListener('blur', reset); };
  }, [history]);
}
