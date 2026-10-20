// Codex adapter: tolerant import and tailing of ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl.
// Codex records have no native ids, so identity is generation + byte offset. Reasoning is
// exposed only as summaries; encrypted reasoning is never decoded or shown.

import { homedir } from 'node:os';
import { join } from 'node:path';
import type { AdapterDescriptor, DiscoveredSource, Observation, UsagePayload } from '@drishya/contracts';
import {
  fileInfo,
  headRecords,
  listFiles,
  parseMcpName,
  textOf,
  touchesProtectedFile,
  literalPatch,
  usageTokens,
  primaryUsageLimits,
  type Adapter,
  type ParseContext,
  type RawObservation,
  type RecordParser,
  type ToolIntent,
  type ToolOutcome,
} from '@drishya/capture-core';
import { sanitize } from '@drishya/privacy';

export const descriptor: AdapterDescriptor = {
  id: 'codex',
  harness: 'codex',
  version: '0.1.0',
  label: 'Codex',
  testedHarnessVersions: ['rollout format with response_item/event_msg, verified on this machine 2026-09-22'],
  capabilities: {
    liveLifecycle: 'partial',
    chunkedOutput: 'unavailable',
    readContent: 'partial', // reads happen through shell commands; classified, not captured as reads
    patchIntent: 'supported', // apply_patch text
    confirmedWrite: 'partial',
    beforeSnapshot: 'unavailable',
    afterSnapshot: 'unavailable',
    exposedRationale: 'partial', // reasoning summaries only
    delegation: 'unavailable',
    replay: 'supported',
  },
};

const MAIN = 'agent:main';
type Rec = Record<string, any>;

/** Records that duplicate response items or carry only accounting. Ignored on purpose. */
const IGNORED_TOP = new Set(['token_usage_record', 'world_state', 'compacted_history', 'inter_agent_communication_metadata']);

/** Codex addresses agents by path: "/root" is the main agent, "/root/<task>" a spawned one. */
const agentFromAddress = (a: unknown) => (typeof a === 'string' && a !== '/root' && a.startsWith('/root/') ? `agent:${a.split('/').pop()}` : MAIN);
const IGNORED_EVENTS = new Set([
  'item_completed', 'item_started', 'thread_settings_applied', 'user_message', 'agent_message',
  'agent_reasoning', 'agent_reasoning_raw_content', 'exec_command_begin', 'exec_command_end', 'exec_command_output_delta',
  'patch_apply_begin', 'patch_apply_end', 'mcp_tool_call_begin', 'mcp_tool_call_end', 'web_search_begin', 'web_search_end',
  'session_configured', 'background_event', 'turn_diff', 'plan_update', 'entered_review_mode', 'exited_review_mode',
]);

export function codexHome(): string {
  return process.env.DRISHYA_CODEX_HOME ?? process.env.CODEX_HOME ?? join(homedir(), '.codex');
}

/** Harness-injected context that is not something the user typed. */
function isInjectedUserText(t: string): boolean {
  const s = t.trimStart();
  // Codex injects context as tagged blocks (<environment_context>, <recommended_plugins>, …)
  // and AGENTS.md as a markdown block. A person's own message does not open with a tag.
  return /^<[a-z_][\w-]*(\s[^>]*)?>/i.test(s) || s.startsWith('# AGENTS.md');
}

function parseArgs(a: unknown): Rec {
  if (a && typeof a === 'object') return a as Rec;
  if (typeof a !== 'string') return {};
  try {
    const v = JSON.parse(a);
    return v && typeof v === 'object' ? v : { value: v };
  } catch {
    return { raw: a };
  }
}

function commandText(c: unknown): string {
  if (Array.isArray(c)) {
    // ["bash","-lc","..."] and ["powershell","-Command","..."] wrap the real command.
    const s = c.map(String);
    if (s.length >= 3 && /^(ba|z)?sh$|powershell|pwsh/i.test(s[0]!.split(/[\\/]/).pop() ?? '')) return s.slice(2).join(' ');
    return s.join(' ');
  }
  return typeof c === 'string' ? c : '';
}

