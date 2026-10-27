import type { Observation, Projection, Turn, TurnDetailPayload } from '@drishya/contracts';

const DETAIL_KEYS = ['rootTurnId', 'parentTurnId', 'trigger', 'initiatingAgentPath', 'startedAt', 'completedAt', 'durationMs', 'timeToFirstTokenMs', 'outcome', 'reason', 'error'] as const;

interface Entry { turn: Turn; details: Observation[] }

/**
 * The turns a harness recorded. `turn.start`/`turn.end` give the turn and its place in the stream; `turn.detail`
 * observations add timing, trigger, error and settings, and may arrive in a later import. Details are merged in
 * journal order (byte offset), never by receipt order, so an enrichment import changes nothing about the old records.
 */
export class TurnAccumulator {
  private turns = new Map<string, Entry>();
  private order: string[] = [];
  private entry(turnId: string, agentId: string): Entry {
    let found = this.turns.get(turnId);
    if (!found) {
      found = { turn: { id: turnId, agentId, basis: 'captured' }, details: [] };
      this.turns.set(turnId, found);
      this.order.push(turnId);
    }
    return found;
  }
  add(o: Observation) {
    if (o.kind !== 'turn.start' && o.kind !== 'turn.end' && o.kind !== 'turn.detail') return;
    const turnId = (o.payload as { turnId?: unknown }).turnId;
    if (typeof turnId !== 'string' || !turnId) return;
    const entry = this.entry(turnId, `${o.recordingId}.${o.agentId}`);
    if (o.kind === 'turn.start') entry.turn.startSequence = Math.min(entry.turn.startSequence ?? Infinity, o.receivedSequence);
    else if (o.kind === 'turn.end') entry.turn.endSequence = Math.max(entry.turn.endSequence ?? -Infinity, o.receivedSequence);
    else entry.details.push(o);
  }
  snapshot(): Projection['turns'] {
    const out: Turn[] = [];
    for (const id of this.order) {
      const { turn, details } = this.turns.get(id)!;
      const merged: Turn = { ...turn };
      const inJournalOrder = [...details].sort((a, b) => a.source.sourceId.localeCompare(b.source.sourceId) || a.source.generation - b.source.generation || a.source.byteOffset - b.source.byteOffset || a.source.part - b.source.part);
      for (const o of inJournalOrder) {
        const p = o.payload as TurnDetailPayload;
        for (const key of DETAIL_KEYS) if (p[key] !== undefined) (merged as unknown as Record<string, unknown>)[key] = p[key];
        if (p.settings) merged.settings = { ...merged.settings, ...p.settings };
      }
      // A turn with neither a recorded boundary nor any detail carries nothing worth listing.
      if (merged.startSequence !== undefined || merged.endSequence !== undefined || details.length) out.push(merged);
    }
    return out.length ? structuredClone(out) : undefined;
  }
}
