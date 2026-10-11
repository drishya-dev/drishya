import { useMemo, useState } from 'react';
import { useApp } from '../state.ts';
import { repositoryNeighbors } from '../lib/repository-context.ts';
import { FileIcon } from './FileIcon.tsx';
import { useSessionWorkspace } from './SessionWorkspace.tsx';

/** Optional current-index context; never an explanation of a historical action. */
export function ImportContext({ path, current = false }: { path: string; current?: boolean }) {
  const graph = useApp(s => s.graph);
  const source = useApp(s => s.source);
  const { workspace } = useSessionWorkspace();
  const [page, setPage] = useState(0);
  const neighbors = useMemo(() => repositoryNeighbors(graph, path), [graph, path]);
  const entries = [...neighbors.imports.map(path => ({ path, direction: 'Imports' })), ...neighbors.importedBy.map(path => ({ path, direction: 'Imported by' }))];
  if (!graph || graph.temporal !== 'current') return null;
  return <details className="import-context" onToggle={e => { if (!e.currentTarget.open) setPage(0); }}><summary>Import connections <span>{entries.length}</span></summary>
    <p className="muted small">Current index{graph.stale ? ' · out of date' : ''}{graph.truncated ? ' · partial' : ''} · not historical execution</p>
    {entries.slice(page * 8, page * 8 + 8).map(item => <button key={`${item.direction}/${item.path}`} onClick={() => useApp.setState(current && source?.kind === 'daemon' && workspace?.approved ? { currentFile: item.path, filePanel: undefined, filePanelFocus: undefined } : { filePanel: item.path, filePanelFocus: undefined, currentFile: undefined })}><FileIcon path={item.path} /><span>{item.path}</span><small>{item.direction}</small></button>)}
    {!entries.length && <p className="muted small">No resolved static imports in this index.</p>}
    {entries.length > 8 && <nav aria-label="Import connection pages"><button disabled={!page} onClick={() => setPage(p => p - 1)}>Previous</button><span>{page + 1} / {Math.ceil(entries.length / 8)}</span><button disabled={(page + 1) * 8 >= entries.length} onClick={() => setPage(p => p + 1)}>Next</button></nav>}
    <button className="btn ghost small" onClick={() => useApp.setState({ mapFocusPath: path, mapVisible: true, explore: true, filePanel: undefined, currentFile: undefined })}>Focus on map ↗</button>
  </details>;
}