export function intentOf(name: string, args: Rec, namespace?: string): ToolIntent {
  // MCP tools arrive either as "mcp__server__tool" or with namespace "mcp__server". Other
  // namespaces ("collaboration", "codex_app") are Codex's own tools, not MCP servers.
  const mcp = parseMcpName(name) ?? (namespace?.startsWith('mcp__') ? { server: namespace.slice(5).replace(/__$/, ''), tool: name } : undefined);
  if (mcp) return { kind: 'mcp', ...mcp };
  switch (name) {
    case 'spawn_agent':
      return { kind: 'spawn', agentType: typeof args.task_name === 'string' ? args.task_name : undefined, description: typeof args.message === 'string' ? args.message : undefined };
    case 'shell':
    case 'shell_command':
    case 'exec_command':
    case 'functions.exec_command':
    case 'container.exec':
    case 'local_shell':
      return { kind: 'shell', command: commandText(args.command ?? args.cmd), cwd: typeof args.workdir === 'string' ? args.workdir : undefined };
    case 'functions.exec':
    case 'exec': {
      // Codex "code mode": the model runs a script that calls tools. Shown as code it ran.
      const source = typeof args.raw === 'string' ? args.raw : typeof args.code === 'string' ? args.code : '';
      const patch = literalPatch(source);
      return patch ? { kind: 'patch', patch } : { kind: 'shell', command: source };
    }
    case 'functions.apply_patch':
    case 'apply_patch':
      return { kind: 'patch', patch: typeof args.raw === 'string' ? args.raw : typeof args.input === 'string' ? args.input : '' };
    case 'update_plan':
      return { kind: 'plan', items: (Array.isArray(args.plan) ? args.plan : []).map((p: Rec) => ({ text: String(p.step ?? ''), status: String(p.status ?? '') })) };
    case 'web_search':
      return { kind: 'web', query: typeof args.query === 'string' ? args.query : undefined };
    case 'view_image':
      return { kind: 'read', path: String(args.path ?? '') };
    default:
      return { kind: 'other' };
  }
}

/** Codex shell output: JSON {output, metadata:{exit_code}} or text "Exit code: N\nWall time: …\nOutput:\n…". */
export function parseShellOutput(raw: unknown): { text?: string; exitCode?: number | null; durationMs?: number } {
  let text = typeof raw === 'string' ? raw : textOf(raw);
  if (text === undefined) return {};
  try {
    const v = JSON.parse(text);
    if (v && typeof v === 'object' && 'output' in v) {
      return { text: String(v.output ?? ''), exitCode: typeof v.metadata?.exit_code === 'number' ? v.metadata.exit_code : undefined, durationMs: typeof v.metadata?.duration_seconds === 'number' ? Math.round(v.metadata.duration_seconds * 1000) : undefined };
    }
  } catch {
    // plain text
  }
  const exit = /^Exit code:\s*(-?\d+)/m.exec(text);
  const wall = /^Wall time:\s*([\d.]+)\s*seconds/m.exec(text);
  const body = /^Output:\r?\n([\s\S]*)$/m.exec(text);
  return { text: body ? body[1] : text, exitCode: exit ? Number(exit[1]) : undefined, durationMs: wall ? Math.round(Number(wall[1]) * 1000) : undefined };
}

