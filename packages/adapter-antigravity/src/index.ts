import { readdir, stat } from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, dirname, join, relative, resolve } from 'node:path';
import type { AdapterDescriptor, DiscoveredSource, Observation } from '@drishya/contracts';
import { initialCursor, readJsonl, type Adapter, type ParseContext, type RawObservation, type RecordParser } from '@drishya/capture-core';
import { sanitize } from '@drishya/privacy';
import { defaultRoots, readablePath, conversationId, within, localPath } from './paths.ts';
import { summaries, type Summary } from './summaries.ts';
import { decodeArgs, intentFor, outcomeFor, recordedExitCode, touchesProtectedFile, isPlanArtifact } from './tools.ts';
import { CallOrder, unmatched, matched, type PendingCall } from './pairing.ts';

export const descriptor: AdapterDescriptor = {
  id: 'antigravity', harness: 'antigravity', version: '0.1.0', label: 'Antigravity',
  testedHarnessVersions: ['2.31.2 (uninstall entry)', '44.9.1 (version file); transcript survey 2026-11-13'],
  capabilities: { readContent: 'supported', patchIntent: 'supported', confirmedWrite: 'partial', beforeSnapshot: 'unavailable', afterSnapshot: 'unavailable', exposedRationale: 'partial', delegation: 'supported', liveLifecycle: 'partial', chunkedOutput: 'unavailable', replay: 'supported' },
};

type Row = Record<string, unknown>;
const object = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const text = (value: unknown) => typeof value === 'string' ? value : '';
const ignored = new Set(['SYSTEM_MESSAGE', 'EPHEMERAL_MESSAGE', 'CONVERSATION_HISTORY']);
const results = new Set(['GENERIC', 'VIEW_FILE', 'LIST_DIRECTORY', 'CODE_ACTION', 'RUN_COMMAND', 'SEARCH_WEB', 'GREP_SEARCH', 'INVOKE_SUBAGENT', 'READ_URL_CONTENT']);
const knownTools = new Set(['read_file', 'view_file', 'write_file', 'write_to_file', 'edit_file', 'replace_file_content', 'multi_replace_file_content', 'grep_search', 'find_by_name', 'list_dir', 'run_command', 'manage_task', 'search_web', 'read_url_content', 'invoke_subagent', 'define_subagent', 'manage_subagents', 'send_message', 'schedule', 'search_marketplace', 'ask_permission', 'ask_question']);

