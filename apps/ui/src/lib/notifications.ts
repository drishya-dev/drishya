import { create } from 'zustand';
import type { NowTone } from './now-state.ts';

/** LIVE-3: opt-in browser notifications. Nothing is requested until the reader turns this on in Settings. */
export type NotifyKind = 'asking' | 'finished';

/** What a change of the "now" line means for the reader: new question or approval, or a turn that just ended. */
export function notifyKind(previous: NowTone | undefined, next: NowTone | undefined): NotifyKind | undefined {
  if (next === 'asking' && previous !== 'asking') return 'asking';
  if (next === 'replied' && (previous === 'running' || previous === 'working')) return 'finished';
  return undefined;
}

/** Session title and state only, never captured content. */
export function notification(kind: NotifyKind, ctx: { harness: string; title?: string; workspace?: string }) {
  const name = ctx.title?.trim() || ctx.workspace || 'Drishya';
  return { title: name.length > 80 ? `${name.slice(0, 79)}…` : name, body: kind === 'asking' ? `${ctx.harness} is waiting for your answer` : `${ctx.harness} finished its turn` };
}

const KEY = 'drishya.notify';
const stored = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
const permission = (): NotificationPermission | 'unsupported' => typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;

export const useNotify = create<{ enabled: boolean; permission: NotificationPermission | 'unsupported' }>(() => ({ enabled: stored() && permission() === 'granted', permission: permission() }));

/** Asks for permission only here, from an explicit toggle. */
export async function setNotifications(on: boolean) {
  const save = (enabled: boolean) => { try { localStorage.setItem(KEY, enabled ? '1' : '0'); } catch { /* Optional local preference. */ } };
  if (!on) { save(false); useNotify.setState({ enabled: false, permission: permission() }); return; }
  if (typeof Notification === 'undefined') { useNotify.setState({ enabled: false, permission: 'unsupported' }); return; }
  const result = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  save(result === 'granted');
  useNotify.setState({ enabled: result === 'granted', permission: result });
}
