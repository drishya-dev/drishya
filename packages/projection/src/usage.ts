import type { Observation, Projection, UsagePayload } from '@drishya/contracts';

interface Point { observation: Observation; payload: UsagePayload }
const isNewer = (a: Point, b: Point, request: boolean) => {
  const at = a.observation.sourceTime, bt = b.observation.sourceTime;
  if (at && bt && at !== bt) return at > bt;
  // Undated cumulative cost records are ordered only by receipt, never by a fabricated clock.
  if (!at || !bt) return a.observation.receivedSequence > b.observation.receivedSequence;
  const offset = a.observation.source.byteOffset - b.observation.source.byteOffset;
  if (offset) return offset > 0;
  if (a.payload.cumulative !== b.payload.cumulative) return request ? !a.payload.cumulative : a.payload.cumulative;
  return a.observation.receivedSequence > b.observation.receivedSequence;
};

/** One session's latest reported point and one request point per recorded turn. Never sum receipts. */
export class UsageAccumulator {
  private recordings = new Set<string>();
  private latest?: Point;
  private turns = new Map<string, Point>();
  add(observation: Observation) {
    this.recordings.add(observation.recordingId);
    if (observation.kind !== 'usage') return;
    const payload = observation.payload as UsagePayload;
    if (!['codex-token-count', 'claude-message-usage', 'claude-cost-state'].includes(payload.source)) return;
    const point = { observation, payload };
    if (!this.latest || isNewer(point, this.latest, false)) this.latest = point;
    if (payload.turnId) {
      const prior = this.turns.get(payload.turnId);
      if (!prior || isNewer(point, prior, true)) this.turns.set(payload.turnId, point);
    }
  }
  snapshot(): Projection['usage'] {
    if (!this.latest || this.recordings.size !== 1) return undefined;
    return structuredClone({ latest: this.latest.payload, byTurn: Object.fromEntries([...this.turns].map(([id, point]) => [id, point.payload])) });
  }
}
