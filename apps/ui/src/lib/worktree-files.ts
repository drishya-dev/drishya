export interface RecordedFileRoot { root: string; prefix: string; recordedRoot?:string;branch?:string;fileCount?:number;lastFileSequence?:number;agents?:{id:string;label:string}[];onDisk?:'present'|'removed'|'unavailable' }
export interface FileTreeRow { path: string; folder: boolean; depth: number; name: string; parent: string; location?: string; worktree?: boolean; unplaced?: boolean; count?:number; description?:string; metadata?:string }
export const WORKTREE_GROUP = '\u0000recorded-worktrees';
export const UNPLACED_GROUP = '\u0000unplaced-paths';
export interface FilePlacement { indexed: ReadonlySet<string>; direct: ReadonlySet<string> }
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

/** Upgrade retained main-folder keys without changing another worktree's identity. */
export function canonicalFileFolders(opened:Set<string>, roots:RecordedFileRoot[], workspaceRoot:string|undefined):Set<string> {
  let next:Set<string>|undefined;
  for(const path of opened) {
    const mapped=currentWorkspacePath(path,roots,workspaceRoot);
    if(mapped===undefined||mapped===path)continue;
    next??=new Set(opened);next.delete(path);next.add(mapped);
  }
  return next??opened;
}

/** Resolve navigation against the display tree, including suppressed inventory
 * aliases. A current path may match only the exact primary root, never a sibling. */
export function workspaceFileReveal(path:string, paths:string[], roots:RecordedFileRoot[], workspaceRoot:string|undefined, placement:FilePlacement, origin=path):{path:string; ancestors:string[]} | undefined {
  if(!path)return;
  const opened=new Set(['',WORKTREE_GROUP,UNPLACED_GROUP]);
  const candidates=new Set([path,origin,...paths.filter(candidate=>currentWorkspacePath(candidate,roots,workspaceRoot)===path)]);
  for(const candidate of candidates){const canonical=currentWorkspacePath(candidate,roots,workspaceRoot);if(canonical)candidates.add(canonical);}
  for(const candidate of candidates)for(let end=candidate.indexOf('/');end>=0;end=candidate.indexOf('/',end+1))opened.add(candidate.slice(0,end));
  const rows=worktreeFileRows(paths,roots,workspaceRoot,opened,'',placement);
  const exact=rows.find(row=>!row.folder&&row.path===path);
  const leaf=(origin!==path?rows.find(row=>!row.folder&&row.path===origin):undefined)
    ??(exact&&!exact.unplaced?exact:undefined)
    ??rows.find(row=>!row.folder&&!row.unplaced&&currentWorkspacePath(row.path,roots,workspaceRoot)===path)
    ??exact;
  if(!leaf){
    // FILES-14 deliberately suppresses primary inventory below a separately
    // captured nested cwd. Reveal that root only, never invent a captured leaf.
    const absolute=workspaceRoot?normalize(workspaceRoot+'/'+path):undefined;
    const root=absolute&&roots.filter(root=>absolute.startsWith(normalize(root.root)+'/')).sort((a,b)=>b.root.length-a.root.length).find(root=>rows.some(row=>row.worktree&&row.path===root.prefix));
    return root?{path:root.prefix,ancestors:['',WORKTREE_GROUP]}:undefined;
  }
  const byPath=new Map(rows.map(row=>[row.path,row]));
  const ancestors=[''];let parent=leaf.parent;
  while(parent){ancestors.push(parent);parent=byPath.get(parent)?.parent??'';}
  return {path:leaf.unplaced?UNPLACED_GROUP:leaf.path,ancestors};
}

