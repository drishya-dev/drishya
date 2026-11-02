import {collectionPage} from '../lib/collection-bounds.ts';
import { useMemo, useState } from 'react';
import { useApp } from '../state.ts';
import { repositoryNeighbors } from '../lib/repository-context.ts';
import { FileIcon } from './FileIcon.tsx';
import { useSessionWorkspace } from './SessionWorkspace.tsx';

/** Optional current-index context; never an explanation of a historical action. */
export function ImportContext({ path, current = false, openCurrent, hideEmpty = false }: { path: string; current?: boolean; openCurrent?: (path: string) => void; hideEmpty?: boolean }) {
  const graph = useApp(s => s.graph);
  const source = useApp(s => s.source);
  const { workspace, approve } = useSessionWorkspace();
  const id = useApp(s => s.recordingId);
  const [page, setPage] = useState(0);
  const [opening, setOpening] = useState<string>();
  const [error, setError] = useState<string>();
  const neighbors = useMemo(() => repositoryNeighbors(graph, path), [graph, path]);
  const entries = [...neighbors.imports.map(path => ({ path, direction: 'Imports' })), ...neighbors.importedBy.map(path => ({ path, direction: 'Imported by' }))];
  const pageWindow=collectionPage(entries.length,page);
  if (!graph || graph.temporal !== 'current' || hideEmpty && !entries.length) return null;
  const canReadDisk = source?.kind === 'daemon' && !!workspace?.root && !!id && !id.includes('+');
  const readDisk = async (target: string) => {
    if (!canReadDisk || opening) return;
    setOpening(target); setError(undefined);
    try {
      if (!workspace?.approved) await approve();
      if (useApp.getState().recordingId !== id || useApp.getState().source !== source) return;
      if (openCurrent) { openCurrent(target); return; }
      useApp.getState().set({ currentFile: target, filePanel: undefined, filePanelFocus: undefined, filePanelEvidence: undefined });
    } catch (error) { setError((error as Error).message); }
    finally { setOpening(undefined); }
  };
  return <details className="import-context" data-size={pageWindow.state} onToggle={e => { if (!e.currentTarget.open) setPage(0); }}><summary>Import connections <span>{entries.length}</span></summary>
    <p className="muted small">Current index{graph.stale ? ' · out of date' : ''}{graph.truncated ? ' · partial' : ''} · not historical execution</p>
    {entries.slice(pageWindow.start,pageWindow.end).map(item => <div className="import-destination" key={`${item.direction}/${item.path}`}>
      <div><FileIcon path={item.path} /><span title={item.path}>{item.path}</span><small>{item.direction}</small></div>
      <div className="import-destination-actions">
        <button className="btn ghost small" aria-label={`Work on ${item.path}`} onClick={() => useApp.getState().set({ developerWorkspace: false, filePanel: item.path, filePanelFocus: undefined, filePanelEvidence: undefined, currentFile: undefined })}>Session work</button>
        {canReadDisk && <button className={`btn ghost small${current ? ' current-destination' : ''}`} aria-label={`Read current file ${item.path}`} title="Current file on disk, not what the agent saw" disabled={!!opening} onClick={() => void readDisk(item.path)}>{opening === item.path ? 'Opening…' : 'Read current file ↗'}</button>}
      </div>
    </div>)}
    {error && <p className="bad small" role="alert">{error}</p>}
    {!entries.length && <p className="muted small">No resolved static imports in this index.</p>}
    {pageWindow.state === 'page' && <nav aria-label="Import connection pages"><button disabled={!pageWindow.page} onClick={() => setPage(pageWindow.page - 1)}>Previous</button><span>{pageWindow.page + 1} / {pageWindow.pages}</span><button disabled={pageWindow.page + 1 >= pageWindow.pages} onClick={() => setPage(pageWindow.page + 1)}>Next</button></nav>}
    <button className="btn ghost small" onClick={() => useApp.getState().set({ developerWorkspace: false, mapFocusPath: path, mapVisible: true, explore: true, filePanel: undefined, currentFile: undefined })}>Focus on map ↗</button>
  </details>;
}
