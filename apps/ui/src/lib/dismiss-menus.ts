import {surfaceMotion,surfaceMotionAllowed} from './surface-motion.ts';
import { useEffect } from 'react';
import { useApp } from '../state.ts';

/** Light dismissal for utility disclosures; content readers remain deliberate. */
export function useDismissMenus() {
  useEffect(() => {
    // Usage and identity are persistent reading disclosures (UI-17), not menus.
    // Hiding the outer utility menu must not overwrite their explicit choices.
    const menus = '.workspace-menu, .prompt-menu, .permission-policy, .session-segments, .review-tools, .desk-options';
    const selectors = menus.split(', ').map(selector => `${selector}[open]`).join(', ');
    const actors=new Map<HTMLDetailsElement,ReturnType<typeof surfaceMotion>[]>();
    // Native/React toggles change the same real details element. This microtask runs before paint,
    // including on the very first opening and on action-driven light dismissal.
    const observer=new MutationObserver(records=>{
      for(const record of records){const details=record.target;if(!(details instanceof HTMLDetailsElement)||!details.matches(menus+', details[data-reading-disclosure]'))continue;
        let current=actors.get(details);
        if(!details.hasAttribute('data-pointer-menu')||!surfaceMotionAllowed()){current?.forEach(actor=>actor.cancel());continue;}
        if(!current){current=[...details.children].filter((node):node is HTMLElement=>node instanceof HTMLElement&&node.tagName!=='SUMMARY').map(node=>surfaceMotion(node,'menu'));actors.set(details,current);}
        current.forEach(actor=>{if(details.open)actor.open(!actor.closing);else actor.close(()=>actor.cancel());});
      }
    });
    observer.observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['open']});

    const motion = (menu: HTMLDetailsElement, pointer: boolean) => {
      menu.toggleAttribute('data-pointer-menu', pointer && useApp.getState().motion && !useApp.getState().lowResource && !matchMedia('(prefers-reduced-motion: reduce)').matches);
      const panel=menu.querySelector<HTMLElement>(':scope > :not(summary)');
      if(pointer&&panel){const style=getComputedStyle(panel);menu.style.setProperty('--menu-origin',`${style.bottom!=='auto'&&style.top==='auto'?'bottom':'top'} ${style.right!=='auto'&&style.left==='auto'?'right':'left'}`);if(!menu.open)void style.opacity;}

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
    // A disclosure inside an open session menu (Usage, Navigate history) closes when something else in that menu is used, but only after
    // the click has landed: closing it on pointer down shifts the rows below it from under the pointer and the click misses (UI-15).
    const insideOpenMenu = (menu: HTMLDetailsElement, event: Event) => {
      const outer = menu.parentElement?.closest('.workspace-menu[open]');
      return !!outer && event.composedPath().includes(outer);
    };
    const dismiss = (event: Event, deferInsideMenu = false) => {
      for (const menu of document.querySelectorAll<HTMLDetailsElement>(selectors)) {
        if (event.composedPath().includes(menu)) continue;
        if (deferInsideMenu && insideOpenMenu(menu, event)) continue;
        motion(menu, event.type === 'pointerdown'); menu.open = false;
      }
    };
    const click = (event: MouseEvent) => {
      for (const menu of document.querySelectorAll<HTMLDetailsElement>(selectors)) {
        if (!event.composedPath().includes(menu) && insideOpenMenu(menu, event)) { motion(menu, true); menu.open = false; }
      }
    };
    const pointer = (event: PointerEvent) => {
      for(const [details,current] of actors)if(!details.isConnected){current.forEach(actor=>actor.dispose());actors.delete(details);}
      const summary = event.target instanceof Element ? event.target.closest('summary') : null;
      const menu = summary?.parentElement;
      if (menu instanceof HTMLDetailsElement && menu.matches(menus+', details[data-reading-disclosure]')) { motion(menu, true); fit(menu); }
      document.documentElement.setAttribute('data-ui-press', '');
      dismiss(event, true);
    };
    const keyboard = (event: KeyboardEvent) => {
      document.documentElement.removeAttribute('data-ui-press');
      const trigger = event.target instanceof Element ? event.target.closest('summary')?.parentElement : null;
      if (trigger instanceof HTMLDetailsElement && trigger.matches(menus+', details[data-reading-disclosure]')) { motion(trigger, false); fit(trigger); }
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
    document.addEventListener('click', click);
    // Focus that a pointer press moved waits for the click like the press itself; keyboard focus closes siblings at once.
    const focus = (event: FocusEvent) => dismiss(event, document.documentElement.hasAttribute('data-ui-press'));
    document.addEventListener('focusin', focus);
    window.addEventListener('resize', resize);
    document.addEventListener('keydown', keyboard);
    return () => { observer.disconnect();actors.forEach(current=>current.forEach(actor=>actor.dispose()));document.removeEventListener('pointerdown', pointer, true); document.removeEventListener('click', click); document.removeEventListener('focusin', focus); window.removeEventListener('resize', resize); document.removeEventListener('keydown', keyboard); };
  }, []);
}
