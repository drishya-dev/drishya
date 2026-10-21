// Harness-neutral descriptions of what a tool call meant to do and what it returned.
// Adapters own the mapping from harness tool names to these; the projection never sees names.

import { isDeniedPath, mentionsDeniedPath } from '@drishya/privacy';

export type ToolIntent =
  | { kind: 'read'; path: string; offset?: number; limit?: number }
  | { kind: 'write'; path: string; content?: string }
  | { kind: 'edit'; path: string; edits: { oldString: string; newString: string; replaceAll?: boolean }[] }
  | { kind: 'patch'; patch: string }
  | { kind: 'search'; mode: 'text' | 'file'; query: string; path?: string; glob?: string }
  | { kind: 'shell'; command: string; cwd?: string }
  | { kind: 'mcp'; server: string; tool: string }
  | { kind: 'web'; url?: string; query?: string }
  | { kind: 'spawn'; agentType?: string; description?: string; prompt?: string }
  | { kind: 'plan'; items: { text: string; status: string }[] }
  | { kind: 'other' };

export type ToolOutcome =
  | { kind: 'read'; path?: string; content?: string; startLine?: number; numLines?: number; totalLines?: number; harnessLineNumbers?: boolean }
  | { kind: 'edit'; path?: string; originalFile?: string | null; hunks?: RawHunk[]; created?: boolean; content?: string }
  | { kind: 'search'; files?: string[]; lines?: string; total?: number }
  | { kind: 'shell'; stdout?: string; stderr?: string; interrupted?: boolean; run?: ShellRun }
  | { kind: 'web'; url?: string; status?: number; text?: string; statusText?: string; bytes?: number; durationMs?: number }
  | { kind: 'spawn'; childAgentId?: string; text?: string }
  | { kind: 'other' };

/** What the harness recorded about how a command ran, beyond its output. */
export interface ShellRun {
  /** The harness moved the command to the background (its task id), e.g. after a timeout. */
  backgroundTaskId?: string;
  timedOutAfterMs?: number;
  /** The harness's own reading of a non-zero exit, e.g. "No matches found". */
  exitNote?: string;
  /** Output too large for the journal, saved by the harness to a file. Reference only. */
  persistedOutput?: { path: string; bytes?: number };
}

export interface RawHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

/**
 * Whether a call reaches a protected file (`.env`, keys, credentials) by any route: a structured
 * path, a shell command that names it, or a patch that edits it. Its result is then treated as
 * protected content, and so is a patch body, whatever shape the harness gives them.
 */
export function touchesProtectedFile(intent: ToolIntent): boolean {
  switch (intent.kind) {
    case 'read':
    case 'write':
    case 'edit':
      return isDeniedPath(intent.path);
    case 'search':
      return !!intent.path && isDeniedPath(intent.path);
    case 'shell':
      return mentionsDeniedPath(intent.command);
    case 'patch':
      return mentionsDeniedPath(intent.patch);
    default:
      return false;
  }
}

export function parseMcpName(name: string): { server: string; tool: string } | undefined {
  if (!name.startsWith('mcp__')) return undefined;
  const parts = name.split('__');
  if (parts.length < 3) return undefined;
  return { server: parts[1]!, tool: parts.slice(2).join('__') };
}
