import { expect, test } from 'vitest';
import { journalWriting } from '../src/lib/home-import.ts';
test('only known writes in the last minute qualify, without process inference', () => {
  const now = Date.parse('2026-11-05T12:00:00Z');
  for (const age of [0, 10_000, 59_999]) expect(journalWriting(new Date(now-age).toISOString(), now)).toBe(true);
  for (const value of [undefined, 'invalid', new Date(now-60_000).toISOString(), new Date(now+1).toISOString()]) expect(journalWriting(value, now)).toBe(false);
});
