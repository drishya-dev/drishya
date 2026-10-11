import { useMemo, useState, type ReactNode } from 'react';
import type { Projection } from '@drishya/contracts';
import type { Scene } from '@drishya/scene';
import { useApp } from '../state.ts';
import { FileIcon } from './FileIcon.tsx';
import { WorkspaceBar } from './Workspace.tsx';
import { EvidenceReview } from './EvidenceReview.tsx';
import { GitReviewEntry } from './GitReview.tsx';
import { agentColor, agentName } from '../lib/identity.ts';
import { localPreviewId, saveLocalPreview } from '../lib/local-preview.ts';
import { HealthTag } from './Home.tsx';

export function LocalPreviewEntry() {
  const id = useApp(s => s.recordingId);
  const source = useApp(s => s.source);
  const [saved, setSaved] = useState(localPreviewId());
  const [error, setError] = useState(false);
  if (source?.kind !== 'daemon' || !id || id.includes('+')) return null;
  const url = new URL(location.href); url.searchParams.set('demo', 'local'); url.searchParams.delete('at'); url.hash = '';
  return <><button className="btn ghost" onClick={() => { const ok = saveLocalPreview(id); setError(!ok); if (ok) setSaved(id); }}>{saved === id ? 'Local preview selected ✓' : 'Use this session as local preview'}</button>{saved && <a className="btn ghost" href={url.href}>Open local preview</a>}{error && <small role="alert">This browser could not save the preview reference.</small>}</>;
}

/** The workbench has three jobs: follow the work, find its source, inspect its evidence.
 * These are separate homes, not three renderings of the captured transcript. */
export function WorkbenchHeader({ projection, scene, children }: { projection: Projection; scene: Scene; children: ReactNode }) {
  const recording = useApp(s => s.recording);
  const source = useApp(s => s.source);
  const connection = useApp(s => s.connection);
  const filter = useApp(s => s.filter);
  const agents = projection.agents.filter(a => scene.agents.some(shown => shown.id === a.id));
  const harnesses = [...new Set(agents.map(a => a.harness))];
  return <header className="workbench-header">
    <button className="brand" title="All recordings" onClick={() => source?.kind === 'bundle' ? location.assign(location.pathname + (location.hash.startsWith('#token=') ? location.hash : '')) : (useApp.setState({ screen: 'home', playing: false }), location.hash = '')}><span className="brand-mark" />Drishya<span className="workbench-edition">STUDIO</span></button>
    <div className="workbench-session studio-session crown-title"><h1 title={projection.title}>{projection.title ?? recording?.title ?? 'Recording'}</h1><span className={source?.sample ? 'crown-sample' : ''}>{source?.sample ? 'Synthetic sample' : source?.kind === 'bundle' ? 'Offline recording' : harnesses.join(' + ')}</span>{connection === 'reconnecting' && <span role="status">Reconnecting…</span>}{recording && !['following', 'idle'].includes(recording.health?.state ?? '') && <HealthTag r={recording} />}{recording?.privacyOutdated && <span className="tag warn">Older privacy policy</span>}</div>
    <div className="workbench-utilities">{children}</div>
    {agents.length > 1 && <div className="workbench-agents" role="group" aria-label="Recorded agents">{agents.map(agent => <button key={agent.id} data-agent-id={agent.id} role="switch" aria-label={`Filter by ${agentName(agent)} agent`} aria-checked={filter?.agentId === agent.id} style={{ '--agent': agentColor(agent, projection.agents) } as React.CSSProperties} onClick={() => useApp.getState().setFilter(filter?.agentId === agent.id ? undefined : { agentId: agent.id })}><span className="agent-dot" />{agentName(agent)}</button>)}</div>}
  </header>;
}

export function WorkbenchSources({ projection }: { projection: Projection }) {
  const [query, setQuery] = useState('');
  const explore = useApp(s => s.explore);
  const foldersHidden = useApp(s => s.foldersHidden);
  const selected = useApp(s => s.filePanel);
  const paged = useApp(s => !!s.historyPage);
  const files = useMemo(() => {
    const entries = new Map<string, { changes: number; reads: number }>();
    for (const op of projection.operations) for (const path of new Set(op.paths.map(p => p.path))) {
      const entry = entries.get(path) ?? { changes: 0, reads: 0 };
      if (op.kind === 'edit' || op.kind === 'write') entry.changes++;
      if (op.kind === 'read') entry.reads++;
      entries.set(path, entry);
    }
    return [...entries].sort(([a, x], [b, y]) => y.changes - x.changes || a.localeCompare(b));
  }, [projection]);
  const matched = files.filter(([path]) => path.toLowerCase().includes(query.toLowerCase()));
  // A source reference opens its recorded work, never an invented current file.
  return <aside className="workbench-sources" aria-label="Working files">
    <WorkspaceBar />
    {!explore && foldersHidden !== false && <section className="working-set">
      <header><h2>Working set</h2><span>{files.length}</span></header>
      <p>{paged ? 'Files in the loaded evidence window' : 'Files referenced in this recording'}</p>
      <input className="ux-search" aria-label="Filter working files" placeholder="Find a source…" value={query} onChange={e => setQuery(e.target.value)} />
      <div className="working-files">{matched.slice(0, 80).map(([path, stats]) => <button key={path} aria-pressed={selected === path} title={path} onClick={() => useApp.setState({ filePanel: path, filePanelFocus: stats.changes ? 'change' : undefined, currentFile: undefined, selectedOp: undefined, explore: false })}><FileIcon path={path} /><span><strong>{path.split(/[\\/]/).pop()}</strong><small>{path.replace(/[\\/][^\\/]+$/, '') === path ? 'Repository root' : path.replace(/[\\/][^\\/]+$/, '')}</small></span>{stats.changes > 0 && <i title={`${stats.changes} captured change inputs`}>{stats.changes}</i>}</button>)}</div>
      {!matched.length && <p>No matching captured file references.</p>}
      {matched.length > 80 && <p>First 80 of {matched.length}. Filter to find another file.</p>}
    </section>}
  </aside>;
}

export function WorkbenchStation({ projection, scene, children }: { projection: Projection; scene: Scene; children: ReactNode }) {
  const id = useApp(s => s.recordingId);
  const mode = useApp(s => s.mode);
  const primary = projection.agents.find(a => scene.agents.some(shown => shown.id === a.id) && !a.parentId);
  return <div className="workbench-station">
    <section className="workbench-review" aria-label="Evidence desk"><span className="desk-caption">Evidence desk</span><div><EvidenceReview key={id} projection={projection} /><GitReviewEntry /></div><p>{mode === 'replay' ? 'Review the full recording in history mode.' : 'Captured changes and checks. Current Git stays separate.'}</p></section>
    <div className="workbench-runtime"><span className="runtime-dot" /><span>{scene.agents.length > 1 ? `${scene.agents.length} recorded agents` : agentName(primary)}<small>{scene.agents.filter(a => a.state === 'active').length ? 'Captured activity in progress' : 'Recorded work'}</small></span></div>
    {children}
  </div>;
}
