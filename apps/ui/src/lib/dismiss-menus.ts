import { useEffect } from 'react';
import { useApp } from '../state.ts';

/** Light dismissal for utility disclosures; content readers remain deliberate. */
export function useDismissMenus() {
  useEffect(() => {
    const menus = '.workspace-menu, .usage-peek, .prompt-menu, .permission-policy, .session-segments, .review-tools, .desk-options, .session-identity';
    const selectors = menus.split(', ').map(selector => `${selector}[open]`).join(', ');
    const motion = (menu: HTMLDetailsElement, pointer: boolean) => {
      menu.toggleAttribute('data-pointer-menu', pointer && useApp.getState().motion && !useApp.getState().lowResource && !matchMedia('(prefers-reduced-motion: reduce)').matches);
    };
    const fit = (menu: HTMLDetailsElement) => {
      if (!menu.matches('.workspace-menu, .permission-policy, .desk-options')) return;
      const summary = menu.querySelector(':scope > summary')?.getBoundingClientRect();
      if (!summary) return;
      const above = menu.matches('.permission-policy');
      const boundary=menu.closest('.developer-workspace')?.getBoundingClientRect().bottom??innerHeight;
      menu.style.setProperty('--menu-max-height', `${Math.max(32, (above ? summary.top : Math.min(innerHeight,boundary) - summary.bottom) - 16)}px`);
      if(menu.matches('.desk-options')){
        const left=menu.closest('.desk-document, .developer-workspace')?.getBoundingClientRect().left??0;
        menu.style.setProperty('--menu-inline-space',`${Math.max(48,summary.right-Math.max(0,left)-8)}px`);
      }
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
      // Visible utility rows form one keyboard path, including opened disclosures.
      const utility=event.target instanceof Element?event.target.closest<HTMLDetailsElement>('.workspace-menu[open], .desk-options[open]'):null;
      if(utility&&!event.altKey&&!event.ctrlKey&&!event.metaKey&&['ArrowDown','ArrowUp','Home','End'].includes(event.key)&&event.target instanceof Element&&event.target.matches('button,a,summary')) {
        const rows=[...utility.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],summary')].filter(row=>row!==utility.querySelector(':scope>summary')&&row.getClientRects().length>0&&!(row.tagName==='SUMMARY'?row.parentElement?.parentElement:row.parentElement)?.closest('details:not([open])'));
        const index=rows.indexOf(event.target as HTMLElement);
        if(rows.length){event.preventDefault();rows[event.key==='Home'?0:event.key==='End'?rows.length-1:(index+(event.key==='ArrowDown'?1:-1)+rows.length)%rows.length]?.focus({preventScroll:true});}
        return;
      }
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
