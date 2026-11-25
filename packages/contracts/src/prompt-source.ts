import { ANTIGRAVITY_REQUEST_RULE } from './antigravity-request.ts';
import type { Provenance } from './index.ts';

/**
 * Claude Code writes some of its own notices into the journal in the user role: a finished background task, a slash-command echo and its
 * output, an interruption, a reminder. They are not typed by the person, so History must not call them "You". Recognised by an exact leading
 * tag only (CONTENT-20 adds a message another Claude Code session sent in, `<cross-session-message>`, which Claude Code delivers like a
 * queued prompt but whose origin is `peer`, not the person); a prompt that merely mentions a tag, or any unknown wrapper, stays a prompt. Presentation of captured text: nothing is inferred
 * and the exact captured text stays one click away.
 */
export type InjectedKind = 'background-task' | 'slash-command' | 'command-output' | 'interrupted' | 'reminder' | 'cross-session';
export interface InjectedMessage {
  kind: InjectedKind;
  /** Drishya's own label for what the harness wrote, with the recorded status where there is one. */
  label: string;
  /** The recorded words (summary, command, output), never a rewrite. */
  detail: string;
  /** Extra recorded fact for the label's hover, such as the task id. */
  hover?: string;
}

const field = (text: string, tag: string) => {
  // The closing tag may be missing when the preview was clipped; take what is there.
  const match = new RegExp(`<${tag}>([\\s\\S]*?)(?:</${tag}>|$)`).exec(text);
  const value = match?.[1]?.trim();
  return value ? value : undefined;
};

export function injectedMessage(text: string): InjectedMessage | undefined {
  const s = text.trimStart();
  if (s.startsWith('<task-notification>')) {
    const status = field(s, 'status'), summary = field(s, 'summary'), id = field(s, 'task-id');
    if (!status && !summary) return;
    return { kind: 'background-task', label: `background task${status ? ` ${status}` : ''}`, detail: summary ?? '', ...(id ? { hover: `Task ${id}` } : {}) };
  }
  if (s.startsWith('<command-name>')) {
    const name = field(s, 'command-name');
    if (!name) return;
    return { kind: 'slash-command', label: 'slash command', detail: [name, field(s, 'command-args')].filter(Boolean).join(' ') };
  }
  if (s.startsWith('<local-command-stdout>')) return { kind: 'command-output', label: 'command output', detail: field(s, 'local-command-stdout') ?? '' };
  if (/^\[Request interrupted by user( for tool use)?\]/.test(s)) return { kind: 'interrupted', label: 'interrupted', detail: s.replace(/^\[|\]\s*$/g, '').trim() };
  if (s.startsWith('<cross-session-message')) {
    const head = /^<cross-session-message([^>]*)>/.exec(s);
    if (!head) return;
    const name = /\sfrom-name="([^"]*)"/.exec(head[1]!)?.[1]?.trim();
    const body = s.slice(head[0].length).replace(/<\/cross-session-message>\s*$/, '').trim();
    return { kind: 'cross-session', label: 'message from another session', detail: body, ...(name ? { hover: `From ${name}` } : {}) };
  }
  if (s.startsWith('<system-reminder>')) {
    const body = field(s, 'system-reminder');
    if (!body) return;
    return { kind: 'reminder', label: 'reminder', detail: body };
  }
  return;
}

/** One line for lists that show prompts (the prompt rail): never "You", always the source. */
export function injectedLine(message: InjectedMessage): string {
  return `Claude Code · ${message.label}${message.detail ? `: ${message.detail.replace(/\s+/g, ' ')}` : ''}`;
}

/** A recorded user-role message is a person prompt unless its exact known shape says otherwise.
 * Undefined/empty text is intentional: image-only prompts still count. Unknown wrappers stay literal.
 * Codex typed collaboration deliveries are assistant records; sub-agent delegation prompts are
 * already excluded by the reducer. Do not guess their source from ordinary quoted routing text. */
export function isPersonPrompt(text: string | undefined): boolean {
  if (text === undefined) return true;
  if (injectedMessage(text)) return false;
  const s = text.trimStart();
  return !/^(?:<environment_context(?:\s[^>]*)?>|<subagent_notification(?:\s[^>]*)?>|# AGENTS\.md instructions for )/.test(s);
}

/** A decoded Antigravity envelope establishes its own origin, even if the request quotes a native notice. */
export function isPersonTurn(turn: { prompt?: string; promptProvenance?: Provenance }): boolean {
  const provenance = turn.promptProvenance;
  return (provenance?.kind === 'derived' && provenance.rule === ANTIGRAVITY_REQUEST_RULE) || isPersonPrompt(turn.prompt);
}
