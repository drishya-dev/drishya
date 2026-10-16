import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Highlighted, tokenize } from '../src/lib/highlight.tsx';

describe('captured command syntax', () => {
  it('keeps long wrapped here-string commands colored and character-exact', () => {
    const script = "@'\nfrom pathlib import Path\n" + 'project description '.repeat(180) + "\n'@ | python -";
    const line = `text(await tools.exec_command({cmd:${JSON.stringify(script)},max_output_tokens:500}));`;
    expect(line.length).toBeGreaterThan(2000);
    const tokens = tokenize(line, 'typescript');
    expect(tokens.map(token => token.s).join('')).toBe(line);
    expect(tokens.some(token => token.t === 'str' && token.s.includes("@'"))).toBe(true);
    expect(tokens.some(token => token.t === 'num' && token.s === '500')).toBe(true);
    expect(renderToStaticMarkup(createElement(Highlighted, { line, lang: 'typescript' }))).toContain('class="tk-str"');
  });

  it('colors scoped packages and decorators without swallowing subsequent syntax', () => {
    for (const [line, lang] of [
      ['npx --yes @openai/codex --version', 'shell'],
      ['@dataclass(frozen=True)', 'python'],
      ['@Injectable({providedIn: "root"})', 'typescript'],
      ["@'", 'shell'], ["'@ | python -", 'shell'],
    ]) {
      expect(tokenize(line!, lang).map(token => token.s).join('')).toBe(line);
    }
    expect(tokenize('npx @scope/package; return 42', 'shell')).toContainEqual({ t: 'property', s: '@scope/package' });
    expect(tokenize('@decorator; return 42', 'python')).toContainEqual({ t: 'kw', s: 'return' });
  });

  it('bounds spans for huge or malformed material while retaining every character', () => {
    for (const line of ['const value = "' + '\\"'.repeat(40000), 'const value = 42; '.repeat(10000)]) {
      const tokens = tokenize(line, 'typescript');
      expect(tokens.length).toBeLessThanOrEqual(512);
      expect(tokens.map(token => token.s).join('')).toBe(line);
      expect(tokens.some(token => token.t !== 'plain')).toBe(true);
    }
  });
});
