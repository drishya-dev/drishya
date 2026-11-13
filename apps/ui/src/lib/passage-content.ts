import type { Agent, Artifact, Notice, Operation, Prose } from '@drishya/contracts';
import type { ScenePassage } from '@drishya/scene';
import { agentColor, agentName } from './identity.ts';

export type PassageContent = {
  ps: ScenePassage; artifacts: Map<string, Artifact>; ops: Map<string, Operation>; prose: Map<string, Prose>; notices: Map<string, Notice>;
  agent?: Agent; agents: Agent[]; focus: boolean; foldable?: boolean; folded?: boolean; onFold?: (id: string) => void;
  /** UI-41: this passage's run, when History reads as a conversation. */
  run?: RunPresentation; onRun?: (runId: string, passageId: string) => void;
};

/** What a passage needs to draw its run: whether it carries the run's line, whether the run is open, and the line's words. */
export interface RunPresentation { runId: string; lead: boolean; open: boolean; text: string; parts: { text: string; tone?: 'good' | 'bad' }[]; failed: boolean; operations: number; live: boolean }

// JSON evidence arrives in new objects on every page. Compare the referenced content,
// without serializing/copying it or treating a stable ID as proof of unchanged bytes.
function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a,b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
  const keys = Object.keys(left), rightKeys = Object.keys(right);
  return keys.length === rightKeys.length && keys.every((k,i) => k === rightKeys[i] && sameValue(left[k],right[k]));
}

function sameRun(a?: RunPresentation, b?: RunPresentation) {
  return a === b || !!a && !!b && a.runId === b.runId && a.lead === b.lead && a.open === b.open && a.text === b.text && a.failed === b.failed && a.live === b.live;
}

export function samePassageContent(a: PassageContent, b: PassageContent): boolean {
  if (a.focus !== b.focus || a.foldable !== b.foldable || a.folded !== b.folded || a.onFold !== b.onFold || a.onRun !== b.onRun || !sameRun(a.run, b.run) || !sameValue(a.ps,b.ps)) return false;
  // PassageView/ProseView use the rendered name/color, multi-agent flag and harness-specific gap explanation.
  // Sequence/status bookkeeping elsewhere must not invalidate every earlier passage.
  if (a.agent?.harness !== b.agent?.harness || (a.agents.length > 1) !== (b.agents.length > 1) || agentName(a.agent) !== agentName(b.agent) ||
    agentColor(a.agent,a.agents) !== agentColor(b.agent,b.agents)) return false;
  if (a.artifacts.size !== b.artifacts.size || [...a.artifacts].some(([id, value]) => !sameValue(value,b.artifacts.get(id)))) return false;
  return a.ps.ops.every(o => sameValue(a.ops.get(o.id),b.ops.get(o.id))) &&
    a.ps.prose.every(p => sameValue(a.prose.get(p.id),b.prose.get(p.id))) &&
    (a.ps.notices ?? []).every(n => sameValue(a.notices.get(n.id),b.notices.get(n.id)));
}

/** A memoized passage must not retain an entire older page through its maps. */
export function passageItems<T>(items: {id: string}[], values: Map<string,T>): Map<string,T> {
  const result = new Map<string,T>();
  for (const item of items) { const value=values.get(item.id); if(value!==undefined) result.set(item.id,value); }
  return result;
}

export function passageArtifacts(ps: ScenePassage, ops: Map<string,Operation>, artifacts: Map<string,Artifact>): Map<string,Artifact> {
  const ids=new Set(ps.ops.flatMap(o=>ops.get(o.id)?.artifactIds ?? []));
  for(const p of ps.prose) ids.add('art_'+p.id+'_prose');
  return passageItems([...ids].map(id=>({id})),artifacts);
}
