import { describe, expect, it } from 'vitest';
import { CLARITY_THEME_KEY, clarityPaletteFor } from '../src/clarity/palette.ts';

// FINISH-0a: a saved Modern palette maps to the Clarity palette of the same scheme, and Clarity never writes Modern's key.
describe('clarityPaletteFor', () => {
  it('maps the light Modern palettes to Porcelain', () => {
    expect(clarityPaletteFor('light', false)).toBe('porcelain');
    expect(clarityPaletteFor('tokyo', false)).toBe('porcelain');
  });
  it('maps every dark Modern palette, and nothing saved, to Graphite', () => {
    for (const saved of ['dark', 'midnight', 'mocha', 'nord', 'gruvbox', null, undefined, 'unknown']) expect(clarityPaletteFor(saved, true)).toBe('graphite');
  });
  it('follows the system scheme for a saved "system" choice', () => {
    expect(clarityPaletteFor('system', true)).toBe('porcelain');
    expect(clarityPaletteFor('system', false)).toBe('graphite');
  });
  it('keeps its own storage key apart from Modern\'s', () => {
    expect(CLARITY_THEME_KEY).toBe('drishya.clarity.theme');
    expect(CLARITY_THEME_KEY).not.toBe('drishya.theme');
  });
});
