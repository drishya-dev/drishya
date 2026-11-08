import{describe,expect,it}from'vitest';
import{createElement}from'react';import{renderToStaticMarkup}from'react-dom/server';
import{proseFileIndex}from'../src/lib/prose-file-index.ts';
import{ProseFiles}from'../src/components/ProseFiles.tsx';import{Markdown}from'../src/lib/markdown.tsx';
const files=[{path:'docs/README.md',captured:true},{path:'src/main.ts',captured:true},{path:'C:/outside/report.txt',captured:true},{path:'src/current.ts',captured:false}];
const index=proseFileIndex(files,'C:/repo');
describe('evidence-backed prose files',()=>{
 it('resolves exact paths, unique names, drive/file URLs and line locations without probing disk',()=>{
  for(const name of ['docs/README.md','README.md','C:\\repo\\docs\\README.md','file:///C:/repo/docs/README.md'])expect(index.resolve(name)).toMatchObject({path:'docs/README.md',folder:false,captured:true});
  expect(index.resolve('report.txt')).toMatchObject({path:'C:/outside/report.txt'});
  expect(index.resolve('src/main.ts#L12-L14')).toMatchObject({path:'src/main.ts',line:12});
  expect(index.resolve('src/current.ts')).toMatchObject({captured:false});
  for(const unknown of ['unknown.md','../README.md','C:/other/main.ts','https://host/src/main.ts','javascript:main.ts','\\\\server\\report.txt'])expect(index.resolve(unknown)).toBeUndefined();
 });
 it('does not guess ambiguous basenames or directories outside the tree',()=>{
  const ambiguous=proseFileIndex([...files,{path:'other/README.md',captured:true}],'C:/repo');
  expect(ambiguous.resolve('README.md')).toBeUndefined();expect(ambiguous.resolve('docs/README.md')).toBeDefined();
  expect(ambiguous.resolve('docs')).toMatchObject({path:'docs',folder:true});expect(ambiguous.resolve('C:/outside')).toBeUndefined();
 });
 it('maps only evidenced worktree roots, preserving the captured identity',()=>{
  const tree=proseFileIndex([{path:'worktree-0123456789/research/results/a.txt',captured:true}],'C:/repo',[{prefix:'worktree-0123456789',root:'C:/different'}]);
  expect(tree.resolve('C:/different/research/results/a.txt')).toMatchObject({path:'worktree-0123456789/research/results/a.txt'});
  expect(tree.resolve('research/results')).toMatchObject({path:'worktree-0123456789/research/results',folder:true});
 });
 it('deduplicates the current tree and captured main-worktree identity without making unique names ambiguous',()=>{
  const tree=proseFileIndex([{path:'docs/a.md',captured:false},{path:'worktree-0123456789/docs/a.md',captured:true}],'C:/repo',[{prefix:'worktree-0123456789',root:'C:/repo'}]);
  for(const name of ['a.md','docs/a.md','C:/repo/docs/a.md'])expect(tree.resolve(name)).toMatchObject({path:'worktree-0123456789/docs/a.md',captured:true});
 });
 it('renders file icons for bare, inline and Markdown references, while commands, fences, unknown names and text stay literal',()=>{
  const text='README.md, `src/main.ts` and [report](C:/outside/report.txt). unknown.md stays.\n\n```sh\ncat README.md\n```';
  const html=renderToStaticMarkup(createElement(ProseFiles.Provider,{value:{...index,open:()=>{}}},createElement(Markdown,{text,onPath:()=>{}})));
  expect((html.match(/class="md-path md-link"/g)??[])).toHaveLength(3);expect((html.match(/class="file-format/g)??[])).toHaveLength(3);
  expect(html).toContain('unknown.md stays.');expect(html.replace(/<[^>]*>/g,'')).toContain('cat README.md');expect(html).not.toContain('Open work on unknown.md');
  const document=renderToStaticMarkup(createElement(ProseFiles.Provider,{value:{...index,open:()=>{}}},createElement(Markdown,{text:'README.md',document:true})));
  expect(document).not.toContain('md-path');
 });
});
