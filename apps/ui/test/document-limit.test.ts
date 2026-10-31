import { describe, expect, it } from 'vitest';
import { DOCUMENT_SIZES, documentFits, documentLimitMessage, isDocumentSize } from '../src/lib/document-limit.ts';
const file = (lines: number, text = '') => ({ totalLines: lines, text });
describe('rendered document limit', () => {
  it('keeps today\'s limit as the default and raises it by explicit choice', () => {
    expect(DOCUMENT_SIZES.standard).toMatchObject({ lines: 5_000, bytes: 256 * 1024 });
    expect(documentFits(file(5_000), 'standard')).toBe(true);
    expect(documentFits(file(5_001), 'standard')).toBe(false);
    expect(documentFits(file(6_000), 'large')).toBe(true);
    expect(documentFits(file(20_001), 'large')).toBe(false);
    expect(documentFits(file(60_000), 'largest')).toBe(true);
  });
  it('counts bytes, not characters', () => {
    expect(documentFits(file(1, 'x'.repeat(256 * 1024)), 'standard')).toBe(true);
    expect(documentFits(file(1, 'é'.repeat(128 * 1024 + 1)), 'standard')).toBe(false);
    expect(documentFits(file(1, 'é'.repeat(128 * 1024 + 1)), 'large')).toBe(true);
  });
  it('never offers more than the 2 MiB the current-file reader returns, and says where to raise the limit', () => {
    expect(DOCUMENT_SIZES.largest.bytes).toBe(2 * 1024 * 1024);
    expect(documentFits(file(1, 'x'.repeat(2 * 1024 * 1024 + 1)), 'largest')).toBe(false);
    expect(documentLimitMessage('standard')).toContain('Settings');
    expect(documentLimitMessage('largest')).not.toContain('Settings');
  });
  it('accepts only known stored values', () => {
    expect(['standard', 'large', 'largest', 'huge', undefined, null].map(isDocumentSize)).toEqual([true, true, true, false, false, false]);
  });
});
