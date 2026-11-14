import { useState } from 'react';
import {CapturedResultViews} from './CapturedResultViews.tsx';
import {ReadingCaption} from './OriginalToggle.tsx';
import {LineClamp} from '../lib/line-clamp.tsx';
import {dataLabel,dataText,isDataRecord,parseCapturedJson} from '../lib/structured-data.ts';

/** Decode actual JSON arguments once; never replace literal backslash sequences. */
export function ToolInput({ value, compact = false }: { value: unknown; compact?: boolean }) {
  const [raw,setRaw] = useState(false);
  const original=typeof value==='string' ? value : JSON.stringify(value,null,2) ?? String(value);
  let input=value;
  if(typeof value==='string') { try { const parsed=parseCapturedJson(value); if(isDataRecord(parsed)||Array.isArray(parsed)) input=parsed; } catch { /* Literal text remains literal. */ } }
  return <div className="tool-input"><ReadingCaption label="Arguments" original={raw} onToggle={()=>setRaw(!raw)}/>{(()=>{const body=raw?<pre className="json">{original}</pre>:<InputValue value={input}/>;return compact?<LineClamp lines={4}>{body}</LineClamp>:body;})()}<CapturedResultViews text={original} argumentsView/></div>;
}

function InputValue({value,depth=0}:{value:unknown;depth?:number}) {
  const [page,setPage]=useState(0);
  if(!Array.isArray(value)&&!isDataRecord(value)) return <pre className="output">{dataLabel(value)}</pre>;
  if(depth>=8||Object.keys(value).length===0) return <pre className="json">{dataText(value)}</pre>;
  const entries=Object.entries(value), pages=Math.ceil(entries.length/30), current=Math.min(page,Math.max(0,pages-1));
  return <><dl className="tool-input-fields">{entries.slice(current*30,(current+1)*30).map(([key,item])=><div key={key}><dt>{key}</dt><dd><InputValue value={item} depth={depth+1}/></dd></div>)}</dl>{pages>1&&<nav className="structured-output-controls" aria-label="Argument fields"><button disabled={!current} onClick={()=>setPage(current-1)}>Previous fields</button><span>{current+1} / {pages}</span><button disabled={current+1>=pages} onClick={()=>setPage(current+1)}>Next fields</button></nav>}</>;
}
