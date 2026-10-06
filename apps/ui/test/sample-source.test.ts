import { readFileSync } from 'node:fs';
import type { ReplayBundle } from '@drishya/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { growingSample, sampleProjection } from '../src/lib/sample-source.ts';

const bundle = JSON.parse(readFileSync(new URL('../public/demo/bundle.json', import.meta.url), 'utf8')) as ReplayBundle;
afterEach(() => vi.useRealTimers());

describe('synthetic growing evidence', () => {
  it('uses applied agent identities across combined harness clocks', () => {
    const codex = bundle.projection.agents.find((agent) => agent.harness === 'codex')!;
    const first = bundle.projection.timeline.findIndex((item) => item.agentId === codex.id);
    const view = sampleProjection(bundle.projection, first + 1);
    expect(view.agents.map((agent) => agent.id)).toContain(codex.id);
    expect(view.agents.find((agent) => agent.id === codex.id)?.stoppedSequence).toBeUndefined();
  });
  it('publishes requests without exposing results, future search hits or stopped agent state', async () => {
    vi.useFakeTimers();
    const source = growingSample(bundle, 100);
    const target = bundle.projection.operations.find((op) => op.detail.kind === 'read')!;
    const index = bundle.projection.timeline.findIndex((item) => item.type === 'op-start' && item.operationId === target.id);
    const stop = source.subscribe(() => undefined);
    await vi.advanceTimersByTimeAsync(index * 100);
    const view = await source.projection(bundle.recording.id);
    expect(view.timeline).toHaveLength(index + 1);
    const pending = view.operations.find((op) => op.id === target.id)!;
    expect(pending.status).toBe('running');
    expect(pending.detail).not.toHaveProperty('excerptArtifactId');
    if (target.detail.kind !== 'read') throw new Error('read fixture missing');
    await expect(source.artifact(bundle.recording.id, target.detail.excerptArtifactId!)).rejects.toThrow('has not arrived');
    expect(await source.search(bundle.recording.id, 'if (!amount)')).toEqual([]);
    expect(view.agents.every((agent) => agent.stoppedSequence === undefined || agent.stoppedSequence <= view.lastSequence)).toBe(true);
    stop();
  });
  it('continues publishing independently of readers, then stops timers on unsubscribe', async () => {
    vi.useFakeTimers();
    const source = growingSample(bundle, 100);
    const change = vi.fn();
    const stop = source.subscribe(change);
    await vi.advanceTimersByTimeAsync(300);
    expect((await source.projection(bundle.recording.id)).timeline).toHaveLength(4);
    expect(change).toHaveBeenCalledTimes(3);
    stop();
    await vi.advanceTimersByTimeAsync(1000);
    expect(change).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('completes explicitly with exact fixture evidence and no repeating publication', async () => {
    vi.useFakeTimers();
    const source = growingSample(bundle, 100);
    const change = vi.fn();
    const stop = source.subscribe(change);
    source.completeSample!();
    const view = await source.projection(bundle.recording.id);
    expect(view.operations).toEqual(bundle.projection.operations);
    expect(view.timeline).toEqual(bundle.projection.timeline);
    expect(view.agents).toEqual(bundle.projection.agents);
    expect((await source.recordings())[0]!.live).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    source.completeSample!();
    expect(change).toHaveBeenCalledTimes(1);
    expect(sampleProjection(bundle.projection, 0).agents).toEqual([]);
    stop();
  });
});
