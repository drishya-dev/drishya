// The projection reducer: observations in, a versioned, rebuildable account of the run out.
// Pure given its inputs (observations + blob reads); no clock, no filesystem, no network.
// Every derived field says so; nothing here invents a location or a cause.

import { createHash } from 'node:crypto';
import type {
  AdapterDescriptor,
  Agent,
  Artifact,
  ArtifactKind,
  Availability,
  CapabilityMatrix,
  EvidenceLink,
  Hunk,
  Observation,
  Operation,
  OperationDetail,
  OperationKind,
  PathRef,
  Projection,
  Prose,
  Provenance,
  SearchHit,
  TextValue,
  TimelineItem,
} from '@drishya/contracts';
import { isBlobText } from '@drishya/contracts';
import type { ToolIntent, ToolOutcome } from '@drishya/capture-core';
import { literalPatch, touchesProtectedFile } from '@drishya/capture-core';
import { applyEdits, applyHunks, diffTexts, hunksFromStrings, parseApplyPatch } from './patch.ts';
import { inWorkspace, relativize, toPosix } from './paths.ts';
import { classifyShell, parseHitLines, SHELL_RULE } from './shell.ts';
import { parseTestOutput } from './tests.ts';
import { UsageAccumulator } from './usage.ts';

export const REDUCER_VERSION = 'r5';

export interface BlobIO {
  get(sha: string): string | undefined;
  put(text: string): { sha: string; bytes: number };
}

export interface ReduceOptions {
  adapters: Record<string, AdapterDescriptor>;
  /** A live recording leaves unfinished operations "running" rather than "unknown". */
  live?: boolean;
  /** Longest prose kept inline in the projection. */
  maxProseChars?: number;
  /** Reader previews; full command inputs remain captured artifacts. */
  maxInputChars?: number;
  /** Internal store readers supply a repeatable, source-time-ordered iterable. */
  ordered?: boolean;
}

const PREVIEW = 4000;
const TITLE_RULE = 'title-v1';

type Rec = Record<string, any>;

interface OpState {
  nestedPatch?: boolean;
  op: Operation;
  intent: ToolIntent;
  cwd?: string;
  callObservationId?: string;
  completed?: boolean;
}

export function reduce(recordingId: string, input: Iterable<Observation>, io: BlobIO, opts: ReduceOptions): Projection {
  return createReducer(recordingId, input, io, opts).snapshot(opts.live);
}

/** Retains reduction state for append-only, already ordered observations. The caller must
 * rebuild when ordering or workspace identity changes; snapshots never mutate this state. */
