import { describe, expect, it } from 'vitest';
import { langOf, tokenize } from '../src/lib/highlight.tsx';
describe('document material keeps prose readable and exact', () => {
  it('does not color ordinary document words as code and retains every character', () => {
    const lines = ['From the current state, return to review for the next release.', '# Review the `current()` code', '- [source](src/main.ts) · 42 lines', 'Use `for` in code, not in this sentence.'];
    for (const line of lines) expect(tokenize(line, langOf('README.md')).map(token => token.s).join('')).toBe(line);
    expect(tokenize(lines[0]!, 'md')).toEqual([{ t: 'plain', s: lines[0] }]);
    expect(tokenize('return 42; // current state', 'txt')).toEqual([{ t: 'plain', s: 'return 42; // current state' }]);
    expect(tokenize('return 42;', 'typescript').some(token => token.t === 'kw')).toBe(true);
  });
});
