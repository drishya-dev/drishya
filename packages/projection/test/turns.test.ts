import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Observation } from '@drishya/contracts';
import { asOfProjection } from '@drishya/contracts';
import { seal } from '@drishya/capture-core';
import { codexAdapter } from '../../adapter-codex/src/index.ts';
import { reduce } from '../src/reduce.ts';

function fixture(file: string) {
  const context = { recordingId: 'r', sourceId: 's', sourcePath: 'fixture' }, parser = codexAdapter.createParser(context);
  const records = readFileSync(new URL(`../../../fixtures/synthetic/turns/${file}`, import.meta.url), 'utf8').trim().split('\n');
  let offset = 0;
  const observations: Observation[] = [];
  for (const line of records) {
    for (const raw of parser.parse(JSON.parse(line))) observations.push({ ...seal({ raw, ...context, adapter: codexAdapter.descriptor, generation: 0, byteOffset: offset, observedAt: '2026-10-22T10:00:00Z' }), receivedSequence: observations.length });
    offset += Buffer.byteLength(line) + 1;
  }
  return observations;
}
const io = { get: () => undefined, put: (text: string) => ({ sha: 'synthetic', bytes: text.length }) };
const options = { adapters: { codex: codexAdapter.descriptor } };

describe('recorded turns (DATA-3)', () => {
  const observations = fixture('codex-rollout-turns.jsonl');
  const projection = reduce('r', observations, io, options);

  it('merges start, settings and end into one captured turn each', () => {
    expect(projection.turns?.map(t => t.id)).toEqual(['turn-a', 'turn-b', 'turn-c']);
    expect(projection.turns![0]).toMatchObject({
      basis: 'captured', trigger: 'composer', outcome: 'completed', durationMs: 8000, timeToFirstTokenMs: 1200,
      startedAt: '2026-10-22T09:00:01.000Z', completedAt: '2026-10-22T09:00:09.000Z',
      settings: { model: 'synthetic-model', effort: 'medium', approvalPolicy: 'never', sandbox: 'read-only', permissionProfile: 'managed', collaborationMode: 'default', approvalsReviewer: 'user', personality: 'friendly' },
    });
    expect(projection.turns![0]!.startSequence).toBeLessThan(projection.turns![0]!.endSequence!);
  });

  it('keeps lineage, aborts and a recorded error, and no time the harness did not record', () => {
    const [, b, c] = projection.turns!;
    expect(b).toMatchObject({ trigger: 'resume_interrupted_task', parentTurnId: 'turn-a', settings: { effort: 'high', sandbox: 'danger-full-access', permissionProfile: 'disabled' } });
    expect(b!.timeToFirstTokenMs).toBeUndefined();
    expect(b!.error).toMatchObject({ code: 'other' });
    expect(c).toMatchObject({ trigger: 'edit_user_message', outcome: 'aborted', reason: 'interrupted', durationMs: 3000 });
  });

  it('redacts the error text and stores policy names, never file-system entries or instructions', () => {
    const json = JSON.stringify(observations.filter(o => o.kind === 'turn.detail'));
    expect(json).not.toContain('AKIA0000000000000000');
    expect(json).not.toContain('private-entry');
    expect(json).not.toContain('synthetic instructions text');
    expect(observations.filter(o => o.kind === 'turn.detail').some(o => o.redactions.length)).toBe(true);
  });

  it('leaves every earlier observation id and payload as it was, and counts the same turns', () => {
    const detail = observations.filter(o => o.kind === 'turn.detail');
    expect(detail.every(o => o.source.part === 1)).toBe(true);
    expect(new Set(observations.map(o => o.id)).size).toBe(observations.length);
    expect(observations.filter(o => o.kind === 'turn.start')).toHaveLength(3);
    const old = observations.filter(o => o.kind !== 'turn.detail');
    const oldProjection = reduce('r', old, io, options);
    expect(oldProjection.timeline).toEqual(projection.timeline);
    expect(oldProjection.turns?.map(t => t.id)).toEqual(['turn-a', 'turn-b', 'turn-c']);
    expect(oldProjection.turns![0]!.durationMs).toBeUndefined();
  });

  it('gives the same turns when the details arrive in a later import', () => {
    const old = observations.filter(o => o.kind !== 'turn.detail');
    const enriched = [...old, ...observations.filter(o => o.kind === 'turn.detail').reverse().map((o, index) => ({ ...o, receivedSequence: observations.length + index }))];
    expect(reduce('r', enriched, io, options).turns).toEqual(projection.turns);
  });

  it('sets the agent effort from the latest recorded settings and hides turn facts from earlier steps', () => {
    expect(projection.agents[0]?.effort).toBe('high');
    expect(asOfProjection(projection, 0).turns).toBeUndefined();
  });
});

describe('recorded thread lineage (DATA-3)', () => {
  it('keeps where a thread began and how deep a sub-agent sits, without inventing a role', () => {
    const projection = reduce('r', fixture('codex-subagent-meta.jsonl'), io, options);
    expect(projection.agents[0]).toMatchObject({ nickname: 'Worker', address: '/root/worker', threadSource: 'subagent', spawnDepth: 1 });
    expect(projection.agents[0]!.role).toBeUndefined();
    const root = reduce('r', fixture('codex-rollout-turns.jsonl'), io, options);
    expect(root.agents[0]).toMatchObject({ threadSource: 'user', startedBy: 'exec' });
    expect(root.turns?.length).toBe(3);
  });
  it('reports no turns for a recording with none', () => {
    expect(reduce('r', fixture('codex-subagent-meta.jsonl'), io, options).turns).toBeUndefined();
  });
});
