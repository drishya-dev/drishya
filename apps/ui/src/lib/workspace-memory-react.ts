import { useLayoutEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { useApp } from '../state.ts';
import { workspaceMemory } from './workspace-memory.ts';

export function useWorkspaceMemory(scope?:string) {
  const source = useApp(s => s.source), id = useApp(s => s.recordingId);
  const mode = useApp(s => s.mode);
  // Replay scope must never reuse a later reading location or retained evidence.
  return useMemo(() => source && (scope || id) && (scope || mode === 'history') ? workspaceMemory(source).session(scope ?? id!) : new Map<string, unknown>(), [source, id, mode,scope]);
}

export function useWorkspaceState<T>(key: string, initial: T | (() => T),scope?:string): [T, Dispatch<SetStateAction<T>>] {
  const memory = useWorkspaceMemory(scope);
  const read = () => memory.has(key) ? memory.get(key) as T : typeof initial === 'function' ? (initial as () => T)() : initial;
  const [state, setState] = useState(() => ({ memory, value: read() }));
  const value = state.memory === memory ? state.value : read();
  if (state.memory !== memory) setState({ memory, value });
  const setValue: Dispatch<SetStateAction<T>> = update => setState(previous => ({ memory, value: typeof update === 'function' ? (update as (value: T) => T)(previous.memory === memory ? previous.value : read()) : update }));
  useLayoutEffect(() => { memory.set(key, value); }, [memory, key, value]);
  return [value, setValue];
}
