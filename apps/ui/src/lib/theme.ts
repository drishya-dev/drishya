import { useSyncExternalStore } from 'react';

// The effective theme can change through the OS without changing the saved preference.
function subscribe(change: () => void) {
  const observer = new MutationObserver(change);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-palette'] });
  return () => observer.disconnect();
}
/** A redraw key: the light/dark scheme plus the named palette (Midnight and Charcoal are both dark). */
export function useResolvedTheme() {
  return useSyncExternalStore(subscribe, () => `${document.documentElement.dataset.theme ?? 'dark'}:${document.documentElement.dataset.palette ?? ''}`, () => 'dark:');
}

/** Read tokens once per paint, rather than querying CSS for every node in a large map. */
export function mapPalette(canvas: HTMLCanvasElement) {
  const styles = getComputedStyle(canvas);
  const colour = (token: string) => styles.getPropertyValue(token).trim();
  return {
    edge: colour('--line'), node: colour('--line-3'), active: colour('--t3'),
    focus: colour('--focus'), text: colour('--t1'), background: colour('--bg'),
    tones: { read: colour('--t2'), search: colour('--focus'), write: colour('--edited'), fail: colour('--fail'), pass: colour('--pass') },
  };
}
