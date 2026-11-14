import type { Observation } from '@drishya/contracts';
import { createHash } from 'node:crypto';
import { sanitize } from '@drishya/privacy';
import type { ParseContext, RawObservation, RecordParser } from '@drishya/capture-core';
import { readOutput, outputReferences, taskId, taskInResult, taskOutputPath, taskState, type CapturedOutput } from './tasks.ts';
import { readChildren, type ChildReference } from './subagents.ts';
import { recordedExitCode } from './tools.ts';
import type { Summary } from './summaries.ts';
import { matched } from './pairing.ts';
import { captureMedia, type MediaResult } from './media.ts';
import { readArtifactVersions, markdownTasks, type ArtifactVersion } from './artifacts.ts';
import { localPath, within, readablePath } from './paths.ts';
import { join, resolve, basename } from 'node:path';

type Row = Record<string, unknown>;
const object = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const text = (value: unknown) => typeof value === 'string' ? value : '';
interface Call { id: string; tool: string; input: Row; protected: boolean }
interface Task { call: Call; id: string; step: number; terminal?: { step: number; text: string; time?: string; error: boolean }; emitted?: string; nextPollAt?: number }

/** Async reads stay outside parse(), then ingest seals both journal and side-file material. */
export function liveParser(parser: RecordParser, ctx: ParseContext, root: string, id: string, summary: () => Summary | undefined, inspectedStep: () => number | undefined = () => undefined): RecordParser {
  const artifactOwners = new Map<string, { id: string; path: string; name: 'implementation_plan.md' | 'task.md' | 'walkthrough.md'; completed: boolean }>(), artifactsEmitted = new Map<string, string>();
  const artifactTransitions = new Map<string, number>(), knownArtifacts = new Map<string, { ownerId: string; version: ArtifactVersion }>();
  let artifactCursor: string | undefined, missingOffset = 0;
  let preparedMedia: MediaResult | undefined, artifactRefresh = 0;
  const calls = new Map<string, Call>(), tasks = new Map<string, Task>(), ambiguousTasks = new Set<string>();
  const spawnOwners = new Map<number, Call>(), childrenEmitted = new Map<string, string>();
  let children: ChildReference[] = [], childRefresh = 0, prepared: CapturedOutput | undefined;
  let lastStep = 0, taskOffset = 0, metaSignature = '';
  const agentId = ctx.agentId ?? 'agent:main';
  const rememberCall = (operationId: string | undefined, payload: Row) => {
    if (!operationId || typeof payload.tool !== 'string') return;
    const native = object(payload.nativeArtifact), path = localPath(text(native.path));
    if (path && within(resolve(join(root, 'brain', id)), resolve(path)) && /^(?:implementation_plan|task|walkthrough)\.md$/.test(text(native.name)) && resolve(path) === resolve(join(root, 'brain', id, text(native.name)))) {
      const previous = artifactOwners.get(path);
      artifactOwners.set(path, { id: operationId, path, name: text(native.name) as 'implementation_plan.md' | 'task.md' | 'walkthrough.md', completed: previous?.id === operationId && previous.completed || false });
    }
    calls.set(operationId, { id: operationId, tool: payload.tool, input: object(payload.input), protected: payload.protected === true || !payload.intent });
  };
  const completeArtifact = (operationId: string | undefined, payload: Row) => {
    if (payload.status === 'running') return;
    for (const owner of artifactOwners.values()) if (owner.id === operationId) owner.completed = true;
  };
  const artifactReceipts = async (): Promise<RawObservation[]> => {
    // Disk versions have no historical capture time. Observe only after the native backlog
    // is consumed and the referenced write finishes; never inject today's file into old rows.
    const latest = inspectedStep();
    if (latest !== undefined && lastStep < latest) return [];
    const owners = [...artifactOwners.values()].filter(owner => owner.completed);
    if (!owners.length || Date.now() - artifactRefresh < 5000) return [];
    artifactRefresh = Date.now();
    const versions = await readArtifactVersions(root, id, owners.map(owner => owner.name), { after: artifactCursor, limit: 8 });
    artifactCursor = versions.length === 8 ? basename(versions.at(-1)!.path) : undefined;
    const out: RawObservation[] = [];
    const emit = (owner: typeof owners[number], version: ArtifactVersion) => {
      const payload = { forOperationId: owner.id, path: owner.path, name: owner.name, filePath: version.path, version: version.version, current: version.current, updatedAt: version.updatedAt, text: version.text, bytes: version.bytes, truncated: version.truncated, unavailable: version.unavailable, observedAfterNativeStep: lastStep, items: markdownTasks(version.text ?? ''), association: 'captured-path-reference' };
      const key = `${owner.id}:${version.path}`, signature = createHash('sha256').update(JSON.stringify(sanitize({ ...payload, observedAfterNativeStep: undefined }).value)).digest('hex');
      knownArtifacts.set(key, { ownerId: owner.id, version: { ...version, text: undefined } });
      if (artifactsEmitted.get(key) === signature) return;
      artifactsEmitted.set(key, signature);
      const transition = (artifactTransitions.get(key) ?? 0) + 1;
      artifactTransitions.set(key, transition);
      out.push({ recordId: `${id}:${lastStep}:artifact:${owner.id}:${basename(version.path)}:${transition}`, part: 0, kind: 'artifact.plan', agentId, operationId: owner.id, contentKeys: ['text', 'items'], availability: version.unavailable ? 'metadata-only' : version.truncated ? 'partial' : 'complete', payload: { ...payload, snapshotFingerprint: signature, artifactTransition: transition } });
    };
    for (const version of versions) {
      const owner = owners.find(owner => owner.name === version.name);
      if (owner) emit(owner, version);
    }
    // A vanished version is evidence too. Check a bounded rotating slice without reading bytes.
    const known = [...knownArtifacts.values()].filter(entry => owners.some(owner => owner.id === entry.ownerId));
    for (const entry of known.slice(missingOffset, missingOffset + 8)) {
      const owner = owners.find(owner => owner.id === entry.ownerId)!;
      try { await readablePath(root, entry.version.path, 'artifact', id); }
      catch (error) {
        const removed = ['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '');
        emit(owner, { ...entry.version, text: undefined, bytes: 0, truncated: false, unavailable: removed ? 'removed' : 'protected' });
      }
    }
    missingOffset = missingOffset + 8 >= known.length ? 0 : missingOffset + 8;
    return out;
  };
  const rememberTask = (call: Call, native: string, step: number) => {
    const previous = tasks.get(native);
    if (previous && previous.call.id !== call.id) { ambiguousTasks.add(native); tasks.delete(native); return; }
    if (!ambiguousTasks.has(native) && !previous) tasks.set(native, { call, id: native, step });
  };
  const childReceipts = (): RawObservation[] => {
    const out: RawObservation[] = [];
    for (const child of children) {
      const call = spawnOwners.get(child.spawnStepIndex), key = `${child.spawnStepIndex}:${child.conversationId}`;
      const signature = JSON.stringify([child.agentType, child.role, child.state]);
      if (!call || childrenEmitted.get(key) === signature) continue;
      childrenEmitted.set(key, signature);
      out.push({ recordId: `${id}:${child.spawnStepIndex}:child:${child.conversationId}`, part: 0, agentId, operationId: call.id, kind: 'agent.spawn',
        payload: { childAgentId: `agent:${child.conversationId}`, agentType: child.agentType, basis: 'source-id', nativeConversationId: child.conversationId,
          spawnStepIndex: child.spawnStepIndex, role: child.role, nativeState: child.state, reference: 'antigravity-subagent-metadata' } });
    }
    return out;
  };
  const taskReceipt = (task: Task, output?: CapturedOutput): RawObservation | undefined => {
    if (task.call.protected) return;
    const terminal = task.terminal, available = output?.available === true;
    if (!terminal && !available) return;
    const body = [terminal?.text, available ? output.text : undefined].filter(Boolean).join('\n\n');
    // Identical captured bytes stay identical across unrelated journal appends and restarts.
    // Changed bytes are a new file snapshot, bounded after the last whole native step we saw.
    const signature = createHash('sha256').update(JSON.stringify([sanitize(body).value, terminal?.error, terminal?.step])).digest('hex');
    if (task.emitted === signature) return;
    task.emitted = signature;
    const exitCode = terminal ? recordedExitCode(terminal.text) : undefined;
    return { recordId: `${id}:${lastStep}:task-output:${task.id}:${signature}`, part: 0, agentId, operationId: task.call.id,
      kind: 'tool.result', correlation: { operationId: task.call.id, basis: 'source-id' },
      availability: !terminal || !available || output.truncated ? 'partial' : 'complete', contentKeys: ['text', 'outcome', 'taskResultText'],
      payload: { tool: task.call.tool, text: body, status: terminal ? 'complete' : 'running', isError: terminal?.error ?? false, exitCode,
        resultUpdate: true, nativeTaskId: task.id, taskResultText: terminal?.text, snapshotFingerprint: signature,
        observedAfterNativeStep: lastStep, terminalNativeStep: terminal?.step, terminalTime: terminal?.time, derived: 'antigravity-task-reference-v1',
        resultAvailability: terminal ? 'recorded' : 'not-recorded',
        outputSource: available ? { path: output.path, bytes: output.bytes, truncated: output.truncated, source: 'captured-harness-file' } : { unavailable: output?.reason ?? 'not-recorded' },
        outcome: { kind: 'shell', stdout: body, run: { backgroundTaskId: task.id } } } };
  };
  return {
    prime(observations) {
      parser.prime(observations);
      for (const o of observations) if (o.kind === 'tool.call') rememberCall(o.operationId, object(o.payload));
      for (const o of observations) {
        const p = object(o.payload), call = o.operationId ? calls.get(o.operationId) : undefined;
        const step = Number.parseInt(o.source.recordId?.split(':')[1] ?? '', 10);
        if (Number.isSafeInteger(step)) lastStep = Math.max(lastStep, step);
        if (o.kind === 'artifact.plan' && typeof p.filePath === 'string' && typeof p.forOperationId === 'string') {
          const key = `${p.forOperationId}:${p.filePath}`;
          artifactsEmitted.set(key, text(p.snapshotFingerprint));
          if (Number.isSafeInteger(p.artifactTransition) && Number(p.artifactTransition) > 0) artifactTransitions.set(key, Number(p.artifactTransition));
          knownArtifacts.set(key, { ownerId: p.forOperationId, version: { name: text(p.name), path: p.filePath, version: typeof p.version === 'string' ? p.version : undefined, current: p.current === true, updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : undefined, bytes: Number(p.bytes) || 0, truncated: p.truncated === true, unavailable: p.unavailable as ArtifactVersion['unavailable'] } });
        }
        if (o.kind === 'tool.result') completeArtifact(o.operationId, p);
        if (o.kind === 'tool.result' && call) {
          if (call.tool === 'invoke_subagent' && Number.isSafeInteger(step)) spawnOwners.set(step, call);
          const native = taskId(object(object(p.outcome).run).backgroundTaskId);
          if (call.tool === 'run_command' && native) rememberTask(call, native, step);
          if (p.resultUpdate === true && typeof p.nativeTaskId === 'string') {
            const task = tasks.get(p.nativeTaskId);
            if (task) {
              task.emitted = text(p.snapshotFingerprint);
              if (p.status === 'complete') task.terminal = { step: typeof p.terminalNativeStep === 'number' ? p.terminalNativeStep : step, text: text(p.taskResultText), time: typeof p.terminalTime === 'string' ? p.terminalTime : o.sourceTime, error: p.isError === true };
            }
          }
        }
        if (o.kind === 'agent.spawn' && typeof p.nativeConversationId === 'string') childrenEmitted.set(`${p.spawnStepIndex}:${p.nativeConversationId}`, JSON.stringify([p.agentType, p.role, p.nativeState]));
      }
    },
    async prepare(value) {
      prepared = undefined; preparedMedia = undefined;
      const row = object(value);
      if (Array.isArray(row.media)) preparedMedia = await captureMedia(root, id, row.media);
      if (Date.now() - childRefresh >= 5000) { children = await readChildren(root, id); childRefresh = Date.now(); }
      const references = [typeof row.full_output_uri === 'string' ? row.full_output_uri : undefined, ...outputReferences(text(row.content))].filter((v): v is string => !!v);
      // Only one bounded persisted-output read per native receipt. Task logs are polled separately.
      const reference = references.find(path => /[\\/]steps[\\/]\d+[\\/]output\.txt$/.test(path));
      if (reference) prepared = await readOutput(root, id, reference);
    },
    parse(value) {
      const row = object(value), step = Number(row.step_index), content = text(row.content);
      if (Number.isSafeInteger(step)) lastStep = Math.max(lastStep, step);
      const raws = parser.parse(value);
      for (const raw of raws) {
        const p = raw.payload;
        if (preparedMedia && (raw.kind === 'message.user' || raw.kind === 'tool.result')) {
          p.images = preparedMedia.images; p.imageReferences = preparedMedia.references;
        }
        if (raw.kind === 'tool.result') completeArtifact(raw.operationId, p);
        if (raw.kind === 'tool.call') rememberCall(raw.operationId, p);
        const call = raw.operationId ? calls.get(raw.operationId) : undefined;
        if (raw.kind !== 'tool.result' || !call) continue;
        if (call.tool === 'invoke_subagent') spawnOwners.set(step, call);
        if (prepared) {
          p.outputSource = prepared.available ? { path: prepared.path, bytes: prepared.bytes, truncated: prepared.truncated, source: 'captured-harness-file' } : { unavailable: prepared.reason };
          if (prepared.available && !call.protected) {
            p.text = `${content}\n\n${prepared.text}`;
            if (object(p.outcome).kind === 'shell') p.outcome = { ...object(p.outcome), stdout: p.text };
            if (prepared.truncated) raw.availability = 'partial';
          }
        }
        if (call.tool === 'run_command') {
          const native = taskInResult(content);
          if (native) {
            rememberTask(call, native, step);
            p.outcome = { ...object(p.outcome), run: { backgroundTaskId: native } };
          }
        }
        if (call.tool === 'manage_task') {
          const native = taskId(call.input.TaskId), task = native ? tasks.get(native) : undefined, state = taskState(content);
          if (task && state && state !== 'running') { task.terminal = { step, text: content, time: raw.sourceTime, error: state === 'error' }; task.nextPollAt = undefined; }
        }
      }
      prepared = undefined; preparedMedia = undefined;
      return [...raws, ...childReceipts()];
    },
    async refresh() {
      if (Date.now() - childRefresh >= 5000) { children = await readChildren(root, id); childRefresh = Date.now(); }
      const out = [...childReceipts(), ...await artifactReceipts()];
      // Bound each polling turn even when an old conversation contains hundreds of tasks.
      const pending = [...tasks.values()].filter(task => !task.call.protected && (!task.nextPollAt || Date.now() >= task.nextPollAt));
      const batch = pending.slice(taskOffset, taskOffset + 8); taskOffset = taskOffset + 8 >= pending.length ? 0 : taskOffset + 8;
      for (const task of batch) {
        const path = taskOutputPath(root, id, task.id);
        const result = path ? await readOutput(root, id, path) : undefined;
        // A completion receipt may precede the final log write. Continue bounded,
        // slower checks rather than permanently losing a late file or its suffix.
        task.nextPollAt = task.terminal ? Date.now() + 5000 : undefined;
        const receipt = taskReceipt(task, result);
        if (receipt) {
          out.push(receipt);
          if (task.terminal) out.push(matched({ ...task.call, args: task.call.input, intent: { kind: 'other' }, step: Number.parseInt(task.call.id.split(':')[1] ?? '', 10) }, { agentId }));
        }
      }
      const meta = summary(), signature = JSON.stringify(meta);
      if (meta && signature !== metaSignature) {
        metaSignature = signature;
        out.push({ recordId: `${id}:metadata`, part: 0, kind: 'session.meta', agentId, workspaceRoot: meta.workspaces[0], payload: { harness: 'antigravity', cwd: meta.workspaces[0], additionalRoots: meta.workspaces.slice(1), title: meta.title, parentThreadId: meta.parentSessionId, agentNickname: meta.agentName, nativeStepCount: meta.stepCount, workspaceSelection: meta.workspaces.length > 1 ? 'derived-captured-path-count' : 'captured-index' } });
      }
      return out;
    },
  };
}
