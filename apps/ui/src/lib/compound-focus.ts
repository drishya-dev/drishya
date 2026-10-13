import type { ComposeInput } from '@drishya/scene';
type Focus = ComposeInput['filter'];
const compact = (focus: NonNullable<Focus>): Focus => {
  const entries = Object.entries(focus).filter(([, value]) => value !== undefined);
  return entries.length ? Object.fromEntries(entries) as NonNullable<Focus> : undefined;
};
export function focusAgent(current: Focus, agentId?: string): Focus {
  return compact({ ...current, agentId: current?.agentId === agentId ? undefined : agentId });
}
export function focusKind(current: Focus, kind: NonNullable<Focus>['kind']): Focus {
  return compact({ agentId: current?.agentId, kind: current?.kind === kind ? undefined : kind });
}
export function focusMcp(current: Focus, server: string, tool?: string): Focus {
  const same = current?.server === server && current.tool === tool;
  return compact({ agentId: current?.agentId, server: same ? undefined : server, tool: same ? undefined : tool });
}