export function createReducer(recordingId: string, input: Iterable<Observation>, io: BlobIO, opts: ReduceOptions) {
  const maxProse = opts.maxProseChars ?? 64_000;
  const obs = opts.ordered ? input : orderObservations([...input]);
  let observationCount = 0;
  let lastSequence = -1;
  const usage = new UsageAccumulator();

  const agents = new Map<string, Agent>();
  const ops = new Map<string, OpState>();
  const snapshots = new Map<string, Operation>();
  const dirtyOperations = new Set<string>();
  const opOrder: string[] = [];
  // One source call may yield several per-file edit operations. Index the group once so each
  // result does not scan every prior operation in a long session.
  const opGroups = new Map<string, string[]>();
  const prose: Prose[] = [];
  const artifacts = new Map<string, Artifact>();
  const links: EvidenceLink[] = [];
  const timeline: TimelineItem[] = [];
  const gaps: Projection['gaps'] = [];
  // A recording's captured base cannot be used to reconstruct another recording's edit,
  // even when both report the same workspace-relative path.
  // Keep captured bases by content hash, not every file's complete text in process memory.
  // Reads remain exact; a missing blob makes reconstruction unavailable rather than guessed.
  const bases = new Map<string, string>();
  const knownFull = {
    get: (key: string) => { const sha = bases.get(key); return sha ? io.get(sha) : undefined; },
    set: (key: string, value: string) => { bases.set(key, io.put(value).sha); },
    delete: (key: string) => bases.delete(key),
  };
  const fileKey = (recording: string, path: string) => `${recording}\u0000${path}`;
  const harnesses = new Set<string>();
  const capabilities: Record<string, CapabilityMatrix> = {};
  let workspaceRoot: string | undefined;
  let title: string | undefined;
  let titleRank = 0;
  let firstPrompt: string | undefined;
  const rootsByRecording = new Map<string, string>();
  for (const o of obs) {
    const root = o.workspaceRoot ?? (o.kind === 'session.meta' && typeof (o.payload as Rec).cwd === 'string' ? (o.payload as Rec).cwd : undefined);
    if (root && !rootsByRecording.has(o.recordingId)) rootsByRecording.set(o.recordingId, root);
  }
  const normalizedRoot = (root: string) => {
    const path = toPosix(root).replace(/\/+$/, '');
    return /^[a-z]:\//i.test(path) ? path.toLowerCase() : path;
  };
  const insideRoot = (path: string, root: string) => {
    const p = normalizedRoot(path);
    const r = normalizedRoot(root);
    return p === r || p.startsWith(r + '/');
  };
  const roots = new Set([...rootsByRecording.values()].map(normalizedRoot));
  for (const o of obs) {
    const cwd = (o.payload as Rec).cwd;
    const primary = rootsByRecording.get(o.recordingId);
    if (o.workspaceRoot && (!primary || !insideRoot(o.workspaceRoot, primary))) roots.add(normalizedRoot(o.workspaceRoot));
    if (typeof cwd === 'string' && (!primary || !insideRoot(cwd, primary))) roots.add(normalizedRoot(cwd));
  }
  const multipleWorktrees = roots.size > 1;
  const rootKey = (root: string) => createHash('sha256').update(normalizedRoot(root)).digest('hex').slice(0, 10);
  let currentRecording = '';

  const text = (v: TextValue | undefined | null): string | undefined => {
    if (v === undefined || v === null) return undefined;
    if (typeof v === 'string') return v;
    if (isBlobText(v)) return io.get(v.$blob) ?? v.preview;
    return undefined;
  };
  const rel = (p: string | undefined, cwd?: string): string => {
    if (!p) return '';
    let q = toPosix(p);
    const base = cwd ?? rootsByRecording.get(currentRecording);
    if (base && !/^([a-zA-Z]:)?\//.test(q)) q = toPosix(base).replace(/\/+$/, '') + '/' + q.replace(/^\.\//, '');
    if (multipleWorktrees) {
      const primary = rootsByRecording.get(currentRecording);
      const root = primary && insideRoot(q, primary) ? primary : base && insideRoot(q, base) ? base : undefined;
      if (root) {
        const relative = relativize(q, root);
        if (inWorkspace(relative)) return `worktree-${rootKey(root)}/${relative}`;
      }
      return q; // outside every evidenced worktree: leave the location unresolved
    }
    return relativize(q, workspaceRoot);
  };
  const agentKey = (o: Observation) => `${o.recordingId}.${o.agentId}`;
  const step = () => timeline.length;

  const ensureAgent = (o: Observation): Agent => {
    const id = agentKey(o);
    let a = agents.get(id);
    const harness = opts.adapters[o.source.adapterId]?.harness ?? o.source.adapterId;
    if (!a) {
      const isMain = o.agentId === 'agent:main';
      a = {
        id,
        harness,
        label: isMain ? (opts.adapters[o.source.adapterId]?.label ?? harness) : 'subagent',
        firstSequence: step(),
        lastSequence: step(),
      };
      agents.set(id, a);
    }
    a.lastSequence = step();
    return a;
  };

  const addArtifact = (a: Omit<Artifact, 'id' | 'bytes' | 'lineCount' | 'blob'> & { id: string; content?: string; blobRef?: TextValue }): string => {
    let blob: string | undefined;
    let bytes = 0;
    let lineCount = 0;
    if (a.blobRef && isBlobText(a.blobRef)) {
      blob = a.blobRef.$blob;
      bytes = a.blobRef.bytes;
      const t = io.get(blob);
      lineCount = t ? t.split('\n').length : 0;
    } else if (a.content !== undefined) {
      const r = io.put(a.content);
      blob = r.sha;
      bytes = r.bytes;
      lineCount = a.content.split('\n').length;
    }
    const { content: _c, blobRef: _b, ...rest } = a;
    artifacts.set(a.id, { ...rest, blob, bytes, lineCount });
    return a.id;
  };

  const link = (l: Omit<EvidenceLink, 'id'>) => {
    links.push({ ...l, id: `lnk_${links.length}` });
  };

  const newOp = (o: Observation, id: string, intent: ToolIntent, tool: string): OpState => {
    const kind = opKind(intent);
    const cwd = typeof (intent as Rec).cwd === 'string' ? (intent as Rec).cwd : o.workspaceRoot;
    const op: Operation = {
      id,
      agentId: agentKey(o),
      kind,
      tool,
      title: tool,
      titleProvenance: derived(TITLE_RULE, [o.id]),
      origin: intent.kind === 'mcp' ? { type: 'mcp', server: intent.server, tool: intent.tool } : { type: 'native', tool },
      status: 'running',
      startSequence: step(),
      startTime: o.sourceTime,
      paths: [],
      detail: { kind: 'other', input: undefined },
      artifactIds: [],
      observationIds: [o.id],
      classification: { kind: 'captured', observationIds: [o.id] },
    };
    const st: OpState = { op, intent, cwd, callObservationId: o.id };
    ops.set(id, st);
    dirtyOperations.add(id);
    opOrder.push(id);
    const baseId = `${o.recordingId}.${o.operationId ?? o.id}`;
    let group = opGroups.get(baseId);
    if (!group) opGroups.set(baseId, group = []);
    group.push(id);
    return st;
  };

  function append(batch: Iterable<Observation>) {
    for (const o of batch) {
      observationCount++;
      lastSequence = Math.max(lastSequence, o.receivedSequence);
      usage.add(o);
      currentRecording = o.recordingId;
      if (o.source?.adapterId) {
        const d = opts.adapters[o.source.adapterId];
        if (d) {
          harnesses.add(d.harness);
          capabilities[d.id] = d.capabilities;
        }
      }
      const p = o.payload as Rec;
      switch (o.kind) {
        case 'session.meta': {
          if (typeof p.cwd === 'string' && !workspaceRoot) workspaceRoot = p.cwd;
          const rank = typeof p.titleRank === 'number' ? p.titleRank : 1;
          if (typeof p.title === 'string' && p.title && rank >= titleRank) {
            title = p.title;
            titleRank = rank;
          }
          const a = ensureAgent(o);
          if (typeof p.model === 'string') a.model = p.model;
          break;
        }
        case 'message.user': {
          const t = text(p.text) ?? '';
          if (!t.trim()) break;
          ensureAgent(o);
          // A subagent's first "user" message is its delegation prompt, already shown on the
          // delegating call. It is not a new turn from the person.
          if (o.agentId !== 'agent:main') break;
          if (!firstPrompt) firstPrompt = clip(t.replace(/\s+/g, ' ').trim(), 120);
          const id = `turn_${o.id}`;
          timeline.push({ type: 'turn', id, sequence: o.receivedSequence, agentId: agentKey(o), prompt: clip(t, maxProse), time: o.sourceTime });
          break;
        }
        case 'message.assistant':
        case 'reasoning': {
          const t = text(p.text) ?? '';
          if (!t.trim()) break;
          const a = ensureAgent(o);
          if (typeof p.model === 'string') a.model = p.model;
          const pr: Prose = {
            id: `prose_${o.id}`,
            agentId: a.id,
            role: o.kind === 'reasoning' ? 'reasoning' : 'assistant',
            text: clip(t, maxProse),
            truncated: t.length > maxProse,
            exposure: p.exposure === 'summary' ? 'summary' : 'full',
            sequence: step(),
            time: o.sourceTime,
            observationIds: [o.id],
          };
          prose.push(pr);
          if (pr.truncated) addArtifact({ id: `art_${pr.id}_prose`, kind: 'excerpt', observedAtSequence: pr.sequence, availability: 'complete', provenance: { kind: 'captured', observationIds: [o.id] }, redacted: o.redactions.length > 0, ...(isBlobText(p.text) ? { blobRef: p.text } : { content: t }) });
          timeline.push({ type: 'prose', id: `t_${pr.id}`, proseId: pr.id, sequence: o.receivedSequence, agentId: a.id, time: o.sourceTime });
          break;
        }
        case 'tool.call': {
          ensureAgent(o);
          // Long strings (heredoc commands, big edits) were moved to the blob store at ingest.
          let intent = resolveBlobs((p.intent ?? { kind: 'other' }) as ToolIntent, text);
          // Older captures retained code-mode source as a shell command. Rebuild
          // its literal patch without changing stored observations or journals.
          if (o.source.adapterId === 'codex' && (p.tool === 'exec' || p.tool === 'functions.exec') && intent.kind === 'shell') {
            const patch = literalPatch(text(intent.command as TextValue) ?? '');
            if (patch && !touchesProtectedFile({ kind: 'patch', patch })) intent = { kind: 'patch', patch };
          }
          const baseId = `${o.recordingId}.${o.operationId ?? o.id}`;
          if (ops.has(baseId)) break; // duplicate call record
          if (intent.kind === 'patch') {
            const nestedPatch = o.source.adapterId === 'codex' && (p.tool === 'exec' || p.tool === 'functions.exec');
            const patchText = text(intent.patch as TextValue) ?? '';
            const files = parseApplyPatch(patchText);
            if (!files.length) {
              const st = newOp(o, baseId, { kind: 'other' }, String(p.tool));
              st.op.detail = { kind: 'other', input: previewValue(p.input) };
              st.op.title = String(p.tool);
              timeline.push({ type: 'op-start', id: `s_${baseId}`, operationId: baseId, sequence: o.receivedSequence, agentId: st.op.agentId, time: o.sourceTime });
            }
            files.forEach((f, i) => {
              const id = files.length === 1 ? baseId : `${baseId}#${i}`;
              const st = newOp(o, id, { kind: 'edit', path: f.path, edits: [] }, String(p.tool));
              st.nestedPatch = nestedPatch;
              if (nestedPatch) st.op.classification = derived('codex-literal-patch-v1', [o.id]);
              const path = rel(f.moveTo ?? f.path, st.cwd);
              const base = knownFull.get(fileKey(o.recordingId, path));
              let hunks = f.hunks;
              let reconstruction: Availability = 'unavailable';
              if (f.op === 'add') {
                const content = f.hunks.flatMap((h) => h.lines.filter((l) => l.startsWith('+')).map((l) => l.slice(1))).join('\n');
                hunks = [{ oldStart: 0, oldLines: 0, newStart: 1, newLines: content.split('\n').length, lines: content.split('\n').map((l) => '+' + l) }];
                st.op.artifactIds.push(addArtifact({ id: `art_${id}_after`, kind: 'snapshot', path, observedAtSequence: step(), availability: 'complete', provenance: nestedPatch ? derived('codex-literal-patch-v1', [o.id]) : { kind: 'captured', observationIds: [o.id] }, redacted: o.redactions.length > 0, content, note: nestedPatch ? 'proposed file content decoded from the captured script; nested execution outcome not exposed' : 'content of a file created by the patch' }));
                if (!nestedPatch) knownFull.set(fileKey(o.recordingId, path), content);
                reconstruction = 'complete';
              } else if (base !== undefined && f.op === 'update') {
                const applied = applyHunks(base, f.hunks);
                if (applied) {
                  hunks = applied.hunks;
                  reconstruction = 'complete';
                  st.op.artifactIds.push(addArtifact({ id: `art_${id}_after`, kind: 'snapshot', path, observedAtSequence: step(), availability: 'complete', provenance: derived('apply-hunks-verified-v1', [o.id]), redacted: o.redactions.length > 0, content: applied.text, note: st.nestedPatch ? 'proposed content reconstructed from the captured script and earlier content; nested execution outcome not exposed' : 'reconstructed by applying the patch to content captured earlier in this recording' }));
                  if (!nestedPatch) knownFull.set(fileKey(o.recordingId, path), applied.text);
                }
              }
              st.op.artifactIds.push(addArtifact({ id: `art_${id}_patch`, kind: 'patch', path, observedAtSequence: step(), availability: 'complete', provenance: { kind: 'captured', observationIds: [o.id] }, redacted: o.redactions.length > 0, content: patchText }));
              st.op.kind = f.op === 'add' ? 'write' : 'edit';
              const reconstructionNote = reconstruction === 'complete' ? undefined
                : f.op === 'delete' ? 'The file was deleted.'
                : base === undefined ? 'No complete earlier capture of this file to apply the patch to.'
                : 'The patch context does not match the captured base.';
              if (reconstruction !== 'complete' && f.op !== 'add') knownFull.delete(fileKey(o.recordingId, path));
              st.op.detail = { kind: 'edit', path, hunks, created: f.op === 'add', reconstruction, reconstructionNote };
              if (nestedPatch) {
                st.op.detail.reconstructionNote = 'Patch input captured; individual nested-tool outcome not exposed.';
                knownFull.delete(fileKey(o.recordingId, path));
              }
              st.op.paths.push({ path, role: 'write', basis: 'captured' });
              st.op.title = f.op === 'add' ? `Create ${path}` : f.op === 'delete' ? `Delete ${path}` : `Edit ${path}`;
              timeline.push({ type: 'op-start', id: `s_${id}`, operationId: id, sequence: o.receivedSequence, agentId: st.op.agentId, time: o.sourceTime });
            });
            break;
          }
          const st = newOp(o, baseId, intent, String(p.tool));
          describeCall(st, p, rel);
          if ((st.op.detail.kind === 'shell' || st.op.detail.kind === 'test') && st.op.detail.command.length > (opts.maxInputChars ?? Infinity)) {
            const command = st.op.detail.command;
            st.op.artifactIds.push(addArtifact({ id: `art_${st.op.id}_input`, kind: 'excerpt', observedAtSequence: st.op.startSequence, availability: 'complete', provenance: { kind: 'captured', observationIds: [o.id] }, redacted: o.redactions.length > 0, content: command }));
            st.op.detail.command = clip(command, opts.maxInputChars!);
            if (st.intent.kind === 'shell') st.intent = { ...st.intent, command: st.op.detail.command };
          }
          timeline.push({ type: 'op-start', id: `s_${baseId}`, operationId: baseId, sequence: o.receivedSequence, agentId: st.op.agentId, time: o.sourceTime });
          break;
        }
        case 'tool.result': {
          ensureAgent(o);
          const baseId = `${o.recordingId}.${o.operationId ?? o.id}`;
          let targets = opGroups.get(baseId) ?? [];
          if (!targets.length) {
            // A result whose call we never saw (lost, or before a compaction): keep it, honestly generic.
            const st = newOp(o, baseId, { kind: 'other' }, String(p.tool ?? 'unknown tool'));
            st.op.title = `${p.tool ?? 'Tool'} result (call not captured)`;
            timeline.push({ type: 'op-start', id: `s_${baseId}`, operationId: baseId, sequence: o.receivedSequence, agentId: st.op.agentId, time: o.sourceTime });
            targets = [baseId];
          }
          for (const id of targets) {
            const st = ops.get(id)!;
            if (st.completed) continue; // duplicate result record
            st.completed = true;
            dirtyOperations.add(id);
            st.op.observationIds.push(o.id);
            st.op.endSequence = step();
            st.op.endTime = o.sourceTime;
            st.op.status = p.isError ? 'error' : st.nestedPatch ? 'unknown' : 'ok';
            completeOp(st, o, p, { text, rel, addArtifact, knownFull, link, fileKey });
            link({ from: st.callObservationId ?? o.id, to: o.id, relation: 'tool-result', basis: 'source-id', sourceObservationIds: [st.callObservationId ?? o.id, o.id], explanation: 'The harness recorded this result for this call id.' });
            // Completed calls no longer need their potentially large edit/command input.
            st.intent = { kind: 'other' };
            timeline.push({ type: 'op-end', id: `e_${id}`, operationId: id, sequence: o.receivedSequence, agentId: st.op.agentId, time: o.sourceTime });
            if (st.op.kind === 'spawn' && st.op.detail.kind === 'spawn' && st.op.detail.childAgentId) {
              timeline.push({ type: 'agent-stop', id: `x_${id}`, sequence: o.receivedSequence, agentId: st.op.detail.childAgentId, time: o.sourceTime });
              const child = agents.get(st.op.detail.childAgentId);
              if (child) child.stoppedSequence = step() - 1;
            }
          }
          break;
        }
        case 'agent.spawn': {
          const child = `${o.recordingId}.${String(p.childAgentId)}`;
          const opId = `${o.recordingId}.${o.operationId}`;
          const st = ops.get(opId);
          if (st && st.op.detail.kind === 'spawn') { st.op.detail.childAgentId = child; dirtyOperations.add(opId); }
          const a = agents.get(child);
          if (a) {
            a.parentId = agentKey(o);
            a.agentType = p.agentType;
            a.label = p.agentType ?? 'subagent';
          }
          link({ from: opId, to: child, relation: 'spawned', basis: p.basis === 'source-id' ? 'source-id' : 'heuristic', sourceObservationIds: [o.id], explanation: 'The harness recorded this subagent as started by this call.' });
          break;
        }
        case 'compaction':
          ensureAgent(o);
          timeline.push({ type: 'gap', id: `g_${o.id}`, sequence: o.receivedSequence, agentId: agentKey(o), reason: 'compaction', time: o.sourceTime });
          gaps.push({ sequence: step() - 1, reason: 'compaction', detail: 'The harness summarised earlier context here.' });
          break;
        case 'capture.gap':
          ensureAgent(o);
          timeline.push({ type: 'gap', id: `g_${o.id}`, sequence: o.receivedSequence, agentId: agentKey(o), reason: String(p.reason ?? 'gap'), time: o.sourceTime });
          gaps.push({ sequence: step() - 1, reason: String(p.reason ?? 'gap'), detail: typeof p.detail === 'string' ? p.detail : undefined });
          break;
        case 'unknown':
          gaps.push({ sequence: step(), reason: 'unsupported-record', detail: String(p.recordType ?? 'unknown') });
          break;
        default:
          break;
      }
    }

  }
  append(obs);

  function snapshot(live = opts.live): Projection {
    // Finalization works on copies: an unfinished call may complete on the next append.
    const finalAgents = new Map([...agents].map(([id, agent]) => [id, structuredClone(agent)]));
    const operations = opOrder.map((id) => {
      const op = ops.get(id)!.op;
      if (dirtyOperations.has(id) || !snapshots.has(id) || op.status === 'running' || op.kind === 'spawn') snapshots.set(id, copyValue(op));
      return snapshots.get(id)!;
    });
    dirtyOperations.clear();
    const finalLinks = [...links];
    const finalLink = (item: Omit<EvidenceLink, 'id'>) => finalLinks.push({ ...item, id: `lnk_${finalLinks.length}` });
    // Subagents we saw but whose spawn the harness did not tie to a call: attach to the latest
    // spawn operation that started before them. Heuristic, and labelled so.
    for (const a of finalAgents.values()) {
      if (a.id.endsWith('.agent:main') || a.parentId) continue;
      const candidates = operations.filter((op) => op.kind === 'spawn' && op.startSequence <= a.firstSequence && op.detail.kind === 'spawn' && !op.detail.childAgentId);
      const spawn = candidates.at(-1);
      if (!spawn || spawn.detail.kind !== 'spawn') continue;
      spawn.detail.childAgentId = a.id;
      a.parentId = spawn.agentId;
      a.agentType = spawn.detail.agentType;
      a.label = spawn.detail.agentType ?? 'subagent';
      if (spawn.endSequence !== undefined) {
        a.stoppedSequence = spawn.endSequence;
      }
      finalLink({ from: spawn.id, to: a.id, relation: 'spawned', basis: 'heuristic', sourceObservationIds: spawn.observationIds, explanation: 'Linked to the latest delegation call that started before this subagent; the harness did not record the id.' });
    }

    for (const op of operations) {
      if (op.status === 'running' && !live) op.status = 'unknown';
    }
    if (!live) {
      for (const a of finalAgents.values()) if (a.stoppedSequence === undefined && a.id.endsWith('.agent:main')) a.stoppedSequence = Math.max(0, timeline.length - 1);
    }

    crossLinks(operations, prose, finalLink);
    const passages = buildPassages(timeline, operations, prose);

    const files = new Map<string, { path: string; firstStep: number; lastStep: number; roles: Set<PathRef['role']> }>();
    for (const op of operations) {
      for (const pr of op.paths) {
        if (!inWorkspace(pr.path)) continue;
        const f = files.get(pr.path) ?? { path: pr.path, firstStep: op.startSequence, lastStep: op.startSequence, roles: new Set() };
        f.firstStep = Math.min(f.firstStep, op.startSequence);
        f.lastStep = Math.max(f.lastStep, op.endSequence ?? op.startSequence);
        f.roles.add(pr.role);
        files.set(pr.path, f);
      }
    }

    const accounting = usage.snapshot();
    return {
      reducerVersion: REDUCER_VERSION,
      recordingId,
      observationCount,
      lastSequence,
      harnesses: [...harnesses],
      workspaceRoot: multipleWorktrees ? undefined : workspaceRoot,
      title: title ?? (firstPrompt ? clip(firstPrompt.replace(/\s+/g, ' ').trim(), 120) : undefined),
      agents: [...finalAgents.values()],
      operations,
      prose: [...prose],
      artifacts: [...artifacts.values()],
      links: finalLinks,
      timeline: [...timeline],
      passages,
      files: [...files.values()].map((f) => ({ ...f, roles: [...f.roles] })).sort((a, b) => a.firstStep - b.firstStep || a.path.localeCompare(b.path)),
      gaps: [...gaps],
      capabilities: { ...capabilities },
      ...(accounting ? { usage: accounting } : {}),
    };
  }
  return { append, snapshot };
}

// ─── ordering ────────────────────────────────────────────────────────────────────────────

/** Strings are immutable; preserve their storage while isolating mutable snapshot objects. */
function copyValue<T>(value: T): T {
  if (Array.isArray(value)) return value.map(copyValue) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copyValue(item)])) as T;
  return value;
}

