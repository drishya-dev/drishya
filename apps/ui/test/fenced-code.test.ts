import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FencedCode } from '../src/components/FencedCode.tsx';
import { tokenize } from '../src/lib/highlight.tsx';

const renderBlock = (text: string, language: string) =>
  renderToStaticMarkup(createElement(FencedCode, { text, language }));

describe('FencedCode and honest syntax highlighting', () => {
  it('never colors text, txt, plaintext, unlabelled or unknown languages', () => {
    const sample = '9. return const value = "text" from import 42\nGet-ChildItem -Path src';
    for (const lang of ['', 'text', 'txt', 'plaintext']) {
      const html = renderBlock(sample, lang);
      expect(html, `lang=${lang}`).not.toContain('class="tk-');
      expect(html, `lang=${lang}`).toContain('md-code-text code-wrap');
      expect(html, `lang=${lang}`).toContain('aria-pressed="true"');
      expect(html, `lang=${lang}`).toContain('Copy as one line');
    }
    expect(renderBlock('single line note', 'text')).not.toContain('Copy as one line');

    for (const unknown of ['latex', 'csv', 'mermaid', 'fortran']) {
      const html = renderBlock('\\section{Intro}\nconst a = 42, "return"', unknown);
      expect(html, `unknown=${unknown}`).not.toContain('class="tk-');
      expect(html, `unknown=${unknown}`).toContain('code-nowrap');
      expect(html, `unknown=${unknown}`).toContain('aria-pressed="false"');
      expect(html, `unknown=${unknown}`).not.toContain('Copy as one line');
      expect(html, `unknown=${unknown}`).toContain(`<span class="fenced-language">${unknown}</span>`);
    }
  });

  it('highlights JSON keys distinctly from string values and preserves scalars', () => {
    const line = '  "name": "drishya", "count": 42, "ok": true, "extra": null';
    const tokens = tokenize(line, 'json');
    expect(tokens.map(t => t.s).join('')).toBe(line);
    expect(tokens).toContainEqual({ t: 'property', s: '"name"' });
    expect(tokens).toContainEqual({ t: 'str', s: '"drishya"' });
    expect(tokens).toContainEqual({ t: 'property', s: '"count"' });
    expect(tokens).toContainEqual({ t: 'num', s: '42' });
    expect(tokens).toContainEqual({ t: 'kw', s: 'true' });
    expect(tokens).toContainEqual({ t: 'kw', s: 'null' });

    const html = renderBlock('{\n' + line + '\n}', 'json');
    expect(html).toContain('class="tk-property">&quot;name&quot;');
    expect(html).toContain('class="tk-str">&quot;drishya&quot;');
    expect(html).toContain('code-nowrap');
  });

  it('reads shell prompts and commands as commands across bash and powershell', () => {
    const bash = '$ corepack pnpm --filter @drishya/ui test README.md # run suite';
    const bashTokens = tokenize(bash, 'bash');
    expect(bashTokens.map(t => t.s).join('')).toBe(bash);
    expect(bashTokens).toContainEqual({ t: 'com', s: '$' });
    expect(bashTokens).toContainEqual({ t: 'fn', s: 'corepack' });
    expect(bashTokens).toContainEqual({ t: 'fn', s: 'pnpm' });
    expect(bashTokens).toContainEqual({ t: 'property', s: '--filter' });
    expect(bashTokens).toContainEqual({ t: 'property', s: '@drishya/ui' });
    expect(bashTokens).toContainEqual({ t: 'com', s: '# run suite' });
    expect(bashTokens.some(t => t.t === 'type')).toBe(false);

    const pipe = 'FOO=bar ls -la | grep "ready"';
    const pipeTokens = tokenize(pipe, 'sh');
    expect(pipeTokens.map(t => t.s).join('')).toBe(pipe);
    expect(pipeTokens).toContainEqual({ t: 'property', s: 'FOO' });
    expect(pipeTokens).toContainEqual({ t: 'fn', s: 'ls' });
    expect(pipeTokens).toContainEqual({ t: 'property', s: '-la' });
    expect(pipeTokens).toContainEqual({ t: 'fn', s: 'grep' });
    expect(pipeTokens).toContainEqual({ t: 'str', s: '"ready"' });

    const ps = 'PS C:\\repo> Get-ChildItem -Path src | Select-String "test"';
    const psTokens = tokenize(ps, 'powershell');
    expect(psTokens.map(t => t.s).join('')).toBe(ps);
    expect(psTokens).toContainEqual({ t: 'com', s: 'PS C:\\repo>' });
    expect(psTokens).toContainEqual({ t: 'fn', s: 'Get-ChildItem' });
    expect(psTokens).toContainEqual({ t: 'property', s: '-Path' });
    expect(psTokens).toContainEqual({ t: 'fn', s: 'Select-String' });
    expect(psTokens).toContainEqual({ t: 'str', s: '"test"' });

    const cpp = 'g++ -std=c++17 main.cpp -o main && ./main';
    const cppTokens = tokenize(cpp, 'bash');
    expect(cppTokens.map(t => t.s).join('')).toBe(cpp);
    expect(cppTokens).toContainEqual({ t: 'fn', s: 'g++' });
    expect(cppTokens).toContainEqual({ t: 'property', s: '-std' });
    expect(cppTokens).toContainEqual({ t: 'fn', s: './main' });

    const html = renderBlock(`${bash}\n${ps}`, 'bash');
    expect(html).toContain('class="tk-com">$</span>');
    expect(html).toContain('class="tk-fn">corepack</span>');
  });

  it('marks diff headers, hunks, additions and removals cleanly without JS leakage', () => {
    const patch = [
      'diff --git a/src/app.ts b/src/app.ts',
      '--- a/src/app.ts',
      '+++ b/src/app.ts',
      '@@ -1,3 +1,3 @@ export function demo()',
      '-return "old";',
      '+return "new";',
      ' const stay = 1;',
    ].join('\n');

    for (const line of patch.split('\n')) {
      expect(tokenize(line, 'diff').map(t => t.s).join('')).toBe(line);
    }
    const html = renderBlock(patch, 'diff');
    expect(html).toContain('md-code-diff');
    expect(html).toContain('fenced-diff-meta');
    expect(html).toContain('fenced-diff-hunk');
    expect(html).toContain('fenced-diff-del');
    expect(html).toContain('fenced-diff-add');
    expect(html).toContain('class="tk-property">@@ -1,3 +1,3 @@');
    expect(html).not.toContain('class="tk-num">1</span>');
  });
});
