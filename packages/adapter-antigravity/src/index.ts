import { readdir, stat } from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, dirname, join, relative, resolve } from 'node:path';
import type { AdapterDescriptor, DiscoveredSource, Observation } from '@drishya/contracts';
import { fingerprintOf, initialCursor, readJsonl, type Adapter, type ParseContext, type RawObservation, type RecordParser, type SourceCursor } from '@drishya/capture-core';
import { sanitize } from '@drishya/privacy';
import { defaultRoots, readableRoot, readablePath, conversationId, within, localPath } from './paths.ts';
import { summaries, type Summary } from './summaries.ts';
import { decodeArgs, intentFor, outcomeFor, recordedExitCode, touchesProtectedFile, isPlanArtifact } from './tools.ts';
import { CallOrder, unmatched, matched, type PendingCall } from './pairing.ts';
import { liveParser } from './live.ts';
import { markdownTasks } from './artifacts.ts';

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
const knownTools = new Set(['read_file', 'view_file', 'write_file', 'write_to_file', 'edit_file', 'replace_file_content', 'multi_replace_file_content', 'grep_search', 'find_by_name', 'list_dir', 'run_command', 'manage_task', 'search_web', 'read_url_content', 'invoke_subagent', 'define_subagent', 'manage_subagents', 'send_message', 'schedule', 'search_marketplace', 'ask_permission', 'ask_question', 'webview_browser', 'call_mcp_tool', 'swarm', 'read_board', 'post_message']);

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
          const artifactText = text(args.Content) || text(args.CodeContent);
          const artifactPath = localPath(text(args.Path) || text(args.AbsolutePath) || text(args.TargetFile));
          const artifact = isPlanArtifact(args) && !!artifactPath && resolve(dirname(artifactPath)) === resolve(dirname(dirname(dirname(ctx.sourcePath))));
          const nativeArtifact = artifact && artifactPath ? { path: resolve(artifactPath.replace(/\.resolved(?:\.\d+)?$/, '')), name: basename(artifactPath).replace(/\.resolved(?:\.\d+)?$/, ''), recordedPath: artifactPath, text: artifactText, items: markdownTasks(artifactText), truncated: partial } : undefined;
          const intent = artifact ? { kind: 'plan' as const, items: markdownTasks(artifactText) } : intentFor(tool, args);
          const operationId = `${id}:${step}:call:${index}`;
          const pending = { id: operationId, tool, args, intent, step };
          pair.add(pending);
          out.push(unmatched(pending, base, 0));
          emit({ part: 10 + index, kind: 'tool.call', operationId, denyContent: touchesProtectedFile(intent), contentKeys: ['input', 'intent', 'nativeArtifact'], payload: { tool, input: args, intent, nativeArtifact, protected: touchesProtectedFile(intent), antigravityStep: step, correlationBasis: 'call-order' } });
          if (artifact && object(args.ArtifactMetadata).RequestFeedback === true) emit({ part: 42000 + index, kind: 'capture.gap', operationId, availability: 'metadata-only', payload: { reason: 'unsupported-content', detail: 'Antigravity requested feedback on this recorded artifact. A native approval or rejection is not established by these records.' } });
          if (tool === 'swarm' && args.action === 'add' && typeof args.model === 'string') emit({ part: 41000 + index, kind: 'capture.gap', operationId, availability: 'metadata-only', payload: { reason: 'unsupported-content', detail: 'Antigravity recorded a requested subagent model in the tool input. The runtime model used by the child is not established by this record.' } });
          if (tool === 'ask_permission') emit({ part: 40000 + index, kind: 'capture.gap', operationId, availability: 'metadata-only', payload: { reason: 'unsupported-content', detail: 'Antigravity recorded a permission request. Its approval or denial cannot be identified from this capture; answer in Antigravity.' } });
          if (!knownTools.has(tool) || tool === 'call_mcp_tool' && intent.kind !== 'mcp') emit({ part: 10000 + index, kind: 'unknown', availability: 'metadata-only', payload: { recordType: `tool:${tool}` } });
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
            outcome: call.intent.kind === 'plan' ? { kind: 'plan', items: markdownTasks(text(call.args.Content) || text(call.args.CodeContent)) } : outcomeFor(call.tool, call.args, content), ...(running ? { status: 'running', resultAvailability: 'not-recorded' } : {}) } });
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
interface Inspection { signature: string; size: number; result: Scan; cursor: SourceCursor; restored?: boolean }
function chooseSummary(id: string, captured: Summary | undefined, inspection: Scan): Summary {
  const workspaces = [...(captured?.workspaces ?? [])];
  workspaces.sort((a, b) => [...inspection.pathCounts].reduce((sum, [path, count]) => sum + (within(b, path) ? count : 0) - (within(a, path) ? count : 0), 0));
  return { ...captured, id, workspaces, title: captured?.title ?? inspection.title };
}
async function scan(path: string, previous?: Inspection): Promise<{ result: Scan; cursor: SourceCursor }> {
  let cursor = previous?.cursor ?? initialCursor();
  let result: Scan = previous ? { ...previous.result, pathCounts: new Map(previous.result.pathCounts) } : { lastStep: -1, pathCounts: new Map() };
  for (;;) {
    const batch = await readJsonl(path, cursor, { acceptUnterminated: false });
    if (batch.reset) result = { lastStep: -1, pathCounts: new Map() };
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
    if (batch.cursor.offset === cursor.offset || batch.cursor.offset >= batch.size) return { result, cursor: batch.cursor };
    cursor = batch.cursor;
  }
}

