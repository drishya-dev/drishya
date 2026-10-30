// The scene composer. A PURE function: projection + playback position + preferences in,
// the semantic scene out. No clock, no DOM, no randomness (AGENTS.md constraint 6). The UI
// only renders what this returns, so any paused frame can be rebuilt exactly and golden-tested.
// Runs in both the daemon (tests, export) and the browser.

import { asOfProjection, type Agent, type Operation, type OperationImage, type OperationKind, type Projection, type Prose, type TimelineItem } from '@drishya/contracts';
import { pinnedPlans, type PinnedPlan } from './plan-threads.ts';
export { asOfProjection } from '@drishya/contracts';
export { sinceBoundary, type SinceDigest, type SinceItem } from './since.ts';
export { verificationFor, type VerificationCheck, type VerificationTrail } from './verification.ts';
export { fixChainFor, type FixChain, type FixChainLink, type FixChainRun, type FixChainEdit } from './fix-chains.ts';
export { readBeforeWriteFor, type ReadBeforeWrite, type ReadSpan } from './read-before-write.ts';
export { planThreads, pinnedPlans, type PinnedPlan, type PlanThread, type PlanRevision, type PlanItem, type PlanChange, type PlanPosition } from './plan-threads.ts';

export const COMPOSER_VERSION = 'c1';

export interface ComposeInput {
  /** Number of timeline items applied. 0 = before anything; timeline.length = the end. */
  step: number;
  /** Follow only this agent, tool or MCP server. Others remain, receded. */
  filter?: { agentId?: string; kind?: OperationKind; tool?: string; server?: string };
  /** Selected operation: it rises; playback holding is the caller's business. */
  selectedOperationId?: string;
}

export type OpPhase = 'arriving' | 'present' | 'settled';
export type OpState = 'running' | 'ok' | 'error' | 'unknown';

export interface SceneOp {
  id: string;
  kind: OperationKind;
  title: string;
  tool: string;
  state: OpState;
  /** CONTENT-3: stopped by a permission decision before it ran; `state` is 'error' but this is not a failure. */
  declined?: boolean;
  /** arriving: started on the last applied step. settled: not in the agent's latest passage. */
  phase: OpPhase;
  /** The step that completed it landed last: play the Resolve move once. */
  resolving: boolean;
  /** Where its motion starts: the map node, the dock instrument, or the MCP server. */
  origin: { type: 'map'; path: string } | { type: 'dock'; tool: string; kind: OperationKind; key: string } | { type: 'mcp'; server: string; tool: string };
  paths: string[];
  matchesFilter: boolean;
  selected: boolean;
}

export interface SceneProse {
  id: string;
  role: Prose['role'];
  exposure: Prose['exposure'];
  arriving: boolean;
}

export interface ScenePassage {
  /** Paged readers retain the slot's identity while its content is fetched. */
  unloaded?: boolean;
  id: string;
  agentId: string;
  ops: SceneOp[];
  prose: SceneProse[];
  /** DATA-6: harness notices recorded in this passage, as of this step. */
  notices?: { id: string; arriving: boolean; /** Recorded before this passage's first operation, so it reads above them. */ leading?: boolean }[];
  compactionIds?: string[];
  compactionSummaryIds?: string[];
  /** Earlier passages ease back; the latest passage per agent is in front. */
  settled: boolean;
  matchesFilter: boolean;
  /** A user turn that opened this passage, if one did. */
  turnPrompt?: string;
  /** Captured timestamp of the turn that opens this passage, when supplied. */
  turnTime?: string;
  /** Timeline step of that turn's prompt, to find its ledger (see turns.ts). */
  turnStep?: number;
  /** Claude Code permission mode recorded with this prompt, only when it differs from the previous prompt's. */
  turnPermissionMode?: string;
  /** CONTENT-1: images the person attached to this prompt. */
  turnImages?: OperationImage[];
  /** CONTENT-4: the lead agent's newest todo list of this turn, as of this step; pinned under the prompt. */
  turnPlan?: PinnedPlan;
  /**
   * Timeline step of the prompt this passage follows, on every passage of the turn (not only the one that opens it),
   * so a reader can fold a finished turn even when its opening passage is paged out.
   */
  inTurn?: number;
}

