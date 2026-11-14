// The projection reducer: observations in, a versioned, rebuildable account of the run out.
// Pure given its inputs (observations + blob reads); no clock, no filesystem, no network.
// Every derived field says so; nothing here invents a location or a cause.

import { createHash } from 'node:crypto';
import { posix } from 'node:path';
import type {
  AdapterDescriptor,
  SessionLineageView,
  WebResult,
  CommandRun,
  BeforeTurn,
  CheckpointPayload,
  OperationImage,
  Notice,
  Agent,
  AvailableTool,
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
  ItemPayload,
} from '@drishya/contracts';
import { isBlobText } from '@drishya/contracts';
import type { ToolIntent, ToolOutcome } from '@drishya/capture-core';
import { literalPatch, literalPlan, literalPlanConfirmed, parseMcpName, touchesProtectedFile } from '@drishya/capture-core';
import { applyEdits, applyHunks, diffTexts, hunksFromStrings, parseApplyPatch, parseUnifiedHunks, resolveHunkLines } from './patch.ts';
import { inWorkspace, relativize, toPosix } from './paths.ts';
import { classifyShell, parseHitLines, plausibleHitPath, SHELL_RULE } from './shell.ts';
import { parseTestOutput } from './tests.ts';
import { TurnAccumulator } from './turns.ts';
import { UsageAccumulator } from './usage.ts';
import { ContextAccumulator } from './context.ts';
import { placeChildren } from './children.ts';
import { declinedFrom } from './declined.ts';
import { DESKTOP_PLAN_TOOL, DesktopChecklists, TaskPlans, exitPlanText, proposedPlan } from './plans.ts';
import {legacyAgentDelivery} from './agent-delivery.ts';

/** Longest changed-region snippet kept on a notice. */
const NOTICE_SNIPPET = 10_000;

export const REDUCER_VERSION = 'r42';

/**
 * Records that lose nothing by being unread, so they are no gap in the work. Codex repeats its messages,
 * reasoning and calls as `item_completed` (checked on 59 local journals: every text is also kept from its
 * response item or tool call, and reasoning has no raw content). Claude Code logs its API requests alongside
 * the conversation. An `Extension` item stays a gap: some kinds have no other record.
 */
const SEPARATE_LOGS = new Set(['item_completed:Reasoning', 'item_completed:AgentMessage', 'item_completed:UserMessage', 'item_completed:ContextCompaction', 'item_completed:CollabAgentToolCall', 'api-request', 'api-request-blob', 'api-request-shape', 'tools-used']);

export interface BlobIO {
  get(sha: string): string | undefined;
  put(text: string): { sha: string; bytes: number };
}

export interface ReduceOptions {
  lineage?: SessionLineageView;
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
  antigravityChildren?: Set<string>;
  literalPlan?: { text: string; status: string }[];
  taskInput?: unknown;
  taskRedacted?: boolean;
  taskTurn?: string;
  nestedPatch?: boolean;
  op: Operation;
  intent: ToolIntent;
  cwd?: string;
  callObservationId?: string;
  completed?: boolean;
  typedOutcome?: boolean;
  script?: TextValue;
  scriptTool?: string;
  scriptWrapper?: boolean;
  wrapperResult?: { observation: Observation; payload: Rec };
  /** The harness id of the prompt that opened this operation's turn (Claude: message uuid). */
  turnMessage?: string;
}

export function reduce(recordingId: string, input: Iterable<Observation>, io: BlobIO, opts: ReduceOptions): Projection {
  return createReducer(recordingId, input, io, opts).snapshot(opts.live);
}

/** Retains reduction state for append-only, already ordered observations. The caller must
 * rebuild when ordering or workspace identity changes; snapshots never mutate this state. */
