export interface RecordedFileRoot { root: string; prefix: string; recordedRoot?:string }
export interface FileTreeRow { path: string; folder: boolean; depth: number; name: string; parent: string; location?: string; worktree?: boolean }
export const WORKTREE_GROUP = '\u0000recorded-worktrees';
const normalize = (value: string) => {
  const path = value.replace(/\\/g, '/').replace(/\/+$/, '');
  return /^[a-z]:\//i.test(path) ? path.toLowerCase() : path;
};

/** Only an exact recorded root match may enter the existing approved workspace reader. */
export function currentWorkspacePath(path:string, roots:RecordedFileRoot[], workspaceRoot:string|undefined):string|undefined {
  const root=roots.find(root=>path.startsWith(root.prefix+'/'));
  if(!root)return path;
  return workspaceRoot && normalize(root.root)===normalize(workspaceRoot) ? path.slice(root.prefix.length+1) : undefined;
}

/** Display structure only: every leaf keeps the projection's exact path identity. */
export function worktreeFileRows(paths: string[], roots: RecordedFileRoot[], workspaceRoot: string | undefined, opened: Set<string>, query = ''): FileTreeRow[] {
  const byPrefix = new Map(roots.map(root => [root.prefix, root]));
  const located = paths.map(path => {
    const root = byPrefix.get(path.split('/')[0]!);
    return { path, root, other: !!root && !!workspaceRoot && normalize(root.root) !== normalize(workspaceRoot) };
  });
  if (query.trim()) return located.filter(({path, root}) => `${path} ${root?.root ?? ''}`.toLowerCase().includes(query.toLowerCase())).map(({path, root}) => ({path, folder:false, depth:0, name:root ? path.slice(root.prefix.length + 1) : path, parent:'', location:root ? `${root.root.replace(/[\\/]$/, '')}/${path.slice(root.prefix.length + 1)}` : undefined}));
  const rows: FileTreeRow[] = [], seen = new Set<string>();
  const append = (path: string, root: RecordedFileRoot | undefined, base: string, depth: number) => {
    const relative = root ? path.slice(root.prefix.length + 1) : path;
    const parts = relative.split('/'); let parent = base;
    for (let i = 0; i < parts.length; i++) {
      if (!opened.has(parent)) break;
      const next = i ? `${parent}/${parts[i]}` : root ? `${root.prefix}/${parts[i]}` : parts[i]!;
      if (!seen.has(next)) {
        rows.push({path:next, folder:i < parts.length - 1, depth:depth+i, name:parts[i]!, parent, location:root ? `${root.root.replace(/[\\/]$/, '')}/${parts.slice(0,i+1).join('/')}` : undefined}); seen.add(next);
      }
      parent = next;
    }
  };
  for (const item of located.filter(item => !item.other)) append(item.path, item.root, '', 0);
  const others = located.filter(item => item.other);
  if (others.length) {
    rows.push({path:WORKTREE_GROUP,folder:true,depth:0,name:'Other working directories',parent:'',worktree:true});
    if (opened.has(WORKTREE_GROUP)) for (const root of roots) {
      const entries = others.filter(item => item.root === root);
      if (!entries.length) continue;
      rows.push({path:root.prefix,folder:true,depth:1,name:root.root.replace(/\\/g,'/').split('/').filter(Boolean).at(-1) ?? root.root,parent:WORKTREE_GROUP,location:root.root,worktree:true});
      for (const item of entries) append(item.path, root, root.prefix, 2);
    }
  }
  return rows;
}
