// Claude Code adapter: transcript-first import and passive tailing of
// ~/.claude/projects/<slug>/<session>.jsonl, plus <session>/subagents/agent-*.jsonl.
// Read-only on every harness path (AGENTS.md constraint 2).

import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import type { AdapterDescriptor, CheckpointPayload, CompactionPayload, DiscoveredSource, ExternalChangePayload, Observation, ToolsSnapshotPayload } from '@drishya/contracts';
import {
  fileInfo,
  discoveryTitle,
  headAndTailRecords,
  listFiles,
  parseMcpName,
  textOf,
  touchesProtectedFile,
  usageTokens,
  type Adapter,
  type ParseContext,
  type RawHunk,
  type RawObservation,
  type RecordParser,
  type ShellRun,
  type SourceSet,
  type ToolIntent,
  type ToolOutcome,
} from '@drishya/capture-core';
import { imageCandidate, isDeniedPath } from '@drishya/privacy';
import { recordedQueueOperation } from './queued-input.ts';

export const descriptor: AdapterDescriptor = {
  id: 'claude-code',
  harness: 'claude-code',
  version: '0.1.0',
  label: 'Claude Code',
  testedHarnessVersions: ['2.x transcript format, verified on this machine 2026-09-22'],
  capabilities: {
    liveLifecycle: 'partial', // passive tailing; hooks not used
    chunkedOutput: 'unavailable',
    readContent: 'supported',
    patchIntent: 'supported',
    confirmedWrite: 'partial', // tool success, not an observed disk state
    beforeSnapshot: 'supported', // Edit/Write results carry originalFile
    afterSnapshot: 'partial', // reconstructed from originalFile + edit, verified
    exposedRationale: 'supported', // thinking text when the harness records it
    delegation: 'supported',
    replay: 'supported',
  },
};

const MAIN = 'agent:main';
/** One checkpoint lists every tracked file; bound it so an unusual session cannot bloat one observation. */
const MAX_CHECKPOINT_FILES = 2000;
/** Claude Code's backup file names: a content hash and a version, e.g. `306e5c83b76fd12d@v2`. */
const BACKUP_NAME = /^[0-9a-f]{8,64}@v\d+$/;

/** Bookkeeping record types that carry no agent activity. Ignored on purpose, not by accident. */
/** A tool name as a harness writes it; anything else is not a name and is not kept. */
const TOOL_NAME = /^[A-Za-z0-9_.:-]{1,120}$/;
const MAX_TOOL_NAMES = 400;
const IGNORED = new Set([
  'bridge-session', 'mode', 'atis-latch',
  'last-prompt', 'agent-name', 'attachment', 'permission-mode', 'progress', 'frame-link',
  'artifact-autoreact-ledger', 'artifact-comment-monitor',
]);

export function claudeHome(): string {
  return process.env.DRISHYA_CLAUDE_HOME ?? join(homedir(), '.claude');
}

type Rec = Record<string, any>;

export function intentOf(name: string, input: Rec): ToolIntent {
  const mcp = parseMcpName(name);
  if (mcp) return { kind: 'mcp', ...mcp };
  const path = input.file_path ?? input.notebook_path ?? input.path;
  switch (name) {
    case 'Read':
      return { kind: 'read', path: String(input.file_path ?? ''), offset: num(input.offset), limit: num(input.limit) };
    case 'Write':
      return { kind: 'write', path: String(input.file_path ?? ''), content: str(input.content) };
    case 'Edit':
      return { kind: 'edit', path: String(input.file_path ?? ''), edits: [{ oldString: str(input.old_string) ?? '', newString: str(input.new_string) ?? '', replaceAll: !!input.replace_all }] };
    case 'MultiEdit':
      return {
        kind: 'edit',
        path: String(input.file_path ?? ''),
        edits: (Array.isArray(input.edits) ? input.edits : []).map((e: Rec) => ({ oldString: str(e.old_string) ?? '', newString: str(e.new_string) ?? '', replaceAll: !!e.replace_all })),
      };
    case 'NotebookEdit':
      return { kind: 'edit', path: String(path ?? ''), edits: [] };
    case 'Grep':
      return { kind: 'search', mode: 'text', query: String(input.pattern ?? ''), path: str(input.path), glob: str(input.glob) };
    case 'Glob':
      return { kind: 'search', mode: 'file', query: String(input.pattern ?? ''), path: str(input.path) };
    case 'Bash':
    case 'PowerShell':
      return { kind: 'shell', command: String(input.command ?? '') };
    case 'WebFetch':
      return { kind: 'web', url: str(input.url) };
    case 'WebSearch':
      return { kind: 'web', query: str(input.query) };
    case 'Task':
    case 'Agent':
      return { kind: 'spawn', agentType: str(input.subagent_type), description: str(input.description), prompt: str(input.prompt) };
    case 'TodoWrite':
      return { kind: 'plan', items: (Array.isArray(input.todos) ? input.todos : []).map((t: Rec) => ({ text: String(t.content ?? t.activeForm ?? ''), status: String(t.status ?? '') })) };
    default:
      return { kind: 'other' };
  }
}

