import { describe, expect, it } from 'vitest';
import { tokenizeFreshCode } from '../src/fresh/CodeTokens.tsx';
describe('fresh source material preserves captured characters', () => {
  it('preserves escapes, whitespace, diff prefixes, unicode and markup as literal source', () => {
    for (const text of ['+ const name = "दृश्य 👁️"; // source', '  return "a\\\"b";\t', '<script>window.bad()</script>', 'value = `literal ${value}`', 'a\r\nb', '', '    # original comment', '- if (before !== after) return false;']) {
      expect(tokenizeFreshCode(text).map(token => token.text).join('')).toBe(text);
    }
  });
  it('keeps keyword-looking content inside a string or comment in that lexical span', () => {
    const tokens = tokenizeFreshCode('const text = "return await class"; // import type');
    expect(tokens.find(token => token.kind === 'string')?.text).toBe('"return await class"');
    expect(tokens.find(token => token.kind === 'comment')?.text).toBe('// import type');
  });
});