/** Display structure only: every leaf keeps the projection's exact path identity. */
export function worktreeFileRows(paths: string[], roots: RecordedFileRoot[], workspaceRoot: string | undefined, opened: Set<string>, query = '', placement?: FilePlacement): FileTreeRow[] {
  const byPrefix = new Map(roots.map(root => [root.prefix, root]));
  // A separately captured descendant is not ordinary primary inventory. Keep only
  // its projection leaf identity; never rebase an indexed alias into captured evidence.
  const evidencedRoots=roots.filter(root=>root.fileCount===undefined||root.fileCount>0);
  const nestedRoots = workspaceRoot ? evidencedRoots.filter(root => normalize(root.root).startsWith(normalize(workspaceRoot) + '/')) : [];
  const located = paths.filter(path => {
    const root = byPrefix.get(path.split('/')[0]!);
    if (root && (!workspaceRoot || normalize(root.root) !== normalize(workspaceRoot))) return true;
    const relative = root ? path.slice(root.prefix.length + 1) : path;
    const absolute = workspaceRoot ? normalize(workspaceRoot + '/' + relative) : undefined;
    return !absolute || !nestedRoots.some(root => absolute === normalize(root.root) || absolute.startsWith(normalize(root.root) + '/'));
  }).map(path => {
    const root = byPrefix.get(path.split('/')[0]!);
    const relative = root ? path.slice(root.prefix.length + 1) : path;
    const main = !!root && !!workspaceRoot && normalize(root.root) === normalize(workspaceRoot);
    const unplaced = !!placement && ((!root && /^worktree-[a-f0-9]{10}\//.test(path)) || !placement.direct.has(path) && !(placement.indexed.has(path) || main && placement.indexed.has(relative)));
    return { path, root, unplaced, other: !!root && !!workspaceRoot && normalize(root.root) !== normalize(workspaceRoot) };
  });
  if (query.trim()) return located.filter(({path, root}) => `${path} ${root?.root ?? ''}`.toLowerCase().includes(query.toLowerCase())).map(({path, root, unplaced}) => ({path, folder:false, depth:0, name:root ? path.slice(root.prefix.length + 1) : path, parent:'', unplaced, location:root && !unplaced ? `${root.root.replace(/[\\/]$/, '')}/${path.slice(root.prefix.length + 1)}` : undefined}));
  const rows: FileTreeRow[] = [], seen = new Set<string>();
  const append = (path: string, root: RecordedFileRoot | undefined, base: string, depth: number) => {
    const relative = root ? path.slice(root.prefix.length + 1) : path;
    const parts = relative.split('/'); let parent = base;
    for (let i = 0; i < parts.length; i++) {
      if (!opened.has(parent)) break;
      const folder = i < parts.length - 1;
      // Main folder identities survive the reducer adding worktree namespaces.
      const next = !folder ? path : placement && base === '' ? parts.slice(0,i+1).join('/') : i ? `${parent}/${parts[i]}` : root ? `${root.prefix}/${parts[i]}` : parts[i]!;
      if (!seen.has(next)) {
        rows.push({path:next, folder:i < parts.length - 1, depth:depth+i, name:parts[i]!, parent, location:root ? `${root.root.replace(/[\\/]$/, '')}/${parts.slice(0,i+1).join('/')}` : undefined}); seen.add(next);
      }
      parent = next;
    }
  };
  const mainNamespaced = new Set(located.filter(item => item.root && !item.other && !item.unplaced).map(item => item.path.slice(item.root!.prefix.length + 1)));
  for (const item of located.filter(item => !item.other && !item.unplaced && !(placement && !item.root && mainNamespaced.has(item.path)))) append(item.path, item.root, '', 0);
  const others = located.filter(item => item.other && !item.unplaced && item.root && (item.root.fileCount===undefined||item.root.fileCount>0));
  if (others.length) {
    rows.push({path:WORKTREE_GROUP,folder:true,depth:0,name:'Other working directories',parent:'',worktree:true,count:new Set(others.map(item=>item.root!.prefix)).size,description:'Captured file evidence only; Files, Git and the map stay on this session’s checkout.'});
    if (opened.has(WORKTREE_GROUP)) for (const root of [...evidencedRoots].sort((a,b)=>(b.lastFileSequence??0)-(a.lastFileSequence??0))) {
      const entries = others.filter(item => item.root === root);
      if (!entries.length) continue;
      const disk=root.onDisk==='present'?'On disk':root.onDisk==='removed'?'Removed':root.onDisk==='unavailable'?'Disk unavailable':'';
      const names=root.agents?.map(agent=>agent.label)??[],agents=names.join(', ');
      const compactAgent=names.length>1?names[0]+' +'+(names.length-1):names[0];
      rows.push({path:root.prefix,folder:true,depth:1,name:root.branch??workingDirectoryName(root.root,roots),parent:WORKTREE_GROUP,location:root.root,worktree:true,count:root.fileCount,metadata:[disk,compactAgent].filter(Boolean).join(' · '),description:[root.root,root.branch?'Recorded branch '+root.branch:undefined,disk,agents?'Recorded agents: '+agents:undefined].filter(Boolean).join(' · ')});
      for (const item of entries) append(item.path, root, root.prefix, 2);
    }
  }
  const unplaced = located.filter(item => item.unplaced);
  if (unplaced.length) {
    rows.push({path:UNPLACED_GROUP,folder:true,depth:0,name:'Unplaced paths',parent:'',unplaced:true});
    if (opened.has(UNPLACED_GROUP)) for (const {path,root} of unplaced) rows.push({path,folder:false,depth:1,name:root?path.slice(root.prefix.length+1):path,parent:UNPLACED_GROUP,unplaced:true});
  }
  return rows;
}

/** Labels are independent of which other roots have arrived, so no relabelling on a new agent. */
function workingDirectoryName(root:string, roots:RecordedFileRoot[]):string {
  const parts=(value:string)=>value.replace(/\\/g,'/').split('/').filter(Boolean);
  const names=parts(root),at=names.lastIndexOf('worktrees');
  if(at>=0 && at+1<names.length) {
    const short=names.slice(at+1).join('/');
    const matches=roots.filter(item=>{const p=parts(item.root),i=p.lastIndexOf('worktrees');return i>=0&&p.slice(i+1).join('/')===short;});
    return matches.length<2?short:root.replace(/\\/g,'/');
  }
  const last=names.at(-1)??root;
  const same=roots.filter(item=>parts(item.root).at(-1)===last);
  if(same.length<2)return last;
  const suffix=names.slice(-2).join('/');
  return same.filter(item=>parts(item.root).slice(-2).join('/')===suffix).length<2?suffix:root.replace(/\\/g,'/');
}