export function createParser(ctx: ParseContext, summary?: Summary): RecordParser {
  const id = basename(dirname(dirname(dirname(ctx.sourcePath))));
  const pair = new CallOrder();
  const fingerprints = new Map<number, string>();
  let resultOwners = new Map<number, PendingCall>();
  // A child is a separate recording, not a companion file of the parent. Its local
  // owner is still main; the captured parentThreadId carries cross-session lineage.
  const agentId = ctx.agentId ?? 'agent:main';
  let initialized = false;
  return {
    prime(observations: Observation[]) { resultOwners = pair.prime(observations); initialized = observations.some(o => o.kind === 'session.meta'); },
    parse(value: unknown): RawObservation[] {
      const row = object(value);
      if (!Number.isSafeInteger(row.step_index) || Number(row.step_index) < 0) return [{ part: 0, agentId, kind: 'unknown', availability: 'metadata-only', payload: { recordType: 'invalid-antigravity-step' } }];
      const step = Number(row.step_index), type = text(row.type), content = text(row.content);
      const fingerprint = createHash('sha256').update(JSON.stringify(row)).digest('hex');
      if (fingerprints.get(step) === fingerprint) return [];
      const replacement = fingerprints.has(step);
      fingerprints.set(step, fingerprint);
      const recordId = `${id}:${step}`;
      const base = { recordId, part: 0, agentId, sourceTime: text(row.created_at) || undefined, workspaceRoot: summary?.workspaces[0] };
      const partial = Array.isArray(row.truncated_fields) && row.truncated_fields.length > 0;
      const out: RawObservation[] = [{ ...base, kind: 'checkpoint', availability: 'metadata-only', payload: { recordType: type, stepIndex: step, status: text(row.status), truncatedFields: partial ? row.truncated_fields : undefined } }];
      if (!initialized) {
        initialized = true;
        out.push({ ...base, recordId: `${id}:metadata`, part: 0, kind: 'session.meta', payload: { harness: 'antigravity', cwd: summary?.workspaces[0], additionalRoots: summary?.workspaces.slice(1), title: summary?.title, parentThreadId: summary?.parentSessionId, agentNickname: summary?.agentName, workspaceSelection: summary && summary.workspaces.length > 1 ? 'derived-captured-path-count' : 'captured-index' } });
      }
      const emit = (observation: Omit<RawObservation, 'agentId' | 'recordId' | 'sourceTime'>) => out.push({ ...base, availability: partial ? 'partial' : 'complete', ...observation });
      if (ignored.has(type)) return out;
      if (type === 'USER_INPUT' && row.source === 'USER_EXPLICIT') {
        for (const call of pair.reset()) if (!replacement) out.push(unmatched(call, base, 0));
        emit({ part: 1, kind: 'turn.start', payload: { turnId: recordId } });
        emit({ part: 2, kind: 'message.user', payload: { text: content } });
      } else if (type === 'PLANNER_RESPONSE') {
        for (const call of pair.reset()) if (!replacement) out.push(unmatched(call, base, 0));
        if (content) emit({ part: 1, kind: 'message.assistant', payload: { text: content } });
        if (text(row.thinking)) emit({ part: 2, kind: 'reasoning', payload: { text: text(row.thinking), source: 'antigravity-recorded-thinking' } });
        const calls = Array.isArray(row.tool_calls) ? row.tool_calls : [];
        calls.forEach((value, index) => {
          const call = object(value), tool = text(call.name), args = decodeArgs(call.args);
          const intent = isPlanArtifact(args) ? { kind: 'other' as const } : intentFor(tool, args);
          const operationId = `${id}:${step}:call:${index}`;
          const pending = { id: operationId, tool, args, intent, step };
          pair.add(pending);
          out.push(unmatched(pending, base, 0));
          emit({ part: 10 + index, kind: 'tool.call', operationId, denyContent: touchesProtectedFile(intent), contentKeys: ['input', 'intent'], payload: { tool, input: args, intent, protected: touchesProtectedFile(intent), antigravityStep: step, correlationBasis: 'call-order' } });
          if (!knownTools.has(tool)) emit({ part: 10000 + index, kind: 'unknown', availability: 'metadata-only', payload: { recordType: `tool:${tool}` } });
        });
      } else if (results.has(type)) {
        const call = resultOwners.get(step) ?? pair.next();
        if (!call) {
          // The record is known to be a result, but its call was not captured. No positional
          // guess or fabricated operation id: the reducer already represents orphan results.
          const path = /^File Path:\s*(.+)$/m.exec(content)?.[1]?.trim();
          const protectedOrUnknown = !path || touchesProtectedFile({ kind: 'read', path });
          emit({ part: 1, kind: 'tool.result', availability: protectedOrUnknown ? 'metadata-only' : 'partial', denyContent: protectedOrUnknown, contentKeys: ['text', 'error'], payload: { tool: type, isError: row.status === 'ERROR' || !!row.error, text: content, error: row.error, callAvailability: 'not-recorded', omissionReason: protectedOrUnknown ? 'The call/path was not captured, so protected-file access cannot be ruled out.' : undefined } });
          return out;
        }
        resultOwners.set(step, call);
        const running = row.status === 'RUNNING';
        if (!running) out.push(matched(call, base));
        const exitCode = call.intent.kind === 'shell' ? recordedExitCode(content) : undefined;
        emit({ part: 1, kind: 'tool.result', operationId: call.id,
          correlation: { operationId: call.id, basis: 'call-order' },
          denyContent: call.protected || touchesProtectedFile(call.intent), contentKeys: ['text', 'outcome', 'error'], availability: running || partial ? 'partial' : 'complete',
          payload: { tool: call.tool, isError: row.status === 'ERROR' || !!row.error || typeof exitCode === 'number' && exitCode !== 0, text: content, error: row.error, exitCode,
            outcome: isPlanArtifact(call.args) ? { kind: 'other' } : outcomeFor(call.tool, call.args, content), ...(running ? { status: 'running', resultAvailability: 'not-recorded' } : {}) } });
      } else if (type === 'CHECKPOINT') {
        emit({ part: 1, kind: 'compaction', payload: { source: 'antigravity-checkpoint', phase: 'summary', summary: content, summaryAvailability: 'captured', authoredBy: 'model' } });
      } else if (type === 'ERROR_MESSAGE') {
        emit({ part: 1, kind: 'capture.gap', availability: 'partial', payload: { reason: 'unsupported-content', detail: content || text(row.error) } });
      } else emit({ part: 1, kind: 'unknown', availability: 'partial', payload: { recordType: type || 'untyped-antigravity-record', text: content } });
      return out;
    },
  };
}

