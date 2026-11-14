import { basename } from 'node:path';
import { artifactName } from './paths.ts';
import { touchesProtectedFile, type ToolIntent, type ToolOutcome } from '@drishya/capture-core';

/** Argument values in the transcript are individually JSON encoded, not the whole object. */
export function decodeArgs(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    if (typeof item !== 'string') return [key, item];
    try { return [key, JSON.parse(item)]; } catch { return [key, item]; }
  }));
}

type Args = Record<string, unknown>;
const str = (a: Args, ...keys: string[]): string | undefined => {
  for (const key of keys) if (typeof a[key] === 'string') return a[key] as string;
  return undefined;
};
const num = (a: Args, key: string): number | undefined => typeof a[key] === 'number' && Number.isFinite(a[key]) ? a[key] : undefined;
const pathFor = (a: Args) => str(a, 'Path', 'AbsolutePath', 'TargetFile') ?? '';
const edit = (a: Args) => ({ oldString: str(a, 'Target', 'TargetContent') ?? '', newString: str(a, 'Replacement', 'ReplacementContent') ?? '', ...(typeof a.AllowMultiple === 'boolean' ? { replaceAll: a.AllowMultiple } : {}) });

export function intentFor(tool: string, args: Args): ToolIntent {
  switch (tool.toLowerCase()) {
    case 'read_file': case 'view_file': {
      const start = num(args, 'StartLine'), end = num(args, 'EndLine');
      return { kind: 'read', path: pathFor(args), ...(start !== undefined ? { offset: start } : {}), ...(start !== undefined && end !== undefined && end >= start ? { limit: end - start + 1 } : {}) };
    }
    case 'write_file': case 'write_to_file': return { kind: 'write', path: pathFor(args), content: str(args, 'Content', 'CodeContent') };
    case 'edit_file': case 'replace_file_content': case 'multi_replace_file_content': {
      const chunks = Array.isArray(args.ReplacementChunks) ? args.ReplacementChunks.filter((v): v is Args => !!v && typeof v === 'object' && !Array.isArray(v)) : undefined;
      return { kind: 'edit', path: pathFor(args), edits: chunks ? chunks.map(edit) : [edit(args)] };
    }
    case 'grep_search': return { kind: 'search', mode: 'text', query: str(args, 'Query') ?? '', path: str(args, 'SearchPath'), glob: str(args, 'Includes') };
    case 'find_by_name': return { kind: 'search', mode: 'file', query: str(args, 'Pattern') ?? '', path: str(args, 'SearchDirectory') };
    case 'run_command': return { kind: 'shell', command: str(args, 'CommandLine') ?? '', cwd: str(args, 'Cwd') };
    case 'call_mcp_tool': {
      const server = str(args, 'ServerName'), tool = str(args, 'ToolName');
      return server?.trim() && tool?.trim() ? { kind: 'mcp', server, tool } : { kind: 'other' };
    }
    case 'search_web': return { kind: 'web', query: str(args, 'Query') };
    case 'read_url_content': return { kind: 'web', url: str(args, 'Url', 'URL') };
    case 'swarm': return args.action === 'add' ? { kind: 'spawn', agentType: str(args, 'name'), description: str(args, 'brief'), prompt: str(args, 'brief') } : { kind: 'other' };
    case 'invoke_subagent': case 'define_subagent': case 'manage_subagents': return { kind: 'spawn', agentType: str(args, 'type_name', 'TypeName'), description: str(args, 'role', 'Role'), prompt: str(args, 'Prompt', 'prompt') };
    default: return { kind: 'other' };
  }
}

/** Only an explicit status is evidence of a process exit. */
export function recordedExitCode(content: string): number | undefined {
  const match = content.match(/(?:^|\n)\s*(?:exit code|exit status)\s*:\s*(-?\d+)\s*(?:\r?$)/im);
  return match ? Number(match[1]) : undefined;
}

export function outcomeFor(tool: string, args: Args, content: string): ToolOutcome {
  switch (tool.toLowerCase()) {
    case 'read_file': case 'view_file': {
      const range = content.match(/Showing lines\s+(\d+)\s*[-–]\s*(\d+)\s+of\s+(\d+)/i);
      const rows = content.split(/\r?\n/).filter(line => /^\s*\d+:/.test(line));
      return { kind: 'read', path: pathFor(args), content: rows.length ? rows.join('\n') : content,
        ...(range ? { startLine: Number(range[1]), numLines: rows.length || Number(range[2]) - Number(range[1]) + 1, totalLines: Number(range[3]) } : rows.length ? { startLine: Number(/^\s*(\d+):/.exec(rows[0]!)![1]), numLines: rows.length } : {}),
        ...(rows.length ? { harnessLineNumbers: true } : {}) };
    }
    case 'write_file': case 'write_to_file': return { kind: 'edit', path: pathFor(args), ...(/\bCreated file\b/i.test(content) ? { created: true } : {}) };
    case 'edit_file': case 'replace_file_content': case 'multi_replace_file_content': return { kind: 'edit', path: pathFor(args) };
    case 'grep_search': return { kind: 'search', lines: content };
    case 'find_by_name': return { kind: 'search', lines: content };
    case 'run_command': return { kind: 'shell', stdout: content };
    case 'search_web': case 'read_url_content': return { kind: 'web', text: content, url: str(args, 'Url', 'URL') };
    case 'swarm': return args.action === 'add' ? { kind: 'spawn', text: content } : { kind: 'other' };
    case 'invoke_subagent': case 'define_subagent': case 'manage_subagents': return { kind: 'spawn', text: content };
    default: return { kind: 'other' };
  }
}

export { touchesProtectedFile };
/** Artifacts are not edits to the user's repository. */
export function isPlanArtifact(args: Args): boolean {
  const name = basename(pathFor(args).replace(/\\/g, '/')).replace(/\.resolved(?:\.\d+)?$/, '');
  return args.ArtifactMetadata !== undefined && artifactName(name);
}
