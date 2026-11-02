import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it} from 'vitest';
import {Markdown} from '../src/lib/markdown.tsx';
import {useApp} from '../src/state.ts';
import {workingLocations} from '../../../packages/contracts/src/working-locations.ts';

it('exposes references as native keyboard buttons with exact line labels',()=>{
  const html=renderToStaticMarkup(createElement(Markdown,{text:'Inspect `src/actual.ts:250` and `src/My file.ts:3`.',onPath:()=>{}}));
  expect(html).toContain('type="button"');expect(html).toContain('Open work on src/actual.ts at line 250');expect(html).toContain('Open work on src/My file.ts at line 3');expect(html).toContain('<code>src/actual.ts:250</code>');
  expect(renderToStaticMarkup(createElement(Markdown,{text:'`src/actual.ts:250`'}))).not.toContain('<button');
});

it('clears a reference for ordinary file navigation and retains explicit reading-history targets',()=>{
  const before=useApp.getState();
  try {
    before.set({filePanel:'a.ts',filePanelLine:250});before.set({filePanel:'b.ts'});expect(useApp.getState().filePanelLine).toBeUndefined();
    before.set({filePanel:'a.ts',filePanelLine:250});before.set({filePanel:undefined});expect(useApp.getState().filePanelLine).toBeUndefined();
    before.set({filePanel:'a.ts',filePanelLine:300});expect(useApp.getState().filePanelLine).toBe(300);
  } finally {useApp.setState(before);}
});

it('persists only bounded positive line navigation metadata',()=>{
  const clean=(line:number)=>workingLocations({version:1,sessions:[{id:'rec_test',entries:[['location',{filePanel:'a.ts',filePanelLine:line}]]}]}).sessions[0]!.entries[0]![1] as Record<string,unknown>;
  expect(clean(250).filePanelLine).toBe(250);for(const line of [-1,0,2.5,1e10])expect(clean(line).filePanelLine).toBeUndefined();
});

it('renders native Codex file citations as safe file references, with recorded line ranges',()=>{
 const render=(text:string)=>renderToStaticMarkup(createElement(Markdown,{text,workspaceRoot:'C:/work/app',onPath:()=>{}}));
 const citation=':codex-file-citation{path="C:/work/app/docs/研究.md" purpose="output" line_range_start=12 line_range_end=18}';
 const shown=render('Saved '+citation+'.');
 expect(shown).toContain('Open work on docs/研究.md at line 12');expect(shown).toContain('<code>研究.md:12–18</code>');expect(shown).not.toContain(':codex-file-citation');
 const outside=render(':codex-file-citation{path="C:/other/file.txt" purpose="output"}');
 expect(outside).toContain('<code>file.txt</code>');expect(outside).not.toContain('<button');
 for(const path of ['javascript:alert(1)','https://host/file.ts','../file.ts'])expect(render(`:codex-file-citation{path="${path}"}`)).not.toContain('<button');
});
it('keeps citation examples in code literal and leaves malformed directives readable',()=>{
 const literal=':codex-file-citation{path="src/a.ts" purpose="input"}';
 const render=(text:string)=>renderToStaticMarkup(createElement(Markdown,{text,onPath:()=>{}}));
 expect(render('`'+literal+'`')).toContain(':codex-file-citation');
 expect(render('```text\n'+literal+'\n```')).toContain(':codex-file-citation');
 expect(render(':codex-file-citation{purpose="output"}')).toContain(':codex-file-citation');
 expect(render('**'+literal+'**')).toContain('<strong><button');
});