export function createReducer(recordingId: string, input: Iterable<Observation>, io: BlobIO, opts: ReduceOptions) {
  const maxProse = opts.maxProseChars ?? 64_000;
  const obs = opts.ordered ? input : orderObservations([...input]);
  const lineageStarts = new Map<string, string>();
  let observationCount = 0;
  let lastSequence = -1;
  const taskPlans = new TaskPlans();
  const desktopPlans = new DesktopChecklists();
  const usage = new UsageAccumulator();
  const context = new ContextAccumulator();
  const turnRecords = new TurnAccumulator();
  const itemReceipts = new Map<string, number>();

  const agents = new Map<string, Agent>();
  const ops = new Map<string, OpState>();
  const snapshots = new Map<string, Operation>();
  const dirtyOperations = new Set<string>();
  const opOrder: string[] = [];
  // One source call may yield several per-file edit operations. Index the group once so each
  // result does not scan every prior operation in a long session.
  const opGroups = new Map<string, string[]>();
  const prose: Prose[] = [];
  // Reasoning recorded without text folds to one line per turn and agent (review125 S3).
  const turnByRecording = new Map<string, string>();
  // CONTENT-1: a prompt's turn by "<recording>|<record id>", and images seen before its text part.
  const turnByRecord = new Map<string, TimelineItem & { type: 'turn' }>();
  // CONTENT-20: the journal line that first carried each part of a prompt record. Claude Code re-emits earlier rows (same uuid, same time) after a resume or
  // compaction; a copy from another line is the same message, not a second prompt, so it is skipped by its native record id.
  const promptRecordLine = new Map<string, string>();
  // `first` is the record's first image part: an image-only prompt keeps that position and id.
  const pendingTurnImages = new Map<string, { images: OperationImage[]; first: Observation }>();
  const unrecorded = new Map<string, Prose>();
  // DATA-5: checkpoints by "<recording>|<prompt id>", then by workspace path. Order-independent:
  // an edit is matched at snapshot time, whichever of the two was recorded first.
  const turnMessageByRecording = new Map<string, string>();
  // Paths stay as recorded until matching: a turn's snapshot precedes the prompt that sets the root.
  const checkpoints = new Map<string, { raw: { path: string; at: BeforeTurn }[]; byPath?: Map<string, BeforeTurn> }>();
  const awaitingCheckpoint = new Set<string>();
  // DATA-6: harness notices of files changed outside its edits; identical repeats fold into one.
  const notices: Notice[] = [];
  // TOOLS-1: tools the harness listed as available, in first-listed order.
  const availableTools = new Map<string, AvailableTool>();
  const lastNotice = new Map<string, Notice>();
  const artifacts = new Map<string, Artifact>();
  const links: EvidenceLink[] = [];
  const timeline: TimelineItem[] = [];
  let hasResultVersions = false;
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
  let recordedBranch: Projection['recordedBranch'];
  let title: string | undefined;
  let titleRank = 0;
  let firstPrompt: string | undefined;
  const rootsByRecording = new Map<string, string>();
  for (const o of obs) {
    const root = o.workspaceRoot ?? (o.kind === 'session.meta' && typeof (o.payload as Rec).cwd === 'string' ? (o.payload as Rec).cwd : undefined);
    if (root && !rootsByRecording.has(o.recordingId)) rootsByRecording.set(o.recordingId, root);
  }
  // Empty incremental readers may receive their first captured root only on append.
  let branchPrimaryRoot = rootsByRecording.get(recordingId);
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
    const operationCwd = (o.payload as Rec).intent?.cwd;
    // A descendant captured directory is a boundary too. This is recorded cwd
    // evidence, not a claim that a folder name identifies a Git worktree.
    for (const root of [o.workspaceRoot, cwd, operationCwd]) if (typeof root === 'string' && root) roots.add(normalizedRoot(root));
  }
  const multipleWorktrees = roots.size > 1;
  const locationRoots = [...roots].sort((a, b) => b.length - a.length || a.localeCompare(b));
  const rootKey = (root: string) => createHash('sha256').update(normalizedRoot(root)).digest('hex').slice(0, 10);
  let currentRecording = '';

  const text = (v: TextValue | undefined | null, allowPreview = true): string | undefined => {
    if (v === undefined || v === null) return undefined;
    if (typeof v === 'string') return v;
    if (isBlobText(v)) return io.get(v.$blob) ?? (allowPreview ? v.preview : undefined);
    return undefined;
  };
  const rel = (p: string | undefined, cwd?: string): string => {
    if (!p) return '';
    let q = toPosix(p);
    const base = cwd ?? rootsByRecording.get(currentRecording);
    if (base && !/^([a-zA-Z]:)?\//.test(q)) q = toPosix(base).replace(/\/+$/, '') + '/' + q.replace(/^\.\//, '');
    // Resolve dot segments before testing ancestry, preserving URL and UNC identities.
    if (!/^[a-z]+:\/\//i.test(q)) q = (q.startsWith('//') ? '/' : '') + posix.normalize(q);
    if (multipleWorktrees) {
      const root = locationRoots.find(root => insideRoot(q, root));
      if (root) {
        const relative = relativize(q, root);
        if (inWorkspace(relative)) return `worktree-${rootKey(root)}/${relative}`;
      }
      return q; // outside every evidenced worktree: leave the location unresolved
    }
    return relativize(q, workspaceRoot);
  };
  const correlationOwner = (o: Observation) => opts.lineage?.recordingIds.includes(o.recordingId) ? opts.lineage.currentRecordingId : o.recordingId;
  const agentKey = (o: Observation) => `${correlationOwner(o)}.${o.agentId}`;
  // Calls correlate by owner and native operation id; a proven lineage shares one owner, an ordinary recording is unchanged.
  const callKey = (o: Observation, operationId = o.operationId ?? o.id) => `${correlationOwner(o)}.${operationId}`;
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
    const st: OpState = { op, intent, cwd, taskTurn: turnByRecording.get(correlationOwner(o)), callObservationId: o.id, turnMessage: turnMessageByRecording.get(correlationOwner(o)) };
    ops.set(id, st);
    if (st.turnMessage && (intent.kind === 'edit' || intent.kind === 'write' || intent.kind === 'patch')) awaitingCheckpoint.add(id);
    dirtyOperations.add(id);
    opOrder.push(id);
    const baseId = `${o.recordingId}.${o.operationId ?? o.id}`;
    let group = opGroups.get(callKey(o));
    if (!group) opGroups.set(callKey(o), group = []);
    group.push(id);
    return st;
  };

  // CONTENT-1: a prompt record whose images never met a text part is still a prompt, with no invented words.
  const imageOnlyTurn = ({ images, first }: { images: OperationImage[]; first: Observation }): TimelineItem & { type: 'turn' } =>
    ({ type: 'turn', id: `turn_${first.id}`, sequence: first.receivedSequence, agentId: agentKey(first), prompt: '', time: first.sourceTime, images });
  function flushImageOnlyTurns(except?: string) {
    for (const [key, held] of [...pendingTurnImages]) {
      if (key === except) continue;
      pendingTurnImages.delete(key);
      ensureAgent(held.first);
      const turn = imageOnlyTurn(held);
      turnByRecording.set(correlationOwner(held.first), turn.id);
      if (held.first.source.recordId) turnMessageByRecording.set(correlationOwner(held.first), held.first.source.recordId);
      turnByRecord.set(key, turn);
      timeline.push(turn);
    }
  }

  function append(batch: Iterable<Observation>) {
    for (const o of batch) {
      const materialStart = timeline.length;
      if (pendingTurnImages.size) flushImageOnlyTurns(`${o.recordingId}|${o.source?.recordId ?? o.id}`);
      observationCount++;
      lastSequence = Math.max(lastSequence, o.receivedSequence);
      usage.add(o);
      context.usage(o, step(), agentKey(o));
      turnRecords.add(o);
      currentRecording = o.recordingId;
      if (o.source?.adapterId) {
        const d = opts.adapters[o.source.adapterId];
        if (d) {
          harnesses.add(d.harness);
          capabilities[d.id] = d.capabilities;
        }
      }
      const p = o.payload as Rec;
      if (!branchPrimaryRoot && o.recordingId === recordingId) {
        branchPrimaryRoot = o.workspaceRoot ?? (o.kind === 'session.meta' && typeof p.cwd === 'string' ? p.cwd : undefined);
      }
      switch (o.kind) {
        case 'session.meta': {
          if (typeof p.cwd === 'string' && !workspaceRoot) workspaceRoot = p.cwd;
          // A branch names this captured root only. Neither companion agents nor another
          // recording/root may replace the selected session's identity; missing data stays missing.
          const primaryRoot = branchPrimaryRoot;
          if (o.recordingId === recordingId && o.agentId === 'agent:main' &&
              typeof p.branch === 'string' && p.branch.trim() && typeof p.cwd === 'string' && p.cwd.trim() &&
              primaryRoot && normalizedRoot(p.cwd) === normalizedRoot(primaryRoot)) {
            recordedBranch = { name: p.branch, workspaceRoot: p.cwd, provenance: { kind: 'captured', observationIds: [o.id] } };
          }
          const rank = typeof p.titleRank === 'number' ? p.titleRank : 1;
          if (typeof p.title === 'string' && p.title && rank >= titleRank) {
            title = p.title;
            titleRank = rank;
          }
          const a = ensureAgent(o);
          if (typeof p.model === 'string') a.model = p.model;
          if (typeof p.agentNickname === 'string') { a.nickname = p.agentNickname; a.label = p.agentNickname; }
          if (typeof p.agentPath === 'string') a.address = p.agentPath;
          if (typeof p.effort === 'string') a.effort = p.effort;
          if (typeof p.forkedFromId === 'string') a.forkedFromId = p.forkedFromId;
          if (typeof p.parentThreadId === 'string') a.parentId = `${o.recordingId}.agent:${p.parentThreadId}`;
          if (typeof p.threadSource === 'string') a.threadSource = p.threadSource;
          if (typeof p.startedBy === 'string') a.startedBy = p.startedBy;
          if (typeof p.spawnDepth === 'number') a.spawnDepth = p.spawnDepth;
          if (typeof p.agentRole === 'string') a.role = p.agentRole;
          break;
        }
        case 'turn.detail': {
          // The most recent turn's effort is the agent's current one; the per-turn history stays in Projection.turns.
          const effort = (p.settings as { effort?: unknown } | undefined)?.effort;
          if (typeof effort === 'string') ensureAgent(o).effort = effort;
          break;
        }
        case 'item.completed': {
          const item = { ...p, command: text(p.command) } as ItemPayload;
          const parentId = o.correlation ? `${o.recordingId}.${o.correlation.operationId}` : undefined;
          const groupId = o.correlation ? callKey(o, o.correlation.operationId) : undefined;
          let parent = parentId ? ops.get(`${parentId}#script`) ?? ops.get(parentId) : undefined;
          const targets = groupId ? (opGroups.get(groupId) ?? []).map(id => ops.get(id)!) : [];
          const scriptParent = () => {
            if (!parentId || !targets.some(st => st.nestedPatch)) return parent;
            const found = ops.get(`${parentId}#script`);
            if (found) return found;
            const edits = targets.filter(st => st.nestedPatch), first = edits[0]!;
            const command = text(first.script) ?? '';
            const wrapper = newOp(o, `${parentId}#script`, { kind: 'shell', command }, first.scriptTool ?? first.op.tool);
            wrapper.scriptWrapper = true; wrapper.callObservationId = first.callObservationId;
            wrapper.op.observationIds = [first.callObservationId!];
            wrapper.op.classification = { kind: 'captured', observationIds: wrapper.op.observationIds };
            wrapper.op.startSequence = Math.min(...edits.map(st => st.op.startSequence));
            wrapper.op.startTime = first.op.startTime;
            describeCall(wrapper, { tool: first.scriptTool ?? first.op.tool, input: {} }, rel);
            // The source call is shared by the per-file edits. Preserve it as a details-only parent.
            if (command.length > (opts.maxInputChars ?? Infinity)) {
              wrapper.op.artifactIds.push(addArtifact({ id: `art_${wrapper.op.id}_input`, kind: 'excerpt', observedAtSequence: wrapper.op.startSequence, availability: 'complete', provenance: { kind: 'captured', observationIds: wrapper.op.observationIds }, redacted: o.redactions.length > 0, content: command }));
              if (wrapper.op.detail.kind === 'shell') wrapper.op.detail.command = clip(command, opts.maxInputChars!);
            }
            if (first.wrapperResult) {
              const result = first.wrapperResult;
              wrapper.completed = true; wrapper.op.status = result.payload.isError ? 'error' : 'ok';
              wrapper.op.endSequence = Math.max(...edits.map(st => st.op.endSequence ?? st.op.startSequence));
              wrapper.op.endTime = result.observation.sourceTime; wrapper.op.observationIds.push(result.observation.id);
              completeOp(wrapper, result.observation, result.payload, { text, rel, addArtifact, knownFull, link, fileKey });
            }
            for (const edit of edits) { edit.op.parentOperationId = wrapper.op.id; dirtyOperations.add(edit.op.id); }
            opGroups.get(groupId!)!.push(wrapper.op.id);
            return wrapper;
          };
          const relate = (op: Operation) => {
            if (!o.correlation) return;
            link({ from: parent?.op.id ?? parentId!, to: op.id, relation: 'tool-result', basis: o.correlation.basis === 'source-id' ? 'source-id' : 'deterministic-rule',
              ...(o.correlation.basis === 'enclosing-call' ? { ruleVersion: 'codex-enclosing-call-v1' } : {}), sourceObservationIds: [targets[0]?.callObservationId, o.id].filter((id): id is string => !!id),
              explanation: o.correlation.basis === 'enclosing-call' ? 'Recorded between this call and its output.' : 'The harness recorded the same item and call id.' });
          };
          if (item.item === 'subagent' && item.agent) {
            const native = item.agent.path?.startsWith('/root/') ? item.agent.path.split('/').at(-1)! : item.agent.threadId;
            const a = ensureAgent({ ...o, agentId: `agent:${native}` });
            if (item.agent.path !== undefined) a.address = item.agent.path;
            if (item.agent.model !== undefined) a.model = item.agent.model;
            if (item.agent.effort !== undefined) a.effort = item.agent.effort;
            if (parent && o.correlation?.basis === 'source-id' && parent.op.detail.kind === 'spawn') {
              a.parentId = parent.op.agentId; parent.op.detail.childAgentId = a.id; dirtyOperations.add(parent.op.id);
            }
            if (parent) link({ from: parent.op.id, to: a.id, relation: 'explicit-reference', basis: o.correlation!.basis === 'source-id' ? 'source-id' : 'deterministic-rule', ...(o.correlation!.basis === 'enclosing-call' ? { ruleVersion: 'codex-enclosing-call-v1' } : {}), sourceObservationIds: [o.id], explanation: o.correlation!.basis === 'enclosing-call' ? 'Recorded between this call and its output.' : 'The harness recorded this agent reference for this call id.' });
            break;
          }
          const edits = targets.filter(st => st.nestedPatch && st.op.detail.kind === 'edit');
          if (item.item === 'file-change' && edits.length) {
            const paths = new Set(item.changes?.map(change => rel(change.path, o.workspaceRoot)));
            const exact = edits.length === paths.size && edits.every(st => st.op.detail.kind === 'edit' && paths.has(st.op.detail.path));
            if (exact) parent = scriptParent();
            if (exact) for (const st of edits) {
              st.typedOutcome = true;
              st.op.status = item.status === 'failed' ? 'error' : item.status === 'completed' ? 'ok' : 'unknown';
              st.op.observationIds.push(o.id); st.op.classification = { kind: 'captured', observationIds: [o.id] };
              if (st.op.detail.kind === 'edit') st.op.detail.reconstructionNote = 'Patch outcome recorded by a typed file change; path set matches exactly.';
              if (st.op.detail.kind === 'edit') {
                const change = item.changes?.find(change => rel(change.path, o.workspaceRoot) === (st.op.detail as Extract<OperationDetail, { kind: 'edit' }>).path);
                const hunks = parseUnifiedHunks(text(change?.content) ?? '');
                if (hunks.length) st.op.detail.hunks = hunks;
              }
              st.op.tool = 'FileChange'; st.op.origin = { type: 'native', tool: 'FileChange' };
              if (st.script !== undefined) st.op.artifactIds.push(addArtifact({ id: `art_${st.op.id}_script`, kind: 'excerpt', observedAtSequence: st.op.startSequence, availability: 'complete', provenance: { kind: 'captured', observationIds: [st.callObservationId!] }, redacted: o.redactions.length > 0, content: text(st.script) }));
              dirtyOperations.add(st.op.id); relate(st.op);
            }
            break;
          }
          if (item.item === 'file-change') {
            for (const [index, change] of (item.changes ?? []).entries()) {
              const id = `${o.recordingId}.item:${o.id}#${index}`;
              const st = newOp(o, id, { kind: 'edit', path: change.path, edits: [] }, 'FileChange');
              itemReceipts.set(id, o.receivedSequence);
              const path = rel(change.path, o.workspaceRoot), content = text(change.content);
              st.op.paths = [{ path, role: 'write', basis: 'captured' }];
              st.op.title = `${change.type === 'add' ? 'Create' : change.type === 'delete' ? 'Delete' : 'Edit'} ${path}`;
              st.op.detail = { kind: 'edit', path, hunks: content ? (change.type === 'add' ? addHunk(content) : parseUnifiedHunks(content)) : [], created: change.type === 'add', ...(change.type === 'delete' ? { deleted: true } : {}), reconstruction: 'unavailable', reconstructionNote: 'Captured file change; no full file snapshot is inferred.' };
              st.op.status = item.status === 'failed' ? 'error' : item.status === 'completed' ? 'ok' : 'unknown';
              st.completed = true; st.op.startTime = undefined; st.op.endTime = o.sourceTime; st.op.endSequence = step();
              if (parent) { st.op.parentOperationId = parent.op.id; relate(st.op); }
              else { timeline.push({ type: 'op-start', id: `s_${id}`, operationId: id, sequence: o.receivedSequence, agentId: st.op.agentId, time: o.sourceTime }); st.op.endSequence = step(); timeline.push({ type: 'op-end', id: `e_${id}`, operationId: id, sequence: o.receivedSequence, agentId: st.op.agentId, time: o.sourceTime }); }
            }
            break;
          }
          let intent: ToolIntent = { kind: 'other' }, tool: string = item.item;
          parent = scriptParent();
          if (item.item === 'command' && typeof item.command === 'string') { intent = { kind: 'shell', command: item.command, cwd: item.cwd }; tool = 'CommandExecution'; }
          else if (item.item === 'mcp-call' && item.mcp) { intent = { kind: 'mcp', server: item.mcp.server, tool: item.mcp.tool }; tool = item.mcp.tool; }
          else if (item.item === 'web-search') intent = { kind: 'web', query: item.web?.query };
          const same = o.correlation?.basis === 'source-id' && parent && (item.item === 'mcp-call' && parent.op.detail.kind === 'mcp' || item.item === 'command' && parent.op.detail.kind === 'shell' || item.item === 'web-search' && parent.op.detail.kind === 'web');
          const existing = same ? parent : undefined;
          const id = existing?.op.id ?? `${o.recordingId}.item:${o.id}`;
          if (!same && ops.has(id)) break;
          ensureAgent(o);
          const st = existing ?? newOp(o, id, intent, tool);
          itemReceipts.set(id, o.receivedSequence);
          const completed = st.completed;
          st.intent = intent; st.typedOutcome = true; st.completed = same ? completed : true;
          st.op.durationMs = item.durationMs;
          st.op.status = item.status === 'failed' || item.mcp?.isError || item.mcp?.error || typeof item.exitCode === 'number' && item.exitCode !== 0 ? 'error' : item.status === 'completed' ? 'ok' : 'unknown';
          const input = existing?.op.detail.kind === 'mcp' ? existing.op.detail.input : undefined;
          describeCall(st, { tool, input }, rel);
          // Node's built-in runner is explicit in typed commands. Leave legacy rollout rules unchanged.
          if (item.item === 'command' && typeof item.command === 'string' && /^node(?:\.exe)?\s+--test(?:\s|=|$)/i.test(item.command.trim())) { st.op.kind = 'test'; st.op.detail = { kind: 'test', command: item.command }; }
          if (item.item === 'command' && typeof item.command === 'string' && st.op.detail.kind !== 'test') { st.op.kind = 'shell'; st.op.detail = { kind: 'shell', command: item.command }; st.op.title = clip(oneLine(item.command), 120); }
          if ((st.op.detail.kind === 'shell' || st.op.detail.kind === 'test') && st.op.detail.command.length > (opts.maxInputChars ?? Infinity)) {
            const command = st.op.detail.command;
            st.op.artifactIds.push(addArtifact({ id: `art_${st.op.id}_input`, kind: 'excerpt', observedAtSequence: st.op.startSequence, availability: 'complete', provenance: { kind: 'captured', observationIds: [o.id] }, redacted: o.redactions.length > 0, content: command }));
            st.op.detail.command = clip(command, opts.maxInputChars!);
          }
          st.op.classification = { kind: 'captured', observationIds: [o.id] };
          st.op.observationIds = [...new Set([...st.op.observationIds, o.id])];
          st.op.endTime = o.sourceTime;
          if (!same) { st.op.startTime = undefined; st.op.endSequence = step(); }
          if (item.image) { st.op.title = `${item.item === 'image-view' ? 'View image' : 'Generated image'} · ${imageReferenceName(item.image.path ?? item.image.savedPath)}`; st.op.detail = { kind: 'other', input: { image: item.image } }; }
          const output = item.mcp?.result ?? item.output ?? (item.web ? JSON.stringify(item.web) : undefined);
          completeOp(st, o, { text: output, exitCode: item.exitCode, outcome: { kind: 'other' } }, { text, rel, addArtifact, knownFull, link, fileKey });
          if (output !== undefined && item.item !== 'command') st.op.artifactIds.push(addArtifact({ id: `art_${st.op.id}_out`, kind: 'output', observedAtSequence: st.op.endSequence ?? st.op.startSequence, availability: o.availability, provenance: { kind: 'captured', observationIds: [o.id] }, redacted: o.redactions.length > 0, content: text(output) }));
          st.intent = { kind: 'other' };
          if (st.op.detail.kind === 'mcp' && item.mcp) { st.op.detail.readOnlyHint = item.mcp.readOnlyHint; st.op.detail.error = item.mcp.error; }
          if (st.op.detail.kind === 'web' && item.web?.results) st.op.detail.results = boundResults(item.web.results);
          if (!same) {
            if (parent) { st.op.parentOperationId = parent.op.id; relate(st.op); }
            else { timeline.push({ type: 'op-start', id: `s_${id}`, operationId: id, sequence: o.receivedSequence, agentId: st.op.agentId, time: o.sourceTime }); st.op.endSequence = step(); timeline.push({ type: 'op-end', id: `e_${id}`, operationId: id, sequence: o.receivedSequence, agentId: st.op.agentId, time: o.sourceTime }); }
          }
          dirtyOperations.add(id);
          break;
        }
        case 'queue.operation': {
          if (!['enqueue', 'dequeue', 'remove'].includes(p.operation)) break;
          ensureAgent(o);
          const input = p.operation === 'enqueue' && p.text !== undefined ? addArtifact({id: `art_queue_${o.id}`, kind: 'excerpt',
            observedAtSequence: step(), availability: o.availability, provenance: {kind: 'captured', observationIds: [o.id]},
            redacted: o.redactions.length > 0, ...(isBlobText(p.text) ? {blobRef: p.text} : {content: typeof p.text === 'string' ? p.text : ''})}) : undefined;
          timeline.push({type: 'queue', id: `queue_${o.id}`, sequence: o.receivedSequence, agentId: agentKey(o), time: o.sourceTime,
            sourceObservationId: o.id, ownerRecordingId: o.recordingId, sourceId: o.source.sourceId, generation: o.source.generation, operation: p.operation,
            ...(typeof p.nativeQueueId === 'string' ? {nativeQueueId: p.nativeQueueId} : {}),
            ...(input ? {inputArtifactId: input, preview: clip(typeof p.text === 'string' ? p.text : isBlobText(p.text) ? p.text.preview : '', 240)} : {}),
            ...(Array.isArray(p.images) && p.images.length ? {images: imageRefs(p.images)} : {})});
          break;
        }
        case 'message.user': {
          if (o.source.recordId) {
            const line = `${o.source.sourceId}|${o.source.generation}|${o.source.byteOffset}`, key = `${o.recordingId}|${o.source.recordId}|${o.source.part}`;
            if ((promptRecordLine.get(key) ?? line) !== line) break;
            promptRecordLine.set(key, line);
          }
          // Only an explicit queue identity can link a native delivery. A source
          // UUID, delivery UUID, equal text or nearby time cannot establish it.
          if (typeof p.nativeQueueId === 'string') timeline.push({type: 'queue', id: `delivery_${o.id}`, sequence: o.receivedSequence,
            agentId: agentKey(o), time: o.sourceTime, sourceObservationId: o.id, ownerRecordingId: o.recordingId,
            nativeQueueId: p.nativeQueueId, sourceId: o.source.sourceId, generation: o.source.generation, operation: 'delivered'});
          const t = text(p.text) ?? '';
          // CONTENT-1: images attached to a prompt. Claude stores them as separate parts of the
          // prompt's record, before or after its text, so they meet the turn through that record.
          const images = Array.isArray(p.images) && p.images.length && o.agentId === 'agent:main' ? imageRefs(p.images) : undefined;
          if (images) {
            const key = `${o.recordingId}|${o.source.recordId ?? o.id}`;
            const turn = turnByRecord.get(key);
            if (turn) (turn.images ??= []).push(...images);
            else if (!t.trim()) { const held = pendingTurnImages.get(key); pendingTurnImages.set(key, { images: [...(held?.images ?? []), ...images], first: held?.first ?? o }); }
          }
          if (!t.trim()) break;
          ensureAgent(o);
          // A subagent's first "user" message is its delegation prompt, already shown on the
          // delegating call. It is not a new turn from the person.
          if (o.agentId !== 'agent:main') break;
          if (!firstPrompt) firstPrompt = clip(t.replace(/\s+/g, ' ').trim(), 120);
          const id = `turn_${o.id}`;
          turnByRecording.set(correlationOwner(o), id);
          if (o.source.recordId) turnMessageByRecording.set(correlationOwner(o), o.source.recordId);
          const recordKey = `${o.recordingId}|${o.source.recordId ?? o.id}`;
          const attached = [...(pendingTurnImages.get(recordKey)?.images ?? []), ...(images ?? [])];
          pendingTurnImages.delete(recordKey);
          const turn: TimelineItem & { type: 'turn' } = { type: 'turn', id, sequence: o.receivedSequence, agentId: agentKey(o), prompt: clip(t, maxProse), time: o.sourceTime, ...(typeof p.permissionMode === 'string' ? { permissionMode: p.permissionMode } : {}), ...(attached.length ? { images: attached } : {}) };
          turnByRecord.set(recordKey, turn);
          timeline.push(turn);
          break;
        }
        case 'message.assistant':
        case 'reasoning': {
          const original = text(p.text) ?? '';
          const delivery = legacyAgentDelivery(o, original, agents.get(agentKey(o))?.address);
          const t = delivery?.text ?? original;
          if (o.kind === 'reasoning' && p.exposure === 'none') {
            const a = ensureAgent(o);
            const key = `${turnByRecording.get(correlationOwner(o)) ?? o.recordingId}|${a.id}`;
            const line = unrecorded.get(key);
            if (line) { line.count = (line.count ?? 1) + 1; line.observationIds.push(o.id); break; }
            const reason = p.reason === 'encrypted' || p.reason === 'signature-only' ? p.reason : 'empty';
            const pr: Prose = { id: `prose_${o.id}`, agentId: a.id, role: 'reasoning', text: '', truncated: false, exposure: 'none', count: 1, reason, sequence: step(), time: o.sourceTime, observationIds: [o.id] };
            unrecorded.set(key, pr);
            prose.push(pr);
            timeline.push({ type: 'prose', id: `t_${pr.id}`, proseId: pr.id, sequence: o.receivedSequence, agentId: a.id, time: o.sourceTime });
            break;
          }
          if (!t.trim()) break;
          const a = ensureAgent(o);
          if (typeof p.model === 'string') a.model = p.model;
          const plan = proposedPlan(o, t);
          if (plan !== undefined) {
            const id = `plan_${o.id}`, st = newOp(o, id, { kind: 'plan', items: [] }, 'Plan');
            const artifactId = addArtifact({ id: `art_${id}_plan`, kind: 'snapshot', observedAtSequence: o.receivedSequence, availability: 'complete', provenance: { kind: 'captured', observationIds: [o.id] }, redacted: o.redactions.length > 0, content: t });
            st.op.detail = { kind: 'plan', items: [], document: { text: clip(plan, maxProse), truncated: plan.length > maxProse, artifactId } };
            st.op.title = 'Proposed plan'; st.op.status = 'ok'; st.op.endSequence = step() + 1;
            st.op.artifactIds.push(artifactId); st.completed = true;
            st.op.classification = derived('codex-proposed-plan-v1', [o.id]);
            timeline.push({ type: 'op-start', id: `s_${id}`, operationId: id, sequence: o.receivedSequence, agentId: st.op.agentId, time: o.sourceTime });
            timeline.push({ type: 'op-end', id: `e_${id}`, operationId: id, sequence: o.receivedSequence, agentId: st.op.agentId, time: o.sourceTime });
            break;
          }
          const pr: Prose = {
            id: `prose_${o.id}`,
            agentId: a.id,
            role: o.kind === 'reasoning' ? 'reasoning' : 'assistant',
            text: clip(t, maxProse),
            truncated: !!delivery || t.length > maxProse,
            exposure: p.exposure === 'summary' ? 'summary' : 'full',
            sequence: step(),
            time: o.sourceTime,
            observationIds: [o.id],
          };
          prose.push(pr);
          if (pr.truncated) addArtifact({ id: `art_${pr.id}_prose`, kind: 'excerpt', observedAtSequence: pr.sequence, availability: 'complete', provenance: { kind: 'captured', observationIds: [o.id] }, redacted: o.redactions.length > 0, ...(delivery?{note:'The preview shows the captured child payload with its routing wrapper omitted. This is the original captured message.'}:{}), ...(isBlobText(p.text) ? { blobRef: p.text } : { content: original }) });
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
              if (nestedPatch) st.script = p.input?.code ?? p.input?.raw;
              if (nestedPatch) st.scriptTool = String(p.tool);
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
              st.op.detail = { kind: 'edit', path, hunks, created: f.op === 'add', ...(f.op === 'delete' ? { deleted: true } : {}), reconstruction, reconstructionNote };
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
          if (o.source.adapterId === 'codex' && (p.tool === 'exec' || p.tool === 'functions.exec') && intent.kind === 'shell') {
            st.literalPlan = literalPlan(text(intent.command as TextValue) ?? '');
          }
          if (['TaskCreate', 'TaskUpdate', 'TaskList', 'TaskGet', 'ExitPlanMode', DESKTOP_PLAN_TOOL].includes(String(p.tool))) { st.taskInput = resolveBlobs(p.input, text); st.taskRedacted = o.redactions.length > 0; }
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
          let targets = opGroups.get(callKey(o)) ?? [];
          if (!targets.length) {
            // A result whose call we never saw (lost, or before a compaction): keep it, honestly generic.
            const st = newOp(o, baseId, { kind: 'other' }, String(p.tool ?? 'unknown tool'));
            st.op.title = `${p.tool ?? 'Tool'} result (call not captured)`;
            timeline.push({ type: 'op-start', id: `s_${baseId}`, operationId: baseId, sequence: o.receivedSequence, agentId: st.op.agentId, time: o.sourceTime });
            targets = [baseId];
          }
          for (const id of targets) {
            const st = ops.get(id)!;
            const taskUpdate = o.source.adapterId === 'antigravity' && p.resultUpdate === true && typeof p.nativeTaskId === 'string'
              && (st.op.detail.kind === 'shell' || st.op.detail.kind === 'test') && st.op.run?.backgroundTaskId === p.nativeTaskId;
            if (st.completed && !taskUpdate) continue; // duplicate result record
            st.completed = true;
            dirtyOperations.add(id);
            st.op.observationIds.push(o.id);
            st.op.endSequence = st.scriptWrapper ? Math.max(0, step() - 1) : step();
            st.op.endTime = taskUpdate && typeof p.terminalTime === 'string' ? p.terminalTime : o.sourceTime;
            if (!st.typedOutcome) st.op.status = p.isError ? 'error' : st.nestedPatch ? 'unknown' : 'ok';
            if (!st.typedOutcome && o.source.adapterId === 'antigravity' && !p.isError && (p.status === 'running' || p.callAvailability === 'not-recorded' || (st.intent.kind === 'shell' || st.op.detail.kind === 'shell' || st.op.detail.kind === 'test') && typeof p.exitCode !== 'number')) st.op.status = p.status === 'running' ? 'running' : 'unknown';
            if (p.isError && !st.typedOutcome) { const declined = declinedFrom(text(p.text)); if (declined) st.op.declined = declined; }
            if (taskUpdate && (st.op.detail.kind === 'shell' || st.op.detail.kind === 'test') && st.op.detail.outputArtifactId) {
              const previousArtifact = st.op.detail.outputArtifactId;
              st.op.artifactIds = st.op.artifactIds.filter(id => id !== previousArtifact);
              st.op.detail.outputArtifactId = undefined;
            }
            if (!st.typedOutcome) completeOp(st, o, p, { text, rel, addArtifact, knownFull, link, fileKey });
            if (!p.isError && st.literalPlan !== undefined && literalPlanConfirmed(text(p.text))) {
              // The wrapper contains exactly one awaited literal call. A failed or
              // pending wrapper supplies no successful revision; dynamic code stays text.
              st.op.kind = 'plan';
              st.op.detail = { kind: 'plan', items: st.literalPlan, scope: JSON.stringify([o.recordingId, o.agentId, o.source.sourceId, o.source.generation, 'codex-literal-plan']) };
              st.op.title = `Update plan · ${st.literalPlan.length} items`;
              st.op.classification = derived('codex-literal-plan-v1', st.op.observationIds);
            }
            st.literalPlan = undefined;
            if (!p.isError && st.taskInput !== undefined) {
              const plan = taskPlans.apply(o, st.op.tool, st.taskInput, resolveBlobs(p.structured, text), st.callObservationId);
              if (plan) {
                st.op.kind = 'plan'; st.op.detail = { ...plan.detail, scope: `${plan.detail.scope}/turn:${st.taskTurn ?? 'unrecorded'}` }; st.op.title = 'Update tasks';
                st.op.classification = derived('claude-task-result-v1', [...new Set([...plan.observations, ...st.op.observationIds])]);
                st.op.artifactIds.push(addArtifact({ id: `art_${st.op.id}_task-result`, kind: 'excerpt', observedAtSequence: st.op.endSequence!, availability: 'complete', provenance: { kind: 'captured', observationIds: [o.id] }, redacted: o.redactions.length > 0, content: JSON.stringify(resolveBlobs(p.structured, text), null, 2) }));
              }
            }
            if (!p.isError && st.taskInput !== undefined && st.op.tool === 'ExitPlanMode' && o.source.adapterId === 'claude-code') {
              // The plan text is the call's own input; the harness's reply stays a captured result, never an inferred approval.
              const plan = exitPlanText(st.taskInput);
              if (plan !== undefined) {
                const artifactId = addArtifact({ id: `art_${st.op.id}_plan`, kind: 'snapshot', observedAtSequence: st.op.startSequence, availability: 'complete', provenance: { kind: 'captured', observationIds: [st.callObservationId ?? o.id] }, redacted: st.taskRedacted === true, content: plan });
                st.op.kind = 'plan'; st.op.title = 'Plan for approval';
                st.op.detail = { kind: 'plan', items: [], document: { text: clip(plan, maxProse), truncated: plan.length > maxProse, artifactId, source: 'proposal' } };
                st.op.artifactIds.push(artifactId);
                st.op.classification = derived('claude-exit-plan-mode-v1', [...new Set([st.callObservationId ?? o.id, o.id])]);
              }
            }
            if (!p.isError && st.taskInput !== undefined && st.op.tool === DESKTOP_PLAN_TOOL) {
              const detail = desktopPlans.apply(o, st.op.tool, st.taskInput);
              if (detail) {
                st.op.kind = 'plan'; st.op.detail = detail; st.op.title = `Update plan · ${detail.items.length} items`;
                st.op.classification = derived('claude-desktop-update-plan-v1', [...new Set([st.callObservationId ?? o.id, o.id])]);
              }
            }
            if (st.nestedPatch) st.wrapperResult = { observation: o, payload: p };
            if (o.source.adapterId !== 'antigravity' || o.correlation?.basis === 'call-order' || taskUpdate) link({ from: st.callObservationId ?? o.id, to: o.id, relation: 'tool-result', basis: o.correlation?.basis === 'call-order' ? 'deterministic-rule' : 'source-id',
              ...(taskUpdate ? { ruleVersion: 'antigravity-native-task-id-v1' } : o.correlation?.basis === 'call-order' ? { ruleVersion: 'antigravity-call-order-v1' } : {}), sourceObservationIds: [st.callObservationId ?? o.id, o.id],
              explanation: taskUpdate ? 'The harness output references this command by its exact recorded background task id.' : o.correlation?.basis === 'call-order' ? 'The result follows this call in the recorded planner group order; the transcript has no native call id.' : 'The harness recorded this result for this call id.' });
            // Completed calls no longer need their potentially large edit/command input.
            const pendingAntigravity = o.source.adapterId === 'antigravity' && p.status === 'running';
            if (!pendingAntigravity) st.intent = { kind: 'other' };
            if (!st.scriptWrapper && !pendingAntigravity) timeline.push({ type: 'op-end', id: taskUpdate ? `e_${id}_${o.id}` : `e_${id}`, operationId: id, sequence: o.receivedSequence, agentId: st.op.agentId, time: o.sourceTime });
            if (o.source.adapterId === 'antigravity' && (st.op.detail.kind === 'shell' || st.op.detail.kind === 'test') && (taskUpdate || typeof st.op.run?.backgroundTaskId === 'string')) {
              hasResultVersions = true;
              (st.op.resultVersions ??= []).push(structuredClone({ availableAfterStep: step() + (pendingAntigravity ? 1 : 0), status: st.op.status,
                endSequence: pendingAntigravity ? undefined : st.op.endSequence, endTime: pendingAntigravity ? undefined : st.op.endTime,
                detail: st.op.detail, artifactIds: st.op.artifactIds, observationIds: st.op.observationIds, run: st.op.run, failure: st.op.failure }));
            }
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
          if (st && st.op.detail.kind === 'spawn') {
            if (o.source.adapterId === 'antigravity') {
              (st.antigravityChildren ??= new Set()).add(child);
              st.op.detail.childAgentId = st.antigravityChildren.size === 1 ? child : undefined;
            } else st.op.detail.childAgentId = child;
            dirtyOperations.add(opId);
          }
          const a = agents.get(child) ?? (o.source.adapterId === 'antigravity' ? ensureAgent({ ...o, agentId: String(p.childAgentId) }) : undefined);
          if (a) {
            a.parentId = agentKey(o);
            a.agentType = p.agentType;
            a.label = p.agentType ?? 'subagent';
          }
          link({ from: opId, to: child, relation: 'spawned', basis: p.basis === 'source-id' ? 'source-id' : 'heuristic', sourceObservationIds: [o.id], explanation: 'The harness recorded this subagent as started by this call.' });
          break;
        }
        case 'checkpoint': {
          if (typeof p.messageId !== 'string' || !Array.isArray(p.files)) break;
          const key = `${o.recordingId}|${p.messageId}`;
          const entry = checkpoints.get(key) ?? { raw: [] };
          checkpoints.set(key, entry);
          entry.byPath = undefined;
          for (const f of p.files as CheckpointPayload['files']) {
            // Claude records the path relative to its cwd and the real parent folder; join them.
            const name = toPosix(f.path).split('/').pop()!;
            const path = f.parentDir ? `${toPosix(f.parentDir).replace(/\/+$/, '')}/${name}` : f.path;
            if (f.backup) entry.raw.push({ path, at: { backup: f.backup.name, ...(f.backup.version !== undefined ? { version: f.backup.version } : {}), ...(f.backup.time ? { time: f.backup.time } : {}) } });
            else if (f.absent) entry.raw.push({ path, at: { absent: true, ...(typeof p.at === 'string' ? { time: p.at } : {}) } });
          }
          break;
        }
        case 'tools.snapshot': {
          const listed = Array.isArray(p.tools) ? p.tools as { name?: unknown; namespace?: unknown }[] : [];
          const withdrawn = Array.isArray(p.removed) ? p.removed as unknown[] : [];
          for (const t of listed.slice(0, 400)) {
            if (typeof t?.name !== 'string' || !t.name) continue;
            const namespace = typeof t.namespace === 'string' && t.namespace ? t.namespace : undefined;
            const key = namespace ? `${namespace}.${t.name}` : t.name;
            const known = availableTools.get(key);
            if (known) { known.until = undefined; continue; }
            const server = parseMcpName(t.name)?.server ?? (namespace?.startsWith('mcp__') ? namespace.slice(5).replace(/__$/, '') : undefined);
            availableTools.set(key, { name: t.name, ...(namespace ? { namespace } : {}), ...(server ? { server } : {}), since: step() });
          }
          for (const name of withdrawn.slice(0, 400)) { const known = typeof name === 'string' ? availableTools.get(name) : undefined; if (known && known.until === undefined) known.until = step(); }
          break;
        }
        case 'external.change': {
          if (typeof p.path !== 'string') break;
          const a = ensureAgent(o);
          const path = rel(p.path, o.workspaceRoot);
          const full = text(p.snippet as TextValue | undefined);
          const key = `${o.recordingId}|${path}`;
          const last = lastNotice.get(key);
          if (last && last.snippet === (full === undefined ? undefined : clip(full, NOTICE_SNIPPET))) { last.repeats++; last.observationIds.push(o.id); break; }
          const notice: Notice = { id: `notice_${o.id}`, agentId: a.id, kind: 'external-change', path, repeats: 0, sequence: step(), time: o.sourceTime, observationIds: [o.id],
            ...(full !== undefined ? { snippet: clip(full, NOTICE_SNIPPET), ...(full.length > NOTICE_SNIPPET ? { truncated: true } : {}) } : {}) };
          notices.push(notice);
          lastNotice.set(key, notice);
          timeline.push({ type: 'notice', id: `t_${notice.id}`, noticeId: notice.id, sequence: o.receivedSequence, agentId: a.id, time: o.sourceTime });
          break;
        }
        case 'compaction': {
          ensureAgent(o);
          const receipt = context.compaction(o, step(), agentKey(o));
          const summary = receipt.summary ?? context.summary(o);
          if (summary && p.summary) {
            const content = text(p.summary as TextValue);
            if (content?.trim() && !summary.artifactId) {
              summary.artifactId = addArtifact({ id: `art_${summary.id}_summary`, kind: 'output', observedAtSequence: summary.availableAfterStep - 1,
                content, availability: o.availability, provenance: { kind: 'captured', observationIds: [o.id] }, redacted: o.redactions.length > 0 });
              summary.availability = 'captured';
            }
          }
          if (receipt.fresh) {
            const reason = receipt.boundary ? 'compaction' : 'compaction-summary';
            timeline.push({ type: 'gap', id: `g_${o.id}`, sequence: o.receivedSequence, agentId: agentKey(o), reason, time: o.sourceTime });
            if (receipt.boundary) gaps.push({ sequence: step() - 1, reason, detail: 'The harness compacted earlier context here.' });
          }
          break;
        }
        case 'capture.gap':
          ensureAgent(o);
          timeline.push({ type: 'gap', id: `g_${o.id}`, sequence: o.receivedSequence, agentId: agentKey(o), reason: String(p.reason ?? 'gap'), time: o.sourceTime });
          gaps.push({ sequence: step() - 1, reason: String(p.reason ?? 'gap'), detail: typeof p.detail === 'string' ? p.detail : undefined });
          break;
        case 'unknown':
          if (!SEPARATE_LOGS.has(String(p.recordType))) gaps.push({ sequence: step(), reason: 'unsupported-record', detail: String(p.recordType ?? 'unknown') });
          break;
        default:
          break;
      }
      if (opts.lineage && timeline.length > materialStart && !lineageStarts.has(o.recordingId)) lineageStarts.set(o.recordingId, timeline[materialStart]!.id);
    }

  }
  append(obs);

  function snapshot(live = opts.live): Projection {
    for (const id of awaitingCheckpoint) {
      const st = ops.get(id)!, d = st.op.detail;
      if (d.kind !== 'edit') { if (st.completed) awaitingCheckpoint.delete(id); continue; }
      const recording = st.op.id.split('.')[0]!;
      const entry = checkpoints.get(`${recording}|${st.turnMessage}`);
      if (entry && !entry.byPath) {
        entry.byPath = new Map();
        // The turn-start snapshot (recorded first) wins over a later per-file delta.
        for (const f of entry.raw) { const path = rel(f.path); if (path && !entry.byPath.has(path)) entry.byPath.set(path, f.at); }
      }
      const found = entry?.byPath?.get(d.path);
      // Checkpoint records land within their turn; once a later prompt exists, stop looking.
      if (!found) { if (turnMessageByRecording.get(recording) !== st.turnMessage) awaitingCheckpoint.delete(id); continue; }
      d.beforeTurn = found;
      dirtyOperations.add(id);
      awaitingCheckpoint.delete(id);
    }
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
      if (op.status === 'error' && !op.failure && !op.declined) op.failure = failureLine('outputPreview' in op.detail ? op.detail.outputPreview : 'resultPreview' in op.detail ? op.detail.resultPreview : undefined, op.detail.kind === 'shell' || op.detail.kind === 'test');
    }
    if (!live) {
      for (const a of finalAgents.values()) if (a.stoppedSequence === undefined && a.id.endsWith('.agent:main')) a.stoppedSequence = Math.max(0, timeline.length - 1);
    }

    const placed = placeChildren(operations, pendingTurnImages.size ? [...timeline, ...[...pendingTurnImages.values()].map(imageOnlyTurn)] : timeline, [...artifacts.values()], prose, [...finalAgents.values()], itemReceipts);
    // Child placement can insert timeline items; translate result boundaries by their preceding item.
    if (hasResultVersions) {
      const placedPositions = new Map(placed.timeline.map((item, index) => [item.id, index]));
      placed.operations = placed.operations.map(op => op.resultVersions ? { ...op, resultVersions: op.resultVersions.map(version => ({ ...version })) } : op);
      for (const op of placed.operations) for (const version of op.resultVersions ?? []) {
        const previous = timeline[version.availableAfterStep - 1];
        if (previous) version.availableAfterStep = (placedPositions.get(previous.id) ?? version.availableAfterStep - 1) + 1;
        else if (version.availableAfterStep > timeline.length) version.availableAfterStep += placed.timeline.length - timeline.length;
        if (version.endSequence !== undefined) {
          const end = timeline[version.endSequence];
          if (end) version.endSequence = placedPositions.get(end.id) ?? version.endSequence;
        }
      }
    }

    crossLinks(placed.operations, placed.prose, finalLink);
    const placedSteps = new Map(placed.timeline.map((item, index) => [item.id, index]));
    const contextEvidence = context.snapshot(at => at >= timeline.length ? placed.timeline.length : placedSteps.get(timeline[at]!.id) ?? at);
    const passages = buildPassages(placed.timeline, placed.operations, placed.prose, contextEvidence);

    const files = new Map<string, { path: string; firstStep: number; lastStep: number; roles: Set<PathRef['role']> }>();
    for (const op of placed.operations) {
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
    const turns = turnRecords.snapshot();
    return {
      ...(opts.lineage ? { lineage: { ...structuredClone(opts.lineage), transitions: [...lineageStarts].flatMap(([recordingId, id]) => placedSteps.has(id) ? [{ recordingId, step: placedSteps.get(id)! }] : []) } } : {}),
      reducerVersion: REDUCER_VERSION,
      recordingId,
      observationCount,
      lastSequence,
      harnesses: [...harnesses],
      workspaceRoot: multipleWorktrees ? undefined : workspaceRoot,
      ...(recordedBranch ? { recordedBranch: { ...recordedBranch, provenance: { kind: 'captured', observationIds: [...recordedBranch.provenance.observationIds] } } } : {}),
      title: title ?? (firstPrompt ? clip(firstPrompt.replace(/\s+/g, ' ').trim(), 120) : undefined),
      agents: placed.agents,
      operations: placed.operations,
      prose: [...placed.prose],
      ...(notices.length ? { notices: notices.map((n) => ({ ...n, observationIds: [...n.observationIds] })) } : {}),
      ...(availableTools.size ? { availableTools: [...availableTools.values()].map((t) => ({ ...t })) } : {}),
      artifacts: placed.artifacts,
      links: finalLinks,
      timeline: [...placed.timeline],
      passages,
      files: [...files.values()].map((f) => ({ ...f, roles: [...f.roles] })).sort((a, b) => a.firstStep - b.firstStep || a.path.localeCompare(b.path)),
      gaps: [...gaps],
      capabilities: { ...capabilities },
      ...(accounting ? { usage: accounting } : {}),
      ...(turns ? { turns } : {}),
      ...contextEvidence,
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
  if (input.length && input.every(o => o.source.adapterId === 'antigravity' && o.recordingId === input[0]!.recordingId)) {
    return [...input].sort((a, b) => {
      const index = (o: Observation) => Number.parseInt(o.source.recordId?.split(':')[1] ?? '-1', 10);
      const ai = index(a), bi = index(b);
      return (Number.isFinite(ai) ? ai : -1) - (Number.isFinite(bi) ? bi : -1) || a.receivedSequence - b.receivedSequence;
    });
  }
  const orderedClocks = new Map<string, string>();
  const agRecordings = new Set(input.filter(o => o.source.adapterId === 'antigravity').map(o => o.recordingId));
  for (const recording of agRecordings) {
    let clock = '';
    for (const o of orderObservations(input.filter(o => o.recordingId === recording && o.source.adapterId === 'antigravity'))) {
      const time = o.sourceTime && Number.isFinite(Date.parse(o.sourceTime)) && !(o.payload as { derived?: unknown }).derived ? new Date(o.sourceTime).toISOString() : '';
      if (time > clock) clock = time;
      orderedClocks.set(o.id, clock);
    }
  }
  const last = new Map<string, string>();
  const keyed = [...input]
    .sort((a, b) => a.receivedSequence - b.receivedSequence)
    .map((o, i) => {
      const src = `${o.recordingId}/${o.source?.sourceId}`;
      const t = orderedClocks.get(o.id) ?? (o.sourceTime && !Number.isNaN(Date.parse(o.sourceTime)) ? new Date(o.sourceTime).toISOString() : last.get(src) ?? '');
      if (t) last.set(src, t);
      return { o, t, i };
    });
  keyed.sort((a, b) => {
    if (a.t !== b.t) return a.t < b.t ? -1 : 1;
    if (agRecordings.size) {
      const index = (o: Observation) => Number.parseInt(o.source.recordId?.split(':')[1] ?? '-1', 10);
      const key = (o: Observation) => o.source.adapterId === 'antigravity' ? Number.isFinite(index(o)) ? index(o) : -1 : o.receivedSequence;
      return key(a.o) - key(b.o) || a.o.receivedSequence - b.o.receivedSequence || a.i - b.i;
    }
    return a.i - b.i;
  });
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
      const description = typeof p.input?.description === 'string' && p.input.description.trim() ? { description: oneLine(p.input.description) } : {};
      if (cls.kind === 'test') {
        op.kind = 'test';
        op.classification = derived(SHELL_RULE, op.observationIds);
        op.detail = { kind: 'test', command: intent.command, ...description };
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
        op.detail = { kind: 'shell', command: intent.command, ...description };
        op.title = `Run ${clip(oneLine(intent.command), 80)}`;
      }
      break;
    }
    case 'mcp':
      op.detail = { kind: 'mcp', server: intent.server, tool: intent.tool, input: intent.tool === 'browser_batch' ? previewBatch(p.input) : previewValue(p.input) };
      op.title = `${intent.server} · ${intent.tool}`;
      break;
    case 'web':
      op.detail = { kind: 'web', url: intent.url, query: intent.query };
      op.title = intent.url ? `Fetch ${hostOf(intent.url)}` : `Web search “${clip(intent.query ?? '', 60)}”`;
      break;
    case 'spawn': {
      // Codex can record a delegated task only as an encrypted token; showing it would present
      // ciphertext as the agent's words, so keep the agent and say the task text was not recorded.
      const encrypted = encryptedToken(intent.description);
      const description = encrypted ? undefined : intent.description;
      op.detail = { kind: 'spawn', agentType: intent.agentType, description, ...(encrypted ? { descriptionEncrypted: true } : {}) };
      op.title = `Delegate${intent.agentType ? ` to ${intent.agentType}` : ''}${description ? `: ${clip(description, 60)}` : ''}`;
      break;
    }
    case 'plan':
      op.detail = { kind: 'plan', items: intent.items.slice(0, 50) };
      op.title = `Update plan · ${intent.items.length} items`;
      break;
    default:
      op.detail = { kind: 'other', input: previewValue(p.input, 0, inputDepth(p.tool)) };
      op.title = String(p.tool ?? 'Tool');
  }
}

interface Ctx {
  text: (v: TextValue | undefined | null, allowPreview?: boolean) => string | undefined;
  rel: (p: string | undefined, cwd?: string) => string;
  addArtifact: (a: Omit<Artifact, 'id' | 'bytes' | 'lineCount' | 'blob'> & { id: string; content?: string; blobRef?: TextValue }) => string;
  knownFull: { get(key: string): string | undefined; set(key: string, value: string): void; delete(key: string): boolean };
  fileKey: (recording: string, path: string) => string;
  link: (l: Omit<EvidenceLink, 'id'>) => void;
}

/** CONTENT-1: image references from captured images; bytes stay in blobs. */
function imageRefs(raw: unknown[]): OperationImage[] {
  return (raw as Rec[]).slice(0, 50).map((img) => ({
    ...(isBlobText(img.data) ? { sha: img.data.$blob } : {}),
    ...(typeof img.mime === 'string' ? { mime: img.mime } : {}),
    ...(typeof img.bytes === 'number' ? { bytes: img.bytes } : {}),
    ...(typeof img.width === 'number' ? { width: img.width } : {}),
    ...(typeof img.height === 'number' ? { height: img.height } : {}),
    ...(!isBlobText(img.data) ? { omitted: typeof img.omitted === 'string' ? img.omitted : 'unrecognised' } : {}),
  }));
}

/** The harness's record of how a command ran. Only fields it recorded; nothing inferred. */
function commandRun(outcome: ToolOutcome & Rec): CommandRun {
  if (outcome.kind !== 'shell') return {};
  const run = (outcome.run ?? {}) as Rec;
  const out: CommandRun = {};
  if (outcome.interrupted) out.interrupted = true;
  if (typeof run.backgroundTaskId === 'string') out.backgroundTaskId = run.backgroundTaskId;
  if (typeof run.timedOutAfterMs === 'number') out.timedOutAfterMs = run.timedOutAfterMs;
  if (typeof run.exitNote === 'string') out.exitNote = clip(run.exitNote, 200);
  const spilled = run.persistedOutput as Rec | undefined;
  if (spilled && typeof spilled.path === 'string') out.persistedOutput = { path: spilled.path, ...(typeof spilled.bytes === 'number' ? { bytes: spilled.bytes } : {}) };
  return out;
}

function completeOp(st: OpState, o: Observation, p: Rec, c: Ctx) {
  const { op } = st;
  const outcome = (p.outcome ?? { kind: 'other' }) as ToolOutcome & Rec;
  const resultText = c.text(p.text);
  if (p.isError && !op.declined) op.failure = failureLine(resultText, op.detail.kind === 'shell' || op.detail.kind === 'test');
  const redacted = o.redactions.length > 0;
  const omitted = (s: string | undefined) => !!s && s.startsWith('[OMITTED');
  const seq = op.endSequence ?? op.startSequence;
  const run = commandRun(outcome);
  if (Object.keys(run).length) op.run = run;
  // CONTENT-1: images the action returned. Only references reach the projection; bytes stay in blobs.
  if (Array.isArray(p.images) && p.images.length) op.images = imageRefs(p.images);

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
      if (o.source.adapterId === 'antigravity') {
        // The transcript records requested strings, not the applied disk state. Show the
        // intent diff, but never promote it to a confirmed snapshot or future read base.
        d.hunks = st.intent.kind === 'write' ? addHunk(st.intent.content ?? '') : hunksFromStrings(st.intent.edits, undefined);
        d.created = outcome.created === true && !p.isError;
        d.reconstruction = 'unavailable';
        d.reconstructionNote = p.isError ? 'The tool reported an error; no after-state was recorded.' : 'Requested change; Antigravity reported the tool result but did not record an applied file snapshot.';
        c.knownFull.delete(c.fileKey(o.recordingId, d.path));
        break;
      }
      const base = typeof original === 'string' ? original : c.knownFull.get(c.fileKey(o.recordingId, d.path));
      const hunks = Array.isArray(outcome.hunks) && outcome.hunks.length
        ? resolveHunkLines(outcome.hunks as Hunk[], line => c.text(line, false))
        : undefined;
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
      // A native plan file has a dedicated recorded harness path. Ordinary Markdown writes
      // remain edits; never read today's file or infer Plan semantics from a heading.
      if (st.intent.kind === 'write' && o.source.adapterId === 'claude-code' && /(?:^|\/)\.claude\/plans\/[^/]+\.md$/i.test(toPosix(st.intent.path)) && after !== undefined && !omitted(after) && op.status === 'ok') {
        op.kind = 'plan'; op.title = 'Plan file (path convention)';
        op.detail = { kind: 'plan', items: [], document: { text: clip(after, 64_000), truncated: after.length > 64_000, artifactId: `art_${op.id}_after`, source: 'file' } };
        op.classification = derived('claude-native-plan-file-v1', op.observationIds);
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
        // The hit stays in the card as captured text; only a plausible path becomes a file reference (BUG-8).
        if (!plausibleHitPath(h.path)) continue;
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
        d.outputArtifactId = c.addArtifact({ id: `art_${op.id}_out${o.source.adapterId === 'antigravity' && (p.resultUpdate === true || typeof op.run?.backgroundTaskId === 'string') ? `_${o.id}` : ''}`, kind: 'output', observedAtSequence: seq, availability: o.source.adapterId === 'antigravity' ? o.availability : 'complete', provenance: { kind: 'captured', observationIds: [o.id] }, redacted, content: out });
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
        d.outputArtifactId = c.addArtifact({ id: `art_${op.id}_out${o.source.adapterId === 'antigravity' && (p.resultUpdate === true || typeof op.run?.backgroundTaskId === 'string') ? `_${o.id}` : ''}`, kind: 'output', observedAtSequence: seq, availability: o.source.adapterId === 'antigravity' ? o.availability : 'complete', provenance: { kind: 'captured', observationIds: [o.id] }, redacted, content: out });
        op.artifactIds.push(d.outputArtifactId);
      }
      break;
    }
    case 'mcp':
      op.detail.resultPreview = clip(resultText ?? '', PREVIEW);
      break;
    case 'web': {
      const full = c.text((outcome as Rec).text as TextValue) ?? resultText ?? '';
      op.detail.resultPreview = clip(full, PREVIEW);
      op.detail.results ??= searchLinks(full);
      if (outcome.kind === 'web') {
        const fetch = Object.fromEntries(Object.entries({ status: outcome.status, statusText: outcome.statusText, bytes: outcome.bytes, durationMs: outcome.durationMs }).filter(([, v]) => v !== undefined && v !== null));
        if (Object.keys(fetch).length) op.detail.fetch = fetch;
      }
      break;
    }
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
export function buildPassages(timeline: TimelineItem[], operations: Operation[], prose: Prose[], context?: Pick<Projection, 'compactions' | 'compactionSummaries'>): Projection['passages'] {
  const scripts = new Set(operations.map(op => op.parentOperationId).filter(Boolean));
  const opAgent = new Map(operations.map((o) => [o.id, o.agentId]));
  const proseAgent = new Map(prose.map((p) => [p.id, p.agentId]));
  const out: Projection['passages'] = [];
  const open = new Map<string, Projection['passages'][number]>();
  const passageByOperation = new Map<string, Projection['passages'][number]>();
  const boundaries = new Map(context?.compactions?.map(c => [c.step, c.id]) ?? []);
  const summaries = new Map(context?.compactionSummaries?.filter(s => !s.boundaryId).map(s => [s.availableAfterStep - 1, s.id]) ?? []);
  timeline.forEach((it, i) => {
    if (it.type === 'turn') {
      open.clear();
      return;
    }
    if (it.type === 'op-start') {
      if (scripts.has(it.operationId)) return;
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
    } else if (it.type === 'gap' && (boundaries.has(i) || summaries.has(i))) {
      out.push({ id: `psg_${it.id}`, agentId: it.agentId, operationIds: [], proseIds: [], firstStep: i, lastStep: i,
        ...(boundaries.has(i) ? { compactionIds: [boundaries.get(i)!] } : { compactionSummaryIds: [summaries.get(i)!] }) });
      open.delete(it.agentId);
    } else if (it.type === 'notice') {
      // A notice sits with the agent's open passage and never splits it.
      let p = open.get(it.agentId);
      if (!p) {
        p = { id: `psg_${it.id}`, agentId: it.agentId, operationIds: [], proseIds: [], firstStep: i, lastStep: i };
        out.push(p);
        open.set(it.agentId, p);
      }
      (p.noticeIds ??= []).push(it.noticeId);
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

const FAILURE_LINE = /(?:\b(?:[a-z]*error|failed|failure|[a-z]*exception|traceback|panic|fatal)\b|✕|✖|FAIL\s)/i;
/**
 * The harness's own words for what went wrong. A tool's error text is the error; a command's output is
 * mostly not, so a command needs a line that says so. A Python traceback ends on its error, not begins.
 */
function failureLine(text: string | undefined, command: boolean): string | undefined {
  const lines = text?.replace(/<\/?tool_use_error>/g, '').split('\n').map(line => line.trim()).filter(line => line && !/^exit code:? -?\d+$/i.test(line)) ?? [];
  const errors = lines.filter(line => FAILURE_LINE.test(line));
  const line = errors[0]?.startsWith('Traceback') ? errors.at(-1) : errors[0] ?? (command ? undefined : lines[0]);
  return line === undefined ? undefined : clip(line, 200);
}

/** Titles identify the image; its original reference remains in captured arguments. */
function imageReferenceName(reference: string | undefined): string {
  if (!reference) return 'reference';
  let path = reference.replace(/\\/g, '/');
  if (/^file:\/\//i.test(path)) {
    try { path = decodeURIComponent(new URL(path).pathname); } catch { /* Keep malformed native text inert. */ }
  }
  return path.replace(/\/+$/, '').split('/').at(-1) || 'reference';
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

/** A bounded copy of a tool input for display: long strings clipped, big arrays cut, deep nesting summarised. */
/**
 * SCREEN-1: a browser batch keeps every action's own input (positions sit one level deeper than the usual bound), up to 200 actions,
 * so a recorded click can be placed on its frame.
 */
export function previewBatch(input: unknown): unknown {
  const actions = input && typeof input === 'object' ? (input as { actions?: unknown }).actions : undefined;
  if (!Array.isArray(actions)) return previewValue(input);
  return { ...(previewValue({ ...input as object, actions: undefined }) as object), actions: actions.slice(0, 200).map((entry) => previewValue(entry)) };
}

export function previewValue(v: unknown, depth = 0, maxDepth = 3): unknown {
  if (typeof v === 'string') return v.length > 600 ? v.slice(0, 599) + '…' : v;
  if (isBlobText(v)) return v.preview.slice(0, 600) + '…';
  if (Array.isArray(v)) return depth > maxDepth ? `[${v.length} items]` : v.slice(0, 20).map((x) => previewValue(x, depth + 1, maxDepth));
  if (v && typeof v === 'object') {
    if (depth > maxDepth) return '{…}';
    return Object.fromEntries(Object.entries(v).slice(0, 30).map(([k, x]) => [k, previewValue(x, depth + 1, maxDepth)]));
  }
  return v;
}

/** Recorded search results, bounded: http(s) links only, at most 20, short fields. */
export function boundResults(results: { url?: unknown; title?: unknown; domain?: unknown; snippet?: unknown }[] | undefined): WebResult[] | undefined {
  const kept = (results ?? []).flatMap((r): WebResult[] => {
    if (typeof r.url !== 'string' || !/^https?:\/\//i.test(r.url)) return [];
    const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? clip(v.trim(), max) : undefined);
    return [{ url: r.url.slice(0, 2048), title: str(r.title, 200), domain: str(r.domain, 100) ?? hostOf(r.url), snippet: str(r.snippet, 300) }];
  }).slice(0, 20);
  return kept.length ? kept : undefined;
}

/** Claude's WebSearch result names its links as `Links: [{"title":…,"url":…}, …]`. Reads whole pairs only. */
export function searchLinks(text: string | undefined): WebResult[] | undefined {
  if (!text) return undefined;
  const at = text.indexOf('Links: [');
  if (at < 0) return undefined;
  const found: { url: string; title: string }[] = [];
  for (const m of text.slice(at).matchAll(/\{"title":"((?:[^"\\]|\\.)*)","url":"((?:[^"\\]|\\.)*)"\}/g)) {
    try { found.push({ title: JSON.parse(`"${m[1]}"`), url: JSON.parse(`"${m[2]}"`) }); } catch { /* a malformed pair is skipped, never guessed */ }
  }
  return boundResults(found);
}

/** A Fernet-style encrypted token (version byte 0x80, base64url), as Codex records some delegated tasks. */
export const encryptedToken = (value: unknown): boolean => typeof value === 'string' && /^gAAAAA[A-Za-z0-9_-]{40,}={0,2}$/.test(value.trim());

/** How deep a tool's input is kept. A question's offered options sit four levels down
 *  (questions → question → options → option); summarising them left the card unable to list them. */
const inputDepth = (tool: unknown) => (['AskUserQuestion', 'request_user_input', 'request_user_input_async'].includes(String(tool)) ? 5 : 3);

export type { OperationDetail };
