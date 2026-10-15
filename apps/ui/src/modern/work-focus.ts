import type { ComposeInput } from '../../../../packages/scene/src/index';

export type WorkFocus = NonNullable<ComposeInput['filter']>;

/** Native names such as exec are shared by unrelated operation kinds. */
export function toggleWorkFocus(current: WorkFocus | undefined, next: WorkFocus): WorkFocus | undefined {
  const key = next.agentId !== undefined ? 'agentId' : 'tool';
  const agent = key === 'agentId' ? (current?.agentId === next.agentId ? undefined : next.agentId) : current?.agentId;
  const sameTool = current?.kind === next.kind && current?.tool === next.tool && current?.server === next.server;
  const tool = key === 'agentId' ? current : sameTool ? undefined : next;
  const result = { ...(agent ? { agentId: agent } : {}), ...(tool?.kind ? { kind: tool.kind } : {}), ...(tool?.tool ? { tool: tool.tool } : {}), ...(tool?.server ? { server: tool.server } : {}) };
  return Object.keys(result).length ? result : undefined;
}

export function workFocusLabel(focus: WorkFocus) {
  return [focus.kind, focus.server, focus.tool, focus.agentId ? 'agent' : undefined].filter(Boolean).join(' · ');
}