const defined = <T extends Rec>(o: T): Partial<T> => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

function shellRun(s: Rec): { run?: ShellRun } {
  const run = defined({
    backgroundTaskId: str(s.backgroundTaskId),
    timedOutAfterMs: num(s.timedOutAfterMs),
    exitNote: str(s.returnCodeInterpretation),
    persistedOutput: str(s.persistedOutputPath) ? defined({ path: s.persistedOutputPath as string, bytes: num(s.persistedOutputSize) }) as { path: string; bytes?: number } : undefined,
  });
  return Object.keys(run).length ? { run } : {};
}

export function outcomeOf(intent: ToolIntent, structured: unknown, text: string | undefined): ToolOutcome {
  const s = (structured && typeof structured === 'object' ? structured : {}) as Rec;
  switch (intent.kind) {
    case 'read': {
      if (s.file && typeof s.file.content === 'string') {
        return { kind: 'read', path: s.file.filePath, content: s.file.content, startLine: s.file.startLine, numLines: s.file.numLines, totalLines: s.file.totalLines, harnessLineNumbers: false };
      }
      if (text !== undefined) {
        // Only the model-facing text survived: strip the harness's "   12\t" line prefixes.
        const lines = text.split('\n');
        const m = /^\s*(\d+)[\t→]/.exec(lines[0] ?? '');
        const content = lines.map((l) => l.replace(/^\s*\d+[\t→]/, '')).join('\n');
        return { kind: 'read', path: intent.path, content, startLine: m ? Number(m[1]) : undefined, numLines: lines.length, harnessLineNumbers: true };
      }
      return { kind: 'read', path: intent.path };
    }
    case 'edit':
    case 'write':
      return {
        kind: 'edit',
        path: s.filePath ?? intent.path,
        originalFile: s.originalFile === undefined ? undefined : s.originalFile,
        hunks: Array.isArray(s.structuredPatch) ? (s.structuredPatch as RawHunk[]).map((h) => ({ oldStart: h.oldStart, oldLines: h.oldLines, newStart: h.newStart, newLines: h.newLines, lines: h.lines })) : undefined,
        // Recent Claude Code often records originalFile: null for existing files, so only the
        // harness's own create/update type says whether the file is new.
        created: s.type === 'create' || (intent.kind === 'write' && s.type === undefined && s.originalFile === null),
        content: intent.kind === 'write' ? (str(s.content) ?? intent.content) : undefined,
      };
    case 'search':
      return { kind: 'search', files: Array.isArray(s.filenames) ? s.filenames : undefined, lines: str(s.content) ?? (s.filenames ? undefined : text), total: num(s.numFiles) ?? num(s.totalMatches) };
    case 'shell':
      if (typeof structured === 'string') return { kind: 'shell', stdout: structured };
      return { kind: 'shell', stdout: str(s.stdout) ?? text, stderr: str(s.stderr), interrupted: !!s.interrupted, ...shellRun(s) };
    case 'web':
      return { kind: 'web', url: str(s.url), status: num(s.code), text: str(s.result) ?? text, ...defined({ statusText: str(s.codeText), bytes: num(s.bytes), durationMs: num(s.durationMs) }) };
    case 'spawn':
      return { kind: 'spawn', childAgentId: typeof s.agentId === 'string' ? `agent:${s.agentId}` : undefined, text: textOf(s.content) ?? text };
    default:
      return { kind: 'other' };
  }
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}
function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