export interface SceneAgent {
  id: string;
  label: string;
  harness: string;
  parentId?: string;
  agentType?: string;
  state: 'waiting' | 'active' | 'idle' | 'stopped';
  activeOperationIds: string[];
}

/**
 * One instrument per kind of action (read, search, edit…), not per harness tool name, so
 * Claude's Read and a Codex `sed -n` read come from the same place. Tool names are listed.
 */
export interface DockInstrument {
  key: string;
  kind: OperationKind;
  tools: string[];
  uses: number;
  active: boolean;
}

export interface DockServer {
  server: string;
  open: boolean;
  tools: { tool: string; uses: number; active: boolean }[];
}

export interface HeatCell {
  path: string;
  /** 0..1, decays with steps since last touch. A pure function of the step. */
  heat: number;
  tone: 'read' | 'write' | 'fail' | 'pass' | 'search';
  /** Edited at some point up to now: keeps a quiet ring even when cold. */
  edited: boolean;
  active: boolean;
}

export interface Marker {
  step: number;
  type: 'turn' | 'edit' | 'fail' | 'pass' | 'prose' | 'gap' | 'spawn';
  label: string;
  /** The operation this marker belongs to, so a timeline can open it in history. */
  operationId?: string;
}

export interface Scene {
  composerVersion: string;
  step: number;
  total: number;
  atEnd: boolean;
  current?: TimelineItem;
  agents: SceneAgent[];
  dock: { native: DockInstrument[]; mcp: DockServer[] };
  passages: ScenePassage[];
  heat: HeatCell[];
  /** The newest thing on screen, for follow-scrolling. */
  focus?: { passageId: string; operationId?: string; proseId?: string };
}

const HALF_LIFE = 14; // steps