/**
 * Orders observations across sources (a session and its subagent files) by source time,
 * carrying each source's last time forward for records without one. Ties keep ingest order.
 */
export function orderObservations(input: Observation[]): Observation[] {
  const last = new Map<string, string>();
  const keyed = [...input]
    .sort((a, b) => a.receivedSequence - b.receivedSequence)
    .map((o, i) => {
      const src = `${o.recordingId}/${o.source?.sourceId}`;
      const t = o.sourceTime && !Number.isNaN(Date.parse(o.sourceTime)) ? new Date(o.sourceTime).toISOString() : last.get(src) ?? '';
      if (t) last.set(src, t);
      return { o, t, i };
    });
  keyed.sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : a.i - b.i));
  return keyed.map((k) => k.o);
}

// ─── operations ──────────────────────────────────────────────────────────────────────────

function opKind(i: ToolIntent): OperationKind {
  switch (i.kind) {
    case 'read':
    case 'search':
    case 'edit':
    case 'write':
    case 'shell':
    case 'mcp':
    case 'web':
    case 'spawn':
    case 'plan':
      return i.kind;
    case 'patch':
      return 'edit';
    default:
      return 'other';
  }
}

function derived(rule: string, ids: string[]): Provenance {
  return { kind: 'derived', rule, observationIds: ids };
}

