import { describe, expect, it } from 'vitest';
import { failurePreview } from '../src/lib/failure-preview.ts';

describe('captured failure excerpt', () => {
  it('surfaces a buried error without rewriting it or showing the entire log', () => {
    const lines = [...Array.from({ length: 40 }, (_, n) => `build step ${n}`), 'TypeError: cannot read cart.total', '  at checkout.ts:42', ...Array(12).fill('cleanup')];
    const selected = failurePreview(lines.join('\n'))!;
    expect(selected.start).toBe(40);
    expect(selected.text).toContain('TypeError: cannot read cart.total');
    expect(selected.text).toContain('checkout.ts:42');
    expect(selected.text.split('\n').length).toBeLessThanOrEqual(6);
    expect(selected.text).toBe(lines.slice(selected.start - 1, selected.end).join('\n'));
  });
  it('does not create a diagnosis when no recognizable error is exposed', () => {
    expect(failurePreview('process exited\nno further output')).toBeUndefined();
  });
});
