import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Projection, ReplayBundle } from '@drishya/contracts';
import { bundleSource } from '../src/api.ts';
import { useApp } from '../src/state.ts';

const bundle = JSON.parse(readFileSync(new URL('../public/demo/bundle.json', import.meta.url), 'utf8')) as ReplayBundle;
const source = bundleSource(bundle);

beforeEach(() => useApp.setState({ source, recordingId: undefined, projection: undefined, mode: 'history', playing: false, follow: true, selectedOp: undefined }));

describe('normal history and optional replay', () => {
  it('opens an imported recording with all captured work visible', async () => {
    await useApp.getState().openRecording(bundle.recording.id);
    expect(useApp.getState().mode).toBe('history');
    expect(useApp.getState().step).toBe(bundle.projection.timeline.length);
    expect(useApp.getState().playing).toBe(false);
  });

  it('extends history without moving the reader back to live', async () => {
    let current: Projection = bundle.projection;
    useApp.setState({ source: { ...source, projection: async () => current } });
    await useApp.getState().openRecording(bundle.recording.id);
    useApp.setState({ follow: false, selectedOp: bundle.projection.operations[0]?.id });
    current = { ...current, timeline: [...current.timeline, current.timeline.at(-1)!] };
    await useApp.getState().reloadProjection();
    expect(useApp.getState()).toMatchObject({ mode: 'history', step: current.timeline.length, follow: false, playing: false, selectedOp: bundle.projection.operations[0]?.id });
  });

  it('enters replay only on deliberate transport navigation and can return to history', async () => {
    await useApp.getState().openRecording(bundle.recording.id);
    useApp.getState().seek(4, { hold: true });
    expect(useApp.getState()).toMatchObject({ mode: 'replay', step: 4, playing: false });
    useApp.getState().showHistory();
    expect(useApp.getState()).toMatchObject({ mode: 'history', step: bundle.projection.timeline.length, playing: false });
  });
});
