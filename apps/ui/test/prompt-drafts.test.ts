import { describe, expect, it } from 'vitest';
import { PromptDrafts, promptDrafts } from '../src/lib/prompt-drafts.ts';
describe('memory-only prompt drafts', () => {
  it('isolates session and source drafts and clears a submitted draft', () => {
    const first = {}, second = {};
    promptDrafts(first).set('a', 'one'); promptDrafts(first).set('b', 'two');
    expect(promptDrafts(first).get('a')).toBe('one');
    expect(promptDrafts(second).get('a')).toBe('');
    promptDrafts(first).set('a', '');
    expect(promptDrafts(first).get('a')).toBe('');
    expect(promptDrafts(first).get('b')).toBe('two');
  });
  it('retains at most eight bounded text drafts', () => {
    const drafts = new PromptDrafts();
    for (let n = 0; n < 9; n++) drafts.set(String(n), 'x'.repeat(70_000));
    expect(drafts.get('0')).toBe('');
    expect(drafts.get('8')).toHaveLength(65_536);
  });
});
