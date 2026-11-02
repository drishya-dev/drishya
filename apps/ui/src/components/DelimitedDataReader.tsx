import {useMemo,useRef,useState} from 'react';
import {ReadingDialog} from './ProductShell.tsx';
import {delimitedBlocks,delimitedData,type DelimitedBlock,type Delimiter} from '../lib/delimited-data.ts';
import './structured-data.css';

export function DelimitedInspection({text,candidates,context}:{text:string;candidates?:DelimitedBlock[];context?:string}){
 const blocks=useMemo(()=>candidates??delimitedBlocks(text),[text,candidates]),[opened,setOpened]=useState<{blocks:DelimitedBlock[];context?:string}>();
 if(!blocks.length&&!opened)return null;
 return <div className="data-inspection" onClick={event=>event.stopPropagation()}>{blocks.length>0&&<button type="button" onClick={()=>setOpened({blocks,context})}>Inspect delimited text</button>}{opened&&<DelimitedReader blocks={opened.blocks} context={opened.context} close={()=>setOpened(undefined)}/>}</div>;
}
function DelimitedReader({blocks,context,close}:{blocks:DelimitedBlock[];context?:string;close:()=>void}){
 const [block,setBlock]=useState(0),[delimiter,setDelimiter]=useState<Delimiter>(),[original,setOriginal]=useState(true),[header,setHeader]=useState(false),[query,setQuery]=useState(''),[top,setTop]=useState(0),[selected,setSelected]=useState<{row:number;column:number}>(),[copied,setCopied]=useState('');
 const viewport=useRef<HTMLDivElement>(null),text=blocks[block]!.text;
 const result=useMemo(()=>delimiter?delimitedData(text,delimiter):undefined,[text,delimiter]),data=result?.data;
 const rows=useMemo(()=>data?data.rows.flatMap((cells,index)=>header&&index===0||query&&!cells.some(cell=>cell.toLowerCase().includes(query.toLowerCase()))?[]:[{cells,index}]):[],[data,header,query]);
 const start=Math.max(0,Math.floor(top/32)-4),end=start+28;
 const reset=()=>{setTop(0);setSelected(undefined);setCopied('');if(viewport.current){viewport.current.scrollTop=0;viewport.current.scrollLeft=0;}};
 const copy=async(value:string)=>{try{await navigator.clipboard.writeText(value);setCopied('Copied');}catch{setCopied('Copy unavailable · select the text instead');}};
 const selectedRow=selected&&data?.rows[selected.row],present=!!selected&&!!selectedRow&&selected.column<selectedRow.length;
 const template=data?`48px repeat(${data.columns},minmax(160px,1fr))`:'';
 return <ReadingDialog title="Delimited text" className="structured-data-dialog delimited-data-dialog" close={close}>
  <div className="data-reader-body">{context&&<p className="material-context">{context}</p>}
   <div className="data-reader-toolbar"><div role="group" aria-label="Delimited text format"><button aria-pressed={original} onClick={()=>{setOriginal(true);reset();}}>Original</button>{([',','\t'] as const).map(value=><button key={value} aria-pressed={!original&&delimiter===value} onClick={()=>{setDelimiter(value);setOriginal(false);reset();}}>{value===','?'CSV':'TSV'}</button>)}</div><button onClick={()=>void copy(text)}>Copy original</button></div>
   <p className="delimited-note">Choose CSV or TSV. Values remain literal; text may be partial.</p>
   {blocks.length>1&&<label className="data-find">Field<select aria-label="Text block" value={block} onChange={event=>{setBlock(Number(event.target.value));setOriginal(true);setDelimiter(undefined);setHeader(false);setQuery('');reset();}}>{blocks.map((item,index)=><option key={item.field+index} value={index}>{item.field}</option>)}</select></label>}
   {blocks.length===1&&<code className="delimited-field">{blocks[block]!.field}</code>}
   {!original&&result?.error&&<p role="status" className="material-context">{result.error}</p>}
   {!original&&data&&<><div className="delimited-options"><label><input type="checkbox" checked={header} onChange={event=>{setHeader(event.target.checked);reset();}}/> First record contains column names</label><label className="data-find">Find cell<input type="search" aria-label="Find delimited cells" value={query} maxLength={200} onChange={event=>{setQuery(event.target.value);reset();}}/></label></div>
    <div className="data-viewport delimited-viewport" style={{height:Math.min(440,(rows.length+1)*32+16),minHeight:Math.min(160,(rows.length+1)*32+16),maxHeight:'45dvh'}} ref={viewport} tabIndex={0} onScroll={event=>setTop(event.currentTarget.scrollTop)} onKeyDown={event=>{
     const target=(event.target as HTMLElement).closest<HTMLElement>('[data-data-row]');if((!target&&event.target!==viewport.current)||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
     event.preventDefault();event.stopPropagation();let row=target?Number(target.dataset.dataRow):Math.floor(top/32),column=target?Number(target.dataset.dataColumn):0;
     if(event.key==='ArrowUp')row--;if(event.key==='ArrowDown')row++;if(event.key==='ArrowLeft')column--;if(event.key==='ArrowRight')column++;
     if(event.key==='Home'){column=0;if(event.ctrlKey||event.metaKey)row=0;}if(event.key==='End'){column=data.columns-1;if(event.ctrlKey||event.metaKey)row=rows.length-1;}
     row=Math.max(0,Math.min(rows.length-1,row));column=Math.max(0,Math.min(data.columns-1,column));if(!rows[row])return;setSelected({row:rows[row]!.index,column});
     const host=viewport.current!;if(row*32<host.scrollTop)host.scrollTop=row*32;else if((row+2)*32>host.scrollTop+host.clientHeight)host.scrollTop=(row+2)*32-host.clientHeight;setTop(host.scrollTop);
     requestAnimationFrame(()=>{const cell=host.querySelector<HTMLElement>(`[data-data-row="${row}"][data-data-column="${column}"]`);cell?.focus({preventScroll:true});if(cell){const box=cell.getBoundingClientRect(),frame=host.getBoundingClientRect();if(box.left<frame.left)host.scrollLeft-=frame.left-box.left;else if(box.right>frame.right)host.scrollLeft+=box.right-frame.right;}});
    }}><div role="table" aria-label="Delimited records" aria-rowcount={rows.length+1} aria-colcount={data.columns+1} style={{minWidth:48+data.columns*160}}>
     <div role="row" className="data-table-header" style={{gridTemplateColumns:template}}><div role="columnheader">#</div>{Array.from({length:data.columns},(_,column)=><div role="columnheader" key={column} title={header?data.rows[0]?.[column]:undefined}>{header&&data.rows[0]?.[column]!==undefined?data.rows[0][column]:`Column ${column+1}`}</div>)}</div>
     <div style={{height:rows.length*32,position:'relative'}}>{rows.slice(start,end).map((record,index)=><div role="row" aria-rowindex={start+index+2} key={record.index} className="data-table-row" style={{position:'absolute',top:(start+index)*32,width:'100%',gridTemplateColumns:template}}><div role="rowheader">{record.index+1}</div>{Array.from({length:data.columns},(_,column)=><div role="cell" key={column}><button data-data-row={start+index} data-data-column={column} tabIndex={selected?selected.row===record.index&&selected.column===column?0:-1:start+index===0&&column===0?0:-1} aria-label={`Inspect record ${record.index+1}, column ${column+1}`} onClick={()=>setSelected({row:record.index,column})}>{column<record.cells.length?record.cells[column]:<span className="muted">not present</span>}</button></div>)}</div>)}</div>
    </div></div>
    <div className="material-context">{rows.length} of {Math.max(0,data.rows.length-(header?1:0))} records · {data.columns} columns · # is the supplied record position{header?' (first record used as names)':''}{blocks.length===8?' · up to 8 candidate text blocks':''}</div>
   </>}
   {(original||!data)&&<pre className="data-original" tabIndex={0}>{text}</pre>}
   {!original&&data&&selected&&<section className="data-selection" aria-label="Selected delimited cell"><div><code>Record {selected.row+1} · column {selected.column+1}</code><button disabled={!present} onClick={()=>void copy(selectedRow![selected.column]!)}>Copy cell</button></div><pre tabIndex={0}>{present?selectedRow![selected.column]: 'Cell not present in this record'}</pre>{present&&selectedRow![selected.column]===''&&<span className="material-context">Empty cell</span>}</section>}
   <div role="status" className="material-context">{copied}</div>
  </div>
 </ReadingDialog>;
}
