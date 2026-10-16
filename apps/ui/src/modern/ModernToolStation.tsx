import type { Projection } from '@drishya/contracts';
import type { Scene } from '@drishya/scene';
import type { ReactNode } from 'react';
import { ModernTools } from './ModernTools';
import { useApp } from '../state';
import { focusAgent, focusKind, focusMcp } from '../lib/compound-focus';
import { useSessionWorkspace } from '../components/SessionWorkspace';

/** Original Modern instrument composition, attached to the shared session and focus owner. */
export function ModernToolStation({ projection, scene, agents }: { projection: Projection; scene: Scene; agents: ReactNode }) {
  const { controller } = useSessionWorkspace();
  const filter = useApp(s => s.filter), setFilter = useApp(s => s.setFilter);
  return <><div className="workbench-station modern-tool-station"><ModernTools page={{ projection,scene }} native={controller} filter={filter} agents={agents} onClear={() => setFilter(undefined)} onFilter={next => {
    if (next.agentId) setFilter(focusAgent(filter,next.agentId));
    else if (next.server) setFilter(focusMcp(filter,next.server,next.tool));
    else if (next.kind) setFilter(focusKind(filter,next.kind));
  }} /></div></>;
}
