import { expect, it } from 'vitest';
import { previousReviewNote, readReviewMarks, updateReviewMark } from '../src/lib/git-review-marks.ts';

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
