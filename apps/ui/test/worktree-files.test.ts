import {describe,it,expect} from 'vitest';
import {worktreeFileRows,workspaceFileReveal,WORKTREE_GROUP,UNPLACED_GROUP,currentWorkspacePath,canonicalFileFolders} from '../src/lib/worktree-files.ts';
const roots=[{root:'C:\\repo',prefix:'worktree-main'},{root:'C:\\agents\\worker',prefix:'worktree-child'}];
const paths=['worktree-child/src/a.ts','worktree-main/src/a.ts','worktree-main/README.md'];

describe('active Workspace file reveal',()=>{
  const placement={indexed:new Set(['src/deep/a.ts','README.md']),direct:new Set(paths)};
  it('reveals nested and repository-root files with their actual ancestor keys',()=>{
    expect(workspaceFileReveal('src/deep/a.ts',['src/deep/a.ts'],roots,'C:/repo',placement)).toEqual({path:'src/deep/a.ts',ancestors:['','src/deep','src']});
    expect(workspaceFileReveal('README.md',['README.md'],roots,'C:/repo',placement)).toEqual({path:'README.md',ancestors:['']});
  });
  it('selects the displayed captured primary alias rather than its hidden indexed duplicate',()=>{
    const all=['src/a.ts',...paths];
    expect(workspaceFileReveal('src/a.ts',all,roots,'C:/repo',placement)).toEqual({path:'worktree-main/src/a.ts',ancestors:['','src']});
    expect(workspaceFileReveal('worktree-main/src/a.ts',all,roots,'C:/repo',placement)?.path).toBe('worktree-main/src/a.ts');
  });
  it('retains an explicit primary URL origin and never substitutes a sibling with the same filename',()=>{
    const alias={root:'C:/repo',recordedRoot:'file:///C:/repo',prefix:'url'};
    const all=[...paths,'url/src/a.ts'];
    const direct={...placement,direct:new Set(all)};
    expect(workspaceFileReveal('src/a.ts',all,[...roots,alias],'C:/repo',direct,'url/src/a.ts')?.path).toBe('url/src/a.ts');
    expect(workspaceFileReveal('src/a.ts',['worktree-child/src/a.ts'],roots,'C:/repo',placement)).toBeUndefined();
    expect(workspaceFileReveal('worktree-child/src/a.ts',all,roots,'C:/repo',direct)).toEqual({path:'worktree-child/src/a.ts',ancestors:['','worktree-child/src','worktree-child',WORKTREE_GROUP]});
  });
  it('distinguishes same-named roots by exact directory identity',()=>{
    const roots=[{root:'C:/main/repo',prefix:'primary'},{root:'C:/other/repo',prefix:'secondary'}];
    const paths=['src/a.ts','primary/src/a.ts','secondary/src/a.ts'];
    const placement={indexed:new Set(['src/a.ts']),direct:new Set(paths.slice(1))};
    expect(workspaceFileReveal('src/a.ts',paths,roots,'C:/main/repo',placement)?.path).toBe('primary/src/a.ts');
    expect(workspaceFileReveal('secondary/src/a.ts',paths,roots,'C:/main/repo',placement)).toEqual({path:'secondary/src/a.ts',ancestors:['','secondary/src','secondary',WORKTREE_GROUP]});
    expect(workspaceFileReveal('src/a.ts',paths,roots,'C:/other/repo',placement)?.path).toBe('secondary/src/a.ts');
  });
  it('keeps unresolved paths in their honest group and finishes placement when exact roots arrive',()=>{
    const path='worktree-0123456789/src/a.ts',direct={indexed:new Set<string>(),direct:new Set([path])};
    expect(workspaceFileReveal(path,[path],[],'C:/repo',direct)).toEqual({path:UNPLACED_GROUP,ancestors:['',UNPLACED_GROUP]});
    expect(workspaceFileReveal(path,[path],[{root:'C:/worker',prefix:'worktree-0123456789'}],'C:/repo',direct)).toEqual({path,ancestors:['','worktree-0123456789/src','worktree-0123456789',WORKTREE_GROUP]});
    expect(workspaceFileReveal('/unknown/file.ts',['/unknown/file.ts'],[],'C:/repo',{indexed:new Set(),direct:new Set()} )?.path).toBe(UNPLACED_GROUP);
  });
  it('reveals local creation drafts without claiming captured evidence',()=>{
    const path='new/deep/draft.ts';
    expect(workspaceFileReveal(path,[path],[],'C:/repo',{indexed:new Set([path]),direct:new Set()})).toEqual({path,ancestors:['','new/deep','new']});
  });
  it('reveals only the exact nested cwd root for a suppressed primary-inventory path',()=>{
    const nested={root:'C:/repo/.local/worker',prefix:'nested'},path='.local/worker/src/a.ts';
    const reveal=workspaceFileReveal(path,[path,'nested/src/a.ts'],[...roots,nested],'C:/repo',{indexed:new Set([path]),direct:new Set(['nested/src/a.ts'])});
    expect(reveal).toEqual({path:'nested',ancestors:['',WORKTREE_GROUP]});
  });
});
describe('recorded worktree file display',()=>{
  it('opens the workspace first and keeps only known non-main roots in one closed group',()=>{
    const rows=worktreeFileRows(paths,roots,'c:/REPO',new Set(['']));
    expect(rows.map(r=>r.name)).toEqual(['src','README.md','Other working directories']);
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
  it('keeps exact main-root current reading inside its existing approval boundary',()=>{
    expect(currentWorkspacePath('worktree-main/src/a.ts',roots,'c:/repo')).toBe('src/a.ts');
    expect(currentWorkspacePath('worktree-child/src/a.ts',roots,'C:/repo')).toBeUndefined();
    expect(currentWorkspacePath('worktree-main/src/a.ts',roots,undefined)).toBeUndefined();
    expect(currentWorkspacePath('src/a.ts',roots,'C:/repo')).toBe('src/a.ts');
  });
  it('keeps distinct recorded prefixes for a local file URL alias of the main root',()=>{
    const alias={root:'C:/repo',recordedRoot:'file:///C:/repo',prefix:'worktree-url'};
    const rows=worktreeFileRows(['worktree-main/a.ts','worktree-url/a.ts'],[...roots,alias],'C:/repo',new Set(['']));
    expect(rows.map(row=>row.path)).toEqual(['worktree-main/a.ts','worktree-url/a.ts']);
    expect(rows.some(row=>row.worktree)).toBe(false);
    expect(currentWorkspacePath('worktree-url/a.ts',[alias],'C:/repo')).toBe('a.ts');
  });
  it('does not reveal a future or empty root without a matching visible file',()=>{
    const rows=worktreeFileRows(['worktree-main/README.md'],roots,'C:/repo',new Set(['',WORKTREE_GROUP]));
    expect(rows.map(row=>row.name)).toEqual(['README.md']);
  });
});


describe('evidenced repository placement',()=>{
  it('keeps search-only basenames outside the repository until their location is confirmed',()=>{
    const paths=['App.tsx','apps/ui/src/App.tsx','README.md'];
    const placement={indexed:new Set(['apps/ui/src/App.tsx','README.md']),direct:new Set<string>()};
    const rows=worktreeFileRows(paths,[],'C:/repo',new Set(['',UNPLACED_GROUP]),'',placement);
    expect(rows.filter(row=>row.parent===''&&!row.folder).map(row=>row.path)).toEqual(['README.md']);
    expect(rows.find(row=>row.path==='App.tsx')).toMatchObject({parent:UNPLACED_GROUP,unplaced:true});
    expect(rows.find(row=>row.path==='App.tsx')?.location).toBeUndefined();
  });
  it('keeps direct read/write evidence in its recorded directory before inventory consent',()=>{
    const rows=worktreeFileRows(['src/a.ts'],[],'C:/repo',new Set(['','src']),'',{indexed:new Set(),direct:new Set(['src/a.ts'])});
    expect(rows.filter(row=>!row.folder).map(row=>row.path)).toEqual(['src/a.ts']);
    expect(rows.some(row=>row.unplaced)).toBe(false);
  });
  it('does not guess a directory from a unique indexed basename',()=>{
    const rows=worktreeFileRows(['App.tsx'],[],'C:/repo',new Set(['',UNPLACED_GROUP]),'App',{indexed:new Set(['apps/ui/src/App.tsx']),direct:new Set()});
    expect(rows).toMatchObject([{path:'App.tsx',unplaced:true}]);
  });
  it('never displays an unresolved worktree namespace as a repository folder while roots load',()=>{
    const path='worktree-0123456789/a.ts';
    const rows=worktreeFileRows([path],[],'C:/repo',new Set(['',UNPLACED_GROUP]),'',{indexed:new Set(),direct:new Set([path])});
    expect(rows.map(row=>row.name)).toEqual(['Unplaced paths',path]);
    expect(rows[1]).toMatchObject({path,unplaced:true});
  });
  it('retains main folder expansion and exact leaf identities when a second working directory arrives',()=>{
    const before=worktreeFileRows(['src/a.ts'],[],'C:/repo',new Set(['','src']),'',{indexed:new Set(),direct:new Set(['src/a.ts'])});
    const after=worktreeFileRows(['worktree-main/src/a.ts','worktree-child/src/a.ts'],roots,'C:/repo',new Set(['','src']),'',{indexed:new Set(),direct:new Set(['worktree-main/src/a.ts','worktree-child/src/a.ts'])});
    expect(before[0]?.path).toBe('src');expect(after[0]?.path).toBe('src');
    expect(after[1]?.path).toBe('worktree-main/src/a.ts');expect(after[1]?.parent).toBe('src');
  });
  it('does not duplicate an indexed file with its main-root captured identity',()=>{
    const path='worktree-main/src/a.ts';
    const rows=worktreeFileRows(['src/a.ts',path],roots,'C:/repo',new Set(['','src']),'',{indexed:new Set(['src/a.ts']),direct:new Set([path])});
    expect(rows.filter(row=>!row.folder).map(row=>row.path)).toEqual([path]);
  });
  it('gives same-named native worktrees stable distinct labels without branch guesses',()=>{
    const more=[{root:'C:/repo',prefix:'main'},{root:'C:/Users/u/.codex/worktrees/alpha/drishya',prefix:'a'},{root:'C:/Users/u/.codex/worktrees/beta/drishya',prefix:'b'},{root:'C:/Users/u/.codex/worktrees/gamma/drishya',prefix:'c'}];
    const paths=['a/read.ts','b/read.ts','c/read.ts'],opened=new Set(['',WORKTREE_GROUP]);
    const label=(rows:ReturnType<typeof worktreeFileRows>)=>rows.filter(row=>row.parent===WORKTREE_GROUP).map(row=>({path:row.path,name:row.name,location:row.location}));
    const before=label(worktreeFileRows(paths.slice(0,2),more.slice(0,3),'C:/repo',opened));
    const after=label(worktreeFileRows(paths,more,'C:/repo',opened));
    expect(after.map(row=>row.name)).toEqual(['alpha/drishya','beta/drishya','gamma/drishya']);
    expect(after.slice(0,2)).toEqual(before);expect(after[0]?.location).toBe(more[1]?.root);
  });
});

it('does not confuse identical worktree names from different harness directories',()=>{
 const roots=[{root:'C:/repo',prefix:'main'},{root:'C:/u/.codex/worktrees/alpha/drishya',prefix:'codex'},{root:'C:/u/.claude/worktrees/alpha/drishya',prefix:'claude'}];
 const rows=worktreeFileRows(['codex/a.ts','claude/a.ts'],roots,'C:/repo',new Set(['',WORKTREE_GROUP]));
 const labels=rows.filter(row=>row.parent===WORKTREE_GROUP).map(row=>row.name);
 expect(new Set(labels).size).toBe(2);expect(labels).toEqual(roots.slice(1).map(root=>root.root));
});

it('migrates retained old main folder keys once and leaves other worktrees open',()=>{
 const before=new Set(['','worktree-main/src','worktree-child/src',WORKTREE_GROUP]);
 const after=canonicalFileFolders(before,roots,'C:/repo');
 expect(after).toEqual(new Set(['','src','worktree-child/src',WORKTREE_GROUP]));
 expect(before.has('worktree-main/src')).toBe(true);
 expect(canonicalFileFolders(after,roots,'C:/repo')).toBe(after);
 expect(canonicalFileFolders(before,roots,undefined)).toBe(before);
});

it('hides primary inventory descendants of an exact captured nested root while retaining its exact leaves',()=>{
 const nested={root:'C:/repo/.local/wt-docs',prefix:'worktree-nested'};
 const allRoots=[...roots,nested],leaf='worktree-nested/docs/TASKS.md';
 const inventory='.local/wt-docs/docs/TASKS.md';
 const rows=worktreeFileRows([inventory,'worktree-main/'+inventory,leaf,'docs/TASKS.md'],allRoots,'C:/repo',new Set(['','docs','.local','.local/wt-docs','.local/wt-docs/docs',WORKTREE_GROUP,nested.prefix,nested.prefix+'/docs']),'',{indexed:new Set([inventory,'docs/TASKS.md']),direct:new Set([leaf])});
 expect(rows.some(row=>row.path===inventory||row.path==='worktree-main/'+inventory||row.name==='.local')).toBe(false);
 expect(rows.filter(row=>!row.folder).map(row=>row.path)).toEqual(['docs/TASKS.md',leaf]);
 expect(rows.find(row=>row.path===leaf)).toMatchObject({parent:nested.prefix+'/docs',location:nested.root+'/docs/TASKS.md'});
 expect(worktreeFileRows([inventory,leaf],allRoots,'C:/repo',new Set(['']),'TASKS').map(row=>row.path)).toEqual([leaf]);
});

it('keeps sibling collisions, nested root names and primary URL aliases separate',()=>{
 const allRoots=[...roots,{root:'C:/repo/.local/wt-docs',prefix:'nested'},{root:'C:/sibling/wt-docs',prefix:'sibling'},{root:'C:/repo',recordedRoot:'file:///C:/repo',prefix:'alias'}];
 const paths=['nested/docs/TASKS.md','sibling/docs/TASKS.md','alias/docs/TASKS.md'];
 const rows=worktreeFileRows(paths,allRoots,'C:/repo',new Set(['',WORKTREE_GROUP,'alias/docs','nested','nested/docs','sibling','sibling/docs']));
 expect(rows.filter(row=>!row.folder).map(row=>row.path)).toEqual(['alias/docs/TASKS.md','nested/docs/TASKS.md','sibling/docs/TASKS.md']);
 expect(new Set(rows.filter(row=>row.parent===WORKTREE_GROUP).map(row=>row.name)).size).toBe(2);
});