export function createParser(_ctx: ParseContext): RecordParser {
  const calls = new Map<string, { tool: string; intent: ToolIntent }>();
  let cwd: string | undefined;
  let version: string | undefined;
  let branch: string | undefined;
  let model: string | undefined;
  let turnId: string | undefined;

  return {
    prime(observations: Observation[]) {
      for (const o of observations) {
        if (o.kind === 'turn.start') {
          const payload = o.payload as { turnId?: string };
          turnId = payload.turnId;
        }
        if (o.kind === 'turn.end') turnId = undefined;
        if (o.kind === 'session.meta') {
          const p = o.payload as { cwd?: string; harnessVersion?: string; branch?: string; model?: string };
          cwd = p.cwd ?? cwd;
          version = p.harnessVersion ?? version;
          branch = p.branch ?? branch;
          model = p.model ?? model;
        }
        if (o.kind === 'tool.call' && o.operationId) {
          const p = o.payload as { tool?: string; intent?: ToolIntent };
          if (p.tool && p.intent) calls.set(o.operationId, { tool: p.tool, intent: p.intent });
        }
      }
    },

    parse(record: unknown): RawObservation[] {
      if (!record || typeof record !== 'object') return [];
      const r = record as Rec;
      const type = String(r.type ?? '');
      const p = (r.payload ?? {}) as Rec;
      const base = { sourceTime: typeof r.timestamp === 'string' ? r.timestamp : undefined, agentId: MAIN, workspaceRoot: cwd, branchRef: branch, harnessVersion: version, part: 0 };

      if (IGNORED_TOP.has(type)) return [];
      if (type === 'session_meta') {
        cwd = typeof p.cwd === 'string' ? p.cwd : cwd;
        version = typeof p.cli_version === 'string' ? p.cli_version : version;
        branch = typeof p.git?.branch === 'string' ? p.git.branch : branch;
        // Provider identifies a service, not the model that performed this turn.
        return [{ ...base, workspaceRoot: cwd, harnessVersion: version, branchRef: branch, kind: 'session.meta', payload: { harness: 'codex', harnessVersion: version, cwd, branch } }];
      }
      if (type === 'turn_context') {
        const nextCwd = typeof p.cwd === 'string' ? p.cwd : cwd;
        const nextModel = typeof p.model === 'string' ? p.model : model;
        if (nextCwd !== cwd || nextModel !== model) {
          cwd = nextCwd; model = nextModel;
          return [{ ...base, workspaceRoot: cwd, kind: 'session.meta', payload: { harness: 'codex', cwd, model } }];
        }
        return [];
      }
      if (type === 'event_msg') {
        const t = String(p.type ?? '');
        if (t === 'task_started') { turnId = typeof p.turn_id === 'string' ? p.turn_id : undefined; return [{ ...base, kind: 'turn.start', payload: { turnId: p.turn_id } }]; }
        if (t === 'token_count') {
          const keys = { input_tokens: 'input', cached_input_tokens: 'cachedInput', cache_write_input_tokens: 'cacheWrite', output_tokens: 'output', reasoning_output_tokens: 'reasoningOutput', total_tokens: 'total' } as const;
          const tokens = usageTokens(p.info?.total_token_usage, keys), request = usageTokens(p.info?.last_token_usage, keys);
          const limits = primaryUsageLimits(p.rate_limits);
          const contextWindow = Number.isSafeInteger(p.info?.model_context_window) && p.info.model_context_window > 0 ? p.info.model_context_window : undefined;
          const shared = { source: 'codex-token-count' as const, ...(model ? { model } : {}), ...(turnId ? { turnId } : {}), ...(limits ? { limits } : {}), ...(contextWindow ? { contextWindow } : {}) };
          const out: RawObservation[] = [];
          const emit = (part: number, payload: UsagePayload) => out.push({ ...base, part, kind: 'usage', payload: { ...payload } });
          if (tokens || limits || contextWindow) emit(0, { ...shared, cumulative: true, ...(tokens ? { tokens } : {}) });
          if (request) emit(1, { ...shared, cumulative: false, tokens: request });
          return out;
        }
        if (t === 'task_complete') { turnId = undefined; return [{ ...base, kind: 'turn.end', payload: { turnId: p.turn_id } }]; }
        if (t === 'turn_aborted') { turnId = undefined; return [{ ...base, kind: 'turn.end', payload: { turnId: p.turn_id, reason: p.reason ?? 'aborted' } }]; }
        if (t === 'context_compacted') return [{ ...base, kind: 'compaction', payload: {} }];
        if (IGNORED_EVENTS.has(t)) return [];
        return [{ ...base, kind: 'unknown', payload: { recordType: `event_msg:${t}` }, availability: 'metadata-only' }];
      }
      if (type === 'compacted') return [{ ...base, kind: 'compaction', payload: { summary: typeof p.message === 'string' ? p.message : undefined }, contentKeys: ['summary'] }];
      if (type !== 'response_item') return [{ ...base, kind: 'unknown', payload: { recordType: type || 'untyped' }, availability: 'metadata-only' }];

      switch (p.type) {
        case 'message': {
          if (p.role === 'developer' || p.role === 'system') return [];
          const text = textOf(p.content) ?? '';
          if (!text) return [];
          if (p.role === 'user') return isInjectedUserText(text) ? [] : [{ ...base, kind: 'message.user', payload: { text }, contentKeys: ['text'] }];
          return [{ ...base, kind: 'message.assistant', payload: { text }, contentKeys: ['text'] }];
        }
        case 'reasoning': {
          const text = (Array.isArray(p.summary) ? p.summary : []).map((s: Rec) => s.text).filter(Boolean).join('\n\n');
          return text ? [{ ...base, kind: 'reasoning', payload: { text, exposure: 'summary' }, contentKeys: ['text'] }] : [];
        }
        case 'function_call':
        case 'custom_tool_call':
        case 'local_shell_call': {
          const name = p.type === 'local_shell_call' ? 'local_shell' : String(p.name ?? '');
          const args = p.type === 'custom_tool_call' ? { raw: p.input } : p.type === 'local_shell_call' ? (p.action ?? {}) : parseArgs(p.arguments);
          const intent = intentOf(name, args, typeof p.namespace === 'string' ? p.namespace : undefined);
          const id = String(p.call_id ?? p.id ?? '');
          if (id) calls.set(id, { tool: name, intent });
          // A patch that edits a protected file carries its contents in the call itself.
          const protectedPatch = intent.kind === 'patch' && touchesProtectedFile(intent);
          return [{ ...base, kind: 'tool.call', operationId: id || undefined, payload: { tool: name, input: args, intent }, ...(protectedPatch ? { denyContent: true, contentKeys: ['input', 'intent'] } : {}) }];
        }
        case 'function_call_output':
        case 'custom_tool_call_output': {
          const id = String(p.call_id ?? '');
          const call = calls.get(id);
          const intent = call?.intent ?? { kind: 'other' as const };
          const parsed = parseShellOutput(p.output);
          let outcome: ToolOutcome = { kind: 'other' };
          if (intent.kind === 'shell') outcome = { kind: 'shell', stdout: parsed.text };
          const isError = parsed.exitCode !== undefined && parsed.exitCode !== 0 ? true : /^(execution error|error:)/i.test(parsed.text ?? '');
          const out: RawObservation[] = [{
            ...base,
            kind: 'tool.result',
            operationId: id || undefined,
            payload: { tool: call?.tool, isError, text: parsed.text, outcome, exitCode: parsed.exitCode, durationMs: parsed.durationMs },
            denyContent: touchesProtectedFile(intent),
            contentKeys: ['text', 'outcome'],
          }];
          if (intent.kind === 'spawn' && intent.agentType && !isError) {
            // The task name is the address Codex uses for the child, so this is a captured reference.
            out.push({ ...base, part: 1, kind: 'agent.spawn', operationId: id || undefined, payload: { childAgentId: `agent:${intent.agentType}`, agentType: intent.agentType, description: intent.description, basis: 'captured-reference' } });
          }
          return out;
        }
        case 'agent_message': {
          // Messages from a spawned agent back to the main one are that agent's words. Messages
          // the main agent sends are already visible as its spawn/send_message calls.
          const author = agentFromAddress(p.author);
          if (author === MAIN) return [];
          const text = textOf((Array.isArray(p.content) ? p.content : []).filter((c: Rec) => c?.type === 'input_text' || c?.type === 'output_text')) ?? '';
          return text ? [{ ...base, agentId: author, kind: 'message.assistant', payload: { text }, contentKeys: ['text'] }] : [];
        }
        case 'web_search_call':
          return [{ ...base, kind: 'tool.call', operationId: typeof p.id === 'string' ? p.id : undefined, payload: { tool: 'web_search', input: p.action ?? {}, intent: { kind: 'web', query: p.action?.query } } }];
        default:
          return [{ ...base, kind: 'unknown', payload: { recordType: `response_item:${p.type}` }, availability: 'metadata-only' }];
      }
    },
  };
}

