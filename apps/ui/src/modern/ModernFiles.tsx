import type { GraphNode } from '@drishya/contracts';
type Branch = { name: string; path: string; files: GraphNode[]; children: Map<string, Branch> };
/** Paths come only from the indexed/captured workspace; grouping does not infer imports. */
export function ModernFiles({ files, selected, onSelect, searching = false }: { files: GraphNode[]; searching?: boolean; selected?: string; onSelect: (path: string) => void }) {
  const root: Branch = { name: '', path: '', files: [], children: new Map() };
  for (const file of files) {
    const pieces = file.path.replace(/\\/g, '/').split('/'); pieces.pop();
    let node = root;
    for (const piece of pieces) { if (!node.children.has(piece)) node.children.set(piece, { name: piece, path: `${node.path}/${piece}`, files: [], children: new Map() }); node = node.children.get(piece)!; }
    node.files.push(file);
  }
  const render = (node: Branch, depth = 0): React.ReactNode => <>{[...node.children.values()].sort((a, b) => a.name.localeCompare(b.name)).map(child => <details key={child.path} className="md-folder" open={searching || selected?.startsWith(child.path.slice(1) + '/') || depth === 0 || undefined}><summary><span className="md-folder-chevron">›</span><svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor"><path d="M2 5h6l2 2h8v10H2z" /></svg><span>{child.name || '/'}</span></summary><div>{render(child, depth + 1)}</div></details>)}{node.files.sort((a, b) => a.path.localeCompare(b.path)).map(file => { const ext = file.path.split('.').at(-1)?.toLowerCase() ?? ''; return <button key={file.id} data-fr-path={file.path} className={`md-file ${selected === file.path ? 'is-selected' : ''}`} title={file.path} onClick={() => onSelect(file.path)}><span className={`md-file-icon file-${ext}`}>{['ts', 'tsx', 'js', 'jsx'].includes(ext) ? ext.includes('x') ? '⚛' : ext.toUpperCase() : ext === 'md' ? 'M↓' : ext === 'json' ? '{}' : ext === 'css' ? '#' : '◇'}</span><span>{file.path.split('/').at(-1)}</span></button>; })}</>;
  return <div className="md-file-tree">{render(root)}</div>;
}
