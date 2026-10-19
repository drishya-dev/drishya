import {CapturedResultViews} from './CapturedResultViews.tsx';
import { useMemo, useState } from 'react';
import { Output } from './common';
import { toolOutputText } from '../lib/tool-output';

/** This display projection never changes stored bytes, source line addresses or copy/search input. */
export function ToolOutput({text,inspect=true}:{text:string;inspect?:boolean}){
 return <><ToolOutputBody text={text}/>{inspect&&<CapturedResultViews text={text}/>}</>;
}
function ToolOutputBody({text}:{text:string}) {
  const formatted = useMemo(() => toolOutputText(text), [text]);
  const [raw, setRaw] = useState(false);
  const [page, setPage] = useState(0);
  const lines = formatted.text.split('\n');
  const currentPage = Math.min(page, Math.max(0, Math.ceil(lines.length / 500) - 1));
  if (!formatted.decoded) return <><Output text={text} /></>;
  return <div className="structured-tool-output"><div className="structured-output-controls"><span>{raw ? 'Captured envelope' : 'Tool text · decoded JSON'}</span><button onClick={event => { event.stopPropagation(); setRaw(value => !value); setPage(0); }} aria-pressed={raw}>{raw ? 'Show tool text' : 'Show raw'}</button></div><Output text={raw ? text : lines.slice(currentPage * 500, (currentPage + 1) * 500).join('\n')} />{!raw && lines.length > 500 && <nav className="structured-output-controls" aria-label="Decoded output pages"><button disabled={!currentPage} onClick={e => { e.stopPropagation(); setPage(currentPage - 1); }}>Previous text</button><span>Decoded lines {currentPage * 500 + 1}–{Math.min(lines.length, (currentPage + 1) * 500)} / {lines.length}</span><button disabled={(currentPage + 1) * 500 >= lines.length} onClick={e => { e.stopPropagation(); setPage(currentPage + 1); }}>Next text</button></nav>}</div>;
}
