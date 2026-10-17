import { describe, expect, it } from 'vitest';
import { compareDraft } from '../src/lib/draft-comparison.ts';
import { applyHunks } from '../../../packages/projection/src/patch.ts';

describe('bounded local draft comparison', () => {
  it('preserves exact text through multiple edits, Unicode, tabs and line endings', () => {
    for (const [base, text] of [
      ['one\nkeep\nold\n', 'new\nkeep\nnext\n'],
      ['const दृश्य = "a";\r\n\treturn दृश्य;\r\n', 'const दृश्य = "b";\r\n\treturn दृश्य;\r\n'],
      ['', 'new file\n'], ['last newline\n', 'last newline'], ['last newline', 'last newline\n'],
    ]) {
      const result = compareDraft(base!, text!);
      expect(result.kind).toBe('patch');
      if (result.kind === 'patch') expect(applyHunks(base!, result.hunks)?.text).toBe(text);
    }
  });

  it('reports local additions and deletions without counting unchanged context', () => {
    const result = compareDraft('first\nold\nlast', 'first\nnew\nextra\nlast');
    expect(result).toMatchObject({ kind: 'patch', added: 2, removed: 1 });
    expect(compareDraft('unchanged\n', 'unchanged\n')).toMatchObject({ kind: 'patch', hunks: [], added: 0, removed: 0 });
  });

  it('keeps a small change in a long file as a patch but bounds unrelated comparisons', () => {
    const base = Array.from({ length: 1500 }, (_, i) => `base-${i}`).join('\n');
    const edited = base.replace('base-701', 'edited-701');
    expect(compareDraft(base, edited).kind).toBe('patch');
    const unrelated = Array.from({ length: 1500 }, (_, i) => `new-${i}`).join('\n');
    expect(compareDraft(base, unrelated)).toEqual({ kind: 'texts' });
    expect(compareDraft('x\n'.repeat(5000), 'changed')).toEqual({ kind: 'texts' });
  });
});
