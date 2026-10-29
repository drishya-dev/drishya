import {describe,it,expect} from 'vitest';
import {worktreeFileRows,WORKTREE_GROUP} from '../src/lib/worktree-files.ts';
const roots=[{root:'C:\\repo',prefix:'worktree-main'},{root:'C:\\agents\\worker',prefix:'worktree-child'}];
const paths=['worktree-child/src/a.ts','worktree-main/src/a.ts','worktree-main/README.md'];
describe('recorded worktree file display',()=>{
  it('opens the workspace first and keeps only known non-main roots in one closed group',()=>{
    const rows=worktreeFileRows(paths,roots,'c:/REPO',new Set(['']));
    expect(rows.map(r=>r.name)).toEqual(['src','README.md','Agent worktrees']);
    expect(rows[0]?.path).toBe('worktree-main/src');
  });
  it('retains exact leaf identities and locations when opening groups',()=>{
    const rows=worktreeFileRows(paths,roots,'C:/repo',new Set(['',WORKTREE_GROUP,'worktree-child','worktree-child/src','worktree-main/src']));
    expect(rows.filter(r=>!r.folder).map(r=>r.path)).toEqual(['worktree-main/src/a.ts','worktree-main/README.md','worktree-child/src/a.ts']);
    expect(rows.at(-1)?.location).toBe('C:\\agents\\worker/src/a.ts');
    expect(rows.at(-1)?.parent).toBe('worktree-child/src');
  });
  it('searches both roots regardless of collapsed state without merging same filenames',()=>{
    const rows=worktreeFileRows(paths,roots,'C:/repo',new Set(['']),'a.ts');
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map(r=>r.path)).size).toBe(2);
    expect(rows.every(r=>r.location)).toBe(true);
  });
  it('does not infer roots from folder names or unknown synthetic prefixes',()=>{
    const rows=worktreeFileRows(['.codex/worktrees/unrecorded/a.ts','worktree-unknown/a.ts'],roots,'C:/repo',new Set(['']));
    expect(rows.map(r=>r.name)).toEqual(['.codex','worktree-unknown']);
    expect(rows.some(r=>r.worktree)).toBe(false);
  });
});

