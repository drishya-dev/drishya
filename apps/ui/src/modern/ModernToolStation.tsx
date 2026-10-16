import type { Projection } from '@drishya/contracts';
import type { Scene } from '@drishya/scene';
import type { ReactNode } from 'react';
import { useWorkspaceState } from '../lib/workspace-memory-react.ts';
import { ModernTools } from './ModernTools';
import { useApp } from '../state';
import { focusAgent, focusKind, focusMcp } from '../lib/compound-focus';
import { useSessionWorkspace } from '../components/SessionWorkspace';

/** Original Modern instrument composition, attached to the shared session and focus owner. */
export function ModernToolStation({ projection, scene, agents }: { projection: Projection; scene: Scene; agents: ReactNode }) {
  const [collapsed,setCollapsed]=useWorkspaceState('toolbox/collapsed',false);
  const { controller } = useSessionWorkspace();
  const filter = useApp(s => s.filter), setFilter = useApp(s => s.setFilter);
  return <><div className={`workbench-station modern-tool-station${collapsed?' toolbox-minimized':''}`}><button className="toolbox-collapse" aria-label={collapsed?'Expand toolbox':'Minimize toolbox'} aria-expanded={!collapsed} onClick={()=>setCollapsed(!collapsed)}>{collapsed?<><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M8 7V4h8v3M3 7h18v13H3ZM3 12h18M10 10v4h4v-4" /></svg>{filter&&<span className="toolbox-filter-dot" title="Focus filter active">•</span>}</>:'−'}</button><ModernTools page={{ projection,scene }} native={controller} filter={filter} agents={agents} onClear={() => setFilter(undefined)} onFilter={next => {
    if (next.agentId) setFilter(focusAgent(filter,next.agentId));
    else if (next.server) setFilter(focusMcp(filter,next.server,next.tool));
    else if (next.kind) setFilter(focusKind(filter,next.kind));
  }} /></div></>;
}
