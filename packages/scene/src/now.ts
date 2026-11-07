import { isPersonPrompt } from '@drishya/contracts';
import type { OperationKind, Projection } from '@drishya/contracts';

/** What the newest captured evidence says right now. Pure: no clock, so tests and replays are deterministic. */
export interface NowFacts {
  /** Calls with no result yet, newest first. A call can stay open if the harness never wrote its result. */
  open: OpenOperation[];
  openCount: number;
  /** The newest thing captured, whichever agent did it. */
  last?: { sequence: number; time?: string; what: 'prompt' | 'tool-call' | 'tool-result' | 'reply' | 'reasoning' | 'other' };
  /** Operations started since the last user prompt. */
  turn: { operations: number; since?: string };
  agents: number;
}

export interface OpenOperation {
  id: string;
  agentId: string;
  agentLabel: string;
  kind: OperationKind;
  tool: string;
  title: string;
  since?: string;
  sequence: number;
  /** The harness is waiting for the person: its open call is a question to them. */
  asking: boolean;
  /** Bounded captured fields the sentence can name; never the full input. */
  command?: string;
  /** The agent's own account of the command, when the harness records one. */
  description?: string;
  path?: string;
  query?: string;
}

const QUESTION_TOOLS = new Set(['AskUserQuestion', 'request_user_input', 'request_user_input_async']);
const clip = (text: string | undefined, max = 200) => text === undefined ? undefined : text.length > max ? text.slice(0, max) : text;

export function nowFacts(projection: Projection, maxOpen = 3): NowFacts {
  const label = new Map(projection.agents.map((agent) => [agent.id, agent.label]));
  const running = projection.operations.filter((op) => op.status === 'running').sort((a, b) => b.startSequence - a.startSequence);
  const open: OpenOperation[] = running.slice(0, maxOpen).map((op) => {
    const d = op.detail;
    return {
      id: op.id, agentId: op.agentId, agentLabel: label.get(op.agentId) ?? op.agentId, kind: op.kind, tool: op.tool, title: op.title,
      since: op.startTime, sequence: op.startSequence, asking: QUESTION_TOOLS.has(op.tool),
      command: d.kind === 'shell' || d.kind === 'test' ? clip(d.command) : undefined,
      description: d.kind === 'shell' || d.kind === 'test' ? clip(d.description) : undefined,
      path: d.kind === 'read' || d.kind === 'edit' ? d.path : undefined,
      query: d.kind === 'search' ? clip(d.query) : d.kind === 'web' ? clip(d.url ?? d.query) : undefined,
    };
  });

  const proseRole = new Map(projection.prose.map((prose) => [prose.id, prose.role]));
  const personProse = new Set(projection.prose.filter(prose => prose.role === 'user' && isPersonPrompt(prose.text)).map(prose => prose.id));
  let last: NowFacts['last'];
  for (let i = projection.timeline.length - 1; i >= 0 && !last; i--) {
    const item = projection.timeline[i]!;
    if (item.type === 'turn') last = { sequence: item.sequence, time: item.time, what: isPersonPrompt(item.prompt) ? 'prompt' : 'other' };
    else if (item.type === 'op-start') last = { sequence: item.sequence, time: item.time, what: 'tool-call' };
    else if (item.type === 'op-end') last = { sequence: item.sequence, time: item.time, what: 'tool-result' };
    else if (item.type === 'prose') {
      const role = proseRole.get(item.proseId);
      last = { sequence: item.sequence, time: item.time, what: role === 'user' ? personProse.has(item.proseId) ? 'prompt' : 'other' : role === 'reasoning' ? 'reasoning' : 'reply' };
    }
  }

  // Operations since the newest user prompt (a turn item, or user prose for harnesses without turn records).
  let operations = 0, since: string | undefined;
  for (let i = projection.timeline.length - 1; i >= 0; i--) {
    const item = projection.timeline[i]!;
    if (item.type === 'turn' && isPersonPrompt(item.prompt)) { since = item.time; break; }
    if (item.type === 'prose' && personProse.has(item.proseId)) { since = item.time; break; }
    if (item.type === 'op-start') operations++;
  }
  return { open, openCount: running.length, last, turn: { operations, since }, agents: projection.agents.length };
}
