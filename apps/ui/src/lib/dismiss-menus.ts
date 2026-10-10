import { useEffect } from 'react';

/** Light dismissal for utility disclosures; content readers remain deliberate. */
export function useDismissMenus() {
  useEffect(() => {
    const selectors = '.workspace-menu[open], .usage-peek[open], .prompt-menu[open], .permission-policy[open]';
    const dismiss = (event: Event) => {
      for (const menu of document.querySelectorAll<HTMLDetailsElement>(selectors)) {
        if (event.type === 'keydown' || !event.composedPath().includes(menu)) menu.open = false;
      }
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') dismiss(event); };
    document.addEventListener('pointerdown', dismiss, true);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', dismiss, true); document.removeEventListener('keydown', escape); };
  }, []);
}