export function createAntigravityAdapter(roots = defaultRoots()): Adapter & { diagnostics(): { code: string; message: string }[]; identity(path: string): string; readPath(path: string): Promise<string> } {
  const metadata = new Map<string, Summary>();
  const selected = new Map<string, string>();
  const physicalSources = new Map<string, string>();
  const inspections = new Map<string, Inspection>();
  const summaryCache = new Map<string, { at: number; values: Map<string, Summary> }>();
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
    let cached = inspections.get(path);
    if (cached?.restored) {
      // Persisted metadata is a hint, never authority over the native file. A bounded
      // prefix check rejects a same-size/same-time replacement before trusting it.
      const fingerprint = await fingerprintOf(path);
      if (info.size === cached.size && fingerprint !== cached.cursor.fingerprint || info.size > cached.size && Number(cached.cursor.fingerprint.split(':')[1]) < 1024) {
        inspections.delete(path); cached = undefined;
      } else cached.restored = false;
    }
    if (cached?.signature === signature) return cached.result;
    // Appended receipts need only the unread suffix. Rewrites/truncations restart the
    // inspection; readJsonl also checks the prefix identity before trusting the cursor.
    const next = await scan(path, cached && info.size > cached.size ? cached : undefined);
    inspections.set(path, { signature, size: info.size, ...next }); return next.result;
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
    const chosen = paths[0]?.path;
    if (chosen) physicalSources.set(id, chosen);
    return chosen;
  }
  async function refreshSummary(root: string, id: string, physical: string) {
    let cached = summaryCache.get(root);
    if (!cached || Date.now() - cached.at >= 5000) {
      let values: Map<string, Summary>;
      try { values = await summaries(root); }
      catch {
        values = cached?.values ?? new Map();
        if (!diagnostics.some(d => d.code === 'index-unavailable')) diagnostics.push({ code: 'index-unavailable', message: 'Antigravity session metadata could not be refreshed safely; readable transcripts remain available.' });
      }
      cached = { at: Date.now(), values }; summaryCache.set(root, cached);
    }
    metadata.set(id, chooseSummary(id, cached.values.get(id) ?? metadata.get(id), await inspect(physical)));
  }
  return {
    descriptor,
    diagnostics: () => diagnostics,
    identity(path) { return locate(path).id; },
    restoreCheckpoint(path, checkpoint) {
      let location: ReturnType<typeof locate>;
      try { location = locate(path); } catch { return; }
      const state = object(checkpoint);
      if (state.version !== 1 || state.conversation !== location.id || !Array.isArray(state.files) || state.files.length > 2) return;
      for (const value of state.files) {
        const entry = object(value), cursor = object(entry.cursor), result = object(entry.result);
        if (entry.name !== 'transcript.jsonl' && entry.name !== 'transcript_full.jsonl') continue;
        const physical = join(location.root, 'brain', location.id, '.system_generated', 'logs', entry.name);
        if (inspections.has(physical)) continue;
        if (typeof entry.signature !== 'string' || !/^\d+:\d+(?:\.\d+)?$/.test(entry.signature)
          || !Number.isSafeInteger(entry.size) || Number(entry.size) < 0 || Number(entry.signature.split(':')[0]) !== entry.size
          || !Number.isSafeInteger(cursor.offset) || Number(cursor.offset) < 0 || Number(cursor.offset) > Number(entry.size)
          || !Number.isSafeInteger(cursor.generation) || Number(cursor.generation) < 0
          || typeof cursor.fingerprint !== 'string' || !/^[a-f0-9]{16}:\d{1,4}$/.test(cursor.fingerprint) || Number(cursor.fingerprint.split(':')[1]) > 1024
          || !Number.isSafeInteger(result.lastStep) || Number(result.lastStep) < -1
          || !Array.isArray(result.pathCounts) || result.pathCounts.length > 20_000) continue;
        const counts = new Map<string, number>();
        let valid = true;
        for (const pair of result.pathCounts) {
          if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== 'string' || pair[0].length > 8192 || !Number.isSafeInteger(pair[1]) || pair[1] < 0) { valid = false; break; }
          counts.set(pair[0], pair[1]);
        }
        if (!valid) continue;
        inspections.set(physical, { signature: entry.signature, size: Number(entry.size), restored: true,
          cursor: { offset: Number(cursor.offset), generation: Number(cursor.generation), fingerprint: cursor.fingerprint, ...(cursor.inOversized === true ? { inOversized: true } : {}) },
          result: { lastStep: Number(result.lastStep), title: typeof result.title === 'string' ? result.title.slice(0, 1000) : undefined, pathCounts: counts } });
      }
      if (!selected.has(location.id)) selected.set(location.id, path);
    },
    checkpoint(path) {
      const { root, id } = locate(path);
      const files = ['transcript_full.jsonl', 'transcript.jsonl'].flatMap(name => {
        const entry = inspections.get(join(root, 'brain', id, '.system_generated', 'logs', name));
        if (!entry) return [];
        return [{ name, signature: entry.signature, size: entry.size,
          cursor: { offset: entry.cursor.offset, generation: entry.cursor.generation, fingerprint: entry.cursor.fingerprint, ...(entry.cursor.inOversized ? { inOversized: true } : {}) },
          result: { lastStep: entry.result.lastStep, title: entry.result.title, pathCounts: [...entry.result.pathCounts] } }];
      });
      return { version: 1, conversation: id, files };
    },
    async readPath(path) { const { root, id } = locate(path); return await choose(root, id) ?? path; },
    async discover() {
      diagnostics = [];
      const sources: DiscoveredSource[] = [], seen = new Set<string>();
      const encrypted = new Map<string, number>(), artifactOnly = new Set<string>(), missingTranscript = new Set<string>();
      for (const configured of roots) {
        const root = resolve(configured);
        try { await readableRoot(root); }
        catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue; throw error; }
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
        const declaredIds = new Set([...nativeFiles].map(name => name.slice(0, -3)).concat([...index.keys()]));
        // brain also contains shared utility folders, which are not conversations.
        const ids = new Set([...entries.filter(entry => entry.isDirectory() && (declaredIds.has(entry.name) || /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(entry.name))).map(entry => entry.name), ...declaredIds]);
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
      await refreshSummary(root, id, physical);
      return { main, companions: [] };
    },
    createParser(ctx) {
      const { root, id } = locate(ctx.sourcePath);
      return liveParser(createParser(ctx, metadata.get(id)), ctx, root, id, () => metadata.get(id), () => { const physical = physicalSources.get(id); return physical ? inspections.get(physical)?.result.lastStep : undefined; });
    },
    sniff(head) { return head.some(value => { const row = object(value); return Number.isSafeInteger(row.step_index) && typeof row.source === 'string' && typeof row.type === 'string' && Array.isArray(row.tool_calls); }); },
  };
}

export const antigravityAdapter = createAntigravityAdapter();
