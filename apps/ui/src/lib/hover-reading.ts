import { useEffect, type RefObject } from 'react';
import { useApp } from '../state.ts';
import { materialIsMoving, moveMaterial } from './material-motion.ts';

/** Enlarge one real DOM preview. Its resting slot stays in history; no evidence is copied. */
export function useHoverReading(history: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const root = history.current;
    if (!root) return;
    type Focus = { card: HTMLElement; slot: HTMLElement; animation?: Animation; returning: boolean; scrollTop: number };
    let active: Focus | undefined;
    let pointer: { x: number; y: number } | undefined;
    let candidate: HTMLElement | undefined;
    let dwell: ReturnType<typeof setTimeout> | undefined;
    let leave: ReturnType<typeof setTimeout> | undefined;
    const focuses = new Set<Focus>();
    const clearTimers = () => { clearTimeout(dwell); clearTimeout(leave); dwell = leave = undefined; candidate = undefined; };
    const restore = (focus: Focus) => {
      focus.animation?.cancel();
      focus.card.removeAttribute('data-hover-reading');
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
      focus.animation = moveMaterial(focus.card, from, 350, 'reading-focus-return');
      const animation = focus.animation;
      const finish = () => { if (focus.returning && focus.animation === animation) restore(focus); };
      void animation.finished.then(finish, finish);
    };
    const reset = () => { clearTimers(); for (const focus of [...focuses]) close(focus, true); };
    const permitted = () => {
      const state = useApp.getState();
      return state.hoverReading && !state.lowResource && !state.explore && !state.selectedOp && !state.expandedOp && !state.settingsOpen && !state.searchOpen && !state.currentFile && !state.filePanel && innerWidth > 820 && matchMedia('(hover: hover)').matches;
    };
    const containsPointer = (card: HTMLElement) => {
      if (!pointer) return false;
      const bounds = card.getBoundingClientRect();
      return pointer.x >= bounds.left && pointer.x <= bounds.right && pointer.y >= bounds.top && pointer.y <= bounds.bottom;
    };
    const leaveAfterDwell = () => {
      if (active && !leave && !getSelection()?.toString()) leave = setTimeout(() => {
        leave = undefined;
        if (active && !containsPointer(active.card)) close(active);
      }, 180);
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
      // Keep the real article in history's stacking context. A top-layer popover
      // would cover the header/composer instead of passing under their edge veils.
      card.dataset.hoverReading = 'focused';
      const width = Math.min(Math.max(from.width, 520), viewport.width - 32);
      const left = Math.max(viewport.left + 16, Math.min(viewport.right - width - 16, from.left + (from.width - width) / 2));
      card.style.setProperty('--hover-width', `${width}px`); card.style.setProperty('--hover-height', 'auto');
      card.style.setProperty('--hover-left', `${left}px`); card.style.setProperty('--hover-top', `${top}px`);
      // Keep the reading space near its source and clamp to real available bounds.
      const style = getComputedStyle(card);
      // scrollHeight omits the border: allocating it verbatim leaves a tiny
      // overflow and an unnecessary scrollbar even when all content fits.
      const body = card.querySelector<HTMLElement>('.op-body');
      const bodyOverflow = body ? Math.max(0, body.scrollHeight - body.clientHeight) : 0;
      // Tool previews allocate input and outcome independently. Include their
      // hidden depth when opening a reader, not just the outer body's overflow.
      const exchangeOverflow = [...card.querySelectorAll<HTMLElement>('.command-request,.tool-input,.result-content')].reduce((sum,node)=>sum+Math.max(0,node.scrollHeight-node.clientHeight),0);
      const needed = Math.ceil(card.scrollHeight + bodyOverflow + exchangeOverflow + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth) + 2);
      const height = Math.min(bottom - top, innerHeight * .72, Math.max(from.height * 1.12, needed));
      card.style.setProperty('--hover-height', `${height}px`);
      card.style.setProperty('--hover-top', `${Math.max(top, Math.min(bottom - height, from.top + (from.height - height) / 2))}px`);
      const focus: Focus = previous ?? { card, slot, returning: false, scrollTop: root.scrollTop }; focus.returning = false; focus.scrollTop = root.scrollTop; active = focus; focuses.add(focus);
      if (useApp.getState().motion && !matchMedia('(prefers-reduced-motion: reduce)').matches) focus.animation = moveMaterial(card, from, 400, 'reading-focus-arrive');
      window.dispatchEvent(new Event('drishya-material-layout'));
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      pointer = { x: event.clientX, y: event.clientY };
      if (event.buttons || !permitted()) return;
      if (getSelection()?.toString()) { clearTimers(); return; }
      // Enter deliberately through the title strip; merely reading/scrolling
      // preview content must not unexpectedly change its size under the cursor.
      const element = event.target as Element;
      const header = element.closest('.op-head');
      const target = header && !element.closest('button, a, input') ? header.closest<HTMLElement>('.op[data-op-id]') : undefined;
      // Test the current enlarged rectangle, not a stale event target or source slot.
      const own = active && containsPointer(active.card);
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
        leaveAfterDwell();
      }
    };
    const wheel = (event: WheelEvent) => {
      const card = active?.card;
      if (!card || !(event.target instanceof Element) || !card.contains(event.target)) return;
      pointer = { x: event.clientX, y: event.clientY };
      // At a result boundary, scroll history without tearing down the reading surface.
      for (let node: Element | null = event.target; node && node !== card; node = node.parentElement) {
        if (!(node instanceof HTMLElement)) continue;
        const style = getComputedStyle(node);
        if (/auto|scroll/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1 &&
            (event.deltaY < 0 ? node.scrollTop > 0 : node.scrollTop + node.clientHeight < node.scrollHeight - 1)) return;
      }
      event.preventDefault(); event.stopPropagation(); clearTimers();
      root.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: event.deltaY, deltaX: event.deltaX, deltaMode: event.deltaMode }));
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? root.clientHeight : 1;
      root.scrollBy({ top: event.deltaY * unit, left: event.deltaX * unit });
    };
    const scroll = () => {
      // Fixed readers do not inherit the history scroll. Carry the one real
      // enlarged card by the same delta instead of pinning it to the viewport.
      let moved = false;
      for (const focus of focuses) {
        const delta = root.scrollTop - focus.scrollTop;
        focus.scrollTop = root.scrollTop;
        if (!delta) continue;
        const top = parseFloat(focus.card.style.getPropertyValue('--hover-top'));
        focus.card.style.setProperty('--hover-top', `${top - delta}px`);
        moved = true;
      }
      if (moved) window.dispatchEvent(new Event('drishya-material-layout'));
      if (active && containsPointer(active.card)) clearTimers();
      else leaveAfterDwell();
    };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') reset(); };
    const unsubscribe = useApp.subscribe(() => { if (!permitted()) reset(); });
    const observer = new MutationObserver(() => { for (const focus of [...focuses]) if (!focus.card.isConnected) close(focus, true); });
    observer.observe(root, { childList: true, subtree: true });
    document.addEventListener('wheel', wheel, { capture: true, passive: false }); document.addEventListener('pointermove', move); document.addEventListener('keydown', key);
    root.addEventListener('scroll', scroll, { passive: true }); window.addEventListener('resize', reset); window.addEventListener('blur', reset);
    return () => { reset(); observer.disconnect(); unsubscribe(); document.removeEventListener('wheel', wheel, true); document.removeEventListener('pointermove', move); document.removeEventListener('keydown', key); root.removeEventListener('scroll', scroll); window.removeEventListener('resize', reset); window.removeEventListener('blur', reset); };
  }, [history]);
}
