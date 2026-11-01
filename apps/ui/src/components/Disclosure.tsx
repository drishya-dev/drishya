import {useEffect, useState, type ComponentProps} from 'react';
import {useApp} from '../state.ts';

const storageKey = 'drishya-disclosures-v1';
const changed = 'drishya-disclosure-change';
// Only identifiers and booleans live here; never captured bodies or grants.
// The array is a migration fallback for choices saved by the earlier draft.
function preferences(): [string, boolean][] {
  try {
    const rows: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    return Array.isArray(rows) ? rows.slice(-256).filter((row): row is [string, boolean] =>
      Array.isArray(row) && row.length === 2 && typeof row[0] === 'string' && row[0].length <= 1400 && typeof row[1] === 'boolean') : [];
  } catch {return [];}
}

/** Explicit reading choices survive live revisions, replay and reload. */
export function useDisclosureChoice(surface: string, initial = true): [boolean, (value: boolean) => void] {
  const id = useApp(state => state.recordingId);
  const key = `${id ?? 'unselected'}/${surface}`;
  const read = () => {
    try {
      const saved = localStorage.getItem(`${storageKey}/${key}`);
      if (saved === '1' || saved === '0') return saved === '1';
    } catch { /* Browser storage can be disabled. */ }
    return new Map(preferences()).get(key) ?? initial;
  };
  const [choice, setChoice] = useState(() => ({key, value: read()}));
  const value = choice.key === key ? choice.value : read();
  useEffect(() => {
    const refresh = () => setChoice({key, value: read()});
    window.addEventListener(changed, refresh);
    window.addEventListener('storage', refresh);
    return () => {window.removeEventListener(changed, refresh); window.removeEventListener('storage', refresh);};
  }, [key, initial]);
  return [value, next => {
    setChoice({key, value: next});
    try {
      // One key per explicit choice: new surfaces never evict earlier choices.
      localStorage.setItem(`${storageKey}/${key}`, next ? '1' : '0');
      window.dispatchEvent(new Event(changed));
    } catch { /* A blocked browser store still permits a choice for this mount. */ }
  }];
}

export function Disclosure({surface, initiallyOpen = true, children, ...props}: Omit<ComponentProps<'details'>, 'open' | 'onToggle'> & {surface: string; initiallyOpen?: boolean}) {
  const [open, setOpen] = useDisclosureChoice(surface, initiallyOpen);
  return <details {...props} data-reading-disclosure="" open={open} onClick={event => {
    props.onClick?.(event);
    const summary = event.target instanceof Element ? event.target.closest('summary') : null;
    if (!event.defaultPrevented && summary?.parentElement === event.currentTarget) {
      // Native toggle is asynchronous; save the deliberate click before an
      // immediate navigation/reload can unmount this reading surface.
      event.preventDefault(); setOpen(!open);
    }
  }} onKeyDown={event => {
    props.onKeyDown?.(event);
    if (!event.defaultPrevented && event.key === 'Escape' && open) {
      event.preventDefault(); event.stopPropagation(); setOpen(false);
      event.currentTarget.querySelector<HTMLElement>(':scope > summary')?.focus();
    }
  }} onToggle={event => {
    if (event.target === event.currentTarget && event.currentTarget.open !== open) setOpen(event.currentTarget.open);
  }}>{children}</details>;
}
