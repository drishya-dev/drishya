import { expect, it } from 'vitest';
import { encryptedToken } from '../src/reduce.ts';

// CONTENT-5: Codex can record a delegated task only as an encrypted token. It must never be shown as
// the task text, and ordinary task text must never be mistaken for one.
it('recognises Codex encrypted task text and nothing else', () => {
  expect(encryptedToken('gAAAAABq0iD0PpVvMDe76T5pILNurR2gA0IZ6NKmWQc7PAn5WMReBThoR7Ocz38MxWjvr-hGtGxDuCR')).toBe(true);
  expect(encryptedToken('Review PR 67 for regressions in the prompt rail')).toBe(false);
  expect(encryptedToken('gAAAAA short')).toBe(false);
  expect(encryptedToken(undefined)).toBe(false);
  expect(encryptedToken('gAAAAAB' + 'x'.repeat(30) + ' with spaces in it and more words')).toBe(false);
});
