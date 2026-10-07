import type { Projection } from '@drishya/contracts';
import type { Scene } from '@drishya/scene';
import { useApp } from '../state.ts';
import { agentColor, agentName } from '../lib/identity.ts';

export function WorkspaceBar() {
  const explore = useApp((s) => s.explore);
  const compare = useApp((s) => s.compareAgents);
  const map = useApp((s) => s.mapVisible);
  const source = useApp((s) => s.source);
  const recording = useApp((s) => s.recording);
  const mode = useApp((s) => s.mode);
  const filter = useApp((s) => s.filter);
  const title = useApp((s) => s.projection?.title ?? s.recording?.title);
  const foldersHidden = useApp(s => s.foldersHidden);
  const foldersShown = foldersHidden === false || foldersHidden !== true && window.innerWidth > 820;
  return <nav className="workspace-bar" aria-label="Workspace views">
    <div className="workspace-toggles"><button aria-label="Show session folders" aria-pressed={foldersShown} onClick={() => useApp.setState({ foldersHidden: foldersShown })}>⌑ Folders</button><button aria-label="Explore repository map" aria-pressed={explore} onClick={() => useApp.setState({ mapVisible: true, explore: !explore, follow: false, held: true, playing: false })}>⌘ Map</button><button role="switch" aria-label="Agent overview" aria-checked={compare} onClick={() => useApp.setState({ compareAgents: !compare, explore: false, follow: false, held: true, playing: false })}>Agents <span className={`mini-switch${compare ? ' on' : ''}`} /></button></div>
    <span className="workspace-recording-title" title={title}>{title}</span>
    <div className="workspace-context"><span>{source?.sample === 'growing' ? 'Synthetic live demonstration' : source?.sample === 'recorded' ? 'Synthetic recording' : source?.kind === 'bundle' ? 'Offline evidence' : recording?.live ? 'Observing local journal' : 'Local recording'}</span><span> / {mode === 'replay' ? 'Sequence replay' : source?.sample === 'growing' ? recording?.live ? 'Publishing sample events' : 'Sample complete' : 'Scrollable history'}</span></div>
    {source?.sample === 'growing' && recording?.live && <button className="btn ghost sample-complete" onClick={() => source.completeSample?.()}>Show complete sample</button>}
    {(source?.sample === 'recorded' || source?.sample === 'growing' && !recording?.live) && <button className="btn ghost sample-watch" onClick={() => location.assign(`${location.pathname}?demo=live`)}>{source.sample === 'growing' ? 'Watch demo again' : 'Watch live demo'}</button>}
    {filter && <button className="btn ghost clear-workspace-filter" onClick={() => useApp.getState().setFilter(undefined)}>Clear focus</button>}
  </nav>;
}

/** Uses only the current evidence boundary. Counts describe shown work, never a paged session total. */
export function AgentOverview({ scene, projection }: { scene: Scene; projection: Projection }) {
  const open = useApp((s) => s.compareAgents);
  const explore = useApp((s) => s.explore);
  const filter = useApp((s) => s.filter);
  if (!open || explore) return null;
  return <section className="agent-overview" aria-label="Agent comparison">
    <div className="agent-overview-caption">Agent ownership · counts and files describe the work shown in this view</div>
    <div className="agent-overview-grid">{scene.agents.map((state) => {
      const agent = projection.agents.find((item) => item.id === state.id);
      const ops = projection.operations.filter((op) => op.agentId === state.id);
      const files = [...new Set(ops.flatMap((op) => op.paths.map((ref) => ref.path)))];
      const parent = projection.agents.find((item) => item.id === state.parentId);
      return <button key={state.id} className="agent-work" aria-pressed={filter?.agentId === state.id} style={{ '--agent': agentColor(agent, projection.agents) } as React.CSSProperties} onClick={() => useApp.getState().setFilter(filter?.agentId === state.id ? undefined : { agentId: state.id })}>
        <strong><i />{agentName(agent)}<small>{state.state}</small></strong><span className="agent-family">{parent ? `Captured child of ${agentName(parent)}` : `${agent?.harness ?? 'Harness'} session`}</span>
        <div className="agent-work-counts"><span>{ops.length} shown actions</span><span>{ops.filter((op) => op.kind === 'edit' || op.kind === 'write').length} changes</span><span>{ops.filter((op) => op.status === 'error').length} failures</span></div>
        <div className="agent-work-files">{files.slice(0, 3).map((path) => <code key={path}>{path}</code>)}{files.length > 3 && <span>+{files.length - 3} more files</span>}{files.length === 0 && <span>No file locations in shown work</span>}</div>
      </button>;
    })}</div>
  </section>;
}
