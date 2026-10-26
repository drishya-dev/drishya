import type { TurnDetailPayload, TurnSettings } from '@drishya/contracts';
import type { RawObservation } from '@drishya/capture-core';

type Rec = Record<string, any>;
const str = (value: unknown) => (typeof value === 'string' && value ? value : undefined);
const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined);
// Codex records epoch seconds. Convert only; Drishya never supplies a time the harness did not.
const iso = (seconds: unknown) => { const n = num(seconds); return n === undefined ? undefined : new Date(n * 1000).toISOString(); };
const compact = <T extends object>(value: T): T | undefined => {
  const entries = Object.entries(value).filter(([, v]) => v !== undefined);
  return entries.length ? (Object.fromEntries(entries) as T) : undefined;
};

/** `task_started`: why the turn began and its place in a chain of turns. */
export function turnStartedDetail(p: Rec): TurnDetailPayload | undefined {
  const turnId = str(p.turn_id);
  if (!turnId) return undefined;
  const attribution = (p.turn_attribution ?? {}) as Rec;
  const detail = compact({
    turnId,
    rootTurnId: str(p.root_turn_id) ?? str(attribution.root_turn_id),
    parentTurnId: str(attribution.parent_turn_id),
    trigger: str(attribution.turn_trigger),
    initiatingAgentPath: str(attribution.initiating_agent_path),
    startedAt: iso(p.started_at),
    settings: compact<TurnSettings>({ collaborationMode: str(p.collaboration_mode_kind) }),
  });
  return detail && Object.keys(detail).length > 1 ? detail : undefined;
}

/** `task_complete` and `turn_aborted`: timing, outcome and any recorded error. */
export function turnEndedDetail(p: Rec, outcome: 'completed' | 'aborted'): TurnDetailPayload | undefined {
  const turnId = str(p.turn_id);
  if (!turnId) return undefined;
  const error = p.error && typeof p.error === 'object' ? compact({ message: str(p.error.message), code: str(p.error.codex_error_info) }) : undefined;
  return compact({
    turnId,
    rootTurnId: str(p.root_turn_id),
    startedAt: iso(p.started_at),
    completedAt: iso(p.completed_at),
    durationMs: num(p.duration_ms),
    timeToFirstTokenMs: num(p.time_to_first_token_ms),
    outcome,
    reason: outcome === 'aborted' ? str(p.reason) : undefined,
    error,
  });
}

/** `turn_context`: the policies and model this turn ran under. Names only; file-system entries and paths are not kept. */
export function turnSettingsDetail(p: Rec): TurnDetailPayload | undefined {
  const turnId = str(p.turn_id);
  if (!turnId) return undefined;
  const settings = compact<TurnSettings>({
    model: str(p.model),
    effort: str(p.effort),
    approvalPolicy: str(p.approval_policy),
    sandbox: str(p.sandbox_policy?.type),
    permissionProfile: str(p.permission_profile?.type),
    collaborationMode: str(p.collaboration_mode?.mode),
    approvalsReviewer: str(p.approvals_reviewer),
    personality: str(p.personality),
  });
  return settings ? { turnId, rootTurnId: str(p.root_turn_id), settings } : undefined;
}

/** Part 1 of the record: part 0 stays whatever that record always produced, so old recordings keep their ids. */
export function turnDetail(base: Omit<RawObservation, 'kind' | 'payload'>, payload: TurnDetailPayload | undefined): RawObservation[] {
  return payload ? [{ ...base, part: 1, kind: 'turn.detail', payload: { ...payload } }] : [];
}
