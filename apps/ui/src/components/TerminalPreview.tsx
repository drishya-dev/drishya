import {CapturedResultViews} from './CapturedResultViews.tsx';
import { useState } from 'react';
import { useArtifact } from './common.tsx';
import { ToolOutput } from './ToolOutput.tsx';
import { toolOutputText } from '../lib/tool-output.ts';
import { failurePreview } from '../lib/failure-preview.ts';
import { LineClamp } from '../lib/line-clamp.tsx';

/** UI-46: how many visual lines a collapsed output shows before it fades; sized so a card's header, command and output fit its height class. */
const PREVIEW_LINES = 7;

/** Fold only captured lines. Full output remains in the paged operation reader. */
export function TerminalPreview({ text, failed = false, artifactId }: { text: string; failed?: boolean; artifactId?: string }) {
  const encoded = /\\[rn]/.test(text);
  const complete = useArtifact(encoded ? artifactId : undefined, { scope: 'preview', count: 200 });
  const full = complete.text && !complete.hasMore && toolOutputText(complete.text).decoded ? complete.text : text;
  return <div className="terminal-preview"><CapturedResultViews text={full} evidence={{partial:complete.partial,unavailable:complete.unavailable??complete.error}}/><TerminalBody text={full} failed={failed}/></div>;
}
function TerminalBody({text,failed}:{text:string;failed:boolean}){
  const [open,setOpen]=useState(false);
  if (toolOutputText(text).decoded) return <LineClamp lines={PREVIEW_LINES}><ToolOutput text={text} inspect={false}/></LineClamp>;
  const lines = text.replace(/\n$/, '').split('\n');
  const selected = failed && !open && lines.length > 8 ? failurePreview(text) : undefined;
  if (selected) return <><div className="material-context">Error · output lines {selected.start}–{selected.end} of {selected.total}</div><LineClamp lines={PREVIEW_LINES}><ToolOutput text={selected.text} inspect={false}/></LineClamp><button className="terminal-fold" onClick={e => { e.stopPropagation(); setOpen(true); }}>Show the rest</button></>;
  if (lines.length <= 8 || open) return <>{open ? <ToolOutput text={text} inspect={false}/> : <LineClamp lines={PREVIEW_LINES}><ToolOutput text={text} inspect={false}/></LineClamp>}{lines.length > 8 && <button className="material-more" onClick={(e) => { e.stopPropagation(); setOpen(false); }}>Show less</button>}</>;
  return <>
    <LineClamp lines={3}><ToolOutput text={lines.slice(0, 3).join('\n')} inspect={false}/></LineClamp>
    <button className="terminal-fold" onClick={(e) => { e.stopPropagation(); setOpen(true); }}>{lines.length - 6} more lines</button>
    <LineClamp lines={3} tail><ToolOutput text={lines.slice(-3).join('\n')} inspect={false}/></LineClamp>
  </>;
}