interface Scan { lastStep: number; title?: string; pathCounts: Map<string, number> }
function chooseSummary(id: string, captured: Summary | undefined, inspection: Scan): Summary {
  const workspaces = [...(captured?.workspaces ?? [])];
  workspaces.sort((a, b) => [...inspection.pathCounts].reduce((sum, [path, count]) => sum + (within(b, path) ? count : 0) - (within(a, path) ? count : 0), 0));
  return { ...captured, id, workspaces, title: captured?.title ?? inspection.title };
}
async function scan(path: string): Promise<Scan> {
  let cursor = initialCursor();
  const result: Scan = { lastStep: -1, pathCounts: new Map() };
  for (;;) {
    const batch = await readJsonl(path, cursor, { acceptUnterminated: false });
    for (const record of batch.records) {
      if (record.type !== 'record') continue;
      const row = object(record.value);
      if (Number.isSafeInteger(row.step_index)) result.lastStep = Math.max(result.lastStep, Number(row.step_index));
      if (!result.title && row.type === 'USER_INPUT' && row.source === 'USER_EXPLICIT') result.title = sanitize(text(row.content).slice(0, 160)).value;
      for (const value of Array.isArray(row.tool_calls) ? row.tool_calls : []) {
        const args = decodeArgs(object(value).args);
        for (const key of ['Path', 'AbsolutePath', 'TargetFile']) if (typeof args[key] === 'string') {
          const path = localPath(args[key]);
          if (path) result.pathCounts.set(path, (result.pathCounts.get(path) ?? 0) + 1);
        }
      }
    }
    if (batch.cursor.offset === cursor.offset || batch.cursor.offset >= batch.size) return result;
    cursor = batch.cursor;
  }
}

