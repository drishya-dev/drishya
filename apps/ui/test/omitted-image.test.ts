import { describe, expect, it } from 'vitest';
import { omittedDimensions, omittedReason } from '../src/lib/omitted-image.ts';

describe('why an image was not kept', () => {
  it('names the byte limit for a large file and the pixel limit for a small file that declares many pixels', () => {
    expect(omittedReason({ omitted: 'too-large', bytes: 12 * 1024 * 1024, width: 3000, height: 2000 })).toBe('larger than the 4 MB kept per image');
    expect(omittedReason({ omitted: 'too-large', bytes: 90, width: 30000, height: 30000 })).toBe('more than 64 megapixels');
    expect(omittedReason({ omitted: 'too-large', bytes: 5 * 1024 * 1024, width: 30000, height: 30000 })).toBe('larger than the 4 MB kept per image');
  });
  it('says the other reasons as before, and states the recorded size', () => {
    expect(omittedReason({ omitted: 'protected' })).toBe('from a protected file');
    expect(omittedReason({})).toBe('not available here');
    expect(omittedDimensions({ width: 30000, height: 30000 })).toBe(' · 30000×30000');
    expect(omittedDimensions({})).toBe('');
  });
});
