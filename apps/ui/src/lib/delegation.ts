import type { Agent, Operation } from '@drishya/contracts';
import { agentName } from './identity.ts';

export type SpawnDetail = Extract<Operation['detail'], { kind: 'spawn' }>;

/**
 * What the harness returned for a delegation. Claude Code returns the sub-agent's reply. Codex returns only an
 * acknowledgement naming the task (`{"task_name": …}`), which is not what the agent answered, so it is not shown as a reply.
 */
export function delegationReply(d: SpawnDetail): { text?: string; acknowledgementOnly?: boolean } {
  const raw = d.resultPreview?.trim();
  if (!raw) return {};
  if (raw.startsWith('{')) {
    try {
      const keys = Object.keys(JSON.parse(raw) as Record<string, unknown>);
      if (keys.length === 1 && keys[0] === 'task_name') return { acknowledgementOnly: true };
    } catch { /* not JSON: a normal reply */ }
  }
  return { text: d.resultPreview };
}

/** Facts the harness recorded about the delegated agent, in reading order; absent facts are left out, never guessed. */
export function delegationFacts(d: SpawnDetail, agent: Agent | undefined): { label: string; value: string }[] {
  const facts: { label: string; value: string }[] = [];
  const name = agent ? agentName(agent) : undefined;
  const type = d.agentType && d.agentType !== name ? d.agentType : undefined;
  if (name || type) facts.push({ label: 'Agent', value: [name ?? type, name && type ? `(${type})` : undefined].filter(Boolean).join(' ') });
  if (agent?.address) facts.push({ label: 'Address', value: agent.address });
  const model = [agent?.model, agent?.effort && `${agent.effort} effort`].filter(Boolean).join(' · ');
  if (model) facts.push({ label: 'Model', value: model });
  return facts;
}

/** The one line shown on the collapsed card, so the delegation says who ran it without opening anything. */
export function delegationLine(d: SpawnDetail, agent: Agent | undefined): string | undefined {
  // The card already names the agent type; add the name only when it says something else.
  const name = agent ? agentName(agent) : undefined;
  const who = agent?.address ?? (name !== d.agentType ? name : undefined);
  const parts = [who, [agent?.model, agent?.effort].filter(Boolean).join(' · ') || undefined].filter(Boolean);
  return parts.length ? parts.join(' · ') : undefined;
}
