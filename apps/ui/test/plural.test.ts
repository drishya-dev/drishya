import { expect, it } from 'vitest';
import { plural, pluralWord } from '../src/lib/plural.ts';

it('formats singular and plural words cleanly for zero, one and many', () => {
  expect(pluralWord(0, 'file', 'files')).toBe('files');
  expect(pluralWord(1, 'file')).toBe('file');
  expect(pluralWord(2, 'file')).toBe('files');
  expect(pluralWord(1, 'match', 'matches')).toBe('match');
  expect(pluralWord(3, 'match', 'matches')).toBe('matches');
  expect(pluralWord(1, 'reply', 'replies')).toBe('reply');
  expect(pluralWord(0, 'reply', 'replies')).toBe('replies');
});

it('formats count with noun', () => {
  expect(plural(0, 'file changed', 'files changed')).toBe('0 files changed');
  expect(plural(1, 'file changed', 'files changed')).toBe('1 file changed');
  expect(plural(2, 'file changed', 'files changed')).toBe('2 files changed');
  expect(plural(1, 'test run')).toBe('1 test run');
  expect(plural(4, 'test run')).toBe('4 test runs');
});
