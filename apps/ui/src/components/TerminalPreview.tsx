import { useState } from 'react';
import { Output } from './common.tsx';
import { useApp } from '../state.ts';

/** Fold only captured lines. Full output remains in the paged operation reader. */
export function TerminalPreview({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const set = useApp((s) => s.set);
  const lines = text.replace(/\n$/, '').split('\n');
  if (lines.length <= 8 || open) return <div className="terminal-preview"><Output text={text} />{lines.length > 8 && <button className="material-more" onClick={(e) => { e.stopPropagation(); setOpen(false); set({ follow: false }); }}>Fold captured preview</button>}</div>;
  return <div className="terminal-preview">
    <Output text={lines.slice(0, 3).join('\n')} />
    <button className="terminal-fold" onClick={(e) => { e.stopPropagation(); setOpen(true); set({ follow: false }); }}>{lines.length - 6} captured lines between · show preview</button>
    <Output text={lines.slice(-3).join('\n')} />
  </div>;
}
