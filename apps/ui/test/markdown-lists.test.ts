import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it} from 'vitest';
import {Markdown} from '../src/lib/markdown.tsx';

const render=(text:string)=>renderToStaticMarkup(createElement(Markdown,{text,document:true}));

it('preserves nested list types, starting numbers and explicit discontinuities',()=>{
  const html=render('3. Inspect source\n   - Read file\n   - Check imports\n     7. Follow dependency\n     8. Inspect callers\n8. Verify result\n- Independent note\n+ Another note');
  expect(html).toContain('<ol class="md-list" start="3"><li><p>Inspect source</p><ul');
  expect(html).toContain('<ol class="md-list" start="7"><li><p>Follow dependency</p></li><li><p>Inspect callers</p></li></ol>');
  expect(html).toContain('<li value="8"><p>Verify result</p></li></ol><ul');
  expect(html).toContain('<p>Independent note</p></li><li><p>Another note</p>');
});

it('retains multi-paragraph items and code without interpreting code as steps',()=>{
  const html=render('2) First paragraph\n   continued here\n\n   Another paragraph\n\n   ```text\n   9. literal code\n   - not an item\n   ```\n3) Next step\n\nOutside paragraph');
  expect(html).toContain('<p>First paragraph continued here</p><p>Another paragraph</p>');
  expect(html).toContain('9. literal code');
  expect(html).toContain('- not an item');
  expect(html.match(/<li[ >]/g)).toHaveLength(2);
  expect(html).toContain('</ol><p>Outside paragraph</p>');
});

it('preserves nested document headings and quotes and escapes unsafe markup',()=>{
  const html=render('- Parent\n  > ### Nested title\n  > <script>unsafe</script>\n- End');
  expect(html).toContain('<blockquote><h3>Nested title</h3><pre class="md-html">&lt;script&gt;unsafe&lt;/script&gt;</pre></blockquote>');
  expect(html).not.toContain('<script>');
});

it('sets a bold-only line as a section lead and leaves bold lead-ins inside sentences as paragraphs',()=>{
  const html=render('**What I did**\n\nIt is small.\n\n**Left to do:**\n\n**Warm text:** cream, not white.');
  expect(html).toContain('<p class="md-lead"><strong>What I did</strong></p><p>It is small.</p>');
  expect(html).toContain('<p class="md-lead"><strong>Left to do:</strong></p>');
  expect(html).toContain('<p><strong>Warm text:</strong> cream, not white.</p>');
});

it('bounds nesting while retaining deeply nested text',()=>{
  const html=render(Array.from({length:100},(_,i)=>`${'  '.repeat(i)}- item ${i}`).join('\n'));
  expect(html.match(/class="md-list"/g)!.length).toBeLessThanOrEqual(32);
  expect(html).toContain('item 99');
});
