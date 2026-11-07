import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it} from 'vitest';
import {Markdown} from '../src/lib/markdown.tsx';
import {tableCells} from '../src/lib/markdown-table.ts';
const render=(text:string)=>renderToStaticMarkup(createElement(Markdown,{text,onPath:()=>{}}));
it('renders a narrow prose table after a paragraph with semantic headers',()=>{
 const html=render('Results\nName | Count\n--- | ---:\nAlpha | 2');
 expect(html).toContain('<p>Results</p>');expect(html).toContain('<table>');expect(html).toContain('scope="col"');expect(html).toContain('text-align:right');expect(html).toContain('<td>Alpha</td>');
});
it('contains wide tables in a keyboard-scrollable region and pads short rows',()=>{
 const text='| A | B | C | D | E | F |\n| --- | --- | --- | --- | --- | --- |\n| one | two |';
 const html=render(text);expect(html).toContain('aria-label="Markdown table" tabindex="0"');expect(html.match(/<th /g)).toHaveLength(6);expect(html.match(/<td[ >]/g)).toHaveLength(6);
});
it('keeps inline code, local links and safe web links functional inside cells',()=>{
 const html=render('| Code | Links |\n| --- | --- |\n| `x()` | [file](src/main.ts) [site](https://example.com) [bad](javascript:alert) |');
 expect(html).toContain('<code>x()</code>');expect(html).toContain('Open work on src/main.ts');expect(html).toContain('href="https://example.com"');expect(html).not.toContain('href="javascript:');
});
it('handles escaped pipes including code and even backslashes',()=>{
 expect(tableCells('| a\\|b | `x\\|y` |')).toEqual(['a|b','`x|y`']);
 expect(tableCells('| a\\\\| b |')).toEqual(['a\\\\','b']);
 const html=render('| A | B |\n| --- | --- |\n| x\\|y | `a\\|b` |');expect(html).toContain('x|y');expect(html).toContain('<code>a|b</code>');
});
it('keeps malformed table headers literal and fenced tables as code',()=>{
 for(const text of ['A | B\n--- | not-a-rule\none | two','A | B\n--- | --- | ---\none | two'])expect(render(text)).not.toContain('<table>');
 expect(render('```text\nA | B\n--- | ---\none | two\n```')).not.toContain('<table>');
});
