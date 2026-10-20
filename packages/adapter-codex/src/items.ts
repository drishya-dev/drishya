import type { ItemPayload } from '@drishya/contracts';
import { isDeniedPath, mentionsDeniedPath } from '@drishya/privacy';
type Rec = Record<string, any>;
const str = (v: unknown) => typeof v === 'string' ? v : undefined;
const number = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? v : undefined;
function duration(value: unknown): number | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const v = value as Rec;
  return Number.isSafeInteger(v.secs) && v.secs >= 0 && Number.isSafeInteger(v.nanos) && v.nanos >= 0 && v.nanos < 1e9 ? v.secs * 1000 + v.nanos / 1e6 : undefined;
}

/** Only supported fields enter capture; account/plugin fields and unknown future content do not. */
export function typedItem(value: unknown, commandText: (v: unknown) => string): { payload: ItemPayload; denyContent?: boolean } | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const v = value as Rec;
  if (typeof v.id !== 'string' || !v.id) return undefined;
  const base = { itemId: v.id, status: str(v.status), durationMs: duration(v.duration) };
  switch (v.type) {
    case 'CommandExecution': {
      if (!(typeof v.command === 'string' || Array.isArray(v.command) && v.command.every((p: unknown) => typeof p === 'string'))) return undefined;
      const command = commandText(v.command);
      return { denyContent: mentionsDeniedPath(command), payload: { ...base, item: 'command', command, cwd: str(v.cwd), exitCode: number(v.exit_code),
        output: str(v.aggregated_output) ?? [str(v.stdout), str(v.stderr)].filter(p => p !== undefined).join('\n'),
        parsed: Array.isArray(v.parsed_cmd) ? v.parsed_cmd.filter((p: Rec) => p && typeof p.type === 'string').map((p: Rec) => ({ kind: p.type, path: str(p.path) })) : undefined } };
    }
    case 'FileChange': {
      if (!v.changes || typeof v.changes !== 'object' || Array.isArray(v.changes)) return undefined;
      let denyContent = false;
      const changes: NonNullable<ItemPayload['changes']> = [];
      for (const [path, raw] of Object.entries(v.changes)) {
        if (!raw || typeof raw !== 'object') return undefined;
        const change = raw as Rec;
        if (!['add', 'update', 'delete', 'move'].includes(change.type)) return undefined;
        const denied = isDeniedPath(path) || !!str(change.move_path) && isDeniedPath(change.move_path);
        denyContent ||= denied;
        changes.push({ path, type: change.type, ...(!denied && typeof (change.content ?? change.unified_diff) === 'string' ? { content: change.content ?? change.unified_diff } : {}) });
      }
      return { denyContent, payload: { ...base, item: 'file-change', changes, output: [str(v.stdout), str(v.stderr)].filter(p => p !== undefined).join('\n') } };
    }
    case 'McpToolCall':
      if (typeof v.server !== 'string' || typeof v.tool !== 'string') return undefined;
      return { payload: { ...base, item: 'mcp-call', mcp: { server: v.server, tool: v.tool, readOnlyHint: typeof v.readOnlyHint === 'boolean' ? v.readOnlyHint : undefined,
        isError: typeof v.result?.isError === 'boolean' ? v.result.isError : undefined, error: str(v.error?.message), result: v.result === undefined ? undefined : JSON.stringify(v.result) } } };
    case 'SubAgentActivity':
      if (typeof v.agent_thread_id !== 'string') return undefined;
      return { payload: { ...base, item: 'subagent', agent: { threadId: v.agent_thread_id, path: str(v.agent_path), kind: str(v.kind), model: str(v.model), effort: str(v.reasoning_effort) } } };
    case 'ImageView':
      if (typeof v.path !== 'string') return undefined;
      return { payload: { ...base, item: 'image-view', image: { path: v.path, origin: 'agent-viewed', availability: 'metadata-only' } } };
    case 'Extension':
      if (v.kind === 'web.search') return { payload: { ...base, item: 'web-search', web: { query: str(v.query), results: Array.isArray(v.results) ? v.results.filter((r: Rec) => r && typeof r.url === 'string').map((r: Rec) => ({ url: r.url, title: str(r.title), domain: str(r.domain), snippet: str(r.snippet) })) : undefined } } };
      if (v.kind === 'image.generation') return { payload: { ...base, item: 'image-generation', image: { savedPath: str(v.savedPath), revisedPrompt: str(v.revisedPrompt), origin: 'generated', availability: 'metadata-only' } } };
      return undefined;
    default: return undefined;
  }
}
