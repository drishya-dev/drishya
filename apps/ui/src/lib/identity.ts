import type { Agent } from '@drishya/contracts';

// Colour carries identity only. Harness hues are fixed (VISION §5); subagents take a lighter
// tint of their parent's hue so the family reads at a glance.
const HARNESS: Record<string, string> = { 'claude-code': '#E0896A', codex: '#6FC3B3' };
const FALLBACK = ['#C7A0E8', '#E6C86E', '#7FB2F0', '#E88FB4'];

export function agentColor(a: Pick<Agent, 'harness' | 'parentId' | 'id'> | undefined, agents: Agent[] = []): string {
  if (!a) return '#71717A';
  const base = HARNESS[a.harness] ?? FALLBACK[Math.abs(hash(a.harness)) % FALLBACK.length]!;
  if (!a.parentId) return base;
  const siblings = agents.filter((x) => x.parentId === a.parentId);
  const i = Math.max(0, siblings.findIndex((x) => x.id === a.id));
  return mix(base, '#FFFFFF', 0.28 + 0.1 * (i % 3));
}

export function agentName(a: Agent | undefined): string {
  if (!a) return 'Agent';
  if (!a.parentId) return a.label;
  return a.agentType ?? a.label;
}

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return h;
}

function mix(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i]! - v) * t).toString(16).padStart(2, '0')).join('');
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
