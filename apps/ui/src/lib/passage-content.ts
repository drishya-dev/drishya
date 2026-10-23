import type { Agent, Artifact, Notice, Operation, Prose } from '@drishya/contracts';
import type { ScenePassage } from '@drishya/scene';
import { agentColor, agentName } from './identity.ts';

export type PassageContent = {
  ps: ScenePassage; artifacts: Map<string, Artifact>; ops: Map<string, Operation>; prose: Map<string, Prose>; notices: Map<string, Notice>;
  agent?: Agent; agents: Agent[]; focus: boolean; foldable?: boolean; folded?: boolean; onFold?: (id: string) => void;
};

// JSON evidence arrives in new objects on every page. Compare the referenced content,
// without serializing/copying it or treating a stable ID as proof of unchanged bytes.
function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a,b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(k => Object.hasOwn(right,k) && sameValue(left[k],right[k]));
}

export function samePassageContent(a: PassageContent, b: PassageContent): boolean {
  if (a.focus !== b.focus || a.foldable !== b.foldable || a.folded !== b.folded || a.onFold !== b.onFold || !sameValue(a.ps,b.ps)) return false;
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
