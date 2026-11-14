import type { Observation } from '@drishya/contracts';
import { createHash } from 'node:crypto';
import { sanitize } from '@drishya/privacy';
import type { ParseContext, RawObservation, RecordParser } from '@drishya/capture-core';
import { readOutput, outputReferences, taskId, taskInResult, taskOutputPath, taskState, type CapturedOutput } from './tasks.ts';
import { readChildren, type ChildReference } from './subagents.ts';
import { recordedExitCode } from './tools.ts';
import type { Summary } from './summaries.ts';
import { matched } from './pairing.ts';

type Row = Record<string, unknown>;
const object = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const text = (value: unknown) => typeof value === 'string' ? value : '';
interface Call { id: string; tool: string; input: Row; protected: boolean }
interface Task { call: Call; id: string; step: number; terminal?: { step: number; text: string; time?: string; error: boolean }; emitted?: string; nextPollAt?: number }

/** Async reads stay outside parse(), then ingest seals both journal and side-file material. */
export function liveParser(parser: RecordParser, ctx: ParseContext, root: string, id: string, summary: () => Summary | undefined): RecordParser {
  const calls = new Map<string, Call>(), tasks = new Map<string, Task>(), ambiguousTasks = new Set<string>();
  const spawnOwners = new Map<number, Call>(), childrenEmitted = new Map<string, string>();
  let children: ChildReference[] = [], childRefresh = 0, prepared: CapturedOutput | undefined;
  let lastStep = 0, taskOffset = 0, metaSignature = '';
  const agentId = ctx.agentId ?? 'agent:main';
  const rememberCall = (operationId: string | undefined, payload: Row) => {
    if (!operationId || typeof payload.tool !== 'string') return;
    calls.set(operationId, { id: operationId, tool: payload.tool, input: object(payload.input), protected: payload.protected === true || !payload.intent });
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
      prepared = undefined;
      const row = object(value);
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
      prepared = undefined;
      return [...raws, ...childReceipts()];
    },
    async refresh() {
      if (Date.now() - childRefresh >= 5000) { children = await readChildren(root, id); childRefresh = Date.now(); }
      const out = childReceipts();
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