function describeCall(st: OpState, p: Rec, rel: (p: string | undefined, cwd?: string) => string) {
  const { op, intent } = st;
  switch (intent.kind) {
    case 'read': {
      const path = rel(intent.path, st.cwd);
      op.paths.push({ path, role: 'read', basis: 'captured' });
      op.detail = { kind: 'read', path, startLine: intent.offset ?? 1, lineCount: intent.limit ?? 0 };
      op.title = `Read ${path}`;
      break;
    }
    case 'write':
    case 'edit': {
      const path = rel(intent.path, st.cwd);
      op.paths.push({ path, role: 'write', basis: 'captured' });
      const hunks = intent.kind === 'edit' ? hunksFromStrings(intent.edits) : [];
      op.detail = { kind: 'edit', path, hunks, created: false, reconstruction: 'unavailable' };
      op.title = intent.kind === 'write' ? `Write ${path}` : `Edit ${path}`;
      break;
    }
    case 'search': {
      op.detail = { kind: 'search', query: intent.query, mode: intent.mode, hits: [] };
      const where = intent.path ? rel(intent.path, st.cwd) : '';
      op.title = `Search “${clip(intent.query, 60)}”${where && where !== '.' ? ` in ${where}` : ''}`;
      break;
    }
    case 'shell': {
      const cls = classifyShell(intent.command);
      if (cls.kind === 'test') {
        op.kind = 'test';
        op.classification = derived(SHELL_RULE, op.observationIds);
        op.detail = { kind: 'test', command: intent.command };
        op.title = `Test · ${clip(oneLine(intent.command), 70)}`;
      } else if (cls.kind === 'read') {
        const path = rel(cls.path, st.cwd);
        op.kind = 'read';
        op.classification = derived(SHELL_RULE, op.observationIds);
        op.paths.push({ path, role: 'read', basis: 'derived' });
        op.detail = { kind: 'read', path, startLine: cls.start ?? 1, lineCount: cls.end && cls.start ? cls.end - cls.start + 1 : 0 };
        op.title = `Read ${path}`;
      } else if (cls.kind === 'search') {
        op.kind = 'search';
        op.classification = derived(SHELL_RULE, op.observationIds);
        op.detail = { kind: 'search', query: cls.query, mode: cls.query === '--files' ? 'file' : 'text', hits: [] };
        op.title = `Search “${clip(cls.query, 60)}”`;
      } else {
        op.detail = { kind: 'shell', command: intent.command };
        op.title = `Run ${clip(oneLine(intent.command), 80)}`;
      }
      break;
    }
    case 'mcp':
      op.detail = { kind: 'mcp', server: intent.server, tool: intent.tool, input: previewValue(p.input) };
      op.title = `${intent.server} · ${intent.tool}`;
      break;
    case 'web':
      op.detail = { kind: 'web', url: intent.url, query: intent.query };
      op.title = intent.url ? `Fetch ${hostOf(intent.url)}` : `Web search “${clip(intent.query ?? '', 60)}”`;
      break;
    case 'spawn':
      op.detail = { kind: 'spawn', agentType: intent.agentType, description: intent.description };
      op.title = `Delegate${intent.agentType ? ` to ${intent.agentType}` : ''}${intent.description ? `: ${clip(intent.description, 60)}` : ''}`;
      break;
    case 'plan':
      op.detail = { kind: 'plan', items: intent.items.slice(0, 50) };
      op.title = `Update plan · ${intent.items.length} items`;
      break;
    default:
      op.detail = { kind: 'other', input: previewValue(p.input) };
      op.title = String(p.tool ?? 'Tool');
  }
}