export function compose(p: Projection, input: ComposeInput): Scene {
  p = asOfProjection(p, input.step);
  const total = p.timeline.length;
  const step = Math.max(0, Math.min(total, Math.floor(input.step)));
  const applied = p.timeline.slice(0, step);
  const last = applied.at(-1);
  const ops = new Map(p.operations.map((o) => [o.id, o]));
  const proseById = new Map(p.prose.map((item) => [item.id, item]));

  // Operation state as of this step: started? ended?
  const started = new Map<string, number>();
  const ended = new Map<string, number>();
  const proseAt = new Map<string, number>();
  const noticeAt = new Map<string, number>();
  const stoppedAgents = new Set<string>();
  const turnAt: { id: string; agentId: string; step: number; prompt?: string; time?:string; modeChange?: string; images?: OperationImage[] }[] = [];
  let lastMode: string | undefined;
  applied.forEach((it, i) => {
    if (it.type === 'op-start') started.set(it.operationId, i);
    else if (it.type === 'op-end') ended.set(it.operationId, i);
    else if (it.type === 'prose') proseAt.set(it.proseId, i);
    else if (it.type === 'notice') noticeAt.set(it.noticeId, i);
    else if (it.type === 'agent-stop') stoppedAgents.add(it.agentId);
    else if (it.type === 'turn') {
      const modeChange = it.permissionMode && it.permissionMode !== lastMode ? it.permissionMode : undefined;
      if (it.permissionMode) lastMode = it.permissionMode;
      turnAt.push({ id: it.id, agentId: it.agentId, step: i, prompt: it.prompt, time: it.time, ...(modeChange ? { modeChange } : {}), ...(it.images?.length ? { images: it.images } : {}) });
    }
  });

  const stateOf = (op: Operation): OpState => {
    if (!ended.has(op.id)) return op.status === 'unknown' && step >= total ? 'unknown' : 'running';
    return op.status === 'running' ? 'unknown' : op.status;
  };

  const f = input.filter;
  const opMatches = (op: Operation) => {
    if (!f) return true;
    if (f.agentId && op.agentId !== f.agentId) return false;
    if (f.kind && op.kind !== f.kind) return false;
    if (f.server && !(op.origin.type === 'mcp' && op.origin.server === f.server)) return false;
    if (f.tool && op.origin.tool !== f.tool) return false;
    return true;
  };

  // Passages visible at this step; the latest per agent stays in front.
  const visible = p.passages.filter((ps) => ps.firstStep < step);
  const latestByAgent = new Map<string, string>();
  for (const ps of visible) latestByAgent.set(ps.agentId, ps.id);

  const openedTurns = new Set<number>();
  const pins = pinnedPlans(p, (op) => started.has(op.id));
  const materialPassages: ScenePassage[] = visible.map((ps) => {
    const sceneOps: SceneOp[] = ps.operationIds
      .filter((id) => started.has(id))
      .map((id) => {
        const op = ops.get(id)!;
        return {
          id,
          kind: op.kind,
          title: op.title,
          tool: op.tool,
          state: stateOf(op),
          ...(op.declined ? { declined: true } : {}),
          phase: started.get(id) === step - 1 ? 'arriving' : latestByAgent.get(ps.agentId) === ps.id ? 'present' : 'settled',
          resolving: ended.get(id) === step - 1,
          origin: originOf(op),
          paths: op.paths.filter((x) => x.role !== 'search-hit').map((x) => x.path),
          matchesFilter: opMatches(op),
          selected: input.selectedOperationId === id,
        };
      });
    const sceneProse: SceneProse[] = ps.proseIds
      .filter((id) => proseAt.has(id))
      .map((id) => {
        const pr = proseById.get(id)!;
        return { id, role: pr.role, exposure: pr.exposure, arriving: proseAt.get(id) === step - 1 };
      });
    let low = 0;
    let high = turnAt.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (turnAt[mid]!.step < ps.firstStep) low = mid + 1;
      else high = mid;
    }
    const turn = turnAt[low - 1];
    // A late result can extend an older passage across a new prompt. It must
    // not suppress the new chapter's caption.
    const opensTurn = turn && !openedTurns.has(turn.step);
    if (turn) openedTurns.add(turn.step);
    return {
      id: ps.id,
      agentId: ps.agentId,
      ops: sceneOps,
      prose: sceneProse,
      ...(ps.compactionIds?.length ? { compactionIds: ps.compactionIds.filter(id => p.compactions?.some(c => c.id === id)) } : {}),
      ...(ps.compactionSummaryIds?.length ? { compactionSummaryIds: ps.compactionSummaryIds.filter(id => p.compactionSummaries?.some(s => s.id === id)) } : {}),
      ...(ps.noticeIds?.some((id) => noticeAt.has(id)) ? { notices: ps.noticeIds.filter((id) => noticeAt.has(id)).map((id) => { const at = noticeAt.get(id)!, firstOp = Math.min(...ps.operationIds.map((op) => started.get(op) ?? Infinity)); return { id, arriving: at === step - 1, ...(at < firstOp ? { leading: true } : {}) }; }) } : {}),
      settled: latestByAgent.get(ps.agentId) !== ps.id,
      matchesFilter: f ? (f.agentId ? ps.agentId === f.agentId : sceneOps.some((o) => o.matchesFilter)) : true,
      turnPrompt: opensTurn ? turn!.prompt : undefined,
      ...(opensTurn&&turn?.time?{turnTime:turn.time}:{}),
      ...(opensTurn&&turn?{turnStep:turn.step}:{}),
      ...(opensTurn&&turn?.modeChange?{turnPermissionMode:turn.modeChange}:{}),
      ...(opensTurn&&turn?.images?{turnImages:turn.images}:{}),
      ...(opensTurn&&turn&&pins.has(turnAt.indexOf(turn)+1)?{turnPlan:pins.get(turnAt.indexOf(turn)+1)!}:{}),
      ...(turn ? { inTurn: turn.step } : {}),
    };
  });

  // Prompt-only turns have no projection passage. Preserve their captured
  // words as reading stops without inventing a response or mutating capture.
  const promptOnly = turnAt.filter(turn => !openedTurns.has(turn.step) && turn.prompt !== undefined);
  const passages: ScenePassage[] = [];
  let promptIndex = 0;
  const appendPrompt = (turn: typeof turnAt[number]) => passages.push({
    id: `prompt_${turn.id}`, agentId: turn.agentId, ops: [], prose: [],
    settled: turn.step !== turnAt.at(-1)?.step,
    matchesFilter: !f || (!f.kind && !f.server && !f.tool && (!f.agentId || f.agentId === turn.agentId)),
    turnPrompt: turn.prompt, turnTime: turn.time, turnStep: turn.step, inTurn: turn.step,
    ...(turn.modeChange ? { turnPermissionMode: turn.modeChange } : {}),
    ...(turn.images ? { turnImages: turn.images } : {}),
  });
  materialPassages.forEach((passage, index) => {
    while (promptIndex < promptOnly.length && promptOnly[promptIndex]!.step < visible[index]!.firstStep) appendPrompt(promptOnly[promptIndex++]!);
    passages.push(passage);
  });
  while (promptIndex < promptOnly.length) appendPrompt(promptOnly[promptIndex++]!);

  // Agents.
  const running = [...started.keys()].filter((id) => !ended.has(id)).map((id) => ops.get(id)!);
  const agents: SceneAgent[] = p.agents.map((a: Agent) => {
    const active = running.filter((o) => o.agentId === a.id).map((o) => o.id);
    const hasBegun = applied.some((it) => it.agentId === a.id);
    const state: SceneAgent['state'] = stoppedAgents.has(a.id) || (a.stoppedSequence !== undefined && step > a.stoppedSequence && step >= total)
      ? 'stopped'
      : !hasBegun
        ? 'waiting'
        : active.length || last?.agentId === a.id
          ? 'active'
          : 'idle';
    return { id: a.id, label: a.label, harness: a.harness, parentId: a.parentId, agentType: a.agentType, state, activeOperationIds: active };
  });

  // Dock: every instrument the recording ever uses, so the dock does not reshuffle while playing.
  const nativeMap = new Map<string, DockInstrument>();
  const mcpMap = new Map<string, DockServer>();
  const scripts = new Set(p.operations.map(op => op.parentOperationId).filter(Boolean));
  for (const op of p.operations.filter(op => !scripts.has(op.id))) {
    const used = started.has(op.id);
    const act = used && !ended.has(op.id);
    if (op.origin.type === 'mcp') {
      const s = mcpMap.get(op.origin.server) ?? { server: op.origin.server, open: false, tools: [] };
      let t = s.tools.find((x) => x.tool === op.origin.tool);
      if (!t) {
        t = { tool: (op.origin as { tool: string }).tool, uses: 0, active: false };
        s.tools.push(t);
      }
      if (used) t.uses++;
      if (act) {
        t.active = true;
        s.open = true;
      }
      mcpMap.set(op.origin.server, s);
    } else {
      const key = dockKey(op);
      const d = nativeMap.get(key) ?? { key, kind: key as OperationKind, tools: [], uses: 0, active: false };
      if (!d.tools.includes(op.tool)) d.tools.push(op.tool);
      if (used) d.uses++;
      if (act) d.active = true;
      nativeMap.set(key, d);
    }
  }
  const lastOp = last && (last.type === 'op-start' || last.type === 'op-end') ? ops.get(last.operationId) : undefined;
  if (lastOp?.origin.type === 'mcp') mcpMap.get(lastOp.origin.server)!.open = true;

  // Heat: a pure function of the step.
  const heat = new Map<string, HeatCell>();
  const failing = new Map<string, { command: string; tests: string[] }>();
  applied.forEach((it, i) => {
    if (it.type !== 'op-start' && it.type !== 'op-end') return;
    const op = ops.get(it.operationId)!;
    // A later run clears a failure mark when the same command runs clean, or when the output
    // lists the failing tests as passing. Nothing else clears it.
    if (it.type === 'op-end' && op.detail.kind === 'test' && op.detail.summary) {
      const d = op.detail;
      const s = d.summary!;
      const passing = new Set(s.passing);
      for (const [path, f] of [...failing]) {
        const cleanSameCommand = s.failed === 0 && s.passed > 0 && f.command === d.command.trim();
        if (cleanSameCommand || f.tests.every((t) => passing.has(t))) failing.delete(path);
      }
    }
    const age = step - 1 - i;
    const w = Math.pow(0.5, age / HALF_LIFE);
    for (const pr of op.paths) {
      const tone: HeatCell['tone'] = pr.role === 'write' ? 'write' : pr.role === 'test' ? (op.status === 'error' ? 'fail' : 'pass') : pr.role === 'search-hit' ? 'search' : 'read';
      const c = heat.get(pr.path) ?? { path: pr.path, heat: 0, tone, edited: false, active: false };
      c.heat = Math.min(1, c.heat * 0.6 + w * (pr.role === 'search-hit' ? 0.35 : 0.8));
      c.tone = tone;
      if (pr.role === 'write' && it.type === 'op-end' && op.status === 'ok') c.edited = true;
      if (pr.role === 'test' && it.type === 'op-end' && op.status === 'error' && op.detail.kind === 'test') {
        const tests = (op.detail.summary?.failures ?? []).filter((f) => f.file === pr.path).map((f) => f.name);
        failing.set(pr.path, { command: op.detail.command.trim(), tests });
      }
      if (it.type === 'op-start' && !ended.has(op.id)) c.active = true;
      heat.set(pr.path, c);
    }
  });
  for (const c of heat.values()) {
    if (failing.has(c.path)) c.tone = 'fail';
    else if (c.tone === 'fail') c.tone = 'pass';
  }

  let focus: Scene['focus'];
  if (last) {
    const opId = last.type === 'op-start' || last.type === 'op-end' ? last.operationId : undefined;
    const proseId = last.type === 'prose' ? last.proseId : undefined;
    const ps = [...passages].reverse().find((x) => (opId && x.ops.some((o) => o.id === opId)) || (proseId && x.prose.some((pr) => pr.id === proseId)));
    if (ps) focus = { passageId: ps.id, operationId: opId, proseId };
  }

  return {
    composerVersion: COMPOSER_VERSION,
    step,
    total,
    atEnd: step >= total,
    current: last,
    agents,
    dock: {
      native: [...nativeMap.values()].map((d) => ({ ...d, tools: d.tools.sort() })).sort((a, b) => NATIVE_ORDER.indexOf(a.kind) - NATIVE_ORDER.indexOf(b.kind)),
      mcp: [...mcpMap.values()].sort((a, b) => a.server.localeCompare(b.server)),
    },
    passages,
    heat: [...heat.values()].map((c) => ({ ...c, heat: Math.round(c.heat * 1000) / 1000 })).sort((a, b) => a.path.localeCompare(b.path)),
    focus,
  };
}

