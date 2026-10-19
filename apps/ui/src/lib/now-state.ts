import type { NowFacts, OpenOperation } from '../../../../packages/scene/src/now.ts';
import { commandDisplay } from './command-display.ts';

/** The quiet "what is it doing right now" line, derived only from captured evidence. The clock is injected. */
export type NowTone = 'running' | 'asking' | 'working' | 'replied' | 'quiet';
export interface NowContext { nowMs: number; harness: string; workspace?: string }
export interface NowView {
  tone: NowTone;
  /** The sentence shown in the composer pill. */
  text: string;
  /** Plain-language basis, so the line never claims more than the evidence shows. */
  basis: string;
  /** Tab title while the agent is active; absent when the page should keep its normal title. */
  tab?: string;
  mark?: 'running' | 'asking' | 'working';
}

/** An open call is "working" until this long without any new event, then plainly "quiet". */
export const WORKING_WINDOW_MS = 20_000;
/** Older than this, a watched session is history, not something happening now: no line at all. */
export const STALE_MS = 2 * 60 * 60_000;

export function elapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} m ${String(s % 60).padStart(2, '0')} s`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} m`;
}

const base = (path: string) => path.replace(/\\/g, '/').split('/').filter(Boolean).at(-1) ?? path;
const clip = (text: string, max = 44) => text.length > max ? `${text.slice(0, max - 1)}…` : text;
const firstLine = (text: string) => text.split('\n').find((line) => line.trim())?.trim() ?? '';

/** A short phrase for one open call: what the harness is running, reading, editing or waiting on. */
export function describeOpen(op: OpenOperation): string {
  if (op.asking) return 'waiting for your answer';
  switch (op.kind) {
    case 'shell': case 'test': return `running ${clip(firstLine(op.command ? commandDisplay(op.command).text : op.title))}`;
    case 'read': return `reading ${op.path ? base(op.path) : 'a file'}`;
    case 'edit': case 'write': return `editing ${op.path ? base(op.path) : 'a file'}`;
    case 'search': return `searching${op.query ? ` ${clip(op.query, 32)}` : ''}`;
    case 'web': return `fetching${op.query ? ` ${clip(op.query, 32)}` : ''}`;
    case 'mcp': return `calling ${clip(op.tool, 32)}`;
    case 'spawn': return 'delegating to an agent';
    default: return `running ${clip(op.title || op.tool)}`;
  }
}

/** `facts` come from the newest captured events; `live` means Drishya is watching the journal. Returns nothing when not live. */
export function nowView(facts: NowFacts | undefined, live: boolean, ctx: NowContext): NowView | undefined {
  if (!facts || !live) return undefined;
  const where = ctx.workspace ? ` · ${ctx.workspace}` : '';
  const turn = facts.turn.operations > 0 ? ` This turn so far: ${facts.turn.operations} operation${facts.turn.operations === 1 ? '' : 's'}.` : '';
  const asking = facts.open.find((op) => op.asking);
  const focus = asking ?? facts.open[0];
  const who = (op?: OpenOperation) => facts.agents > 1 && op ? op.agentLabel : ctx.harness;
  const since = (iso?: string) => iso && Number.isFinite(Date.parse(iso)) ? ctx.nowMs - Date.parse(iso) : undefined;
  const newest = [since(facts.last?.time), ...facts.open.map((op) => since(op.since))].filter((age): age is number => age !== undefined);
  if (newest.length && Math.min(...newest) > STALE_MS) return undefined;

  if (focus) {
    const age = since(focus.since);
    const more = facts.openCount > 1 ? ` +${facts.openCount - 1}` : '';
    const text = `${who(focus)} · ${describeOpen(focus)}${age === undefined ? '' : ` · ${elapsed(age)}`}${more}`;
    const basis = focus.asking
      ? 'A question to you is open: the harness recorded the call and no answer yet.'
      : `A call is open: the harness recorded it${age === undefined ? '' : ` ${elapsed(age)} ago`} and no result yet. Long commands stay open until they finish.${turn}`;
    return asking
      ? { tone: 'asking', text, basis, tab: `? Needs you${where}`, mark: 'asking' }
      : { tone: 'running', text, basis, tab: `● Running${where}`, mark: 'running' };
  }

  const last = facts.last, age = since(last?.time);
  if (!last || age === undefined) return { tone: 'quiet', text: `${ctx.harness} · live`, basis: 'Watching the journal. No timed event has been captured yet.' };
  if (last.what === 'reply') return { tone: 'replied', text: `${ctx.harness} · replied ${elapsed(age)} ago`, basis: 'The newest captured event is an agent reply and no call is open.' };
  if (age < WORKING_WINDOW_MS) {
    return { tone: 'working', text: `${ctx.harness} · working`, basis: `No call is open and the newest event is ${last.what === 'prompt' ? 'a prompt' : last.what === 'reasoning' ? 'reasoning' : 'a tool result'} from ${elapsed(age)} ago, so the model is most likely still going.${turn}`, tab: `◐ Working${where}`, mark: 'working' };
  }
  return { tone: 'quiet', text: `${ctx.harness} · no activity for ${elapsed(age)}`, basis: `No call is open and nothing new was captured for ${elapsed(age)}.` };
}
