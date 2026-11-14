import { useSyncExternalStore } from 'react';

/**
 * UI-1: the header's navigation cluster has a slot that the Workspace and Git graph controls render into
 * (a portal) on desktop widths. The controls' owner stays mounted in the workspace bar, so a dialog they opened keeps
 * its state when the window crosses the phone breakpoint.
 */
let slot: HTMLElement | null = null;
const listeners = new Set<() => void>();
export function registerHeaderSlot(element: HTMLElement | null) {
  if (slot === element) return;
  slot = element;
  for (const notify of listeners) notify();
}
export function useHeaderSlot(): HTMLElement | null {
  return useSyncExternalStore((notify) => { listeners.add(notify); return () => { listeners.delete(notify); }; }, () => slot, () => null);
}