const NATIVE_ORDER: OperationKind[] = ['read', 'search', 'edit', 'write', 'shell', 'test', 'web', 'spawn', 'plan', 'other', 'mcp'];

/** Dock instruments group by what the operation did, so Bash-as-test and Bash-as-shell differ. */
export function dockKey(op: Operation): string {
  if (op.origin.type === 'mcp') return `mcp:${op.origin.server}`;
  return op.kind === 'write' ? 'edit' : op.kind;
}

function originOf(op: Operation): SceneOp['origin'] {
  if (op.origin.type === 'mcp') return { type: 'mcp', server: op.origin.server, tool: op.origin.tool };
  // Reads and edits of a file come from the map; everything else from its dock instrument.
  const file = op.paths.find((x) => x.role === 'read' || x.role === 'write');
  if ((op.kind === 'read' || op.kind === 'edit' || op.kind === 'write') && file) return { type: 'map', path: file.path };
  return { type: 'dock', tool: op.tool, kind: op.kind, key: dockKey(op) };
}

// ─── transport helpers ───────────────────────────────────────────────────────────────────

export function markers(p: Projection): Marker[] {
  const ops = new Map(p.operations.map((o) => [o.id, o]));
  const out: Marker[] = [];
  p.timeline.forEach((it, i) => {
    const step = i + 1; // the step at which this item is visible
    if (it.type === 'turn') out.push({ step, type: 'turn', label: clip(it.prompt ?? 'Prompt', 60) });
    else if (it.type === 'gap') out.push({ step, type: 'gap', label: it.reason });
    else if (it.type === 'op-start') {
      const op = ops.get(it.operationId)!;
      if (op.kind === 'spawn') out.push({ step, type: 'spawn', label: op.title, operationId: op.id });
    } else if (it.type === 'op-end') {
      const op = ops.get(it.operationId)!;
      if ((op.kind === 'edit' || op.kind === 'write') && op.status === 'ok') out.push({ step, type: 'edit', label: op.title, operationId: op.id });
      if (op.declined) { /* stopped before it ran: neither a pass nor a fail */ }
      else if (op.kind === 'test') out.push({ step, type: op.status === 'error' ? 'fail' : 'pass', label: op.title, operationId: op.id });
      else if (op.status === 'error') out.push({ step, type: 'fail', label: op.title, operationId: op.id });
    } else if (it.type === 'prose') out.push({ step, type: 'prose', label: '' });
  });
  return out;
}