interface Ctx {
  text: (v: TextValue | undefined | null) => string | undefined;
  rel: (p: string | undefined, cwd?: string) => string;
  addArtifact: (a: Omit<Artifact, 'id' | 'bytes' | 'lineCount' | 'blob'> & { id: string; content?: string; blobRef?: TextValue }) => string;
  knownFull: { get(key: string): string | undefined; set(key: string, value: string): void; delete(key: string): boolean };
  fileKey: (recording: string, path: string) => string;
  link: (l: Omit<EvidenceLink, 'id'>) => void;
}

function completeOp(st: OpState, o: Observation, p: Rec, c: Ctx) {
  const { op } = st;
  const outcome = (p.outcome ?? { kind: 'other' }) as ToolOutcome & Rec;
  const resultText = c.text(p.text);
  const redacted = o.redactions.length > 0;
  const omitted = (s: string | undefined) => !!s && s.startsWith('[OMITTED');
  const seq = op.endSequence ?? op.startSequence;

  switch (op.detail.kind) {
    case 'read': {
      const d = op.detail;
      let content: string | undefined;
      let blobRef: TextValue | undefined;
      let harnessLineNumbers: boolean | undefined;
      if (outcome.kind === 'read') {
        blobRef = outcome.content as TextValue | undefined;
        content = c.text(outcome.content as TextValue);
        if (typeof outcome.startLine === 'number') d.startLine = outcome.startLine;
        if (typeof outcome.numLines === 'number') d.lineCount = outcome.numLines;
        if (typeof outcome.totalLines === 'number') d.totalLines = outcome.totalLines;
        harnessLineNumbers = outcome.harnessLineNumbers;
      } else if (op.classification.kind === 'derived') {
        content = resultText; // output of cat/sed: the file bytes, as the command printed them
        blobRef = p.text;
      }
      if (content !== undefined && !p.isError) {
        const lines = content.replace(/\n$/, '').split('\n');
        // A command's requested range may exceed the file; only the printed lines are known.
        if (!d.lineCount || op.classification.kind === 'derived') d.lineCount = lines.length;
        const deny = omitted(content);
        const full = d.startLine === 1 && d.totalLines !== undefined && d.lineCount >= d.totalLines;
        d.excerptArtifactId = c.addArtifact({
          id: `art_${op.id}_excerpt`,
          kind: full ? 'snapshot' : 'excerpt',
          path: d.path,
          range: { start: d.startLine, end: d.startLine + d.lineCount - 1 },
          totalLines: d.totalLines,
          observedAtSequence: seq,
          availability: deny ? 'metadata-only' : 'complete',
          provenance: op.classification.kind === 'derived' ? derived('shell-read-output-v1', op.observationIds) : { kind: 'captured', observationIds: [o.id] },
          harnessLineNumbers,
          redacted,
          note: deny ? 'protected file: content never stored' : undefined,
          ...(blobRef !== undefined && isBlobText(blobRef) && !deny ? { blobRef } : { content: deny ? '' : content }),
        });
        op.artifactIds.push(d.excerptArtifactId);
        if (full && !deny) c.knownFull.set(c.fileKey(o.recordingId, d.path), content);
      }
      if (d.lineCount && op.paths[0]) op.paths[0].lines = { start: d.startLine, end: d.startLine + d.lineCount - 1 };
      op.title = d.lineCount ? `Read ${d.path} ${d.startLine}–${d.startLine + d.lineCount - 1}` : `Read ${d.path}`;
      break;
    }
    case 'edit': {
      const d = op.detail;
      if (st.intent.kind !== 'edit' && st.intent.kind !== 'write') break; // patch ops were described at call time
      if (outcome.kind !== 'edit') break;
      const original = outcome.originalFile === null ? null : c.text(outcome.originalFile as TextValue);
      const base = typeof original === 'string' ? original : c.knownFull.get(c.fileKey(o.recordingId, d.path));
      const hunks = Array.isArray(outcome.hunks) && outcome.hunks.length ? (outcome.hunks as Hunk[]) : undefined;
      if (typeof original === 'string' && !omitted(original)) {
        op.artifactIds.push(c.addArtifact({ id: `art_${op.id}_before`, kind: 'snapshot', path: d.path, observedAtSequence: op.startSequence, availability: 'complete', provenance: { kind: 'captured', observationIds: [o.id] }, redacted, blobRef: outcome.originalFile as TextValue, note: 'file content before this edit, as the harness recorded it' }));
      }
      let after: string | undefined;
      let afterProv: Provenance | undefined;
      if (st.intent.kind === 'write') {
        after = c.text(outcome.content as TextValue) ?? st.intent.content;
        afterProv = { kind: 'captured', observationIds: [st.callObservationId ?? o.id] };
        d.created = !!outcome.created;
        d.hunks = hunks ?? (base !== undefined && after !== undefined ? diffTexts(base, after) ?? [] : after !== undefined ? addHunk(after) : []);
        op.kind = d.created ? 'write' : 'edit';
        op.title = d.created ? `Create ${d.path}` : `Write ${d.path}`;
      } else {
        if (base !== undefined && !op.status.startsWith('error')) {
          after = applyEdits(base, st.intent.edits);
          if (after !== undefined) afterProv = derived('apply-edit-verified-v1', op.observationIds);
        }
        d.hunks = hunks ?? hunksFromStrings(st.intent.edits, base);
      }
      if (after !== undefined && afterProv && !omitted(after) && op.status === 'ok') {
        op.artifactIds.push(c.addArtifact({ id: `art_${op.id}_after`, kind: 'snapshot', path: d.path, observedAtSequence: seq, availability: 'complete', provenance: afterProv, redacted, content: after, note: afterProv.kind === 'derived' ? 'reconstructed: the captured edit applied exactly once to the captured base' : 'content the agent wrote' }));
        c.knownFull.set(c.fileKey(o.recordingId, d.path), after);
        d.reconstruction = 'complete';
      } else {
        d.reconstruction = 'unavailable';
        d.reconstructionNote =
          op.status !== 'ok' ? 'The edit failed, so no after-state exists.'
          : (after !== undefined && omitted(after)) || (typeof original === 'string' && omitted(original)) ? 'Protected file: content is never stored.'
          : base === undefined ? 'The harness did not record the file before this edit, and no complete earlier capture of it exists.'
          : 'The captured edit does not apply exactly once to the captured base.';
        if (op.status === 'ok') c.knownFull.delete(c.fileKey(o.recordingId, d.path)); // the file changed in a way we cannot reproduce
      }
      break;
    }
    case 'search': {
      const d = op.detail;
      const hits: SearchHit[] = [];
      if (outcome.kind === 'search' && Array.isArray(outcome.files)) for (const f of outcome.files.slice(0, 200)) hits.push({ path: c.rel(f, st.cwd) });
      const lines = outcome.kind === 'search' ? c.text(outcome.lines as TextValue) : resultText;
      if (!hits.length && lines) for (const h of parseHitLines(lines)) hits.push({ ...h, path: c.rel(h.path, st.cwd) });
      d.hits = hits;
      d.total = (outcome.kind === 'search' && typeof outcome.total === 'number' ? outcome.total : undefined) ?? hits.length;
      const seen = new Set<string>();
      for (const h of hits) {
        if (seen.has(h.path)) continue;
        seen.add(h.path);
        op.paths.push({ path: h.path, role: 'search-hit', basis: op.classification.kind === 'derived' ? 'derived' : 'captured', lines: h.line ? { start: h.line, end: h.line } : undefined });
        c.link({ from: op.id, to: `file:${h.path}`, relation: 'explicit-reference', basis: 'captured-reference', sourceObservationIds: [o.id], explanation: 'This file appears in the search result.' });
      }
      break;
    }
    case 'test': {
      const d = op.detail;
      const out = [c.text(outcome.stdout as TextValue) ?? resultText ?? '', c.text(outcome.stderr as TextValue) ?? ''].join('\n');
      d.exitCode = p.exitCode ?? null;
      d.summary = parseTestOutput(out);
      d.outputPreview = tail(out, PREVIEW);
      if (out.length > PREVIEW) {
        d.outputArtifactId = c.addArtifact({ id: `art_${op.id}_out`, kind: 'output', observedAtSequence: seq, availability: 'complete', provenance: { kind: 'captured', observationIds: [o.id] }, redacted, content: out });
        op.artifactIds.push(d.outputArtifactId);
      }
      if ((d.summary && d.summary.failed > 0) || (typeof d.exitCode === 'number' && d.exitCode !== 0)) op.status = 'error';
      for (const f of d.summary?.failures ?? []) {
        if (!f.file) continue;
        const path = c.rel(f.file, st.cwd);
        f.file = path;
        op.paths.push({ path, role: 'test', basis: 'derived', lines: f.line ? { start: f.line, end: f.line } : undefined });
        c.link({ from: op.id, to: `file:${path}`, relation: 'test-reference', basis: 'captured-reference', sourceObservationIds: [o.id], explanation: `The test output names this file for the failing test “${f.name}”.` });
      }
      break;
    }
    case 'shell': {
      const d = op.detail;
      const out = [c.text(outcome.stdout as TextValue) ?? resultText ?? '', c.text(outcome.stderr as TextValue) ?? ''].filter(Boolean).join('\n');
      // A successful tool/wrapper return is not a captured process exit code.
      d.exitCode = p.exitCode ?? null;
      d.outputPreview = tail(out, PREVIEW);
      if (out.length > PREVIEW) {
        d.outputArtifactId = c.addArtifact({ id: `art_${op.id}_out`, kind: 'output', observedAtSequence: seq, availability: 'complete', provenance: { kind: 'captured', observationIds: [o.id] }, redacted, content: out });
        op.artifactIds.push(d.outputArtifactId);
      }
      break;
    }
    case 'mcp':
      op.detail.resultPreview = clip(resultText ?? '', PREVIEW);
      break;
    case 'web':
      op.detail.resultPreview = clip(c.text((outcome as Rec).text as TextValue) ?? resultText ?? '', PREVIEW);
      break;
    case 'spawn':
      op.detail.resultPreview = clip(c.text((outcome as Rec).text as TextValue) ?? resultText ?? '', PREVIEW);
      if (outcome.kind === 'spawn' && outcome.childAgentId) op.detail.childAgentId = `${o.recordingId}.${outcome.childAgentId}`;
      break;
    case 'other':
      op.detail.resultPreview = clip(resultText ?? '', PREVIEW);
      break;
    default:
      break;
  }
}

