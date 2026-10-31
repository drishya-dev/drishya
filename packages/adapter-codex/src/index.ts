// Codex adapter: tolerant import and tailing of ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl.
// Codex records have no native ids, so identity is generation + byte offset. Reasoning is
// exposed only as summaries; encrypted reasoning is never decoded or shown.

import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import type { AdapterDescriptor, CompactionPayload, DiscoveredSource, Observation, ToolsSnapshotPayload, UsagePayload } from '@drishya/contracts';
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
import { imageCandidate, sanitize } from '@drishya/privacy';
import { typedItem } from './items.ts';
import { agentDelivery } from './agent-delivery.ts';
import { turnDetail, turnEndedDetail, turnSettingsDetail, turnStartedDetail } from './turns.ts';

export const descriptor: AdapterDescriptor = {
  id: 'codex',
  harness: 'codex',
  version: '0.1.0',
  label: 'Codex',
  testedHarnessVersions: ['rollout format with response_item/event_msg, verified on this machine 2026-09-22', '0.162.0-alpha.2: typed-item field audit and synthetic fixture coverage, 2026-10-20; see adapter-codex/README.md for limits', '0.162.0-alpha.17.2: message/reasoning item metadata only; command/file/MCP item coverage unverified'],
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
/** A tool or group name as a harness writes it; anything else is not a name and is not kept. */
const TOOL_NAME = /^[A-Za-z0-9_.:-]{1,120}$/;
const MAX_TOOL_NAMES = 400;
type Rec = Record<string, any>;

/** Records that duplicate response items or carry only accounting. Ignored on purpose. */
const IGNORED_TOP = new Set(['token_usage_record', 'world_state', 'compacted_history', 'inter_agent_communication_metadata']);

/** Codex addresses agents by path: "/root" is the main agent, "/root/<task>" a spawned one. */
const agentFromAddress = (a: unknown) => (typeof a === 'string' && a !== '/root' && a.startsWith('/root/') ? `agent:${a.split('/').pop()}` : MAIN);
const IGNORED_EVENTS = new Set([
  'item_started', 'thread_settings_applied', 'user_message', 'agent_message',
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
/** CONTENT-1: `input_image` entries carrying base64 data URLs, as unchecked candidates for sanitize. Remote URLs are never fetched. */
function dataImages(content: unknown) {
  if (!Array.isArray(content)) return [];
  return (content as Rec[]).flatMap<ReturnType<typeof imageCandidate> | { kind: 'captured-image'; omitted: 'remote' }>((c) => {
    const url = c?.type === 'input_image' && typeof c.image_url === 'string' ? c.image_url : '';
    const m = /^data:image\/[a-z+.-]+;base64,/i.exec(url);
    return m ? [imageCandidate(url.slice(m[0].length))] : /^https?:\/\//i.test(url) ? [{ kind: 'captured-image', omitted: 'remote' }] : [];
  });
}

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
  const delivered = new Map<string, Set<string>>();
  const rememberDelivery = (delivery: Rec, text: unknown) => {
    if (typeof delivery.nativeId !== 'string') return false;
    const clean = sanitize(delivery).value;
    const digest = text && typeof text === 'object' && '$blob' in text ? text.$blob : createHash('sha256').update(sanitize(typeof text === 'string' ? text : '').value).digest('hex');
    const key = JSON.stringify([clean.sender, clean.recipient, clean.type, clean.state, digest]);
    const seen = delivered.get(clean.nativeId) ?? new Set<string>();
    const duplicate = seen.has(key);seen.add(key);delivered.set(clean.nativeId, seen);
    return duplicate;
  };
  const openExec = new Set<string>();
  const track = (id: string, tool: string) => { if (tool === 'exec' || tool === 'functions.exec') openExec.add(id); };
  let cwd: string | undefined;
  let version: string | undefined;
  let branch: string | undefined;
  let model: string | undefined;
  let turnId: string | undefined;

  return {
    prime(observations: Observation[]) {
      for (const o of observations) {
        const delivery = (o.payload as Rec).delivery;
        if (o.kind === 'message.assistant' && delivery) rememberDelivery(delivery, (o.payload as Rec).text);
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
          if (p.tool) track(o.operationId, p.tool);
        }
        if (o.kind === 'tool.result' && o.operationId) openExec.delete(o.operationId);
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
        const out: RawObservation[] = [{ ...base, workspaceRoot: cwd, harnessVersion: version, branchRef: branch, kind: 'session.meta', payload: { harness: 'codex', harnessVersion: version, cwd, branch } }];
        const identity = Object.fromEntries(Object.entries({ agentNickname: p.agent_nickname, agentPath: p.agent_path, parentThreadId: p.parent_thread_id, forkedFromId: p.forked_from_id, effort: p.reasoning_effort }).filter(([, value]) => typeof value === 'string'));
        // Existing metadata IDs/payloads remain unchanged. New identity data can enrich old recordings.
        if (Object.keys(identity).length) out.push({ ...base, part: 1, workspaceRoot: cwd, kind: 'session.meta', payload: { harness: 'codex', ...identity } });
        // Lineage facts arrived later than the identity above (DATA-3), so they take their own part and can enrich old recordings.
        const spawn = p.source?.subagent?.thread_spawn;
        const lineage = Object.fromEntries(Object.entries({ threadSource: p.thread_source, startedBy: typeof p.source === 'string' ? p.source : undefined, spawnDepth: Number.isSafeInteger(spawn?.depth) ? spawn.depth : undefined, agentRole: spawn?.agent_role }).filter(([, value]) => value !== undefined && value !== null && (typeof value === 'number' || typeof value === 'string')));
        if (Object.keys(lineage).length) out.push({ ...base, part: 2, workspaceRoot: cwd, kind: 'session.meta', payload: { harness: 'codex', ...lineage } });
        return out;
      }
      if (type === 'turn_context') {
        const detail = turnDetail(base, turnSettingsDetail(p));
        const nextCwd = typeof p.cwd === 'string' ? p.cwd : cwd;
        const nextModel = typeof p.model === 'string' ? p.model : model;
        if (nextCwd !== cwd || nextModel !== model) {
          cwd = nextCwd; model = nextModel;
          return [{ ...base, workspaceRoot: cwd, kind: 'session.meta', payload: { harness: 'codex', cwd, model } }, ...detail];
        }
        return detail;
      }
      if (type === 'event_msg') {
        const t = String(p.type ?? '');
        if (t === 'item_completed') {
          const parsed = typedItem(p.item, commandText);
          if (!parsed) return [{ ...base, kind: 'unknown', payload: { recordType: `item_completed:${typeof p.item?.type === 'string' ? p.item.type : 'untyped'}` }, availability: 'metadata-only' }];
          const id = parsed.payload.itemId;
          const correlation = calls.has(id) ? { operationId: id, basis: 'source-id' as const } : openExec.size === 1 ? { operationId: [...openExec][0]!, basis: 'enclosing-call' as const } : undefined;
          const denyContent = parsed.denyContent || !!correlation && touchesProtectedFile(calls.get(correlation.operationId)?.intent ?? { kind: 'other' });
          const out: RawObservation[] = [{ ...base, kind: 'item.completed', correlation, payload: { ...parsed.payload }, denyContent, contentKeys: ['output', 'mcp'], availability: denyContent ? 'partial' : 'complete' }];
          if (parsed.payload.agent && typeof p.item.agent_nickname === 'string') out.push({ ...base, part: 1, agentId: parsed.payload.agent.path ? agentFromAddress(parsed.payload.agent.path) : `agent:${parsed.payload.agent.threadId}`, kind: 'session.meta', payload: { harness: 'codex', agentNickname: p.item.agent_nickname } });
          return out;
        }
        if (t === 'task_started') { turnId = typeof p.turn_id === 'string' ? p.turn_id : undefined; return [{ ...base, kind: 'turn.start', payload: { turnId: p.turn_id } }, ...turnDetail(base, turnStartedDetail(p))]; }
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
        if (t === 'task_complete') { turnId = undefined; return [{ ...base, kind: 'turn.end', payload: { turnId: p.turn_id } }, ...turnDetail(base, turnEndedDetail(p, 'completed'))]; }
        if (t === 'turn_aborted') { turnId = undefined; return [{ ...base, kind: 'turn.end', payload: { turnId: p.turn_id, reason: p.reason ?? 'aborted' } }, ...turnDetail(base, turnEndedDetail(p, 'aborted'))]; }
        if (t === 'context_compacted') return [{ ...base, kind: 'compaction', payload: {} }, { ...base, part: 1, kind: 'compaction', payload: { source: 'codex-context-compacted', phase: 'boundary' } satisfies CompactionPayload }];
        if (IGNORED_EVENTS.has(t)) return [];
        return [{ ...base, kind: 'unknown', payload: { recordType: `event_msg:${t}` }, availability: 'metadata-only' }];
      }
      if (type === 'compacted') {
        const summary = typeof p.message === 'string' && p.message.trim() ? p.message : undefined;
        // Only explicit compaction items establish encrypted summary availability. Never retain ciphertext.
        const encrypted = Array.isArray(p.replacement_history) && p.replacement_history.some((item: Rec) => item?.type === 'compaction' && typeof item.encrypted_content === 'string' && item.encrypted_content.length > 0);
        return [{ ...base, kind: 'compaction', payload: { summary: typeof p.message === 'string' ? p.message : undefined }, contentKeys: ['summary'] },
          { ...base, part: 1, kind: 'compaction', payload: { source: 'codex-compacted', phase: 'boundary', summaryAvailability: summary ? 'captured' : encrypted ? 'encrypted' : 'not-recorded' } satisfies CompactionPayload }];
      }
      if (type !== 'response_item') return [{ ...base, kind: 'unknown', payload: { recordType: type || 'untyped' }, availability: 'metadata-only' }];

      switch (p.type) {
        case 'message': {
          if (p.role === 'developer' || p.role === 'system') return [];
          const text = textOf(p.content) ?? '';
          // CONTENT-1: images the person attached to the prompt, inline as data URLs.
          const images = p.role === 'user' ? dataImages(p.content) : [];
          if (!text && !images.length) return [];
          if (p.role === 'user') return text && isInjectedUserText(text) ? [] : [{ ...base, kind: 'message.user', payload: { text, ...(images.length ? { images } : {}) }, contentKeys: ['text', 'images'] }];
          return [{ ...base, kind: 'message.assistant', payload: { text }, contentKeys: ['text'] }];
        }
        case 'reasoning': {
          const text = (Array.isArray(p.summary) ? p.summary : []).map((s: Rec) => s.text).filter(Boolean).join('\n\n');
          if (text.trim()) return [{ ...base, kind: 'reasoning', payload: { text, exposure: 'summary' }, contentKeys: ['text'] }];
          // Reasoning happened but only its encrypted form was saved; never decoded.
          return [{ ...base, kind: 'reasoning', payload: { text: '', exposure: 'none', reason: p.encrypted_content ? 'encrypted' : 'empty' } }];
        }
        case 'function_call':
        case 'custom_tool_call':
        case 'local_shell_call': {
          const name = p.type === 'local_shell_call' ? 'local_shell' : String(p.name ?? '');
          const args = p.type === 'custom_tool_call' ? { raw: p.input } : p.type === 'local_shell_call' ? (p.action ?? {}) : parseArgs(p.arguments);
          const intent = intentOf(name, args, typeof p.namespace === 'string' ? p.namespace : undefined);
          const id = String(p.call_id ?? p.id ?? '');
          if (id) calls.set(id, { tool: name, intent });
          if (id) track(id, name);
          // A patch that edits a protected file carries its contents in the call itself.
          const protectedPatch = intent.kind === 'patch' && touchesProtectedFile(intent);
          return [{ ...base, kind: 'tool.call', operationId: id || undefined, payload: { tool: name, input: args, intent }, ...(protectedPatch ? { denyContent: true, contentKeys: ['input', 'intent'] } : {}) }];
        }
        case 'function_call_output':
        case 'custom_tool_call_output': {
          const id = String(p.call_id ?? '');
          const call = calls.get(id);
          openExec.delete(id);
          const intent = call?.intent ?? { kind: 'other' as const };
          const parsed = parseShellOutput(p.output);
          const images = dataImages(p.output);
          let outcome: ToolOutcome = { kind: 'other' };
          if (intent.kind === 'shell') outcome = { kind: 'shell', stdout: parsed.text };
          const isError = parsed.exitCode !== undefined && parsed.exitCode !== 0 ? true : /^(execution error|error:)/i.test(parsed.text ?? '');
          const out: RawObservation[] = [{
            ...base,
            kind: 'tool.result',
            operationId: id || undefined,
            payload: { tool: call?.tool, isError, text: parsed.text, outcome, exitCode: parsed.exitCode, durationMs: parsed.durationMs, ...(images.length ? { images } : {}) },
            denyContent: touchesProtectedFile(intent),
            contentKeys: ['text', 'outcome', 'images'],
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
          const delivery = agentDelivery(p, text);
          if (delivery) {
            // Native delivery identity, not equal text: distinct messages can repeat the same findings.
            if (rememberDelivery(delivery.delivery, delivery.text)) return [];
            return [{ ...base, agentId: author, kind: 'message.assistant', payload: { text: delivery.text, delivery: delivery.delivery }, contentKeys: ['text'], availability: delivery.delivery.state === 'complete' ? 'complete' : delivery.delivery.state === 'partial' ? 'partial' : 'metadata-only' }];
          }
          return text ? [{ ...base, agentId: author, kind: 'message.assistant', payload: { text }, contentKeys: ['text'] }] : [];
        }
        // TOOLS-1: tool groups the harness listed as available to the agent (names only).
        case 'additional_tools': {
          const tools: { name: string; namespace?: string }[] = [];
          const add = (name: unknown, namespace?: unknown) => { if (typeof name === 'string' && TOOL_NAME.test(name) && tools.length < MAX_TOOL_NAMES) tools.push({ name, ...(typeof namespace === 'string' && TOOL_NAME.test(namespace) ? { namespace } : {}) }); };
          for (const entry of Array.isArray(p.tools) ? p.tools as Rec[] : []) {
            if (Array.isArray(entry?.tools)) for (const child of entry.tools as Rec[]) add(child?.name, entry.name);
            else add(entry?.name);
          }
          return tools.length ? [{ ...base, kind: 'tools.snapshot', payload: { source: 'additional_tools', tools } satisfies ToolsSnapshotPayload }] : [];
        }
        case 'web_search_call':
          if (typeof p.id === 'string') calls.set(p.id, { tool: 'web_search', intent: { kind: 'web', query: p.action?.query } });
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
