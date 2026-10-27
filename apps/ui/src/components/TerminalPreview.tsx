import {CapturedResultViews} from './CapturedResultViews.tsx';
import { useState } from 'react';
import { useArtifact } from './common.tsx';
import { ToolOutput } from './ToolOutput.tsx';
import { toolOutputText } from '../lib/tool-output.ts';
import { failurePreview } from '../lib/failure-preview.ts';

/** Fold only captured lines. Full output remains in the paged operation reader. */
export function TerminalPreview({ text, failed = false, artifactId }: { text: string; failed?: boolean; artifactId?: string }) {
  const encoded = /\\[rn]/.test(text);
  const complete = useArtifact(encoded ? artifactId : undefined, { scope: 'preview', count: 200 });
  const full = complete.text && !complete.hasMore && toolOutputText(complete.text).decoded ? complete.text : text;
  return <div className="terminal-preview"><CapturedResultViews text={full} evidence={{partial:complete.partial,unavailable:complete.unavailable??complete.error}}/><TerminalBody text={full} failed={failed}/></div>;
}
function TerminalBody({text,failed}:{text:string;failed:boolean}){
  const [open,setOpen]=useState(false);
  if (toolOutputText(text).decoded) return <ToolOutput text={text} inspect={false}/>;
  const lines = text.replace(/\n$/, '').split('\n');
  const selected = failed && !open && lines.length > 8 ? failurePreview(text) : undefined;
  if (selected) return <><div className="material-context">Captured error excerpt · output lines {selected.start}–{selected.end} of {selected.total}</div><ToolOutput text={selected.text} inspect={false}/><button className="terminal-fold" onClick={e => { e.stopPropagation(); setOpen(true); }}>Show captured preview</button></>;
  if (lines.length <= 8 || open) return <><ToolOutput text={text} inspect={false}/>{lines.length > 8 && <button className="material-more" onClick={(e) => { e.stopPropagation(); setOpen(false); }}>Fold captured preview</button>}</>;
  return <>
    <ToolOutput text={lines.slice(0, 3).join('\n')} inspect={false}/>
    <button className="terminal-fold" onClick={(e) => { e.stopPropagation(); setOpen(true); }}>{lines.length - 6} captured lines between · show preview</button>
    <ToolOutput text={lines.slice(-3).join('\n')} inspect={false}/>
  </>;
}