export function createParser(ctx: ParseContext): RecordParser {
  const calls = new Map<string, { tool: string; intent: ToolIntent }>();
  let lastCwd: string | undefined;
  // Checkpoint rows carry no session id; a forked journal holds rows of the session it continues,
  // whose backups live in that session's folder. Use the last session id the journal named.
  let lastSession: string | undefined;
  const messagesWithUsage = new Set<string>();
  const compactionBoundaries = new Set<string>();

  const agentOf = (r: Rec): string => {
    if (ctx.agentId) return ctx.agentId;
    if (r.isSidechain) return `agent:${r.agentId ?? 'sidechain'}`;
    return MAIN;
  };

  return {
    prime(observations: Observation[]) {
      for (const o of observations) {
        if (o.kind !== 'tool.call' || !o.operationId) continue;
        const p = o.payload as { tool?: string; intent?: ToolIntent };
        if (p.tool && p.intent) calls.set(o.operationId, { tool: p.tool, intent: p.intent });
      }
    },

    parse(record: unknown): RawObservation[] {
      if (!record || typeof record !== 'object') return [];
      const r = record as Rec;
      const type = String(r.type ?? '');
      if (typeof r.sessionId === 'string') lastSession = r.sessionId;
      const attachmentType = type === 'attachment' ? (r.attachment as Rec | undefined)?.type : undefined;
      if (IGNORED.has(type) && attachmentType !== 'edited_text_file' && attachmentType !== 'prompt_snapshot' && attachmentType !== 'deferred_tools_delta' && attachmentType !== 'queued_command') return [];
      const base = {
        recordId: typeof r.uuid === 'string' ? r.uuid : undefined,
        sourceTime: typeof r.timestamp === 'string' ? r.timestamp : undefined,
        agentId: agentOf(r),
        workspaceRoot: typeof r.cwd === 'string' ? r.cwd : undefined,
        branchRef: typeof r.gitBranch === 'string' && r.gitBranch ? r.gitBranch : undefined,
        harnessVersion: typeof r.version === 'string' ? r.version : undefined,
      };
      const out: RawObservation[] = [];

      // A queue receipt records typing, not delivery. Anonymous dequeue/remove rows do
      // not identify which input left the queue and must never create a user turn.
      if (type === 'queue-operation') {
        const queue = recordedQueueOperation(r);
        if (!queue) return [];
        const blocks = Array.isArray(queue.content) ? queue.content as Rec[] : [];
        const text = typeof queue.content === 'string' ? queue.content : blocks.filter(b => b?.type === 'text' && typeof b.text === 'string').map(b => b.text as string).join('\n');
        const images = blocks.flatMap(b => b?.type === 'image' && b.source?.type === 'base64' && typeof b.source.data === 'string' ? [imageCandidate(b.source.data)] : []);
        return [{ ...base, part: 0, kind: 'queue.operation', payload: {
          operation: queue.operation, ...(queue.nativeQueueId ? { nativeQueueId: queue.nativeQueueId } : {}),
          ...(Object.hasOwn(queue, 'content') ? { text, ...(images.length ? { images } : {}) } : {}),
        }, contentKeys: ['text', 'images'] }];
      }


      // DATA-5: Claude Code's checkpoints (file backups per turn), as references only.
      if (type === 'file-history-snapshot' || type === 'file-history-delta') {
        const files: CheckpointPayload['files'] = [];
        const add = (path: unknown, b: Rec | undefined) => {
          if (typeof path !== 'string' || !path || !b || files.length >= MAX_CHECKPOINT_FILES) return;
          const name = str(b.backupFileName);
          files.push({ path, ...(str(b.realParentDir) ? { parentDir: b.realParentDir } : {}), ...(name && BACKUP_NAME.test(name) ? { backup: { name, ...defined({ version: num(b.version), time: str(b.backupTime) }) } } : b.backupFileName === null ? { absent: true } : {}) });
        };
        const snap = (r.snapshot ?? {}) as Rec;
        if (type === 'file-history-snapshot') for (const [path, b] of Object.entries((snap.trackedFileBackups ?? {}) as Record<string, Rec>)) add(path, b);
        else add(r.trackingPath, r.backup as Rec | undefined);
        const messageId = str(type === 'file-history-snapshot' ? r.messageId ?? snap.messageId : r.snapshotMessageId);
        if (!messageId || !files.length) return [];
        return [{ ...base, part: 0, kind: 'checkpoint', payload: { messageId, ...defined({ at: str(snap.timestamp) ?? str(r.timestamp), session: lastSession }), files } satisfies CheckpointPayload }];
      }

      // LIVE-5: a message typed while the agent was working is not a `user` row. Claude Code records it as a `queue-operation` and delivers it
      // into the turn as a `queued_command` attachment (`prompt` is the text, or text and image blocks; a background task's notice arrives the same way).
      if (type === 'attachment' && attachmentType === 'queued_command') {
        const at = r.attachment as Rec, blocks = Array.isArray(at.prompt) ? at.prompt as Rec[] : [];
        const text = typeof at.prompt === 'string' ? at.prompt : blocks.filter((b) => b?.type === 'text' && typeof b.text === 'string').map((b) => b.text as string).join('\n');
        const queued = typeof at.timestamp === 'string' && !Number.isNaN(Date.parse(at.timestamp)) ? at.timestamp : base.sourceTime;
        const items: RawObservation[] = [];
        // A delivery id / source UUID identifies the attachment, not a queued item.
        const nativeQueueId = str(at.queueId) ?? str(at.queue_id);
        const queueIdentity = nativeQueueId ? { nativeQueueId } : {};
        if (text.trim()) items.push({ ...base, sourceTime: queued, part: 0, kind: 'message.user', payload: { text, ...queueIdentity }, contentKeys: ['text'] });
        blocks.forEach((b, i) => { if (b?.type === 'image' && (b.source as Rec | undefined)?.type === 'base64') items.push({ ...base, sourceTime: queued, part: i + 1, kind: 'message.user', payload: { text: '', ...queueIdentity, images: [imageCandidate((b.source as Rec).data as string)] }, contentKeys: ['text', 'images'] }); });
        return items;
      }

      // TOOLS-1: the tool names Claude Code listed as available. Names only: the same rows carry the system prompt, which is never read.
      if (type === 'attachment' && (attachmentType === 'prompt_snapshot' || attachmentType === 'deferred_tools_delta')) {
        const at = r.attachment as Rec;
        const names = (value: unknown): string[] => Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && TOOL_NAME.test(v)).slice(0, MAX_TOOL_NAMES) : [];
        const listed = attachmentType === 'prompt_snapshot'
          ? names(Array.isArray(at.tools) ? (at.tools as Rec[]).map((t) => t?.name) : [])
          : [...names(at.addedNames), ...names(at.readdedNames)];
        const removed = attachmentType === 'deferred_tools_delta' ? names(at.removedNames) : [];
        if (!listed.length && !removed.length) return [];
        return [{ ...base, part: 0, kind: 'tools.snapshot', payload: { source: attachmentType, ...(listed.length ? { tools: listed.map((name) => ({ name })) } : {}), ...(removed.length ? { removed } : {}) } satisfies ToolsSnapshotPayload }];
      }

      // DATA-6: Claude Code noticed a file it had read changed on disk outside its edit tools.
      if (type === 'attachment' && (r.attachment as Rec | undefined)?.type === 'edited_text_file') {
        const at = r.attachment as Rec;
        if (typeof at.filename !== 'string' || !at.filename) return [];
        return [{ ...base, part: 0, kind: 'external.change', payload: { path: at.filename, ...(typeof at.snippet === 'string' ? { snippet: at.snippet } : {}), basis: 'harness-notice' } satisfies ExternalChangePayload, contentKeys: ['snippet'], denyContent: isDeniedPath(at.filename) }];
      }

      if (type === 'cost-state') {
        const work: Record<string, number> = {};
        for (const [key, field] of Object.entries({ totalLinesAdded: 'linesAdded', totalLinesRemoved: 'linesRemoved', totalDuration: 'durationMs', totalAPIDuration: 'apiDurationMs', totalToolDuration: 'toolDurationMs' })) {
          if (Number.isSafeInteger(r[key]) && r[key] >= 0) work[field] = r[key];
        }
        // A single model's reported cumulative counters need no cross-model estimate or summation.
        const models = r.modelUsage && typeof r.modelUsage === 'object' ? Object.entries(r.modelUsage) : [];
        const tokens = models.length === 1 ? usageTokens(models[0]![1], { inputTokens: 'input', outputTokens: 'output', cacheReadInputTokens: 'cachedInput', cacheCreationInputTokens: 'cacheWrite', thinkingTokens: 'reasoningOutput' }) : undefined;
        const cost = typeof r.totalCostUSD === 'number' && Number.isFinite(r.totalCostUSD) && r.totalCostUSD >= 0
          ? { usd: r.totalCostUSD, basis: 'harness-estimate', ...(typeof r.hasUnknownModelCost === 'boolean' ? { modelCostUnknown: r.hasUnknownModelCost } : {}) } : undefined;
        return [{ ...base, part: 0, kind: 'usage', payload: { source: 'claude-cost-state', cumulative: true,
          ...(tokens ? { tokens, model: models[0]![0] } : {}), ...(cost ? { cost } : {}), ...(Object.keys(work).length ? { work } : {}) } }];
      }

      if (base.workspaceRoot && base.workspaceRoot !== lastCwd && !ctx.agentId) {
        lastCwd = base.workspaceRoot;
        out.push({ ...base, part: 90, kind: 'session.meta', payload: { harness: 'claude-code', harnessVersion: base.harnessVersion, cwd: base.workspaceRoot, branch: base.branchRef } });
      }

      if (type === 'summary' || type === 'custom-title' || type === 'ai-title') {
        const title = str(r.customTitle) ?? str(r.summary) ?? str(r.aiTitle) ?? str(r.title);
        // A title the person set outranks one the harness generated.
        const titleRank = type === 'custom-title' ? 3 : type === 'summary' ? 2 : 1;
        if (title) out.push({ ...base, recordId: base.recordId ?? (r.leafUuid ? `summary:${r.leafUuid}` : undefined), part: 0, kind: 'session.meta', payload: { harness: 'claude-code', title, titleRank } });
        return out;
      }

      if (type === 'system') {
        if (r.subtype === 'compact_boundary') {
          if (typeof r.uuid === 'string') compactionBoundaries.add(r.uuid);
          out.push({ ...base, part: 0, kind: 'compaction', payload: { trigger: r.compactMetadata?.trigger } });
          const metadata = r.compactMetadata ?? {};
          const metric = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
          // A new part enriches old imports on rescan without rewriting their stable original observation.
          out.push({ ...base, part: 1, kind: 'compaction', payload: { source: 'claude-boundary', phase: 'boundary',
            ...defined({ trigger: str(metadata.trigger), beforeTokens: metric(metadata.preTokens), afterTokens: metric(metadata.postTokens), durationMs: metric(metadata.durationMs) }),
          } satisfies CompactionPayload });
        }
        // A slash command's own output (`/context`, `/cost`) is a `system` row in current Claude Code and a user row in older versions.
        // Both carry the same exact `<local-command-stdout>` text, so both reach History as the same captured command output.
        if (r.subtype === 'local_command' && typeof r.content === 'string' && r.content.trimStart().startsWith('<local-command-stdout>')) {
          out.push({ ...base, part: 0, kind: 'message.user', payload: { text: r.content }, contentKeys: ['text'] });
          return out;
        }
        return out; // hook bookkeeping and notices carry no agent activity
      }

      if (type === 'user') {
        const content = r.message?.content;
        if (r.isCompactSummary) {
          out.push({ ...base, part: 0, kind: 'compaction', payload: { summary: textOf(content) }, contentKeys: ['summary'] });
          out.push({ ...base, part: 1, kind: 'compaction', payload: { source: 'claude-summary', phase: 'summary', ...defined({ boundaryRecordId: compactionBoundaries.has(r.parentUuid) ? str(r.parentUuid) : undefined }) } satisfies CompactionPayload });
          return out;
        }
        const mode = typeof r.permissionMode === 'string' ? { permissionMode: r.permissionMode } : {};
        if (typeof content === 'string') {
          if (!r.isMeta) out.push({ ...base, part: 0, kind: 'message.user', payload: { text: content, ...mode }, contentKeys: ['text'] });
          return out;
        }
        if (!Array.isArray(content)) return out;
        content.forEach((c: Rec, i: number) => {
          if (c.type === 'tool_result') {
            const call = calls.get(c.tool_use_id);
            const text = textOf(c.content);
            // CONTENT-1 (D7): images returned to the model (Read of an image file, screenshots).
            // Claude's toolUseResult repeats them; keep one copy, with its recorded display size.
            const shown = (r.toolUseResult as Rec | undefined)?.file?.dimensions as Rec | undefined;
            const images = Array.isArray(c.content) ? (c.content as Rec[]).filter((b) => b?.type === 'image' && b.source?.type === 'base64')
              .map((b) => imageCandidate(b.source.data, shown ? { width: shown.displayWidth, height: shown.displayHeight } : undefined)) : [];
            const structured = Array.isArray(r.toolUseResult) ? (r.toolUseResult as Rec[]).filter((b) => b?.type !== 'image') : r.toolUseResult?.type === 'image' && images.length ? { ...r.toolUseResult, file: undefined } : r.toolUseResult;
            const intent = call?.intent ?? { kind: 'other' as const };
            const outcome = outcomeOf(intent, structured, text);
            const exitMatch = /^Exit code (-?\d+)/m.exec(text ?? '');
            out.push({
              ...base,
              part: i,
              kind: 'tool.result',
              operationId: c.tool_use_id,
              payload: {
                tool: call?.tool,
                isError: !!c.is_error,
                text,
                outcome,
                // Unknown tools keep their structured result (sanitized) so nothing is lost.
                structured: outcome.kind === 'other' ? structured : undefined,
                exitCode: intent.kind === 'shell' ? (exitMatch ? Number(exitMatch[1]) : c.is_error ? null : 0) : undefined,
                ...(images.length ? { images } : {}),
              },
              denyContent: touchesProtectedFile(intent),
              contentKeys: ['text', 'outcome', 'structured', 'images'],
            });
            if (intent.kind === 'spawn' && outcome.kind === 'spawn' && outcome.childAgentId) {
              out.push({ ...base, part: 100 + i, kind: 'agent.spawn', operationId: c.tool_use_id, payload: { childAgentId: outcome.childAgentId, agentType: intent.agentType, description: intent.description, basis: 'source-id' } });
            }
          } else if (c.type === 'text' && !r.isMeta) {
            out.push({ ...base, part: i, kind: 'message.user', payload: { text: c.text, ...mode }, contentKeys: ['text'] });
          } else if (c.type === 'image' && !r.isMeta && c.source?.type === 'base64') {
            // CONTENT-1: an image the person attached; it belongs to the prompt in this same record.
            out.push({ ...base, part: i, kind: 'message.user', payload: { text: '', images: [imageCandidate(c.source.data)] }, contentKeys: ['text', 'images'] });
          } else if (c.type === 'image') {
            out.push({ ...base, part: i, kind: 'capture.gap', payload: { reason: 'unsupported-content', detail: 'image omitted by privacy policy' }, availability: 'metadata-only' });
          }
        });
        return out;
      }

      if (type === 'assistant') {
        const content = r.message?.content;
        const model = str(r.message?.model);
        const messageId = str(r.message?.id);
        const tokens = usageTokens(r.message?.usage, { input_tokens: 'input', cache_read_input_tokens: 'cachedInput', cache_creation_input_tokens: 'cacheWrite', output_tokens: 'output' });
        if (messageId && tokens && !messagesWithUsage.has(messageId)) {
          messagesWithUsage.add(messageId);
          // New identity, independent of the repeated transcript line's uuid and of existing block parts.
          out.push({ ...base, recordId: `usage:${messageId}`, part: 0, kind: 'usage', payload: { source: 'claude-message-usage', cumulative: false, tokens, ...(model ? { model } : {}) } });
        }
        const finish = () => {
          // 0xffffffff is reserved for completion: it cannot be an ECMAScript array index.
          // It enriches rescans without replacing content/usage or inventing a native turn id.
          if (r.message?.stop_reason === 'end_turn') out.push({ ...base, part: 0xffffffff, kind: 'turn.end', payload: {} });
          return out;
        };
        if (!Array.isArray(content)) return finish();
        content.forEach((c: Rec, i: number) => {
          if (c.type === 'text' && c.text) {
            out.push({ ...base, part: i, kind: 'message.assistant', payload: { text: c.text, model }, contentKeys: ['text'] });
          } else if (c.type === 'thinking' && typeof c.thinking === 'string' && c.thinking.trim()) {
            out.push({ ...base, part: i, kind: 'reasoning', payload: { text: c.thinking, exposure: 'full', model }, contentKeys: ['text'] });
          } else if (c.type === 'thinking' || c.type === 'redacted_thinking') {
            // The block exists but its text was not saved; record that so the UI can say so.
            const reason = c.type === 'redacted_thinking' ? 'encrypted' : c.signature ? 'signature-only' : 'empty';
            out.push({ ...base, part: i, kind: 'reasoning', payload: { text: '', exposure: 'none', reason, model } });
          } else if (c.type === 'tool_use') {
            const input = (c.input ?? {}) as Rec;
            const intent = intentOf(String(c.name), input);
            calls.set(c.id, { tool: String(c.name), intent });
            out.push({ ...base, part: i, kind: 'tool.call', operationId: c.id, payload: { tool: c.name, input, intent } });
          }
        });
        return finish();
      }

      if (type === 'user' || type === 'assistant') return out;
      // A record type this adapter does not know yet: visible, never an exception.
      out.push({ ...base, part: 0, kind: 'unknown', payload: { recordType: type || 'untyped' }, availability: 'metadata-only' });
      return out;
    },
  };
}

