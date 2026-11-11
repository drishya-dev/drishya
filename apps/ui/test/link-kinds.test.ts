import { expect, it } from 'vitest';
import { branchCandidate, commitCandidate, githubTarget, linkKind, splitUrls, webUrl } from '../src/lib/link-kinds.ts';

it('only plain http(s) addresses are links', () => {
  expect(webUrl('https://example.com/a?b=1#c')).toBe('https://example.com/a?b=1#c');
  for (const bad of ['javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,x', 'ftp://x.test/a', 'https://user:pw@x.test/', 'https://x.test/a b', '//x.test']) expect(webUrl(bad), bad).toBeUndefined();
});

it('recognises GitHub pull requests and issues exactly', () => {
  expect(githubTarget('https://github.com/drishya-dev/drishya/pull/395')).toEqual({ owner: 'drishya-dev', repo: 'drishya', kind: 'pull', number: 395 });
  expect(linkKind('https://github.com/a/b/issues/3')).toBe('github');
  expect(linkKind('https://github.com/a/b/commit/abc1234')).toBe('url');
  expect(linkKind('https://github.com.evil.test/a/b/pull/1')).toBe('url');
});

it('treats only plausible hex words as commit candidates', () => {
  for (const ok of ['1a2b3c4', 'a3f9c21de0', '6a246dc5b7e8d9f0a1b2c3d4e5f60718293a4b5c', 'abcdef123456']) expect(commitCandidate(ok), ok).toBe(true);
  for (const no of ['deadbee', 'facade', '1234567', '12345678', 'abcdefg1', 'Release', 'abc123']) expect(commitCandidate(no), no).toBe(false);
});

it('treats conventional branch names as candidates, not files', () => {
  expect(branchCandidate('feature/link-cards')).toBe(true);
  expect(branchCandidate('codex/ship-12')).toBe(true);
  expect(branchCandidate('src/components/App.tsx')).toBe(false);
  expect(branchCandidate('docs/readme')).toBe(false);
  expect(branchCandidate('release', 'release')).toBe(true);
  expect(branchCandidate('feature/a..b')).toBe(false);
});

it('splits bare addresses out of prose and keeps sentence punctuation as text', () => {
  expect(splitUrls('See https://example.com/docs, then (https://example.com/a_(b)) and https://x.test/y.')).toEqual([
    { text: 'See ' }, { url: 'https://example.com/docs' }, { text: ', then (' }, { url: 'https://example.com/a_(b)' }, { text: ') and ' }, { url: 'https://x.test/y' }, { text: '.' },
  ]);
  expect(splitUrls('no links here')).toEqual([{ text: 'no links here' }]);
  expect(splitUrls('javascript:alert(1) is not one')).toEqual([{ text: 'javascript:alert(1) is not one' }]);
});
