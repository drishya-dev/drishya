import { useLayoutEffect } from 'react';
import { HISTORY_MODE_KEY, HISTORY_MODE_SCOPE, useApp, type HistoryMode } from '../state.ts';
import { workspaceMemory } from '../lib/workspace-memory.ts';

const MODES: { mode: HistoryMode; label: string; title: string }[] = [
  { mode: 'work', label: 'Work', title: 'Work: every tool card, as the agent did it' },
  { mode: 'conversation', label: 'Conversation', title: 'Conversation: what you asked and what the agent said, each run of tool cards folded to one line (v)' },
];

/**
 * UI-41: the two ways to read History, in the header's view cluster. The choice is a way of reading, like the layout, so it is
 * remembered for this window (not for one session) and every session opens the way it was left.
 */
export function HistoryModeSwitch() {
  const mode = useApp((s) => s.historyMode);
  const source = useApp((s) => s.source);
  const setMode = useApp((s) => s.setHistoryMode);
  useLayoutEffect(() => {
    if (!source) return;
    const saved = workspaceMemory(source).session(HISTORY_MODE_SCOPE).get(HISTORY_MODE_KEY);
    if ((saved === 'work' || saved === 'conversation') && saved !== useApp.getState().historyMode) useApp.setState({ historyMode: saved });
  }, [source]);
  return <div className="history-mode" role="group" aria-label="Read the session as">
    {MODES.map((item) => <button key={item.mode} type="button" className="history-mode-option" aria-pressed={mode === item.mode} title={item.title} onClick={() => mode !== item.mode && setMode(item.mode)}>{item.label}</button>)}
  </div>;
}
