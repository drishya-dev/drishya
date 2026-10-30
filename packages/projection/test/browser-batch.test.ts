import { describe, it, expect } from 'vitest';
import { previewBatch, previewValue } from '../src/reduce.ts';

describe('browser batch input', () => {
  it('keeps every action\'s coordinates, which the ordinary bound would replace with a count', () => {
    const input = { actions: [{ name: 'computer', input: { action: 'left_click', coordinate: [100, 50], tabId: 7 } }, { name: 'computer', input: { action: 'left_click_drag', start_coordinate: [1, 2], coordinate: [3, 4] } }] };
    expect(JSON.stringify(previewValue(input))).toContain('[2 items]');
    expect(previewBatch(input)).toEqual(input);
  });

  it('keeps up to 200 actions, bounds the rest of the input like any other and leaves non-batches alone', () => {
    const actions = Array.from({ length: 250 }, (_, i) => ({ name: 'computer', input: { action: 'wait', duration: i } }));
    const kept = previewBatch({ actions, note: 'x'.repeat(900) }) as { actions: unknown[]; note: string };
    expect(kept.actions).toHaveLength(200);
    expect(kept.note.length).toBeLessThanOrEqual(600);
    expect(previewBatch('plain')).toBe('plain');
    expect(previewBatch({ other: 1 })).toEqual({ other: 1 });
  });
});
