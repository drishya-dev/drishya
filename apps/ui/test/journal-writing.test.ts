import { expect, test } from 'vitest';
import { journalWriting } from '../src/lib/home-import.ts';
test('only known writes in the last minute qualify, without process inference', () => {
  const now = Date.parse('2026-11-05T12:00:00Z');
  for (const age of [0, 10_000, 59_999]) expect(journalWriting(new Date(now-age).toISOString(), now)).toBe(true);
  for (const value of [undefined, 'invalid', new Date(now-60_000).toISOString(), new Date(now+1).toISOString()]) expect(journalWriting(value, now)).toBe(false);
});

import { writingSince } from '../src/lib/home-import.ts';
const clock = Date.parse('2026-11-05T12:00:00Z'), ago = (ms: number) => new Date(clock - ms).toISOString();
test('an unopened discovered journal qualifies on its own write time', () => {
  expect(writingSince({ sourceModifiedAt: ago(5_000) }, clock)).toBe(clock - 5_000);
  expect(writingSince({ sourceModifiedAt: ago(61_000) }, clock)).toBeUndefined();
  expect(writingSince({}, clock)).toBeUndefined();
});
test('a followed recording whose parent journal is stale stays while companions or sub-agents change it', () => {
  const health = { state: 'following', lastChangeAt: ago(3_000) };
  expect(writingSince({ sourceModifiedAt: ago(600_000), health }, clock)).toBe(clock - 3_000);
});
test('an imported recording outside the discovery roots has no journal to date and still qualifies', () => {
  expect(writingSince({ health: { state: 'following', lastChangeAt: ago(8_000) } }, clock)).toBe(clock - 8_000);
  expect(writingSince({ health: { state: 'following' } }, clock)).toBe(0);
});
test('the one-minute expiry holds for followed recordings and for states that are not following', () => {
  expect(writingSince({ sourceModifiedAt: ago(90_000), health: { state: 'following', lastChangeAt: ago(60_000) } }, clock)).toBeUndefined();
  expect(writingSince({ health: { state: 'idle', lastChangeAt: ago(1_000) } }, clock)).toBeUndefined();
  expect(writingSince({ health: { state: 'stopped', lastChangeAt: ago(1_000) } }, clock)).toBeUndefined();
});
test('the newer of the two kinds of evidence orders the strip', () => {
  expect(writingSince({ sourceModifiedAt: ago(20_000), health: { state: 'following', lastChangeAt: ago(2_000) } }, clock)).toBe(clock - 2_000);
  expect(writingSince({ sourceModifiedAt: ago(2_000), health: { state: 'following', lastChangeAt: ago(20_000) } }, clock)).toBe(clock - 2_000);
});
