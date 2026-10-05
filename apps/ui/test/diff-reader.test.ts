import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DiffView } from '../src/components/common.tsx';

describe('paged captured diff', () => {
  it('keeps historical line numbers when rendering a later page', () => {
    const hunks = [{ oldStart: 1, newStart: 1, oldLines: 250, newLines: 250, lines: Array.from({ length: 250 }, (_, i) => ` line ${i + 1}`) }];
    const html = renderToStaticMarkup(createElement(DiffView, { hunks, skipLines: 120, maxLines: 120, path: 'example.ts' }));
    expect(html).toContain('class="ln-no">121</span>');
    expect(html).not.toContain('class="ln-no">120</span>');
    expect(html).not.toContain('class="ln-no">241</span>');
    expect(html).toContain('10 more lines');
  });
});
