import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Markdown } from '../src/lib/markdown.tsx';

const renderProse = (text: string) => renderToStaticMarkup(createElement(Markdown, { text, document: false }));
const renderDocument = (text: string) => renderToStaticMarkup(createElement(Markdown, { text, document: true }));

describe('UI-50: unified Markdown rendering across prose and cards', () => {
  describe('task lists (GFM)', () => {
    it('renders unchecked and checked task items with disabled checkboxes in prose', () => {
      const markdown = '- [ ] First task\n- [x] Second completed task\n- [X] Third completed task';
      const html = renderProse(markdown);
      expect(html).toContain('class="md-list md-task-list"');
      expect(html).toContain('class="md-task-item"');
      expect(html).toContain('class="md-task-item md-task-done"');
      expect(html).toContain('type="checkbox" class="md-task-check"');
      expect(html).toContain('aria-label="Incomplete task"');
      expect(html).toContain('aria-label="Completed task"');
      expect(html).toContain('checked=""');
      expect(html).toContain('First task');
      expect(html).toContain('Second completed task');
    });

    it('renders task items in document mode as well', () => {
      const markdown = '- [ ] Plan item 1\n- [x] Plan item 2 (done)';
      const html = renderDocument(markdown);
      expect(html).toContain('class="md-list md-task-list"');
      expect(html).toContain('class="md-task-item md-task-done"');
      expect(html).toContain('Plan item 2 (done)');
    });
  });

  describe('blockquotes in prose and documents', () => {
    it('renders blockquotes in prose without requiring document mode', () => {
      const markdown = '> Note: this is an important constraint.\n> Always verify with real sessions.';
      const html = renderProse(markdown);
      expect(html).toContain('<blockquote><p>Note: this is an important constraint. Always verify with real sessions.</p></blockquote>');
    });

    it('renders nested markdown inside blockquotes', () => {
      const markdown = '> Here is `code` and **bold** inside a quote.';
      const html = renderProse(markdown);
      expect(html).toContain('<blockquote><p>Here is <code>code</code> and <strong>bold</strong> inside a quote.</p></blockquote>');
    });
  });

  describe('horizontal rules in prose and documents', () => {
    it('renders <hr/> in prose mode for --- and ***', () => {
      const markdown1 = 'Section 1\n\n---\n\nSection 2';
      const html1 = renderProse(markdown1);
      expect(html1).toContain('<p>Section 1</p><hr/><p>Section 2</p>');

      const markdown2 = 'Above\n\n***\n\nBelow';
      const html2 = renderProse(markdown2);
      expect(html2).toContain('<p>Above</p><hr/><p>Below</p>');
    });
  });

  describe('HTML markup blocks in prose and documents', () => {
    it('renders raw HTML blocks as non-executable .md-html pre elements in prose', () => {
      const html = renderProse('<div class="warning">Do not interpret</div>');
      expect(html).toContain('<pre class="md-html">&lt;div class=&quot;warning&quot;&gt;Do not interpret&lt;/div&gt;</pre>');
      expect(html).not.toContain('<div class="warning">');
    });
  });

  describe('tables in prose and document mode', () => {
    it('renders tables with the same structure and scrolling container', () => {
      const table = '| Header A | Header B |\n| --- | --- |\n| val 1 | val 2 |';
      const proseHtml = renderProse(table);
      const docHtml = renderDocument(table);

      expect(proseHtml).toContain('class="md-table-scroll" role="region" aria-label="Markdown table" tabindex="0"');
      expect(docHtml).toContain('class="md-table-scroll" role="region" aria-label="Markdown table" tabindex="0"');
      expect(proseHtml).toContain('<table><thead><tr><th scope="col">Header A</th><th scope="col">Header B</th></tr></thead>');
      expect(docHtml).toContain('<table><thead><tr><th scope="col">Header A</th><th scope="col">Header B</th></tr></thead>');
    });
  });
});
