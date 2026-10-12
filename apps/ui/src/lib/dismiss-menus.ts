import { useEffect } from 'react';
import { useApp } from '../state.ts';

/** Light dismissal for utility disclosures; content readers remain deliberate. */
export function useDismissMenus() {
  useEffect(() => {
    const menus = '.workspace-menu, .usage-peek, .prompt-menu, .permission-policy';
    const selectors = menus.split(', ').map(selector => `${selector}[open]`).join(', ');
    const motion = (menu: HTMLDetailsElement, pointer: boolean) => {
      menu.toggleAttribute('data-pointer-menu', pointer && useApp.getState().motion && !useApp.getState().lowResource && !matchMedia('(prefers-reduced-motion: reduce)').matches);
    };
    const fit = (menu: HTMLDetailsElement) => {
      if (!menu.matches('.workspace-menu, .permission-policy')) return;
      const summary = menu.querySelector(':scope > summary')?.getBoundingClientRect();
      if (!summary) return;
      const above = menu.matches('.permission-policy');
      menu.style.setProperty('--menu-max-height', `${Math.max(32, (above ? summary.top : innerHeight - summary.bottom) - 16)}px`);
    };
    const dismiss = (event: Event) => {
      for (const menu of document.querySelectorAll<HTMLDetailsElement>(selectors)) {
        if (!event.composedPath().includes(menu)) { motion(menu, event.type === 'pointerdown'); menu.open = false; }
      }
    };
    const pointer = (event: PointerEvent) => {
      const summary = event.target instanceof Element ? event.target.closest('summary') : null;
      const menu = summary?.parentElement;
      if (menu instanceof HTMLDetailsElement && menu.matches(menus)) { motion(menu, true); fit(menu); }
      document.documentElement.setAttribute('data-ui-press', '');
      dismiss(event);
    };
    const keyboard = (event: KeyboardEvent) => {
      document.documentElement.removeAttribute('data-ui-press');
      const trigger = event.target instanceof Element ? event.target.closest('summary')?.parentElement : null;
      if (trigger instanceof HTMLDetailsElement && trigger.matches(menus)) { motion(trigger, false); fit(trigger); }
      const active = event.target instanceof Element ? event.target.closest<HTMLDetailsElement>(selectors) : null;
      if (active) { motion(active, false); fit(active); }
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      const menu = active ?? [...document.querySelectorAll<HTMLDetailsElement>(selectors)].at(-1);
      if (!menu) return;
      event.preventDefault();
      motion(menu, false); menu.open = false;
      menu.querySelector<HTMLElement>(':scope > summary')?.focus({ preventScroll: true });
    };
    const resize = () => document.querySelectorAll<HTMLDetailsElement>(selectors).forEach(fit);
    document.addEventListener('pointerdown', pointer, true);
    document.addEventListener('focusin', dismiss);
    window.addEventListener('resize', resize);
    document.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('pointerdown', pointer, true); document.removeEventListener('focusin', dismiss); window.removeEventListener('resize', resize); document.removeEventListener('keydown', keyboard); };
  }, []);
}
