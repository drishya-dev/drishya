import { createContext, useContext, useLayoutEffect, useMemo, useState, type Dispatch, type SetStateAction, type ReactNode, type RefObject } from 'react';
import { useApp } from '../state.ts';
import { EvidenceTrail, type EvidenceLocation, type EvidenceVisit } from '../lib/evidence-navigation.ts';
import { useWorkspaceMemory } from '../lib/workspace-memory-react.ts';

const NavigationContext = createContext<{ trail: EvidenceTrail; visit: EvidenceVisit } | undefined>(undefined);

export function EvidenceNavigationProvider({ children }: { children: ReactNode }) {
  const source = useApp(s => s.source);
  const id = useApp(s => s.recordingId);
  const mode = useApp(s => s.mode);
  const cutoff = useApp(s => s.mode === 'replay' ? s.step : undefined);
  const filePanel = useApp(s => s.filePanel);
  const filePanelFocus = useApp(s => s.filePanelFocus);
  const filePanelEvidence = useApp(s => s.filePanelEvidence);
  const currentFile = useApp(s => s.currentFile);
  const selectedOp = useApp(s => s.selectedOp);
  const explore = useApp(s => s.explore);
  const inspectorTab = useApp(s => s.inspectorTab);
  const inspectorWidth = useApp(s => s.inspectorWidth);
  const loaded = useApp(s => !!s.projection);
  // Replay movement invalidates retained evidence before rendering. Live capture
  // does not erase the user's independent reading trail.
  const memory = useWorkspaceMemory();
  const trail = useMemo(() => {
    const saved = mode === 'history' ? memory.get('evidence/trail') as EvidenceTrail | undefined : undefined;
    const value = saved ?? new EvidenceTrail();
    if (mode === 'history') memory.set('evidence/trail', value);
    return value;
  }, [memory, source, id, mode, cutoff]);
  const location: EvidenceLocation = { filePanel, filePanelFocus, filePanelEvidence, currentFile, selectedOp, explore, inspectorTab, inspectorWidth };
  if (!loaded) return <>{children}</>;
  const visit = trail.visit(location);
  return <NavigationContext.Provider value={{ trail, visit }}>{children}</NavigationContext.Provider>;
}

export function EvidenceNavigation({ hideEmpty = false }: { hideEmpty?: boolean }) {
  const context = useContext(NavigationContext);
  if (!context) return null;
  if (hideEmpty && !context.trail.canBack && !context.trail.canForward) return null;
  const go = (direction: -1 | 1) => {
    const target = context.trail.move(direction);
    if (!target) return;
    const app = useApp.getState();
    app.select(target.location.selectedOp);
    useApp.setState({ ...target.location, follow: false });
  };
  return <nav className="evidence-navigation" aria-label="Reading history"><button className="btn ghost small" aria-label="Back in reading history" title="Return to the previous evidence and reading position" disabled={!context.trail.canBack} onClick={() => go(-1)}>← Back</button><button className="btn ghost small" aria-label="Forward in reading history" title="Reopen the next evidence and reading position" disabled={!context.trail.canForward} onClick={() => go(1)}>Forward →</button></nav>;
}

/** Bounded controls and at most two selected evidence references per file visit.
 * Do not cache fetched source/disk responses or copy a projection into this trail. */
export function useEvidenceState<T>(key: string, initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const context = useContext(NavigationContext);
  const visit = context?.visit;
  const read = () => visit?.memory.has(key) ? visit.memory.get(key) as T : typeof initial === 'function' ? (initial as () => T)() : initial;
  const [state, setState] = useState(() => ({ visit, key, value: read() }));
  let value = state.value;
  if (state.visit !== visit || state.key !== key) { value = read(); setState({ visit, key, value }); }
  const change: Dispatch<SetStateAction<T>> = update => setState(previous => {
    const base = previous.visit === visit && previous.key === key ? previous.value : read();
    const next = typeof update === 'function' ? (update as (value: T) => T)(base) : update;
    visit?.memory.set(key, next);
    if(visit)window.dispatchEvent(new Event('drishya-location-change'));
    if (visit && visit.memory.size > 64) visit.memory.delete(visit.memory.keys().next().value!);
    return { visit, key, value: next };
  });
  return [value, change];
}

/** Restore actual scroll after bounded async material mounts; never scroll the
 * main history or fake a source range. Each reader supplies a stable slot key. */
export function useEvidenceScroll(ref: RefObject<HTMLElement | null>, key: string, ready: unknown = true) {
  const visit = useContext(NavigationContext)?.visit;
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || !visit || !ready) return;
    const saved = visit.memory.get(`scroll/${key}`) as { top: number; left: number } | undefined;
    let pending = !!saved;
    const restore = () => {
      if (!pending || !saved || root.scrollHeight - root.clientHeight < saved.top || root.scrollWidth - root.clientWidth < saved.left) return;
      pending = false; root.scrollTop = saved.top; root.scrollLeft = saved.left;
    };
    restore();
    const save = () => {
      if (pending) return;
      visit.memory.set(`scroll/${key}`, { top: root.scrollTop, left: root.scrollLeft });
      window.dispatchEvent(new Event('drishya-location-change'));
      if (visit.memory.size > 64) visit.memory.delete(visit.memory.keys().next().value!);
    };
    const interact = () => { pending = false; };
    const keyboard = (event: KeyboardEvent) => { if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) interact(); };
    const observer = new MutationObserver(restore);
    observer.observe(root, { childList: true, subtree: true });
    const resize = new ResizeObserver(restore); resize.observe(root);
    root.addEventListener('scroll', save, { passive: true });
    root.addEventListener('wheel', interact, { passive: true });
    root.addEventListener('pointerdown', interact);
    root.addEventListener('keydown', keyboard);
    return () => { observer.disconnect(); resize.disconnect(); root.removeEventListener('scroll', save); root.removeEventListener('wheel', interact); root.removeEventListener('pointerdown', interact); root.removeEventListener('keydown', keyboard); };
  }, [ref, visit, key, ready]);
}
