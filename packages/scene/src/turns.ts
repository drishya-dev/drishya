import type { Operation, Projection, Turn, TurnSettings } from '@drishya/contracts';

/**
 * What one turn (from a user prompt to the next) did, counted from captured operations. Pure and clock-free.
 * Nothing here is inferred beyond counting: a turn's duration is derived from the last captured time inside it,
 * because not every harness records where a turn ends. A harness that does record turns (Codex, DATA-3) adds
 * `recorded`, which is its own account of the turn and is always preferred over the derived duration.
 */
export interface TurnLedger {
  /** Timeline step of the prompt that opens this turn; passages carry the same number as `turnStep`. */
  step: number;
  time?: string;
  endTime?: string;
  durationMs?: number;
  operations: number;
  reads: number;
  searches: number;
  edits: { files: number; added: number; removed: number };
  commands: number;
  tests: { runs: number; passed: number; failed: number };
  web: number;
  mcp: number;
  delegations: number;
  /** Operations that ended in an error. */
  failed: number;
  /** Actions a permission decision stopped before they ran (CONTENT-3); not failures. */
  declined: number;
  /** Calls still without a result inside this turn. */
  open: number;
  /** What the harness itself recorded about this turn; absent when it records none (Claude Code). */
  recorded?: RecordedTurn;
}

export interface RecordedTurn {
  durationMs?: number;
  timeToFirstTokenMs?: number;
  outcome?: 'completed' | 'aborted';
  reason?: string;
  error?: { message?: string; code?: string };
  /** The settings that differ from the agent's previous recorded turn, or all of them on its first. */
  settingsChange?: TurnSettings;
}

const parse = (iso?: string) => iso && Number.isFinite(Date.parse(iso)) ? Date.parse(iso) : undefined;

const SETTING_KEYS: (keyof TurnSettings)[] = ['model', 'effort', 'approvalPolicy', 'sandbox', 'permissionProfile', 'collaborationMode', 'approvalsReviewer', 'personality'];

/** The recorded turn that contains a prompt: the agent's latest turn that started at or before it and had not ended. */
function recordedTurns(projection: Projection): (sequence: number, agentId: string) => Turn | undefined {
  const byAgent = new Map<string, Turn[]>();
  for (const turn of projection.turns ?? []) {
    if (turn.startSequence === undefined) continue;
    const list = byAgent.get(turn.agentId);
    if (list) list.push(turn); else byAgent.set(turn.agentId, [turn]);
  }
  for (const list of byAgent.values()) list.sort((a, b) => a.startSequence! - b.startSequence!);
  return (sequence, agentId) => {
    const list = byAgent.get(agentId);
    if (!list) return undefined;
    let found: Turn | undefined;
    for (const turn of list) { if (turn.startSequence! <= sequence) found = turn; else break; }
    return found && (found.endSequence === undefined || found.endSequence >= sequence) ? found : undefined;
  };
}

/**
 * A recorded turn can carry several prompts (the person steers while the agent works). Its settings belong to the first
 * prompt, its outcome and error to the last, and its duration only to a turn with a single prompt, because the
 * duration covers all of them while each prompt's counts cover its own stretch.
 */
function recordedFacts(turn: Turn, previous: TurnSettings | undefined, place: { first: boolean; last: boolean }): RecordedTurn | undefined {
  const change: TurnSettings = {};
  if (place.first) for (const key of SETTING_KEYS) {
    const value = turn.settings?.[key];
    if (value !== undefined && value !== previous?.[key]) change[key] = value;
  }
  const whole = place.first && place.last;
  const recorded: RecordedTurn = {
    ...(whole && turn.durationMs !== undefined ? { durationMs: turn.durationMs } : {}),
    ...(whole && turn.timeToFirstTokenMs !== undefined ? { timeToFirstTokenMs: turn.timeToFirstTokenMs } : {}),
    ...(place.last && turn.outcome ? { outcome: turn.outcome } : {}),
    ...(place.last && turn.reason ? { reason: turn.reason } : {}),
    ...(place.last && turn.error ? { error: turn.error } : {}),
    ...(Object.keys(change).length ? { settingsChange: change } : {}),
  };
  return Object.keys(recorded).length ? recorded : undefined;
}

