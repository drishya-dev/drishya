import { useSyncExternalStore } from 'react';
export type Experience = 'classic' | 'studio' | 'legacy';
const key = 'drishya-experience-v3';
const query = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('experience');
let current: Experience = query === 'classic' || query === 'studio' || query === 'legacy' ? query : 'classic';
if (!query) { try { const saved = localStorage.getItem(key); if (saved === 'classic' || saved === 'studio' || saved === 'legacy') current = saved; } catch { /* Private browsing still has a working default. */ } }
const listeners = new Set<() => void>();
export function setExperience(value: Experience) { current = value; try { localStorage.setItem(key, value); } catch { /* Session-only choice. */ } if (typeof document !== 'undefined') document.documentElement.dataset.experience = value; for (const listener of listeners) listener(); }
export function useExperience() { return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => current, () => 'classic' as const); }
if (typeof document !== 'undefined') document.documentElement.dataset.experience = current;
