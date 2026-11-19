import { useSyncExternalStore } from 'react';

// The effective theme can change through the OS without changing the saved preference.
function subscribe(change: () => void) {
  const observer = new MutationObserver(change);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-palette', 'data-experience'] });
  return () => observer.disconnect();
}
/** A redraw key: the light/dark scheme plus the named palette (Midnight and Charcoal are both dark). */
export function useResolvedTheme() {
  return useSyncExternalStore(subscribe, () => `${document.documentElement.dataset.theme ?? 'dark'}:${document.documentElement.dataset.palette ?? ''}:${document.documentElement.dataset.experience ?? ''}`, () => 'dark:');
}

// Everything that can change the map's colour tokens. Reading these never forces a style recalculation.
const themeKey = () => {
  const d = document.documentElement.dataset;
  return `${d.theme ?? ''}:${d.palette ?? ''}:${d.experience ?? ''}:${d.uiVersion ?? ''}:${matchMedia('(prefers-color-scheme: dark)').matches}`;
};
type MapPalette = ReturnType<typeof readPalette>;
const palettes = new WeakMap<HTMLCanvasElement, { key: string; palette: MapPalette }>();

/**
 * The map's colours, read from CSS once per theme rather than once per paint. The map paints every
 * frame while history is live, and each getPropertyValue forced a full style recalculation against
 * a DOM that changed every frame (PERF-2: ~410 ms of a 2.6 s window on a 166 MB journal).
 */
export function mapPalette(canvas: HTMLCanvasElement): MapPalette {
  const key = themeKey(), cached = palettes.get(canvas);
  if (cached?.key === key) return cached.palette;
  const palette = readPalette(canvas);
  palettes.set(canvas, { key, palette });
  return palette;
}

function readPalette(canvas: HTMLCanvasElement) {
  const styles = getComputedStyle(canvas);
  const colour = (token: string) => styles.getPropertyValue(token).trim();
  return {
    edge: colour('--graph-edge') || colour('--line'), node: colour('--graph-node') || colour('--line-3'), active: colour('--t1'),
    focus: colour('--focus'), text: colour('--t1'), background: colour('--bg'),
    tones: { read: colour('--source'), search: colour('--focus'), write: colour('--edited'), fail: colour('--fail'), pass: colour('--pass') },
  };
}
