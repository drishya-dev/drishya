import type { Compaction, CompactionPayload, CompactionSummary, ContextReading, Observation, Projection, UsagePayload } from '@drishya/contracts';

const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const recordKey = (o: Observation) => `${o.recordingId}|${o.agentId}|${o.source.sourceId}|${o.source.generation}|${o.source.recordId ?? o.source.byteOffset}`;
const nativeKey = (o: Observation, id: string) => `${o.recordingId}|${o.agentId}|${o.source.sourceId}|${o.source.generation}|${id}`;

/** Separate request readings from accounting. No capacity, occupancy or boundary association is guessed. */
export class ContextAccumulator {
  private readings = new Map<string, ContextReading>();
  private latest = new Map<string, ContextReading>();
  private pinned = new Set<string>();
  private boundaries = new Map<string, Compaction>();
  private nativeBoundaries = new Map<string, Compaction>();
  private summaries = new Map<string, CompactionSummary>();
  private waiting = new Map<string, Compaction[]>();
  private summaryParents = new Map<string, string>();

  usage(o: Observation, step: number, agentId: string) {
    if (o.kind !== 'usage') return;
    const p = o.payload as UsagePayload;
    if (p.cumulative) return;
    let input = p.contextInput;
    if (!input && p.source === 'codex-token-count' && count(p.tokens?.input)) input = { tokens: p.tokens.input, basis: 'captured-request-input' };
    if (!input && p.source === 'claude-message-usage' && [p.tokens?.input, p.tokens?.cachedInput, p.tokens?.cacheWrite].every(count)) {
      const tokens = p.tokens!.input! + p.tokens!.cachedInput! + p.tokens!.cacheWrite!;
      if (count(tokens)) input = { tokens, basis: 'derived-request-input' };
    }
    if (!input || !count(input.tokens)) return;
    const point: ContextReading = { id: `ctx_${o.id}`, agentId, source: p.source, time: o.sourceTime, availableAfterStep: step, observationIds: [o.id], input,
      ...(count(p.contextWindow) && p.contextWindow > 0 ? { window: p.contextWindow } : {}) };
    const previous = this.latest.get(agentId);
    // Repeated readings at one playback boundary need only their final value, unless a compaction cites one.
    if (previous?.availableAfterStep === step && !this.pinned.has(previous.id)) this.readings.delete(previous.id);
    this.readings.set(point.id, point);
    this.latest.set(agentId, point);
    for (const boundary of this.waiting.get(agentId) ?? []) {
      boundary.nextReadingId = point.id;
      this.pinned.add(point.id);
    }
    this.waiting.delete(agentId);
  }

  /** Returns whether this native record needs its original timeline position. Enrichment parts never add a step. */
  compaction(o: Observation, step: number, agentId: string): { boundary?: Compaction; summary?: CompactionSummary; fresh: boolean } {
    const p = o.payload as Partial<CompactionPayload>;
    const key = recordKey(o);
    const summaryOnly = p.phase === 'summary' || p.source === 'claude-summary' || o.source.adapterId === 'claude-code' && 'summary' in p;
    if (summaryOnly) {
      let summary = this.summaries.get(key);
      const fresh = !summary;
      if (!summary) {
        summary = { id: `csm_${o.id}`, agentId, time: o.sourceTime, availableAfterStep: step + 1, observationIds: [], availability: 'not-recorded' };
        this.summaries.set(key, summary);
      }
      if (!summary.observationIds.includes(o.id)) summary.observationIds.push(o.id);
      if (p.boundaryRecordId) this.summaryParents.set(key, nativeKey(o, p.boundaryRecordId));
      this.connectSummary(key, summary);
      return { summary, fresh };
    }
    let boundary = this.boundaries.get(key);
    const fresh = !boundary;
    if (!boundary) {
      const before = this.latest.get(agentId);
      boundary = { id: `cmp_${o.id}`, agentId, step, time: o.sourceTime, observationIds: [], ...(before ? { priorReadingId: before.id } : {}) };
      if (before) this.pinned.add(before.id);
      this.boundaries.set(key, boundary);
      this.nativeBoundaries.set(key, boundary);
      this.waiting.set(agentId, [...this.waiting.get(agentId) ?? [], boundary]);
    }
    if (!boundary.observationIds.includes(o.id)) boundary.observationIds.push(o.id);
    if (typeof p.trigger === 'string') boundary.trigger = p.trigger;
    for (const field of ['beforeTokens', 'afterTokens', 'durationMs'] as const) if (count(p[field])) boundary[field] = p[field];
    if (o.source.adapterId === 'codex') {
      let summary = this.summaries.get(key);
      if (!summary) {
        summary = { id: `csm_${o.id}`, agentId, time: o.sourceTime, availableAfterStep: boundary.step + 1, observationIds: [], boundaryId: boundary.id, availability: 'not-recorded' };
        this.summaries.set(key, summary);
      }
      if (!summary.observationIds.includes(o.id)) summary.observationIds.push(o.id);
      if (p.summaryAvailability && !summary.artifactId) summary.availability = p.summaryAvailability;
      boundary.summaryId = summary.id;
    }
    for (const [summaryKey, summary] of this.summaries) this.connectSummary(summaryKey, summary);
    return { boundary, fresh };
  }

  private connectSummary(key: string, summary: CompactionSummary) {
    const parent = this.summaryParents.get(key);
    const boundary = parent && this.nativeBoundaries.get(parent);
    if (!boundary) return;
    summary.boundaryId = boundary.id;
    boundary.summaryId = summary.id;
  }

  summary(o: Observation): CompactionSummary | undefined { return this.summaries.get(recordKey(o)); }

  snapshot(remap: (step: number) => number): Pick<Projection, 'context' | 'compactions' | 'compactionSummaries'> {
    const readings = [...this.readings.values()].map(p => ({ ...p, availableAfterStep: remap(p.availableAfterStep), observationIds: [...p.observationIds], input: { ...p.input } }));
    const latest = [...this.latest.values()];
    // A merged account has no meaningful single context window. Agent-specific evidence remains available.
    return {
      ...(readings.length ? { context: { readings, ...(latest.length === 1 ? { latest: readings.find(p => p.id === latest[0]!.id) } : {}) } } : {}),
      ...(this.boundaries.size ? { compactions: [...this.boundaries.values()].map(b => ({ ...b, step: remap(b.step), observationIds: [...b.observationIds] })) } : {}),
      ...(this.summaries.size ? { compactionSummaries: [...this.summaries.values()].map(s => ({ ...s, availableAfterStep: remap(s.availableAfterStep), observationIds: [...s.observationIds] })) } : {}),
    };
  }
}
