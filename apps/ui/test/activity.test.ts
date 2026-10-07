import { expect, it } from 'vitest';
import type { Marker } from '@drishya/scene';
import { sampleActivity } from '../src/lib/activity.ts';

it('bounds a failure-heavy recording without losing its chronological endpoints', () => {
  const marks: Marker[] = Array.from({ length: 2000 }, (_, i) => ({ step: i + 1, type: 'fail', label: `Failure ${i}`, operationId: `synthetic-${i}` }));
  const shown = sampleActivity(marks);
  expect(shown).toHaveLength(400);
  expect(new Set(shown.map((m) => m.operationId)).size).toBe(400);
  expect(shown[0]).toBe(marks[0]);
  expect(shown.at(-1)).toBe(marks.at(-1));
  expect(shown.map((m) => m.step)).toEqual(shown.map((m) => m.step).sort((a, b) => a - b));
});

it('keeps a rare failure visible among quiet marks and preserves small recordings', () => {
  const marks: Marker[] = Array.from({ length: 2000 }, (_, i) => ({ step: i + 1, type: i === 777 ? 'fail' : 'turn', label: String(i) }));
  expect(sampleActivity(marks)).toContain(marks[777]);
  const small = marks.slice(0, 20);
  expect(sampleActivity(small)).toBe(small);
});