export function nextMarker(p: Projection, from: number, type: Marker['type'] | Marker['type'][], dir: 1 | -1 = 1): number | undefined {
  const types = Array.isArray(type) ? type : [type];
  const ms = markers(p).filter((m) => types.includes(m.type));
  return dir === 1 ? ms.find((m) => m.step > from)?.step : ms.reverse().find((m) => m.step < from)?.step;
}

/** The step at which an operation first appears, for "jump to" from search or links. */
export function stepOfOperation(p: Projection, operationId: string): number | undefined {
  const i = p.timeline.findIndex((it) => it.type === 'op-start' && it.operationId === operationId);
  return i < 0 ? undefined : i + 1;
}

export function stepOfObservation(p: Projection, observationId: string): number | undefined {
  const op = p.operations.find((o) => o.observationIds.includes(observationId));
  if (op) return stepOfOperation(p, op.id);
  const pr = p.prose.find((x) => x.observationIds.includes(observationId));
  if (pr) return pr.sequence + 1;
  return undefined;
}

/**
 * Suggested dwell for playback pacing, in ms, from the content's reading cost. The caller owns
 * the clock; this only says how long a step deserves.
 */
export function dwellFor(p: Projection, step: number, speed = 1): number {
  const it = p.timeline[step - 1];
  if (!it) return 350 / speed;
  let ms = 550;
  if (it.type === 'prose') {
    const pr = p.prose.find((x) => x.id === it.proseId);
    const words = pr?.text.trim().split(/\s+/).length ?? 20;
    ms = Math.min(20_000, 1200 + words * (pr?.role === 'reasoning' ? 110 : 140));
  } else if (it.type === 'turn') ms = 2000;
  else if (it.type === 'op-end') {
    const op = p.operations.find((o) => o.id === it.operationId);
    const detail = op?.detail;
    const preview = detail && 'outputPreview' in detail ? detail.outputPreview : detail && 'resultPreview' in detail ? detail.resultPreview : undefined;
    const words = preview?.trim().split(/\s+/).length ?? 0;
    ms = Math.max(op?.kind === 'test' || op?.kind === 'edit' || op?.kind === 'write' ? 1800 : op?.status === 'error' ? 1600 : 950,
      Math.min(7000, 700 + words * 120));
  } else if (it.type === 'op-start') ms = 650;
  return ms / speed;
}

function clip(s: string, n: number) {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
}
export { screenRun, isScreenOperation, SCREEN_STEP_CAP, type ScreenRun, type ScreenStep, type ScreenGesture } from './screen.ts';
export { toolInventory, toolTrail, matchesTool, type ToolEntry, type ToolInventory, type ToolTrail, type ToolFilter, type TrailStep } from './tools.ts';
