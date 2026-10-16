import { describe,expect,it } from 'vitest';
import { WorkspaceDrafts,WORKSPACE_DRAFT_BYTES } from '../src/lib/workspace-drafts.ts';
const draft = {base:'original',text:'changed',modifiedAt:'2026-10-16T00:00:00Z'};
describe('bounded local workspace drafts',()=>{
 it('preserves an edited draft when a slower second pane finishes opening the same file',()=>{const store=new WorkspaceDrafts();store.create('a','file.ts',{...draft,text:draft.base});store.set('a','file.ts',draft);store.create('a','file.ts',{...draft,text:draft.base});expect(store.get('a','file.ts')).toEqual(draft);});
 it('isolates the same path in different sessions and preserves exact text',()=>{const store=new WorkspaceDrafts();store.set('a','file.ts',draft);expect(store.get('b','file.ts')).toBeUndefined();expect(store.get('a','file.ts')).toEqual(draft);});
 it('refuses overflow without silently truncating or evicting existing work',()=>{const store=new WorkspaceDrafts();for(let i=0;i<8;i++)store.set('session',`file${i}.ts`,draft);expect(()=>store.set('session','ninth.ts',draft)).toThrow('Eight drafts');expect(store.get('session','file0.ts')).toEqual(draft);store.discard('session','file0.ts');store.set('session','ninth.ts',draft);expect(store.get('session','ninth.ts')).toEqual(draft);});
 it('counts UTF-8 bytes for source and draft independently',()=>{const store=new WorkspaceDrafts();store.set('a','file.ts',draft);expect(()=>store.set('a','file.ts',{...draft,text:'🙂'.repeat(WORKSPACE_DRAFT_BYTES/4+1)})).toThrow('256 KiB');expect(()=>store.set('a','file.ts',{...draft,base:'x'.repeat(WORKSPACE_DRAFT_BYTES+1)})).toThrow('256 KiB');expect(store.get('a','file.ts')).toEqual(draft);});
});
