import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// assets/brand is the one canonical copy of the brand files. The app and the site serve their own copies from their
// public folders (a bundler cannot reach outside its root), so this keeps the copies from drifting apart.
const read = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url));

describe('brand assets', () => {
  it.each([
    ['apps/site/public/mark.svg', 'assets/brand/mark-on-dark.svg'],
    ['apps/site/public/social-preview.png', 'assets/brand/social-preview.png'],
    ['apps/ui/public/brand/drishya.svg', 'assets/brand/app-icon.svg'],
    ['apps/ui/public/brand/drishya.png', 'assets/brand/app-icon.png'],
    ['apps/ui/public/brand/drishya-tab.svg', 'assets/brand/mark-adaptive.svg'],
  ])('%s matches %s', (served, canonical) => {
    expect(read(served).equals(read(canonical))).toBe(true);
  });

  it('has a 1280 x 640 social preview', () => {
    const png = read('assets/brand/social-preview.png');
    expect(png.readUInt32BE(16)).toBe(1280);
    expect(png.readUInt32BE(20)).toBe(640);
  });
});
