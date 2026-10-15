import { useState } from 'react';
import { useArtifact } from './common.tsx';
import { ToolOutput } from './ToolOutput.tsx';
import { toolOutputText } from '../lib/tool-output.ts';
import { failurePreview } from '../lib/failure-preview.ts';

/** Fold only captured lines. Full output remains in the paged operation reader. */
export function TerminalPreview({ text, failed = false, artifactId }: { text: string; failed?: boolean; artifactId?: string }) {
  const [open, setOpen] = useState(false);
  const encoded = /\\[rn]/.test(text);
  const complete = useArtifact(encoded ? artifactId : undefined, { scope: 'preview', count: 200 });
  const full = complete.text && !complete.hasMore && toolOutputText(complete.text).decoded ? complete.text : text;
  if (toolOutputText(full).decoded) return <div className="terminal-preview"><ToolOutput text={full} /></div>;
  const lines = text.replace(/\n$/, '').split('\n');
  const selected = failed && !open && lines.length > 8 ? failurePreview(text) : undefined;
  if (selected) return <div className="terminal-preview"><div className="material-context">Captured error excerpt · output lines {selected.start}–{selected.end} of {selected.total}</div><ToolOutput text={selected.text} /><button className="terminal-fold" onClick={e => { e.stopPropagation(); setOpen(true); }}>Show captured preview</button></div>;
  if (lines.length <= 8 || open) return <div className="terminal-preview"><ToolOutput text={text} />{lines.length > 8 && <button className="material-more" onClick={(e) => { e.stopPropagation(); setOpen(false); }}>Fold captured preview</button>}</div>;
  return <div className="terminal-preview">
    <ToolOutput text={lines.slice(0, 3).join('\n')} />
    <button className="terminal-fold" onClick={(e) => { e.stopPropagation(); setOpen(true); }}>{lines.length - 6} captured lines between · show preview</button>
    <ToolOutput text={lines.slice(-3).join('\n')} />
  </div>;
}
