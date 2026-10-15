import { ModernToolStation } from '../modern/ModernToolStation.tsx';
import { focusAgent } from '../lib/compound-focus.ts';
import { BrandMark } from './BrandMark.tsx';
import { useMemo, useState, type ReactNode } from 'react';
import type { Projection } from '@drishya/contracts';
import type { Scene } from '@drishya/scene';
import { useApp } from '../state.ts';
import { FileIcon } from './FileIcon.tsx';
import { WorkspaceBar } from './Workspace.tsx';
import { EvidenceReview } from './EvidenceReview.tsx';
import { GitReviewEntry } from './GitReview.tsx';
import { ReviewQuestionsEntry } from './ReviewQuestions.tsx';
import { agentColor, agentName } from '../lib/identity.ts';
import { localPreviewId, saveLocalPreview } from '../lib/local-preview.ts';
import { HealthTag } from './Home.tsx';
import { EvidenceNavigation } from './EvidenceNavigation.tsx';

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
    <button className="brand" title="All recordings" onClick={() => source?.kind === 'bundle' ? location.assign(location.pathname + (location.hash.startsWith('#token=') ? location.hash : '')) : (useApp.setState({ screen: 'home', playing: false }), location.hash = '')}><BrandMark />Drishya<span className="workbench-edition">STUDIO</span></button>
    <div className="workbench-session studio-session crown-title"><h1 title={projection.title}>{projection.title ?? recording?.title ?? 'Recording'}</h1><span className={source?.sample ? 'crown-sample' : ''}>{source?.sample ? 'Synthetic sample' : source?.kind === 'bundle' ? 'Offline recording' : harnesses.join(' + ')}</span>{connection === 'reconnecting' && <span role="status">Reconnecting…</span>}{recording && !['following', 'idle'].includes(recording.health?.state ?? '') && <HealthTag r={recording} />}{recording?.privacyOutdated && <span className="tag warn">Older privacy policy</span>}</div>
    <div className="workbench-utilities">{children}</div>
    {agents.length > 1 && <div className="workbench-agents" role="group" aria-label="Recorded agents">{agents.map(agent => <button key={agent.id} data-agent-id={agent.id} role="switch" aria-label={`Filter by ${agentName(agent)} agent`} aria-checked={filter?.agentId === agent.id} style={{ '--agent': agentColor(agent, projection.agents) } as React.CSSProperties} onClick={() => useApp.getState().setFilter(focusAgent(filter, agent.id))}><span className="agent-dot" />{agentName(agent)}</button>)}</div>}
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
  const filter = useApp(s => s.filter);
  if (document.documentElement.dataset.uiVersion === 'modern') return <ModernToolStation projection={projection} scene={scene} agents={<AgentFamilies projection={projection} scene={scene} />} />;
  return <div className="workbench-station">
    <section className="workbench-review" aria-label="Evidence desk"><span className="desk-caption">Review</span><div><EvidenceReview key={id} projection={projection} /><GitReviewEntry /><ReviewQuestionsEntry key={id} /></div><EvidenceNavigation hideEmpty /><p>{mode === 'replay' ? 'Review the full recording in history mode.' : 'Recorded changes and checks.'}</p></section>
    <button className="btn ghost workspace-navigation-open" onClick={() => window.dispatchEvent(new Event('drishya-navigate-workspace'))}>Navigate workspace <kbd>Ctrl/⌘ K</kbd></button>
    {scene.agents.length === 1 && <div className="workbench-runtime"><span className="runtime-dot" /><span>{agentName(primary)}<small>{scene.agents.some(a => a.state === 'active') ? 'Captured activity in progress' : 'Recorded work'}</small></span></div>}
    {scene.agents.length > 1 && <details className="station-agent-menu"><summary>Agents <span>{scene.agents.length}{filter?.agentId ? ' · focused' : ''}</span></summary><AgentFamilies projection={projection} scene={scene} /></details>}
    {children}
  </div>;
}

/** Only captured family links create nesting. Missing parents remain independent roots. */
function AgentFamilies({ projection, scene }: { projection: Projection; scene: Scene }) {
  const filter = useApp(s => s.filter);
  const visible = new Set(scene.agents.map(a => a.id));
  const rendered = new Set<string>();
  const render = (state: Scene['agents'][number]): ReactNode => {
    if (rendered.has(state.id)) return null;
    rendered.add(state.id);
    const agent = projection.agents.find(a => a.id === state.id);
    const parent = projection.agents.find(a => a.id === state.parentId);
    const children = scene.agents.filter(a => a.parentId === state.id && !rendered.has(a.id));
    const description = `${agent?.harness ?? 'Harness'} · ${state.state}${parent ? ` · child of ${agentName(parent)}` : ''}. Focus this agent; surrounding history stays visible. Click again to show everyone.`;
    const row = <button data-agent-id={state.id} role="switch" aria-label={`Filter by ${agentName(agent)} agent`} aria-checked={filter?.agentId === state.id} title={description} style={{ '--agent': agentColor(agent, projection.agents) } as React.CSSProperties} onClick={() => useApp.getState().setFilter(focusAgent(filter, state.id))}><span className="agent-dot" /><span>{agentName(agent)}<small>{state.state}</small></span></button>;
    return <div key={state.id} className="station-agent-family">{row}{children.length > 0 && <details className="station-subagents"><summary>Subagents <span>{children.length}</span></summary><div>{children.map(render)}</div></details>}</div>;
  };
  const roots = scene.agents.filter(a => !a.parentId || !visible.has(a.parentId));
  const families = roots.map(render);
  // Malformed cyclic ancestry must not hide a captured identity or recurse forever.
  for (const state of scene.agents) if (!rendered.has(state.id)) families.push(render(state));
  return <div className="station-agents" role="group" aria-label="Recorded agents">{families}{filter?.agentId && <button className="btn ghost" onClick={() => useApp.getState().setFilter(focusAgent(filter))}>Show all agents</button>}</div>;
}