function addHunk(content: string): Hunk[] {
  const lines = content.split('\n').slice(0, 2000);
  return [{ oldStart: 0, oldLines: 0, newStart: 1, newLines: lines.length, lines: lines.map((l) => '+' + l) }];
}

// ─── relationships ───────────────────────────────────────────────────────────────────────

function crossLinks(operations: Operation[], prose: Prose[], link: Ctx['link']) {
  // Same artifact: each operation links to the previous one that touched the same path.
  const lastOnPath = new Map<string, Operation>();
  const writers = new Map<string, Set<string>>();
  for (const op of operations) {
    for (const pr of op.paths) {
      if (pr.role === 'search-hit' || pr.role === 'mentioned') continue;
      const prev = lastOnPath.get(pr.path);
      if (prev && prev.id !== op.id) link({ from: prev.id, to: op.id, relation: 'same-artifact', basis: 'deterministic-rule', sourceObservationIds: [...prev.observationIds, ...op.observationIds], ruleVersion: 'same-path-v1', explanation: `Both touched ${pr.path}.` });
      lastOnPath.set(pr.path, op);
      if (pr.role === 'write') {
        const w = writers.get(pr.path) ?? new Set();
        if (w.size && !w.has(op.agentId)) link({ from: [...w][0]!, to: op.agentId, relation: 'observed-write-overlap', basis: 'deterministic-rule', sourceObservationIds: op.observationIds, ruleVersion: 'write-overlap-v1', explanation: `More than one agent wrote ${pr.path}.` });
        w.add(op.agentId);
        writers.set(pr.path, w);
      }
    }
  }

  // Test outcome change: a test that failed earlier is later reported passing. A change in
  // outcome, stated as such — not a claim that any particular edit caused it.
  const failedAt = new Map<string, Operation>();
  for (const op of operations) {
    if (op.detail.kind !== 'test' || !op.detail.summary) continue;
    const s = op.detail.summary;
    for (const f of s.failures) failedAt.set(f.name, op);
    const nowPassing = new Set(s.passing);
    const cleanRun = s.failed === 0 && s.passed > 0;
    for (const [name, prev] of [...failedAt]) {
      if (prev.id === op.id) continue;
      const sameCommand = prev.detail.kind === 'test' && prev.detail.command.trim() === op.detail.command.trim();
      if (nowPassing.has(name) || (cleanRun && sameCommand)) {
        link({ from: prev.id, to: op.id, relation: 'test-outcome-change', basis: 'deterministic-rule', sourceObservationIds: [...prev.observationIds, ...op.observationIds], ruleVersion: 'test-outcome-v1', explanation: `“${name}” failed earlier and passes here.` });
        failedAt.delete(name);
      }
    }
  }

  // Prose written right after operations is their temporal neighbour — nearby, not "because".
  const byAgent = new Map<string, Operation[]>();
  for (const op of operations) {
    let agentOps = byAgent.get(op.agentId);
    if (!agentOps) byAgent.set(op.agentId, agentOps = []);
    agentOps.push(op);
  }
  for (const p of prose) {
    const agentOps = byAgent.get(p.agentId) ?? [];
    // Operations are ordered by their start sequence. Find the last eligible one without
    // scanning the full history for every prose item in a long session.
    let lo = 0;
    let hi = agentOps.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (agentOps[mid]!.startSequence < p.sequence) lo = mid + 1;
      else hi = mid;
    }
    const before = agentOps.slice(Math.max(0, lo - 3), lo);
    for (const op of before) link({ from: op.id, to: p.id, relation: 'temporal-neighbor', basis: 'deterministic-rule', sourceObservationIds: [...op.observationIds, ...p.observationIds], ruleVersion: 'neighbor-v1', explanation: 'Written shortly after this operation. Nearby activity, not a stated reason.' });
  }
}

