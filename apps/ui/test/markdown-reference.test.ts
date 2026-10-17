import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it} from 'vitest';
import {Markdown} from '../src/lib/markdown.tsx';
import {useApp} from '../src/state.ts';
import {workingLocations} from '../../../packages/contracts/src/working-locations.ts';

it('exposes captured references as native keyboard buttons with exact line labels',()=>{
  const html=renderToStaticMarkup(createElement(Markdown,{text:'Inspect `src/actual.ts:250` and `src/My file.ts:3`.',onPath:()=>{}}));
  expect(html).toContain('type="button"');expect(html).toContain('Open captured work for src/actual.ts at line 250');expect(html).toContain('Open captured work for src/My file.ts at line 3');expect(html).toContain('<code>src/actual.ts:250</code>');
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