export function createAntigravityAdapter(roots = defaultRoots()): Adapter & { diagnostics(): { code: string; message: string }[]; identity(path: string): string; readPath(path: string): Promise<string> } {
  const metadata = new Map<string, Summary>();
  const selected = new Map<string, string>();
  const inspections = new Map<string, { signature: string; result: Scan }>();
  let diagnostics: { code: string; message: string }[] = [];
  function locate(path: string) {
    const absolute = resolve(path);
    const root = roots.find(root => within(resolve(root), absolute));
    if (!root) throw new Error('Antigravity source is outside configured roots');
    const parts = relative(root, absolute).split(/[\\/]/);
    if (parts[0] !== 'brain' || !conversationId(parts[1] ?? '') || parts.length !== 5 || parts[2] !== '.system_generated' || parts[3] !== 'logs' || !/^transcript(?:_full)?\.jsonl$/.test(parts[4]!)) throw new Error('Invalid Antigravity transcript path');
    return { root: resolve(root), id: parts[1]! };
  }
  async function inspect(path: string): Promise<Scan> {
    const info = await stat(path), signature = `${info.size}:${info.mtimeMs}`;
    const cached = inspections.get(path);
    if (cached?.signature === signature) return cached.result;
    const result = await scan(path); inspections.set(path, { signature, result }); return result;
  }
  async function choose(root: string, id: string): Promise<string | undefined> {
    const paths = [];
    for (const file of ['transcript_full.jsonl', 'transcript.jsonl']) {
      try {
        const path = await readablePath(root, join(root, 'brain', id, '.system_generated', 'logs', file), 'transcript', id);
        paths.push({ path, last: (await inspect(path)).lastStep });
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }
    paths.sort((a, b) => b.last - a.last);
    return paths[0]?.path;
  }
  return {
    descriptor,
    diagnostics: () => diagnostics,
    identity(path) { return locate(path).id; },
    async readPath(path) { const { root, id } = locate(path); return await choose(root, id) ?? path; },
    async discover() {
      diagnostics = [];
      const sources: DiscoveredSource[] = [], seen = new Set<string>();
      const encrypted = new Map<string, number>(), artifactOnly = new Set<string>(), missingTranscript = new Set<string>();
      for (const configured of roots) {
        const root = resolve(configured);
        let entries: Dirent<string>[];
        try { entries = await readdir(join(root, 'brain'), { withFileTypes: true }); }
        catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') entries = []; else throw error; }
        let conversations: Dirent<string>[];
        try { conversations = await readdir(join(root, 'conversations'), { withFileTypes: true }); }
        catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') conversations = []; else throw error; }
        let index = new Map<string, Summary>();
        try { index = await summaries(root); }
        catch { diagnostics.push({ code: 'index-unavailable', message: 'Antigravity session metadata could not be read safely; readable transcripts remain available without index metadata.' }); }
        const nativeFiles = new Set(conversations.filter(entry => entry.isFile() && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}\.(?:pb|db)$/.test(entry.name)).map(entry => entry.name));
        const ids = new Set([...entries.filter(entry => entry.isDirectory()).map(entry => entry.name), ...[...nativeFiles].map(name => name.slice(0, -3)), ...index.keys()]);
        for (const id of ids) {
          if (!conversationId(id) || seen.has(id)) continue;
          try {
            const physical = await choose(root, id);
            if (!physical) {
              if (nativeFiles.has(`${id}.pb`)) encrypted.set(id, encrypted.get(id) ?? roots.indexOf(configured));
              else {
                let artifact = false;
                for (const name of ['implementation_plan.md', 'task.md', 'walkthrough.md']) {
                  try { await readablePath(root, join(root, 'brain', id, name), 'artifact', id); artifact = true; break; }
                  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
                }
                if (artifact) artifactOnly.add(id); else missingTranscript.add(id);
              }
              continue;
            }
            seen.add(id);
            encrypted.delete(id); artifactOnly.delete(id); missingTranscript.delete(id);
            const summary = chooseSummary(id, index.get(id), await inspect(physical));
            metadata.set(id, summary);
            const key = selected.get(id) ?? physical; selected.set(id, key);
            const info = await stat(physical);
            sources.push({ adapterId: descriptor.id, harness: descriptor.harness, path: key, bytes: info.size, modifiedAt: info.mtime.toISOString(), sessionId: id, cwd: summary.workspaces[0], title: summary.title, parentSessionId: summary.parentSessionId, agentName: summary.agentName === undefined ? undefined : sanitize(summary.agentName).value, companions: [] });
          } catch { diagnostics.push({ code: 'read-failed', message: `Antigravity conversation ${id.slice(0, 8)} could not be read safely.` }); }
        }
      }
      for (let root = 0; root < roots.length; root++) {
        const count = [...encrypted.values()].filter(index => index === root).length;
        if (count) diagnostics.push({ code: root ? 'encrypted-legacy' : 'encrypted', message: `${count} unreadable: encrypted Antigravity conversations without transcripts${root ? ' (additional legacy-root conversations)' : ''}.` });
      }
      if (artifactOnly.size) diagnostics.push({ code: 'artifact-only', message: `${artifactOnly.size} Antigravity artifact-only conversations without transcripts.` });
      if (missingTranscript.size) diagnostics.push({ code: 'transcript-unavailable', message: `${missingTranscript.size} Antigravity conversations have no readable transcript or supported artifact.` });
      return sources;
    },
    async sourceSet(main) {
      const { root, id } = locate(main);
      const physical = await choose(root, id);
      if (!physical) throw new Error('The Antigravity transcript is unavailable. Captured history remains readable.');
      if (!metadata.has(id)) {
        const index = await summaries(root);
        metadata.set(id, chooseSummary(id, index.get(id), await inspect(physical)));
      }
      return { main, companions: [] };
    },
    createParser(ctx) { return createParser(ctx, metadata.get(locate(ctx.sourcePath).id)); },
    sniff(head) { return head.some(value => { const row = object(value); return Number.isSafeInteger(row.step_index) && typeof row.source === 'string' && typeof row.type === 'string' && Array.isArray(row.tool_calls); }); },
  };
}

export const antigravityAdapter = createAntigravityAdapter();
