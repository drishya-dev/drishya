import { describe, expect, it } from 'vitest';
import { useApp } from '../src/state.ts';
import { bundleSource } from '../src/api.ts';
import bundle from '../public/demo/bundle.json';
import type { ReplayBundle } from '@drishya/contracts';

// BUG-7: a live refresh that starts while a session is still opening must not discard the
// open's result, or the returning session loses the reader it had open.
describe('session open and live refresh', () => {
  it('keeps deliberate navigation made while a saved session is opening', async () => {
    const base = bundleSource(bundle as unknown as ReplayBundle);
    let gate: Promise<void> | undefined, release = () => {};
    const source = { ...base, recordings: async () => { if (gate) await gate; return base.recordings(); } };
    useApp.setState({ source });
    const id = bundle.recording.id;
    await useApp.getState().openRecording(id);
    useApp.getState().set({ explore: false, currentFile: 'src/cart/total.ts' });
    await useApp.getState().openRecording('detour');
    gate = new Promise(resolve => { release = resolve; });
    const opening = useApp.getState().openRecording(id);
    useApp.getState().set({ explore: true, currentFile: undefined });
    release();
    await opening;
    expect(useApp.getState().explore).toBe(true);
    expect(useApp.getState().currentFile).toBeUndefined();
  });

  it('restores the saved reading location when a refresh arrives mid-open', async () => {
    const base = bundleSource(bundle as unknown as ReplayBundle);
    let gate: Promise<void> | undefined, release = () => {};
    const source = { ...base, recordings: async () => { if (gate) await gate; return base.recordings(); } };
    useApp.setState({ source });
    const id = bundle.recording.id;
    await useApp.getState().openRecording(id);
    useApp.setState({ currentFile: 'src/cart/total.ts', follow: false });
    await useApp.getState().openRecording('detour');
    gate = new Promise(resolve => { release = resolve; });
    const opening = useApp.getState().openRecording(id);
    const refresh = useApp.getState().reloadProjection();
    release();
    await Promise.all([opening, refresh]);
    expect(useApp.getState().recordingId).toBe(id);
    expect(useApp.getState().projection).toBeDefined();
    expect(useApp.getState().currentFile).toBe('src/cart/total.ts');
  });
});
