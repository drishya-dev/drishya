import { expect, it } from 'vitest';
import { previousReviewNote, readReviewMarks, reviewMarkId, reviewMarkKey, updateReviewMark } from '../src/lib/git-review-marks.ts';
import { buildHandoff } from '../src/lib/changes-handoff.ts';

it('retains an old note through a changed patch while review status resets', () => {
  const original = { fingerprint: 'old', note: 'Check the total', reviewed: true };
  const changed = updateReviewMark(original, 'new', { note: 'Reviewing this now' });
  expect(changed.reviewed).toBe(false);
  expect(changed.previous).toEqual({ fingerprint: 'old', note: 'Check the total' });
  const reused = updateReviewMark(changed, 'new', { note: changed.previous!.note, reviewed: false });
  expect(reused.reviewed).toBe(false); expect(reused.note).toBe('Check the total');
  expect(previousReviewNote(reused, 'new')).toEqual(changed.previous);
});
it('migrates compatible saved marks, rejects corrupt entries and bounds/redacts local notes', () => {
  const result = readReviewMarks(JSON.stringify({ file: { fingerprint: 'old', note: 'Note', reviewed: true }, bad: { note: 1 }, secret: { fingerprint: 's', note: 'sk-proj-abcdefghijklmnopqrstuvw0123456789', reviewed: 'yes' } }));
  expect(result.file?.reviewed).toBe(true); expect(result.bad).toBeUndefined();
  expect(result.secret?.note).not.toContain('abcdefghijklmnop'); expect(result.secret?.reviewed).toBe(false);
  expect(Object.keys(readReviewMarks(JSON.stringify(Object.fromEntries(Array.from({ length: 200 }, (_, n) => [`${n}`, { fingerprint: 'x', note: 'a'.repeat(3000) }])))))).toHaveLength(100);
  expect(readReviewMarks('not json')).toEqual({});
});

it('keeps the working tree on the bare path Git review used and scopes a comparison by its two sides', () => {
  expect(reviewMarkId('', 'src/a.ts')).toBe('src/a.ts');
  expect(reviewMarkId('refs/heads/main..refs/heads/topic:head', 'src/a.ts')).not.toBe(reviewMarkId('refs/heads/main..refs/heads/topic:base', 'src/a.ts'));
  expect(reviewMarkKey('rec_1')).toBe('drishya-git-review-v1:rec_1');
});
it('builds the handoff packet in the same shape and redacts it', () => {
  const text = buildHandoff({ sampledAt: '2026-11-11T00:00:00Z', lines: ['Comparing: main ← topic'], omitted: 2, files: [{ path: 'a.ts', fingerprint: 'abc', note: 'token sk-proj-abcdefghijklmnopqrstuvw0123456789', patch: '@@ -1 +1 @@\n-a\n+b' }] });
  expect(text.startsWith('# Local Git changes handoff\n\nCurrent Git, sampled on 2026-11-11T00:00:00Z')).toBe(true);
  expect(text).toContain('Scope: explicitly reviewed patches in the files listed. 2 paths outside this sample');
  expect(text).toContain('## a.ts\nContent fingerprint: abc\nReview note: ');
  expect(text).toContain('@@ -1 +1 @@');
  expect(text).not.toContain('abcdefghijklmnop');
  expect(text).not.toMatch(/Git review/);
});
