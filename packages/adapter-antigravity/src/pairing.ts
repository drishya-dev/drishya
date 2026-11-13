import type { ToolIntent, RawObservation } from '@drishya/capture-core';
import type { Observation } from '@drishya/contracts';

export interface PendingCall { id: string; tool: string; args: Record<string, unknown>; intent: ToolIntent; step: number; protected?: boolean }

/** Results have no native IDs. Only the immediately preceding planner's ordered group may own one. */
export class CallOrder {
  private pending: PendingCall[] = [];
  reset(): PendingCall[] { const previous = this.pending; this.pending = []; return previous; }
  add(call: PendingCall): void { this.pending.push(call); }
  next(): PendingCall | undefined { return this.pending.shift(); }
  prime(observations: Observation[]): Map<number, PendingCall> {
    const calls = new Map<string, PendingCall>();
    for (const o of observations) {
      if (o.kind !== 'tool.call' || !o.operationId) continue;
      const payload = o.payload as { tool?: unknown; input?: unknown; intent?: unknown; antigravityStep?: unknown; protected?: unknown };
      if (typeof payload.tool !== 'string' || typeof payload.antigravityStep !== 'number') continue;
      const validIntent = payload.intent && typeof payload.intent === 'object' && 'kind' in payload.intent;
      const args = payload.input && typeof payload.input === 'object' && !Array.isArray(payload.input) ? payload.input as Record<string, unknown> : {};
      calls.set(o.operationId, { id: o.operationId, tool: payload.tool, args, intent: validIntent ? payload.intent as ToolIntent : { kind: 'other' }, step: payload.antigravityStep,
        // Missing content may be an older protected call; fail closed rather than expose its result.
        protected: payload.protected === true || !validIntent });
    }
    const owners = new Map<number, PendingCall>(), consumed = new Set<string>();
    for (const o of observations) {
      if (o.kind !== 'tool.result' || !o.operationId) continue;
      const call = calls.get(o.operationId), match = /:(\d+)$/.exec(o.source.recordId ?? '');
      if (!call || !match) continue;
      owners.set(Number(match[1]), call);
      consumed.add(call.id); // A running receipt already occupies this position; updates reuse its owner.
    }
    const barriers = observations.filter(o => o.kind === 'checkpoint').map(o => o.payload as { recordType?: string; stepIndex?: number })
      .filter(p => p.recordType === 'PLANNER_RESPONSE' || p.recordType === 'USER_INPUT').map(p => p.stepIndex ?? -1);
    const latestStep = Math.max(-1, ...barriers, ...[...calls.values()].map(call => call.step));
    this.pending = [...calls.values()].filter(call => call.step === latestStep && !consumed.has(call.id));
    return owners;
  }
}

export function unmatched(call: PendingCall, base: Pick<RawObservation, 'agentId' | 'sourceTime'>, _part: number): RawObservation {
  const [recordId, index] = call.id.split(':call:');
  return { ...base, recordId, part: 20000 + Number(index), kind: 'capture.gap', operationId: call.id,
    availability: 'partial', payload: { reason: 'unsupported-content', detail: 'Antigravity recorded this call without a corresponding result.', derived: 'antigravity-unmatched-call-v1' } };
}

/** Replaces the materialized missing-result notice, without inventing an extra source step. */
export function matched(call: PendingCall, base: Pick<RawObservation, 'agentId' | 'sourceTime'>): RawObservation {
  const marker = unmatched(call, base, 0);
  return { ...marker, kind: 'checkpoint', availability: 'metadata-only', payload: { resultRecorded: true, derived: 'antigravity-unmatched-call-v1' } };
}
