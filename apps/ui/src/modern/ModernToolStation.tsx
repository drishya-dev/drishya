import type { Projection } from '@drishya/contracts';
import type { Scene } from '@drishya/scene';
import {useLayoutEffect,useRef,type ReactNode} from 'react';
import {useSurfaceReflow} from '../lib/use-surface-reflow.ts';
import { useWorkspaceState } from '../lib/workspace-memory-react.ts';
import { ModernTools } from './ModernTools';
import { useApp } from '../state';
import { focusAgent, focusKind, focusMcp } from '../lib/compound-focus';
import { useSessionWorkspace } from '../components/SessionWorkspace';
import {ToolboxWindowOwner,useToolboxWindow} from './ToolboxWindow.tsx';

/** Original Modern instrument composition, attached to the shared session and focus owner. */
export function ModernToolStation({ projection, scene, agents }: { projection: Projection; scene: Scene; agents: ReactNode }) {
  const id=useApp(s=>s.recordingId);
  return <ToolboxWindowOwner key={id}><ToolStation projection={projection} scene={scene} agents={agents}/></ToolboxWindowOwner>;
}

function ToolStation({ projection, scene, agents }: { projection: Projection; scene: Scene; agents: ReactNode }) {
  const [collapsed,setCollapsed]=useWorkspaceState('toolbox/collapsed',false);
  const surface=useRef<HTMLDivElement>(null),id=useApp(s=>s.recordingId);
  const prepareCollapse=useSurfaceReflow(surface,collapsed,id);
  useLayoutEffect(()=>{
    const stage=surface.current?.closest<HTMLElement>('.connected-workspace');
    if(!stage)return;
    stage.toggleAttribute('data-toolbox-minimized',collapsed);
    return()=>stage.removeAttribute('data-toolbox-minimized');
  },[collapsed]);
  const { controller } = useSessionWorkspace();
  const window=useToolboxWindow();
  const filter = useApp(s => s.filter), setFilter = useApp(s => s.setFilter);
  return <><div ref={surface} className={`workbench-station modern-tool-station${collapsed?' toolbox-minimized':''}`}><button className="toolbox-collapse" aria-label={collapsed?'Expand toolbox':'Minimize toolbox'} aria-expanded={!collapsed} onClick={event=>{prepareCollapse();setCollapsed(!collapsed);if(collapsed)window.open('toolbox',event.currentTarget,event.detail>0);}}>{collapsed?<span data-surface-label=""><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M8 7V4h8v3M3 7h18v13H3ZM3 12h18M10 10v4h4v-4" /></svg>{filter&&<span className="toolbox-filter-dot" title="Focus filter active">•</span>}</span>:'−'}</button><ModernTools page={{ projection,scene }} native={controller} filter={filter} agents={agents} onClear={() => setFilter(undefined)} onFilter={next => {
    if (next.agentId) setFilter(focusAgent(filter,next.agentId));
    else if (next.server) setFilter(focusMcp(filter,next.server,next.tool));
    else if (next.kind) setFilter(focusKind(filter,next.kind));
  }} /></div></>;
}
