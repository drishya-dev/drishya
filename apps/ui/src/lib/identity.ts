import type { Agent } from '@drishya/contracts';

// Colour carries identity only. Harness hues are fixed (VISION §5); subagents take a lighter
// tint of their parent's hue so the family reads at a glance.
const HARNESS: Record<string, string> = { 'claude-code': 'var(--agent-claude-ink)', codex: 'var(--agent-codex-ink)' };
const FALLBACK = ['var(--agent-violet-ink)', 'var(--agent-gold-ink)', 'var(--agent-blue-ink)', 'var(--agent-rose-ink)'];

export function agentColor(a: Pick<Agent, 'harness' | 'parentId' | 'id'> | undefined, agents: Agent[] = []): string {
  if (!a) return 'var(--text-muted)';
  const base = HARNESS[a.harness] ?? FALLBACK[Math.abs(hash(a.harness)) % FALLBACK.length]!;
  if (!a.parentId) return base;
  const siblings = agents.filter((x) => x.parentId === a.parentId);
  const i = Math.max(0, siblings.findIndex((x) => x.id === a.id));
  const tint=0.28+0.1*(i%3);
  // On Daylight, tint toward the palette's dark primary ink rather than white.
  return `color-mix(in srgb, ${base} ${(1-tint)*100}%, var(--text-primary))`;
}

export function agentName(a: Agent | undefined): string {
  if (!a) return 'Agent';
  const generic = ['claude code', 'codex', 'agent', 'main'].includes(a.label.toLowerCase());
  if (!generic) return a.label;
  if (a.model && !['openai', 'anthropic', 'synthetic', '<synthetic>'].includes(a.model.toLowerCase())) return a.model;
  return a.agentType ?? (a.parentId ? `Agent ${a.id.slice(-6)}` : 'Main agent');
}

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return h;
}


export const KIND_LABEL: Record<string, string> = {
  read: 'Read',
  search: 'Search',
  edit: 'Edit',
  write: 'Write',
  shell: 'Shell',
  test: 'Test',
  mcp: 'MCP',
  web: 'Web',
  spawn: 'Delegate',
  plan: 'Plan',
  other: 'Other',
};
