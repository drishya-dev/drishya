// Harness-neutral descriptions of what a tool call meant to do and what it returned.
// Adapters own the mapping from harness tool names to these; the projection never sees names.

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
  | { kind: 'shell'; stdout?: string; stderr?: string; interrupted?: boolean }
  | { kind: 'web'; url?: string; status?: number; text?: string }
  | { kind: 'spawn'; childAgentId?: string; text?: string }
  | { kind: 'other' };

export interface RawHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

export function parseMcpName(name: string): { server: string; tool: string } | undefined {
  if (!name.startsWith('mcp__')) return undefined;
  const parts = name.split('__');
  if (parts.length < 3) return undefined;
  return { server: parts[1]!, tool: parts.slice(2).join('__') };
}