/** One operation's contribution to a ledger. Shared by the per-turn ledger and the per-run line so the two never count differently. */
export function tallyOperation(ledger: TurnLedger, op: Operation, files: Set<string>): void {
  ledger.operations++;
  if (op.declined) ledger.declined++;
  else if (op.status === 'error') ledger.failed++;
  if (op.status === 'running') ledger.open++;
  const d = op.detail;
  switch (op.kind) {
    case 'read': ledger.reads++; break;
    case 'search': ledger.searches++; break;
    case 'shell': ledger.commands++; break;
    case 'web': ledger.web++; break;
    case 'mcp': ledger.mcp++; break;
    case 'spawn': ledger.delegations++; break;
    case 'test':
      ledger.tests.runs++;
      if (d.kind === 'test' && d.summary) { ledger.tests.passed += d.summary.passed; ledger.tests.failed += d.summary.failed; }
      break;
    case 'edit': case 'write':
      if (d.kind === 'edit' && op.status !== 'error') {
        files.add(d.path);
        for (const hunk of d.hunks) for (const line of hunk.lines) { if (line[0] === '+') ledger.edits.added++; else if (line[0] === '-') ledger.edits.removed++; }
      }
      break;
  }
}

export function turnLedgers(projection: Projection): TurnLedger[] {
  const recordedAt = recordedTurns(projection);
  const lastSettings = new Map<string, TurnSettings>();
  // Which recorded turn each prompt began in, and how many prompts share it.
  const owner = new Map<number, Turn>();
  const prompts = new Map<string, number>();
  const seen = new Map<string, number>();
  projection.timeline.forEach((item, index) => {
    if (item.type !== 'turn') return;
    const turn = recordedAt(item.sequence, item.agentId);
    if (!turn) return;
    owner.set(index, turn);
    prompts.set(turn.id, (prompts.get(turn.id) ?? 0) + 1);
  });
  const scripts = new Set(projection.operations.map(op => op.parentOperationId).filter(Boolean));
  const ops = new Map(projection.operations.filter(op => !scripts.has(op.id)).map((op) => [op.id, op]));
  const starts: number[] = [];
  projection.timeline.forEach((item, index) => { if (item.type === 'turn') starts.push(index); });

  return starts.map((from, n) => {
    const to = starts[n + 1] ?? projection.timeline.length;
    const head = projection.timeline[from]!;
    const ledger: TurnLedger = {
      step: from, time: head.time, operations: 0, reads: 0, searches: 0, edits: { files: 0, added: 0, removed: 0 },
      commands: 0, tests: { runs: 0, passed: 0, failed: 0 }, web: 0, mcp: 0, delegations: 0, failed: 0, declined: 0, open: 0,
    };
    const files = new Set<string>();
    let last = parse(head.time);
    for (let i = from; i < to; i++) {
      const item = projection.timeline[i]!;
      const at = parse(item.time);
      if (at !== undefined && (last === undefined || at > last)) last = at;
      if (item.type !== 'op-start') continue;
      const op = ops.get(item.operationId);
      if (!op) continue;
      tallyOperation(ledger, op, files);
    }
    ledger.edits.files = files.size;
    const recorded = owner.get(from);
    if (recorded) {
      const nth = seen.get(recorded.id) ?? 0;
      seen.set(recorded.id, nth + 1);
      const facts = recordedFacts(recorded, lastSettings.get(recorded.agentId), { first: nth === 0, last: nth + 1 === prompts.get(recorded.id) });
      if (facts) ledger.recorded = facts;
      if (nth === 0 && recorded.settings) lastSettings.set(recorded.agentId, { ...lastSettings.get(recorded.agentId), ...recorded.settings });
    }
    const start = parse(head.time);
    if (last !== undefined && start !== undefined && last >= start) { ledger.endTime = new Date(last).toISOString(); ledger.durationMs = last - start; }
    return ledger;
  });
}
