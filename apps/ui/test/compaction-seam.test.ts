import { describe, expect, it } from 'vitest';
import { formatDuration, formatTokens, triggerPhrase } from '../src/components/ContextEvidence.tsx';

describe('UI-36 compaction seam helpers', () => {
  describe('formatTokens', () => {
    it('formats tokens as human readable values with k and M', () => {
      expect(formatTokens(566666)).toBe('566.7k');
      expect(formatTokens(23219)).toBe('23.2k');
      expect(formatTokens(80000)).toBe('80k');
      expect(formatTokens(9000)).toBe('9k');
      expect(formatTokens(6000)).toBe('6k');
      expect(formatTokens(272000)).toBe('272k');
      expect(formatTokens(258400)).toBe('258.4k');
      expect(formatTokens(1000000)).toBe('1M');
      expect(formatTokens(1500000)).toBe('1.5M');
      expect(formatTokens(500)).toBe('500');
      expect(formatTokens(0)).toBe('0');
    });
  });

  describe('formatDuration', () => {
    it('formats milliseconds into human min/s or s', () => {
      expect(formatDuration(89183)).toBe('1 min 29 s');
      expect(formatDuration(41000)).toBe('41 s');
      expect(formatDuration(3400)).toBe('3 s');
      expect(formatDuration(43)).toBe('43 ms');
      expect(formatDuration(undefined)).toBeUndefined();
    });
  });

  describe('triggerPhrase', () => {
    it('combines trigger and duration into one natural phrase', () => {
      expect(triggerPhrase('manual', 89183)).toBe('You compacted · 1 min 29 s');
      expect(triggerPhrase('auto', 41000)).toBe('Compacted automatically · 41 s');
      expect(triggerPhrase('auto', 43)).toBe('Compacted automatically · 43 ms');
      expect(triggerPhrase('manual', undefined)).toBe('You compacted');
      expect(triggerPhrase(undefined, 41000)).toBe('Compacted · 41 s');
      expect(triggerPhrase(undefined, undefined)).toBeUndefined();
    });
  });
});