async function discover(): Promise<DiscoveredSource[]> {
  const root = join(codexHome(), 'sessions');
  const files = await listFiles(root, (n) => n.startsWith('rollout-') && n.endsWith('.jsonl'), 0, 4);
  const out: DiscoveredSource[] = [];
  for (const path of files) {
    const info = await fileInfo(path);
    if (!info || info.bytes === 0) continue;
    const head = (await headRecords(path)) as Rec[];
    const meta = head.find((r) => r.type === 'session_meta')?.payload;
    const firstUser = head.find((r) => r.type === 'response_item' && r.payload?.type === 'message' && r.payload.role === 'user' && !isInjectedUserText(textOf(r.payload.content) ?? '<'));
    const t = firstUser ? textOf(firstUser.payload.content) : undefined;
    out.push({
      adapterId: descriptor.id,
      harness: 'codex',
      path,
      bytes: info.bytes,
      modifiedAt: info.modifiedAt,
      cwd: typeof meta?.cwd === 'string' ? meta.cwd : undefined,
      title: t ? sanitize(t.slice(0, 160)).value : undefined,
      companions: [],
    });
  }
  return out.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}

export const codexAdapter: Adapter = {
  descriptor,
  discover,
  sourceSet: async (main) => ({ main, companions: [] }),
  createParser,
  sniff: (head) => (head as Rec[]).some((r) => r && (r.type === 'session_meta' || r.type === 'response_item') && 'payload' in r),
};
