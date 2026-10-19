import { GitReviewEntry } from './GitReview.tsx';
import { focusAgent } from '../lib/compound-focus.ts';
import type { Projection } from '@drishya/contracts';
import type { Scene } from '@drishya/scene';
import { useLayoutEffect, useRef } from 'react';
import { useApp } from '../state.ts';
import { useExperience } from '../lib/experience.ts';
import { agentColor, agentName } from '../lib/identity.ts';
import { useNarrowWorkspace } from '../lib/responsive-workspace.ts';

export function WorkspaceBar() {
  const bar = useRef<HTMLElement>(null);
  const experience = useExperience();
  const narrow = useNarrowWorkspace();
  const modern = document.documentElement.dataset.uiVersion === 'modern';
  useLayoutEffect(() => {
    const element = bar.current;
    const viewer = element?.closest<HTMLElement>('.viewer');
    if (!element || !viewer) return;
    // Demo controls and focus controls can wrap; the explorer must start below them.
    const measure = () => { const groups=[...element.querySelectorAll<HTMLElement>('.workspace-leading,.workspace-secondary')]; const bottom=Math.max(element.getBoundingClientRect().bottom,...groups.map(group=>group.getBoundingClientRect().bottom)); viewer.style.setProperty('--workspace-tools-bottom', `${bottom-viewer.getBoundingClientRect().top+12}px`); };
    const observer = new ResizeObserver(measure);
    observer.observe(element); for(const group of element.querySelectorAll('.workspace-leading,.workspace-secondary'))observer.observe(group);observer.observe(viewer);const header=viewer.querySelector('.workspace-header');if(header)observer.observe(header);measure();
    return () => { observer.disconnect(); viewer.style.removeProperty('--workspace-tools-bottom'); };
  }, [experience]);
  const developerWorkspace = useApp(s => s.developerWorkspace);
  const mode = useApp(s => s.mode);
  const explore = useApp((s) => s.explore);
  const compare = useApp((s) => s.compareAgents);
  const source = useApp((s) => s.source);
  const recording = useApp((s) => s.recording);
  const filter = useApp((s) => s.filter);
  const multipleAgents = useApp(s => (s.projection?.agents.length ?? 0) > 1);
  const foldersHidden = useApp(s => s.foldersHidden);
  const foldersShown = !explore && (foldersHidden === false || experience !== 'studio' && foldersHidden !== true && !narrow);
  return <nav ref={bar} className="workspace-bar" aria-label="Workspace views">
    <span className="workspace-context sr-only">{source?.sample === 'growing' ? recording?.live ? 'Synthetic live demonstration · Publishing sample events' : 'Synthetic live demonstration · Sample complete' : source?.sample ? 'Synthetic recording' : source?.kind === 'bundle' ? 'Offline evidence' : mode==='replay'?'Sequence replay':'Live session'}</span>
    <div className="workspace-leading">    <div className="workspace-toggles"><button data-workspace-files-trigger title="Browse current files after workspace consent, or captured file evidence" aria-label={modern ? 'Show files' : 'Show session folders'} aria-pressed={foldersShown} onClick={() => useApp.setState({ foldersHidden: foldersShown, explore:false })}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7V5h7l2 3h9v12H3Z" /></svg>{modern ? 'Files' : 'Folders'}</button><button aria-label="Explore repository map" title="Explore file/import relationships and captured locations" aria-pressed={explore} onClick={() => useApp.setState({ developerWorkspace: false, mapVisible: true, explore: !explore, selectedOp: undefined, expandedOp: undefined })}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M7 17 17 7" /><circle cx="5" cy="5" r="3" /><circle cx="19" cy="5" r="3" /><circle cx="5" cy="19" r="3" /><circle cx="19" cy="19" r="3" /></svg>{modern ? 'Repository' : 'Map'}</button>{experience === 'legacy' && multipleAgents && <button role="switch" aria-label="Agent overview" aria-checked={compare} onClick={() => useApp.setState({ compareAgents: !compare, explore: false })}>Agents <span className={`mini-switch${compare ? ' on' : ''}`} /></button>}</div>
    {source?.sample === 'growing' && <span className={`sample-state${recording?.live ? ' live' : ''}`}><i aria-hidden="true" />{recording?.live ? 'Live demo' : 'Demo complete'}</span>}
    {source?.sample === 'growing' && recording?.live && <button className="btn ghost sample-complete" onClick={() => source.completeSample?.()}>Show complete sample</button>}
    {(source?.sample === 'recorded' || source?.sample === 'growing' && !recording?.live) && <button className="btn ghost sample-watch" onClick={() => { const next = new URL(location.href); next.searchParams.set('demo', 'live'); next.searchParams.delete('at'); next.hash = ''; location.assign(next.href); }}>{source.sample === 'growing' ? 'Watch demo again' : 'Watch live demo'}</button>}
    {filter && <button className="btn ghost clear-workspace-filter" onClick={() => useApp.getState().setFilter(undefined)}>Clear focus</button>}
    </div>
    <div className="workspace-secondary">{experience === 'classic' && <button aria-label="Open developer workspace" aria-pressed={developerWorkspace} disabled={source?.kind !== 'daemon' || mode !== 'history' || !!recording?.id.includes('+')} title="Read files side by side and prepare native edit or run requests" onClick={() => useApp.getState().set({ developerWorkspace: !developerWorkspace, explore: false, currentFile: undefined, filePanel: undefined, follow: false, held: true, foldersHidden: false })}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M9 9v11" /></svg>Workspace</button>}{modern && <div className="modern-review-control"><GitReviewEntry icon /></div>}</div>
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
      return <button key={state.id} className="agent-work" aria-pressed={filter?.agentId === state.id} style={{ '--agent': agentColor(agent, projection.agents) } as React.CSSProperties} onClick={() => useApp.getState().setFilter(focusAgent(filter, state.id))}>
        <strong><i />{agentName(agent)}<small>{state.state}</small></strong><span className="agent-family">{parent ? `Captured child of ${agentName(parent)}` : `${agent?.harness ?? 'Harness'} session`}</span>
        <div className="agent-work-counts"><span>{ops.length} shown actions</span><span>{ops.filter((op) => op.kind === 'edit' || op.kind === 'write').length} changes</span><span>{ops.filter((op) => op.status === 'error').length} failures</span></div>
        <div className="agent-work-files">{files.slice(0, 3).map((path) => <code key={path}>{path}</code>)}{files.length > 3 && <span>+{files.length - 3} more files</span>}{files.length === 0 && <span>No file locations in shown work</span>}</div>
      </button>;
    })}</div>
  </section>;
}
