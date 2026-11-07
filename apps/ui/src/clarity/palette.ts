/** Clarity's two palettes (FINISH-0a). Stored under their own key, so Modern's saved palette is never touched. */
export type ClarityPalette = 'graphite' | 'porcelain';
export const CLARITY_THEME_KEY = 'drishya.clarity.theme';

/**
 * A Modern palette maps to the Clarity palette of the same scheme: the light ones (Daylight, Royal) to Porcelain, every dark one to Graphite.
 * Used until the person makes a Clarity choice of their own, which is then saved separately.
 */
export function clarityPaletteFor(modern: string | null | undefined, prefersLight: boolean): ClarityPalette {
  if (modern === 'light' || modern === 'tokyo') return 'porcelain';
  if (modern === 'system') return prefersLight ? 'porcelain' : 'graphite';
  return 'graphite';
}
