import { redactText } from '../../../../packages/privacy/src/index.ts';

export interface PreviousNote { fingerprint: string; note: string }
export interface ReviewMark { fingerprint: string; note: string; reviewed: boolean; previous?: PreviousNote }
export function readReviewMarks(raw: string): Record<string, ReviewMark> {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).slice(-100).flatMap(([path, mark]) => {
      if (!mark || typeof mark !== 'object' || typeof mark.fingerprint !== 'string' || typeof mark.note !== 'string') return [];
      const previous = mark.previous && typeof mark.previous.fingerprint === 'string' && typeof mark.previous.note === 'string'
        ? { fingerprint: mark.previous.fingerprint.slice(0, 128), note: redactText(mark.previous.note.slice(0, 2000)).text } : undefined;
      return [[path, { fingerprint: mark.fingerprint.slice(0, 128), note: redactText(mark.note.slice(0, 2000)).text, reviewed: mark.reviewed === true, previous }]];
    }));
  } catch { return {}; }
}
export function previousReviewNote(mark: ReviewMark | undefined, fingerprint: string): PreviousNote | undefined {
  return mark?.fingerprint !== fingerprint && mark?.note ? { fingerprint: mark.fingerprint, note: mark.note } : mark?.previous;
}
export function updateReviewMark(mark: ReviewMark | undefined, fingerprint: string, patch: Partial<Pick<ReviewMark, 'note' | 'reviewed'>>): ReviewMark {
  const exact = mark?.fingerprint === fingerprint;
  return {
    fingerprint, note: redactText((patch.note ?? (exact ? mark?.note ?? '' : '')).slice(0, 2000)).text,
    reviewed: patch.reviewed ?? (exact && !!mark?.reviewed),
    previous: previousReviewNote(mark, fingerprint),
  };
}

/** GIT-9: the marks that Git review stored before Changes absorbed it live under this same key, so a mark made then still counts when its fingerprint matches. */
export const reviewMarkKey = (recordingId: string) => `drishya-git-review-v1:${recordingId}`;
/** A mark belongs to a path in one view of the changes. The working tree keeps the bare path (what Git review used); a comparison adds which two sides it reads. */
export const reviewMarkId = (scope: string, path: string) => scope ? `${scope}\u0001${path}` : path;
export function loadReviewMarks(recordingId: string): Record<string, ReviewMark> {
  try { return readReviewMarks(localStorage.getItem(reviewMarkKey(recordingId)) ?? '{}'); } catch { return {}; }
}
/** False when the browser refused the write; the caller says so. */
export function saveReviewMarks(recordingId: string, marks: Record<string, ReviewMark>): boolean {
  try { localStorage.setItem(reviewMarkKey(recordingId), JSON.stringify(Object.fromEntries(Object.entries(marks).slice(-100)))); return true; } catch { return false; }
}
