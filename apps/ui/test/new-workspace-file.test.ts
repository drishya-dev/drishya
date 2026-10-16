import {expect,it} from 'vitest';
import {newWorkspacePath} from '../src/lib/new-workspace-file.ts';
it('accepts relative new file proposals and refuses existing, protected and escaping paths',()=>{
  expect(newWorkspacePath('src/new-file.ts',[])).toBe('src/new-file.ts');
  for(const path of ['../out.ts','C:/out.ts','/out.ts','.git/config','.env','src//file.ts','src\\file.ts','.local/private.ts','src/\0file.ts'])expect(()=>newWorkspacePath(path,[])).toThrow();
  expect(()=>newWorkspacePath('SRC/FILE.ts',['src/file.ts'])).toThrow('already exists');
});