/**
 * Passages: an agent's operations between two pieces of its prose, left to right, with the
 * prose that follows them beneath. A user turn closes every open passage.
 */
export function buildPassages(timeline: TimelineItem[], operations: Operation[], prose: Prose[]): Projection['passages'] {
  const opAgent = new Map(operations.map((o) => [o.id, o.agentId]));
  const proseAgent = new Map(prose.map((p) => [p.id, p.agentId]));
  const out: Projection['passages'] = [];
  const open = new Map<string, Projection['passages'][number]>();
  const passageByOperation = new Map<string, Projection['passages'][number]>();
  timeline.forEach((it, i) => {
    if (it.type === 'turn') {
      open.clear();
      return;
    }
    if (it.type === 'op-start') {
      const agent = opAgent.get(it.operationId)!;
      let p = open.get(agent);
      if (!p || p.proseIds.length || p.operationIds.length >= 32) {
        p = { id: `psg_${it.id}`, agentId: agent, operationIds: [], proseIds: [], firstStep: i, lastStep: i };
        out.push(p);
        open.set(agent, p);
      }
      p.operationIds.push(it.operationId);
      passageByOperation.set(it.operationId, p);
      p.lastStep = i;
    } else if (it.type === 'op-end') {
      const p = passageByOperation.get(it.operationId);
      if (p) p.lastStep = Math.max(p.lastStep, i);
    } else if (it.type === 'prose') {
      const agent = proseAgent.get(it.proseId)!;
      let p = open.get(agent);
      if (!p || p.proseIds.length >= 16) {
        p = { id: `psg_${it.id}`, agentId: agent, operationIds: [], proseIds: [], firstStep: i, lastStep: i };
        out.push(p);
        open.set(agent, p);
      }
      p.proseIds.push(it.proseId);
      p.lastStep = i;
    }
  });
  return out;
}

