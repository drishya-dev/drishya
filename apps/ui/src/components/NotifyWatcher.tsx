import { useEffect, useRef } from 'react';
import { useApp } from '../state.ts';
import { useNow } from '../lib/now-store.ts';
import { notification, notifyKind, useNotify } from '../lib/notifications.ts';

const HARNESS: Record<string, string> = { codex: 'Codex', 'claude-code': 'Claude' };

/** Notifies only while the tab is hidden and only after the reader opted in; renders nothing. */
export function NotifyWatcher() {
  const enabled = useNotify((s) => s.enabled);
  const tone = useNow((s) => s.view?.tone);
  const recording = useApp((s) => s.recording);
  const previous = useRef<typeof tone>(undefined);
  useEffect(() => {
    const before = previous.current;
    previous.current = tone;
    const kind = notifyKind(before, tone);
    if (!kind || !enabled || !document.hidden || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const text = notification(kind, { harness: HARNESS[recording?.harness ?? ''] ?? 'The agent', title: recording?.title, workspace: recording?.workspaceRoot?.replaceAll('\\', '/').split('/').filter(Boolean).at(-1) });
    const shown = new Notification(text.title, { body: text.body, tag: `drishya-${recording?.id ?? 'session'}`, silent: true });
    shown.onclick = () => { window.focus(); shown.close(); };
  }, [tone]);
  return null;
}
