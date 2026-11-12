import {CapturedResultViews} from './CapturedResultViews.tsx';
import { useMemo, useState } from 'react';
import { Output } from './common';
import { looksLikeMarkdown, toolOutputText } from '../lib/tool-output';
import { Markdown } from '../lib/markdown.tsx';
import { prosePath } from '../lib/prose-path.ts';
import { useApp } from '../state.ts';
import type {CapturedContentEvidence} from '../lib/captured-content.ts';
import {ReadingCaption} from './OriginalToggle.tsx';

/** This display projection never changes stored bytes, source line addresses or copy/search input. */
export function ToolOutput({text,inspect=true,evidence}:{text:string;inspect?:boolean;evidence?:CapturedContentEvidence}){
 // The reading controls float over the output's corner (captured-content.css) instead of taking a row of their own.
 return <div className="result-readings">{inspect&&<CapturedResultViews text={text} evidence={evidence}/>}<ToolOutputBody text={text}/></div>;
}
function ToolOutputBody({text}:{text:string}) {
  const formatted = useMemo(() => toolOutputText(text), [text]);
  const workspaceRoot = useApp(s => s.recording?.workspaceRoot);
  const [raw, setRaw] = useState(false);
  const [page, setPage] = useState(0);
  const lines = formatted.text.split('\n');
  const currentPage = Math.min(page, Math.max(0, Math.ceil(lines.length / 500) - 1));
  const sliceText = useMemo(() => lines.slice(currentPage * 500, (currentPage + 1) * 500).join('\n'), [lines, currentPage]);
  const markdown = useMemo(() => formatted.decoded && !raw && looksLikeMarkdown(sliceText), [formatted.decoded, raw, sliceText]);
  if (!formatted.decoded) return <><Output text={text} /></>;
  const body = raw
    ? <Output text={text} />
    : markdown
      ? <div className="tool-markdown"><Markdown text={sliceText} document workspaceRoot={workspaceRoot} onPath={(path, line) => { const ref = prosePath(path, workspaceRoot, true); if (ref) useApp.getState().set({ hoveredPath: ref.path, filePanel: ref.path, filePanelLine: line ?? ref.line, filePanelEvidence: undefined, filePanelFocus: undefined, currentFile: undefined, selectedOp: undefined, follow: false, held: true }); }}/></div>
      : <Output text={sliceText} />;
  return <div className="structured-tool-output">
    <ReadingCaption label={raw ? 'Envelope' : markdown ? 'Tool markdown' : 'Tool text'} title={raw ? undefined : 'Decoded from the JSON envelope the tool returned'} original={raw} onToggle={() => { setRaw(value => !value); setPage(0); }}/>
    {body}
    {!raw && lines.length > 500 && <nav className="structured-output-controls" aria-label="Decoded output pages"><button disabled={!currentPage} onClick={e => { e.stopPropagation(); setPage(currentPage - 1); }}>Previous text</button><span>Decoded lines {currentPage * 500 + 1}–{Math.min(lines.length, (currentPage + 1) * 500)} / {lines.length}</span><button disabled={(currentPage + 1) * 500 >= lines.length} onClick={e => { e.stopPropagation(); setPage(currentPage + 1); }}>Next text</button></nav>}
  </div>;
}
