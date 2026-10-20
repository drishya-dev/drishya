import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Observation } from '@drishya/contracts';
import { seal } from '@drishya/capture-core';
import { codexAdapter } from '../../adapter-codex/src/index.ts';
import { claudeAdapter } from '../../adapter-claude/src/index.ts';
import { reduce } from '../src/reduce.ts';
import { asOfProjection } from '@drishya/contracts';

function fixture(adapter: typeof codexAdapter, file: string) {
  const context = { recordingId: 'r', sourceId: 's', sourcePath: 'fixture' }, parser = adapter.createParser(context);
  const records = readFileSync(new URL(`../../../fixtures/synthetic/usage/${file}`, import.meta.url), 'utf8').trim().split('\n');
  let offset = 0;
  const observations: Observation[] = [];
  for (const line of records) {
    for (const raw of parser.parse(JSON.parse(line))) observations.push({ ...seal({ raw, ...context, adapter: adapter.descriptor, generation: 0, byteOffset: offset, observedAt: '2026-10-20T10:00:00Z' }), receivedSequence: observations.length });
    offset += Buffer.byteLength(line) + 1;
  }
  return observations;
}
const io = { get: () => undefined, put: (text: string) => ({ sha: 'synthetic', bytes: text.length }) };
const options = { adapters: { codex: codexAdapter.descriptor, 'claude-code': claudeAdapter.descriptor } };

describe('recorded usage', () => {
  it('keeps cumulative latest and the last request for each recorded turn without affecting chronology', () => {
    const observations = fixture(codexAdapter, 'codex-rollout-usage.jsonl');
    const projection = reduce('r', observations, io, options);
    expect(projection.usage?.latest).toMatchObject({ cumulative: true, tokens: { total: 29250 } });
    expect(projection.usage?.byTurn['turn-u1']).toMatchObject({ cumulative: false, tokens: { input: 9700, output: 110 } });
    expect(Object.keys(projection.usage!.byTurn)).toEqual(['turn-u1', 'turn-u2']);
    const old = observations.filter(o => o.kind !== 'usage');
    const enriched = [...old, ...observations.filter(o => o.kind === 'usage').map((o, index) => ({ ...o, receivedSequence: observations.length + index }))];
    expect(reduce('r', enriched, io, options).usage).toEqual(projection.usage);
    expect(reduce('r', old, io, options).timeline).toEqual(projection.timeline);
    expect(asOfProjection(projection, 0).usage).toBeUndefined();
    expect(JSON.stringify(projection)).not.toContain('synthetic-limit-id');
  });
  it('keeps the last undated cost receipt and never combines sessions or invents Claude turn identity', () => {
    const observations = fixture(claudeAdapter, 'claude-usage.jsonl');
    const projection = reduce('r', observations, io, options);
    expect(projection.usage?.latest).toMatchObject({ source: 'claude-cost-state', cost: { usd: .0871 }, tokens: { input: 52 } });
    expect(projection.usage?.byTurn).toEqual({});
    expect(reduce('r+other', [...observations, { ...observations[0]!, id: 'other', recordingId: 'other' }], io, options).usage).toBeUndefined();
  });
});
