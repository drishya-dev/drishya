import {useMemo,useRef,useState} from 'react';
import {ReadingDialog} from './ProductShell.tsx';
import {dataLabel,pointerKey,structuredData,visibleDataNodes} from '../lib/structured-data.ts';
import './structured-data.css';

/** Parsing and indexing happen only after an explicit reading request. */
export function DataInspection({text}:{text:string}){
 const [open,setOpen]=useState(false);
 if(text.length>262144||!/^\s*[\[{]/.test(text))return null;
 return <div className="data-inspection" onClick={event=>event.stopPropagation()}>
  <button type="button" onClick={()=>setOpen(true)}>Inspect data</button>
  {open&&<DataReader text={text} close={()=>setOpen(false)}/>}
 </div>;
}
function DataReader({text,close}:{text:string;close:()=>void}){
 const data=useMemo(()=>structuredData(text),[text]);
 const [mode,setMode]=useState<'tree'|'table'|'original'>(data?.table?'table':'tree');
 const [expanded,setExpanded]=useState(new Set([''])),[query,setQuery]=useState(''),[top,setTop]=useState(0),[selected,setSelected]=useState(''),[copied,setCopied]=useState('');
 const viewport=useRef<HTMLDivElement>(null);
 const nodes=useMemo(()=>data?visibleDataNodes(data.nodes,expanded,query):[],[data,expanded,query]);
 const current=data?.nodes.find(node=>node.pointer===selected);
 const start=Math.max(0,Math.floor(top/32)-4),end=start+28;
 const reset=()=>{setTop(0);if(viewport.current)viewport.current.scrollTop=0;};
 const copy=async(value:string)=>{try{await navigator.clipboard.writeText(value);setCopied('Copied');}catch{setCopied('Copy unavailable · select the text instead');}};
 const toggle=(pointer:string)=>setExpanded(previous=>{const next=new Set(previous);if(next.has(pointer))next.delete(pointer);else next.add(pointer);return next;});
 return <ReadingDialog title="Captured data" className="structured-data-dialog" close={close}>
  <div className="data-reader-body">
   <div className="data-reader-toolbar"><div role="group" aria-label="Data view">{(data?.table?['table','tree','original']:['tree','original']).map(view=><button key={view} type="button" aria-pressed={mode===view} onClick={()=>{setMode(view as typeof mode);reset();}}>{view==='tree'?'Tree':view==='table'?'Table':'Original'}</button>)}</div><button type="button" onClick={()=>void copy(text)}>Copy original</button></div>
   {!data&&<p className="material-context">Tree unavailable: requires complete JSON within 256 KiB, fewer than 25,000 values and 80 levels. Original captured text remains available.</p>}
   {data&&mode==='tree'&&<label className="data-find">Find key or value<input value={query} onChange={event=>{setQuery(event.target.value);reset();}} placeholder="Search captured data…"/></label>}
   {(mode==='original'||!data)?<pre className="data-original" tabIndex={0}>{text}</pre>:<div ref={viewport} className="data-viewport" tabIndex={0} onScroll={event=>setTop(event.currentTarget.scrollTop)}>
    {mode==='tree'?<div role="tree" aria-label="Captured JSON tree" onKeyDown={event=>{
     if(!['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
     const row=(event.target as HTMLElement).closest<HTMLElement>('[data-tree-index]');if(!row)return;
     event.preventDefault();const index=Number(row.dataset.treeIndex),node=nodes[index]!;
     if(event.key==='ArrowRight'&&node.container&&!expanded.has(node.pointer)){toggle(node.pointer);return;}
     if(event.key==='ArrowLeft'&&node.container&&expanded.has(node.pointer)){toggle(node.pointer);return;}
     const next=event.key==='Home'?0:event.key==='End'?nodes.length-1:event.key==='ArrowLeft'?Math.max(0,nodes.findIndex(item=>item.pointer===node.parent)):event.key==='ArrowRight'?node.container&&nodes[index+1]?.depth===node.depth+1?index+1:index:Math.max(0,Math.min(nodes.length-1,index+(event.key==='ArrowUp'?-1:1)));
     setSelected(nodes[next]!.pointer);const host=viewport.current;if(host){if(next*32<host.scrollTop)host.scrollTop=next*32;else if((next+1)*32>host.scrollTop+host.clientHeight)host.scrollTop=(next+1)*32-host.clientHeight;setTop(host.scrollTop);requestAnimationFrame(()=>host.querySelector<HTMLElement>(`[data-tree-index="${next}"]`)?.focus({preventScroll:true}));}
    }} style={{height:nodes.length*32,position:'relative'}}>{nodes.slice(start,end).map((node,index)=><div key={node.pointer} role="treeitem" data-tree-index={start+index} tabIndex={selected===node.pointer?0:-1} aria-level={node.depth+1} aria-expanded={node.container?expanded.has(node.pointer):undefined} aria-selected={selected===node.pointer} style={{position:'absolute',top:(start+index)*32,height:32,width:'100%',paddingInlineStart:Math.min(node.depth,8)*14}} className="data-tree-row">
     {node.container?<button type="button" aria-label={`${expanded.has(node.pointer)?'Collapse':'Expand'} ${node.key}`} onClick={()=>toggle(node.pointer)}>{expanded.has(node.pointer)?'⌄':'›'}</button>:<span className="data-leaf"/>}
     <button type="button" className="data-value" onClick={()=>setSelected(node.pointer)} title={node.pointer||'Root'}><strong>{node.key}</strong><span>{dataLabel(node.value)}</span></button>
    </div>)}</div>:data.table&&<div role="table" aria-label="Captured records" aria-rowcount={data.table.rows.length+1} aria-colcount={data.table.columns.length} style={{minWidth:data.table.columns.length*150}}>
     <div role="row" className="data-table-header" style={{gridTemplateColumns:`repeat(${data.table.columns.length},minmax(150px,1fr))`}}>{data.table.columns.map(key=><div role="columnheader" key={key} title={key}>{key}</div>)}</div>
     <div style={{height:data.table.rows.length*32,position:'relative'}}>{data.table.rows.slice(start,end).map((row,index)=><div role="row" aria-rowindex={start+index+2} key={start+index} className="data-table-row" style={{position:'absolute',top:(start+index)*32,width:'100%',gridTemplateColumns:`repeat(${data.table!.columns.length},minmax(150px,1fr))`}}>{data.table!.columns.map(key=><div role="cell" key={key}>{Object.hasOwn(row,key)?<button type="button" onClick={()=>setSelected(`${data.table!.pointer}/${start+index}/${pointerKey(key)}`)}>{dataLabel(row[key])}</button>:<span className="muted">not present</span>}</div>)}</div>)}</div>
    </div>}
   </div>}
   {data&&mode!=='original'&&<div className="material-context">{mode==='tree'?`${nodes.length} visible values${query?' · search shows up to 500 matches':''}`:`${data.table?.rows.length} records · ${data.table?.columns.length} fields`} · scroll to inspect</div>}
   {data&&mode!=='original'&&current&&<section className="data-selection" aria-label="Selected data value"><div><code>{current.pointer||'Root'}</code><button type="button" onClick={()=>void copy(typeof current.value==='string'?current.value:JSON.stringify(current.value))}>Copy value</button></div><pre tabIndex={0}>{current.container?dataLabel(current.value):typeof current.value==='string'?current.value:JSON.stringify(current.value)}</pre>{current.container&&<button type="button" onClick={()=>{const ancestors=data.nodes.filter(node=>node.container&&(current.pointer===node.pointer||current.pointer.startsWith(`${node.pointer}/`)));const next=new Set([...expanded,...ancestors.map(node=>node.pointer)]);setExpanded(next);setMode('tree');setQuery('');reset();requestAnimationFrame(()=>{const index=visibleDataNodes(data.nodes,next).findIndex(node=>node.pointer===current.pointer);if(viewport.current){viewport.current.scrollTop=Math.max(0,index*32-32);setTop(viewport.current.scrollTop);}});}}>Explore in tree</button>}</section>}
   <div role="status" className="material-context">{copied}</div>
  </div>
 </ReadingDialog>;
}
