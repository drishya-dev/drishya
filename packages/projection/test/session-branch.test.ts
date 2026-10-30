import { describe, expect, it } from 'vitest';
import { asOfProjection, type Observation } from '@drishya/contracts';
import { seal } from '@drishya/capture-core';
import { codexAdapter } from '../../adapter-codex/src/index.ts';
import { claudeAdapter } from '../../adapter-claude/src/index.ts';
import { createReducer, reduce } from '../src/reduce.ts';

const io = { get: () => undefined, put: (text: string) => ({ sha: 'synthetic', bytes: text.length }) };
const options = { adapters: { codex: codexAdapter.descriptor, 'claude-code': claudeAdapter.descriptor } };
const root = 'C:/synthetic/repository';
function meta(sequence: number, payload: Record<string, unknown>, overrides: Partial<Observation> = {}): Observation {
  return { ...seal({ raw: { part: 0, recordId: `record-${sequence}`, agentId: 'agent:main', kind: 'session.meta', payload }, recordingId: 'r', sourceId: 's', generation: 0, byteOffset: sequence, adapter: codexAdapter.descriptor, observedAt: '2026-10-30T00:00:00Z' }), receivedSequence: sequence, ...overrides };
}
const project = (observations: Observation[], id = 'r') => reduce(id, observations, io, options);

describe('captured session branch identity (UI-1b)', () => {
  it('keeps the last eligible exact sanitized text and its captured root/provenance', () => {
    const first = meta(0, { cwd: root, branch: 'earlier' });
    const last = meta(1, { cwd: root, branch: ' last captured ' });
    expect(project([first, last]).recordedBranch).toEqual({ name: ' last captured ', workspaceRoot: root, provenance: { kind: 'captured', observationIds: [last.id] } });
  });

  it('does not erase a captured value with absent, empty or malformed later metadata', () => {
    const first = meta(0, { cwd: root, branch: 'captured' });
    const later = [{ cwd: root }, { cwd: root, branch: '   ' }, { cwd: root, branch: 42 }, { branch: 'unassociated' }].map((p, i) => meta(i + 1, p));
    expect(project([first, ...later]).recordedBranch?.name).toBe('captured');
    expect(project(later).recordedBranch).toBeUndefined();
  });

  it('never takes a companion, another recording, another root or envelope fallback', () => {
    const first = meta(0, { cwd: root, branch: 'primary' });
    const noise = [
      meta(1, { cwd: root, branch: 'companion' }, { agentId: 'agent:child' }),
      meta(2, { cwd: root, branch: 'other-session' }, { recordingId: 'other' }),
      meta(3, { cwd: 'C:/synthetic/another', branch: 'another-root' }),
      meta(4, { cwd: root }, { branchRef: 'envelope-only' }),
    ];
    expect(project([first, ...noise]).recordedBranch?.name).toBe('primary');
    expect(project([first, ...noise], 'r+other').recordedBranch).toBeUndefined();
    expect(project([meta(0, { cwd: root }, { branchRef: 'envelope-only' })]).recordedBranch).toBeUndefined();
  });

  it('uses the existing Windows root normalization without inferring a different location', () => {
    const first = meta(0, { cwd: root, branch: 'initial' });
    expect(project([first, meta(1, { cwd: 'c:\\SYNTHETIC\\REPOSITORY\\', branch: 'same-root' })]).recordedBranch?.name).toBe('same-root');
    expect(project([first, meta(1, { cwd: `${root}/nested`, branch: 'subdirectory' })]).recordedBranch?.name).toBe('initial');
  });

  it('is identical through incremental appends and isolates returned snapshots', () => {
    const observations = [meta(0, { cwd: root, branch: 'first' }), meta(1, { cwd: root, branch: 'second' })];
    const reducer = createReducer('r', observations.slice(0, 1), io, { ...options, ordered: true });
    const before = reducer.snapshot(false);
    before.recordedBranch!.name = 'external-mutation';
    before.recordedBranch!.provenance.observationIds.push('external-id');
    expect(reducer.snapshot(false).recordedBranch?.name).toBe('first');
    reducer.append(observations.slice(1));
    expect(reducer.snapshot(false).recordedBranch).toEqual(project(observations).recordedBranch);
  });

  it('suppresses whole-session branch metadata at partial historical steps and tolerates old projections', () => {
    const branch = meta(0, { cwd: root, branch: 'captured' });
    const prompt = meta(1, { text: 'synthetic prompt' }, { kind: 'message.user' });
    const projection = project([branch, prompt]);
    expect(projection.timeline.length).toBeGreaterThan(0);
    expect(asOfProjection(projection, 0).recordedBranch).toBeUndefined();
    const { recordedBranch: omitted, ...old } = projection;
    expect(omitted).toBeDefined();
    expect(asOfProjection(old, 0).recordedBranch).toBeUndefined();
  });

  it('projects only privacy-sealed branch/root strings', () => {
    const secret = 'AKIA0000000000000000';
    const observation = meta(0, { cwd: `C:/synthetic/${secret}`, branch: `feature/${secret}` });
    const projection = project([observation]);
    expect(projection.recordedBranch).toBeDefined();
    expect(JSON.stringify(projection.recordedBranch)).not.toContain(secret);
    expect(observation.redactions.length).toBeGreaterThan(0);
  });

  for (const adapter of [codexAdapter, claudeAdapter]) it(`retains the actual ${adapter.descriptor.harness} adapter's captured metadata`, () => {
    const context = { recordingId: 'r', sourceId: 's', sourcePath: 'synthetic' };
    const parser = adapter.createParser(context);
    const record = adapter === codexAdapter
      ? { type: 'session_meta', payload: { cwd: root, git: { branch: 'fixture-branch' } } }
      : { type: 'user', uuid: 'synthetic-user', cwd: root, gitBranch: 'fixture-branch', message: { role: 'user', content: 'synthetic prompt' } };
    const observations = parser.parse(record).map((raw, receivedSequence) => ({ ...seal({ raw, ...context, adapter: adapter.descriptor, generation: 0, byteOffset: 0, observedAt: '2026-10-30T00:00:00Z' }), receivedSequence }));
    expect(project(observations).recordedBranch?.name).toBe('fixture-branch');
  });
});