async function sourceSet(mainPath: string): Promise<SourceSet> {
  const session = basename(mainPath).replace(/\.jsonl$/, '');
  const dir = join(dirname(mainPath), session, 'subagents');
  const files = await listFiles(dir, (n) => n.endsWith('.jsonl'), 0, 0);
  return {
    main: mainPath,
    companions: files.sort().map((p) => ({ path: p, agentId: `agent:${basename(p).replace(/^agent-/, '').replace(/\.jsonl$/, '')}` })),
  };
}

async function discover(): Promise<DiscoveredSource[]> {
  const root = join(claudeHome(), 'projects');
  const files = await listFiles(root, (n) => n.endsWith('.jsonl'), 0, 1);
  const out: DiscoveredSource[] = [];
  for (const path of files) {
    // Only top-level session journals; subagent files are companions of their session.
    if (basename(dirname(dirname(path))) === 'subagents' || basename(dirname(path)) === 'subagents') continue;
    const info = await fileInfo(path);
    if (!info || info.bytes === 0) continue;
    const { head, tail } = await headAndTailRecords(path, info.bytes) as { head: Rec[]; tail: Rec[] };
    const cwd = head.find((r) => typeof r.cwd === 'string')?.cwd as string | undefined;
    let titled: string | undefined;
    let titleRank = 0;
    // Match imported metadata: the latest title at the highest recorded rank wins.
    // Tail records contribute titles only; workspace and first prompt still come from the head.
    for (const r of [...head, ...tail] as Rec[]) {
      if (!r || typeof r !== 'object') continue;
      const rank = r.type === 'custom-title' ? 3 : r.type === 'summary' ? 2 : r.type === 'ai-title' ? 1 : 0;
      const value = str(r.customTitle) ?? str(r.summary) ?? str(r.aiTitle) ?? str(r.title);
      if (rank && value && rank >= titleRank) { titled = value; titleRank = rank; }
    }
    const firstPrompt = head.find((r) => r.type === 'user' && typeof r.message?.content === 'string' && !r.isMeta && !String(r.message.content).startsWith('<'));
    const rawTitle = titled ?? firstPrompt?.message?.content;
    const set = await sourceSet(path);
    out.push({
      adapterId: descriptor.id,
      harness: 'claude-code',
      path,
      bytes: info.bytes,
      modifiedAt: info.modifiedAt,
      cwd,
      title: typeof rawTitle === 'string' ? discoveryTitle(rawTitle) : undefined,
      companions: set.companions.map((c) => c.path),
    });
  }
  return out.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}

export const claudeAdapter: Adapter = {
  descriptor,
  discover,
  sourceSet,
  createParser,
  sniff: (head) =>
    (head as Rec[]).some((r) => r && typeof r.sessionId === 'string' && (r.type === 'user' || r.type === 'assistant') && 'uuid' in r),
};
