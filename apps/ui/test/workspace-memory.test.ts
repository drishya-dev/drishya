import { describe, expect, it } from 'vitest';
import { WorkspaceMemory, workspaceMemory } from '../src/lib/workspace-memory.ts';
import { useApp } from '../src/state.ts';
import { bundleSource } from '../src/api.ts';
import bundle from '../public/demo/bundle.json';
import type { ReplayBundle } from '@drishya/contracts';

describe('bounded workspace navigation memory', () => {
  it('isolates sources, evicts old sessions and caps location slots', () => {
    const memory = new WorkspaceMemory(), first = memory.session('first');
    for (let n = 0; n < 100; n++) first.set(`slot${n}`, n);
    expect(first.size).toBe(64);
    expect(first.has('slot0')).toBe(false);
    for (let n = 0; n < 8; n++) memory.session(String(n));
    expect(memory.session('first')).not.toBe(first);
    expect(workspaceMemory({})).not.toBe(workspaceMemory({}));
  });
  it('restores selected evidence after a session detour and discards it at replay boundaries', async () => {
    const source = bundleSource(bundle as unknown as ReplayBundle);
    useApp.setState({ source });
    const id = bundle.recording.id;
    await useApp.getState().openRecording(id);
    useApp.setState({ currentFile: 'src/cart/total.ts', follow: false, explore: true });
    await useApp.getState().openRecording('detour');
    await useApp.getState().openRecording(id);
    expect(useApp.getState()).toMatchObject({ currentFile: 'src/cart/total.ts', follow: false, explore: true });
    await useApp.getState().openRecording(id, { at: 1 });
    expect(useApp.getState()).toMatchObject({ currentFile: undefined, mode: 'replay', step: 1 });
    expect(workspaceMemory(source).session(id).has('location')).toBe(false);
  });
});
