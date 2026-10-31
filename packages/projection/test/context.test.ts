import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { asOfProjection, type Observation } from '@drishya/contracts';
import { seal } from '@drishya/capture-core';
import { codexAdapter } from '../../adapter-codex/src/index.ts';
import { claudeAdapter } from '../../adapter-claude/src/index.ts';
import { createReducer, reduce } from '../src/reduce.ts';
import { compose } from '../../scene/src/index.ts';

const options = { adapters: { codex: codexAdapter.descriptor, 'claude-code': claudeAdapter.descriptor } };
const timestamp = (n: number) => `2026-10-30T10:00:${String(n).padStart(2, '0')}Z`;
const user = (n: number) => ({ timestamp: timestamp(n), type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: `Synthetic prompt ${n}` }] } });
const usage = (n: number, input: number) => ({ timestamp: timestamp(n), type: 'event_msg', payload: { type: 'token_count', info: { model_context_window: 100000, total_token_usage: { input_tokens: input + 500000 }, last_token_usage: { input_tokens: input, cached_input_tokens: input - 10 } } } });

function captured(adapter: typeof codexAdapter, rows: unknown[]) {
  const parser = adapter.createParser({ recordingId: 'r', sourceId: 's', sourcePath: 'synthetic' });
  const observations: Observation[] = [];
  rows.forEach((r, i) => {
    for (const raw of parser.parse(r)) observations.push({ ...seal({ raw, recordingId: 'r', sourceId: 's', adapter: adapter.descriptor, generation: 0, byteOffset: i * 100, observedAt: timestamp(59) }), receivedSequence: observations.length });
  });
  return observations;
}
function memory() {
  const blobs = new Map<string, string>();
  return { blobs, get: (sha: string) => blobs.get(sha), put: (text: string) => { const sha = createHash('sha256').update(text).digest('hex'); blobs.set(sha, text); return { sha, bytes: Buffer.byteLength(text) }; } };
}

