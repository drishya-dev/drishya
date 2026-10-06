import { useMemo } from 'react';
import type { RepoGraph } from '@drishya/contracts';
import { repositoryNeighbors, type RepositoryContext as Context } from '../lib/repository-context.ts';
import { KIND_LABEL } from '../lib/identity.ts';
import { useApp } from '../state.ts';

export function RepositoryContext({ context, graph }: { context: Context; graph?: RepoGraph }) {
  const set = useApp((state) => state.set);
  const neighbors = useMemo(() => repositoryNeighbors(graph, context.path), [graph, context.path]);
  const openFile = (path: string) => set({ filePanel: path, follow: false, playing: false, held: true });
  const group = (label: string, paths: string[]) => paths.length ? <div className="repo-relations"><span>{label}</span>{paths.slice(0, 2).map((path) => <button key={path} title={path} onClick={() => openFile(path)}>{path}</button>)}{paths.length > 2 && <small>{paths.length - 2} more · explore map</small>}</div> : null;
  return <section className="repository-context" aria-label="Repository reading context">
    <div className="repo-context-scope">{context.scope === 'reading' ? 'Reading here' : context.scope === 'selected' ? 'Selected action' : 'Latest file reference'}</div>
    {context.path ? <>
      <button className="repo-context-file" title={`Open recorded work on ${context.path}`} onClick={() => openFile(context.path!)}><span>{context.path.slice(0, context.path.lastIndexOf('/') + 1)}</span><strong>{context.path.split('/').at(-1)}</strong><span aria-hidden="true">↗</span></button>
      {context.actions.length > 0 && <div className="repo-context-actions"><span>In shown history</span>{context.actions.map((op) => <button key={op.id} data-context-op={op.id} onClick={() => void useApp.getState().select(op.id)} title={`Open ${KIND_LABEL[op.kind]} in history`}><i className={`repo-action-status status-${op.status}`} aria-hidden="true" /><span>{KIND_LABEL[op.kind]}</span><small>{op.status === 'running' ? 'pending' : op.status === 'ok' ? 'completed' : op.status === 'error' ? 'failed' : 'outcome unknown'}</small></button>)}</div>}
      {graph?.temporal === 'current' && <div className="repo-current-relations"><span>Current static imports{graph.stale ? ' · out of date' : ''}{graph.truncated ? ' · partial index' : ''}</span>{group('Imports', neighbors.imports)}{group('Imported by', neighbors.importedBy)}{!neighbors.imports.length && !neighbors.importedBy.length && <small>No indexed connections for this file</small>}<small>Workspace index · not historical execution</small></div>}
    </> : <p className="repo-context-empty">{context.scope === 'latest' ? 'File references appear as work arrives.' : 'No file location captured for this passage.'}</p>}
  </section>;
}
