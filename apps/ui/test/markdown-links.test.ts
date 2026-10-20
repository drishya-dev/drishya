import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it} from 'vitest';
import {Markdown} from '../src/lib/markdown.tsx';
import {prosePath} from '../src/lib/prose-path.ts';

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

it('resolves local file links and line anchors only inside their captured workspace',()=>{
  expect(prosePath('/C:/Work/App/src/file.ts:12:3','c:\\work\\app')).toEqual({path:'src/file.ts',line:12});
  expect(prosePath('C:\\Work\\App\\docs\\report (copy).md#L4-L9','C:/Work/App/')).toEqual({path:'docs/report (copy).md',line:4});
  expect(prosePath('/home/dev/app/src/file.ts#L28','/home/dev/app')).toEqual({path:'src/file.ts',line:28});
  expect(prosePath('./docs/研究.md')).toEqual({path:'docs/研究.md'});
  expect(prosePath('.gitignore')).toEqual({path:'.gitignore'});
  expect(prosePath('LICENSE')).toEqual({path:'LICENSE'});
  for(const target of ['https://host/file.ts','file:///C:/Work/App/a.ts','javascript:alert(1)','data:text/a.ts','//host/share/a.ts','../a.ts','src/../a.ts','src/a.ts?raw=1','npm test','C:relative.ts'])expect(prosePath(target,'C:/Work/App'),target).toBeUndefined();
  expect(prosePath('C:/Work/Application/a.ts','C:/Work/App')).toBeUndefined();
  expect(prosePath('/home/dev/App/a.ts','/home/dev/app')).toBeUndefined();
  expect(prosePath('/home/dev/app/a.ts')).toBeUndefined();
});

it('opens emphasis-wrapped local links with one semantic button and leaves external targets inert',()=>{
  const render=(text:string)=>renderToStaticMarkup(createElement(Markdown,{text,workspaceRoot:'C:/Work/App',onPath:()=>{}}));
  const output=render('**[source](/C:/Work/App/src/file.ts#L12)** and [`source.ts`](src/file.ts)');
  expect(output.match(/<button/g)).toHaveLength(2);
  expect(output).toContain('Open captured work for src/file.ts at line 12');
  expect(output).toContain('<code>source.ts</code></button>');
  expect(render('[other](C:/Elsewhere/secret.txt) [web](https://host/file.ts)')).not.toContain('<button');
  expect(render('`C:\\Work\\App\\src\\file.ts:12`')).toContain('Open captured work for src/file.ts at line 12');
});

it('retains workspace resolution through nested lists, headings and document quotes',()=>{
  const output=renderToStaticMarkup(createElement(Markdown,{text:'# [heading](/C:/Work/App/a.ts)\n\n- **[list](/C:/Work/App/b.ts)**\n\n> [quote](/C:/Work/App/c.ts)',workspaceRoot:'C:/Work/App',onPath:()=>{},document:true}));
  expect(output.match(/<button/g)).toHaveLength(3);
});