describe('compaction and context evidence', () => {
  it('uses captured Claude pre/post/duration, joins only exact native summary refs and preserves source parts', () => {
    const rows = [
      { type: 'system', subtype: 'compact_boundary', uuid: 'boundary', timestamp: timestamp(1), compactMetadata: { trigger: 'manual', preTokens: 90000, postTokens: 7000, durationMs: 4500 } },
      { type: 'user', uuid: 'summary', parentUuid: 'boundary', isCompactSummary: true, timestamp: timestamp(2), message: { content: 'Synthetic retained summary' } },
      { type: 'user', uuid: 'unlinked', parentUuid: 'not-boundary', isCompactSummary: true, timestamp: timestamp(3), message: { content: 'Synthetic unlinked summary' } },
    ];
    const observations = captured(claudeAdapter, rows), io = memory();
    expect(observations.filter(o => o.kind === 'compaction').map(o => o.source.part)).toEqual([0, 1, 0, 1, 0, 1]);
    const p = reduce('r', observations, io, options);
    expect(p.compactions).toHaveLength(1);
    expect(p.compactions![0]).toMatchObject({ beforeTokens: 90000, afterTokens: 7000, durationMs: 4500, trigger: 'manual' });
    const linked = p.compactionSummaries!.find(s => s.boundaryId);
    expect(linked?.id).toBe(p.compactions![0]!.summaryId);
    expect(io.get(p.artifacts.find(a => a.id === linked!.artifactId)!.blob!)).toBe('Synthetic retained summary');
    expect(p.compactionSummaries!.filter(s => !s.boundaryId)).toHaveLength(1);
    expect(p.timeline.filter(t => t.type === 'gap' && t.reason === 'compaction')).toHaveLength(1);
    expect(p.passages.filter(ps => ps.compactionSummaryIds?.length)).toHaveLength(1);
  });

  it('enriches legacy marker records without rewriting observations or adding duplicate boundaries', () => {
    const observations = captured(claudeAdapter, [{ type: 'system', uuid: 'b', subtype: 'compact_boundary', timestamp: timestamp(1), compactMetadata: { preTokens: 70000, postTokens: 6000, trigger: 'auto', durationMs: 1000 } }]);
    const legacy = observations.filter(o => o.source.part === 0), io = memory();
    const old = reduce('r', legacy, io, options);
    const enriched = reduce('r', [...legacy, ...observations.filter(o => o.source.part === 1).map((o, i) => ({ ...o, receivedSequence: 100 + i }))], io, options);
    expect(enriched.timeline).toEqual(old.timeline);
    expect(enriched.compactions).toHaveLength(1);
    expect(enriched.compactions![0]).toMatchObject({ id: old.compactions![0]!.id, beforeTokens: 70000, afterTokens: 6000 });
    expect(enriched.compactions![0]!.observationIds).toContain(legacy[0]!.id);
  });

  it('keeps Codex neighboring request readings distinct from direct compaction metrics and never retains ciphertext', () => {
    const observations = captured(codexAdapter, [user(0), usage(1, 80000), { timestamp: timestamp(2), type: 'compacted', payload: { message: '', replacement_history: [{ type: 'compaction', encrypted_content: 'synthetic-ciphertext-do-not-retain' }] } }, usage(3, 9000), user(4)]);
    expect(JSON.stringify(observations)).not.toContain('synthetic-ciphertext-do-not-retain');
    const p = reduce('r', observations, memory(), options), c = p.compactions![0]!;
    expect(c.beforeTokens).toBeUndefined(); expect(c.afterTokens).toBeUndefined(); expect(c.durationMs).toBeUndefined(); expect(c.trigger).toBeUndefined();
    expect(p.context!.readings.find(r => r.id === c.priorReadingId)?.input).toEqual({ tokens: 80000, basis: 'captured-request-input' });
    expect(p.context!.readings.find(r => r.id === c.nextReadingId)?.input.tokens).toBe(9000);
    expect(p.compactionSummaries![0]).toMatchObject({ availability: 'encrypted', boundaryId: c.id });
    expect(p.context!.latest!.window).toBe(100000);
    expect(p.timeline.filter(t => t.type === 'gap')).toHaveLength(1);
    const atBoundary = asOfProjection(p, c.step + 1);
    expect(atBoundary.compactions![0]!.nextReadingId).toBeUndefined();
    expect(atBoundary.context!.latest!.input.tokens).toBe(80000);
    expect(asOfProjection(p, c.step).compactions).toHaveLength(0);
    expect(compose(p, { step: c.step }).passages.some(ps => ps.compactionIds?.length)).toBe(false);
    expect(compose(p, { step: c.step + 1 }).passages.some(ps => ps.compactionIds?.length)).toBe(true);
  });

  it('does not leak later summary artifacts or evidence through a past cursor', () => {
    const p = reduce('r', captured(claudeAdapter, [
      { type: 'system', uuid: 'b', subtype: 'compact_boundary', timestamp: timestamp(1), compactMetadata: { trigger: 'auto' } },
      { type: 'user', uuid: 's', parentUuid: 'b', isCompactSummary: true, timestamp: timestamp(2), message: { content: 'Synthetic future summary' } },
      { type: 'user', uuid: 'u', timestamp: timestamp(3), message: { content: 'Synthetic next prompt' } },
    ]), memory(), options);
    const beforeSummary = asOfProjection(p, p.compactions![0]!.step + 1);
    expect(beforeSummary.compactions![0]!.summaryId).toBeUndefined();
    expect(beforeSummary.compactionSummaries).toHaveLength(0);
    expect(beforeSummary.artifacts).toHaveLength(0);
    expect(JSON.stringify(beforeSummary)).not.toContain('Synthetic future summary');
  });

  it('leaves missing numbers absent and derives Claude request input only from all recorded input buckets', () => {
    const observations = captured(claudeAdapter, [
      { type: 'assistant', uuid: 'a', timestamp: timestamp(0), message: { id: 'm', usage: { input_tokens: 7, cache_read_input_tokens: 20, cache_creation_input_tokens: 30, output_tokens: 600 }, content: [] } },
      { type: 'system', uuid: 'b', subtype: 'compact_boundary', timestamp: timestamp(1), compactMetadata: { preTokens: -4, postTokens: 2.5, durationMs: -1 } },
    ]);
    const p = reduce('r', observations, memory(), options);
    expect(p.context!.latest).toMatchObject({ input: { tokens: 57, basis: 'derived-request-input' } });
    expect(p.context!.latest!.window).toBeUndefined();
    expect(p.compactions![0]!.beforeTokens).toBeUndefined(); expect(p.compactions![0]!.afterTokens).toBeUndefined(); expect(p.compactions![0]!.durationMs).toBeUndefined();
  });

  it('keeps context empty for cumulative-only usage and never combines agent windows', () => {
    const observations = captured(codexAdapter, [user(0), usage(1, 1000)]), io = memory();
    expect(reduce('r', observations.filter(o => (o.payload as { cumulative?: boolean }).cumulative !== false), io, options).context).toBeUndefined();
    const other = observations.filter(o => o.kind === 'usage').map(o => ({ ...o, id: `other-${o.id}`, recordingId: 'other' }));
    const p = reduce('combined', [...observations, ...other], io, options);
    expect(p.context!.latest).toBeUndefined(); expect(new Set(p.context!.readings.map(r => r.agentId)).size).toBe(2);
  });


  it('removes future unlinked summary references from historical passage metadata', () => {
    const p = reduce('r', captured(claudeAdapter, [
      { type: 'system', uuid: 'b', subtype: 'compact_boundary', timestamp: timestamp(0) },
      { type: 'user', uuid: 's', parentUuid: 'unknown', isCompactSummary: true, timestamp: timestamp(1), message: { content: 'Synthetic unlinked future summary' } },
      { type: 'user', uuid: 'u', timestamp: timestamp(2), message: { content: 'Synthetic following prompt' } },
    ]), memory(), options);
    const past = asOfProjection(p, p.compactions![0]!.step + 1);
    expect(past.passages.flatMap(ps => ps.compactionSummaryIds ?? [])).toEqual([]);
    expect(past.compactionSummaries).toEqual([]);
    expect(past.artifacts).toEqual([]);
  });

  it('keeps same-timestamp receipts behind the next timeline item and never borrows a missing prior reading', () => {
    const rows = [{ type: 'compacted', timestamp: timestamp(0), payload: { message: '' } }, usage(0, 5000), user(0), usage(0, 6000), user(1)];
    const p = reduce('r', captured(codexAdapter, rows), memory(), options), c = p.compactions![0]!;
    expect(c.priorReadingId).toBeUndefined();
    expect(asOfProjection(p, c.step + 1).context).toBeUndefined();
    const after = asOfProjection(p, c.step + 2);
    expect(after.context!.latest!.input.tokens).toBe(5000);
    expect(after.compactions![0]!.nextReadingId).toBe(after.context!.latest!.id);
    expect(asOfProjection(p, p.timeline.length).context!.latest!.input.tokens).toBe(6000);
  });

  it('incremental append has the same context evidence as a cold reduction', () => {
    const observations = captured(codexAdapter, [user(0), usage(1, 80000), { type: 'compacted', timestamp: timestamp(2), payload: { message: 'Synthetic captured Codex summary' } }, usage(3, 5000), user(4)]), io = memory();
    const reducer = createReducer('r', observations.slice(0, 3), io, { ...options, ordered: true });
    reducer.append(observations.slice(3));
    const warm = reducer.snapshot(), cold = reduce('r', observations, io, options);
    expect(warm.context).toEqual(cold.context); expect(warm.compactions).toEqual(cold.compactions); expect(warm.compactionSummaries).toEqual(cold.compactionSummaries);
  });
});