// ─── small helpers ───────────────────────────────────────────────────────────────────────

/** Replaces blob references with their text, deeply. Used for tool intents, which are small. */
function resolveBlobs<T>(v: T, text: (v: TextValue) => string | undefined): T {
  if (isBlobText(v)) return (text(v) ?? v.preview) as T;
  if (Array.isArray(v)) return v.map((x) => resolveBlobs(x, text)) as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolveBlobs(x, text)])) as T;
  return v;
}

function clip(s: string, n: number): string {
  return s.length > n ? Buffer.from(s.slice(0, n - 1), 'utf8').toString('utf8') + '…' : s;
}
function tail(s: string, n: number): string {
  // V8 substrings can retain the complete captured output behind a tiny preview.
  return s.length > n ? '…' + Buffer.from(s.slice(s.length - n + 1), 'utf8').toString('utf8') : s;
}
function oneLine(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}
function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return clip(url, 60);
  }
}

/** A bounded copy of a tool input for display: long strings clipped, big arrays cut. */
export function previewValue(v: unknown, depth = 0): unknown {
  if (typeof v === 'string') return v.length > 600 ? v.slice(0, 599) + '…' : v;
  if (isBlobText(v)) return v.preview.slice(0, 600) + '…';
  if (Array.isArray(v)) return depth > 3 ? `[${v.length} items]` : v.slice(0, 20).map((x) => previewValue(x, depth + 1));
  if (v && typeof v === 'object') {
    if (depth > 3) return '{…}';
    return Object.fromEntries(Object.entries(v).slice(0, 30).map(([k, x]) => [k, previewValue(x, depth + 1)]));
  }
  return v;
}

export type { OperationDetail };
