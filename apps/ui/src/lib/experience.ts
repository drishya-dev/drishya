import { useSyncExternalStore } from 'react';
export type Experience = 'canvas' | 'classic' | 'studio' | 'legacy';
const key = 'drishya-experience-v4';
const query = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('experience');
let current: Experience = query === 'canvas' || query === 'classic' || query === 'studio' || query === 'legacy' ? query : query === 'modern' || query === 'fresh' ? 'classic' : 'canvas';
if (!query) { try { const version = localStorage.getItem('drishya-ui-version'); const saved = version === 'modern' || version === 'fresh' ? 'classic' : version === 'canvas' || version === 'classic' ? version : localStorage.getItem(key); if (saved === 'canvas' || saved === 'classic' || saved === 'studio' || saved === 'legacy') current = saved; } catch { /* Private browsing still has a working default. */ } }
const listeners = new Set<() => void>();
export function setExperience(value: Experience) { current = value; try { localStorage.setItem(key, value); } catch { /* Session-only choice. */ } if (typeof document !== 'undefined') document.documentElement.dataset.experience = value; for (const listener of listeners) listener(); }
export function useExperience() { return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => current, () => 'canvas' as const); }
if (typeof document !== 'undefined') document.documentElement.dataset.experience = current;
