import { useState } from 'react';

/** Decode actual JSON arguments once; never replace literal backslash sequences. */
export function ToolInput({ value }: { value: unknown }) {
  const [raw,setRaw] = useState(false);
  const original=typeof value==='string' ? value : JSON.stringify(value,null,2) ?? String(value);
  let input=value;
  if(typeof value==='string') { try { const parsed=JSON.parse(value); if(parsed && typeof parsed==='object') input=parsed; } catch { /* Literal text remains literal. */ } }
  return <div className="tool-input"><div className="structured-output-controls"><span>Captured arguments</span><button aria-pressed={raw} onClick={e=>{e.stopPropagation();setRaw(!raw);}}>{raw?'Show fields':'Show raw'}</button></div>{raw?<pre className="json">{original}</pre>:<InputValue value={input}/>}</div>;
}

function InputValue({value}:{value:unknown}) {
  const [page,setPage]=useState(0);
  if(!value || typeof value!=='object') return <pre className="output">{typeof value==='string'?value:String(value)}</pre>;
  const entries=Object.entries(value), pages=Math.ceil(entries.length/30), current=Math.min(page,Math.max(0,pages-1));
  return <><dl className="tool-input-fields">{entries.slice(current*30,(current+1)*30).map(([key,item])=><div key={key}><dt>{key}</dt><dd><InputValue value={item}/></dd></div>)}</dl>{pages>1&&<nav className="structured-output-controls" aria-label="Argument fields"><button disabled={!current} onClick={()=>setPage(current-1)}>Previous fields</button><span>{current+1} / {pages}</span><button disabled={current+1>=pages} onClick={()=>setPage(current+1)}>Next fields</button></nav>}</>;
}
