import { useSyncExternalStore } from 'react';
import { selectedUIVersion } from './ui-version.ts';
export type Experience = 'canvas' | 'classic' | 'studio' | 'legacy';
const key = 'drishya-experience-v4';
const selected = typeof location === 'undefined' ? 'modern' : selectedUIVersion();
let current: Experience = selected === 'canvas' || selected === 'studio' || selected === 'legacy' ? selected : 'classic';
const listeners = new Set<() => void>();
export function setExperience(value: Experience) { current = value; try { localStorage.setItem(key, value); } catch { /* Session-only choice. */ } if (typeof document !== 'undefined') document.documentElement.dataset.experience = value; for (const listener of listeners) listener(); }
export function useExperience() { return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => current, () => 'classic' as const); }
if (typeof document !== 'undefined') document.documentElement.dataset.experience = current;
