import { describe, expect, it } from 'vitest';
import { WorkspaceMemory, workspaceMemory } from '../src/lib/workspace-memory.ts';
import { useApp } from '../src/state.ts';
import { bundleSource } from '../src/api.ts';
import bundle from '../public/demo/bundle.json';
import type { ReplayBundle } from '@drishya/contracts';
import { EvidenceTrail } from '../src/lib/evidence-navigation.ts';

describe('bounded workspace navigation memory', () => {
  it('restores validated reader state and folder sets without source bodies or executable state',()=>{const memory=new WorkspaceMemory();const session=memory.session('r'),trail=new EvidenceTrail();trail.visit({currentFile:'file.ts',explore:false,inspectorTab:'detail',inspectorWidth:760}).memory.set('disk/start',200);session.set('evidence/trail',trail);session.set('folders/open',new Set(['src']));session.set('source/body','NEVER_PERSIST');session.set('location',{currentFile:'file.ts',playing:true,approved:true});const snapshot=memory.snapshot('r');expect(JSON.stringify(snapshot)).not.toContain('NEVER_PERSIST');expect(JSON.stringify(snapshot)).not.toContain('playing');expect(JSON.stringify(snapshot)).not.toContain('approved');const restored=new WorkspaceMemory();restored.restore(snapshot);expect(restored.session('r').get('folders/open')).toEqual(new Set(['src']));expect((restored.session('r').get('evidence/trail') as EvidenceTrail).current!.memory.get('disk/start')).toBe(200);expect(()=>restored.restore({version:1,sessions:[{id:'r',entries:[['evidence/trail',{cursor:0}]]}]})).not.toThrow();});
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

it('does not promote a stale session version when acknowledging a different saved session',()=>{
  const memory=new WorkspaceMemory();
  memory.restore({version:1,sessions:[{id:'x',revision:1,entries:[['history/top',10]]},{id:'y',revision:1,entries:[['history/top',20]]}]});
  memory.versions({x:2,y:2},['y']);
  expect(memory.snapshot().sessions.find(s=>s.id==='x')!.revision).toBe(1);
  expect(memory.snapshot().sessions.find(s=>s.id==='y')!.revision).toBe(2);
});
