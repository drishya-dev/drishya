import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it} from 'vitest';
import {Markdown} from '../src/lib/markdown.tsx';

const html=(text:string)=>renderToStaticMarkup(createElement(Markdown,{text}));

it('parses a link wrapped in bold or italic instead of showing its source',()=>{
  const bold=html('Saved in **[92-feature-value.md](/C:/Users/ASUS/Desktop/docs/92-feature-value.md)**.');
  expect(bold).toContain('<strong><span class="md-link" title="/C:/Users/ASUS/Desktop/docs/92-feature-value.md">92-feature-value.md</span></strong>');
  expect(bold).not.toContain('](');
  const italic=html('See *[notes](C:\\work\\notes.md)* now');
  expect(italic).toContain('<em><span class="md-link"');expect(italic).not.toContain('](');
});

it('keeps Windows drive paths and one level of parentheses inside a link target',()=>{
  expect(html('[a](C:\\Users\\me\\a.md)')).toContain('title="C:\\Users\\me\\a.md"');
  const copy=html('[copy](/docs/report (copy).md) tail');
  expect(copy).toContain('title="/docs/report (copy).md"');expect(copy).toContain('copy</span> tail');
});

it('still renders plain bold, code inside bold and unterminated markers as text',()=>{
  expect(html('**plain**')).toContain('<strong>plain</strong>');
  expect(html('**use `pnpm test`**')).toContain('<strong>use <code>pnpm test</code></strong>');
  expect(html('2 ** 3 and [x(y)')).toContain('2 ** 3 and [x(y)');
});
