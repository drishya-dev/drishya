import {useId,useMemo,useRef,useState} from 'react';
import {capturedResources,resourceHref,type ResourceSelection} from '../lib/captured-resources.ts';
import {ReadingDialog} from './ProductShell.tsx';
import {Markdown} from '../lib/markdown.tsx';
import {DataInspection} from './StructuredDataReader.tsx';
import {DelimitedInspection} from './DelimitedDataReader.tsx';
import './captured-resources.css';

export function ResourceInspection({text}:{text:string}){
 const references=useMemo(()=>capturedResources(text),[text]),[opened,setOpened]=useState<ResourceSelection>();
 if(!references&&!opened)return null;
 return <div className="data-inspection" onClick={event=>event.stopPropagation()}>{references&&<button onClick={()=>setOpened(references)}>Inspect resources · {references.items.length}{references.limited?'+':''}</button>}{opened&&<ResourceReader resources={opened} close={()=>setOpened(undefined)}/>}</div>;
}
function ResourceReader({resources,close}:{resources:ResourceSelection;close:()=>void}){
 const [selected,setSelected]=useState(0),[query,setQuery]=useState(''),[document,setDocument]=useState(false),[copied,setCopied]=useState('');
 const detailId=useId();
 const rail=useRef<HTMLDivElement>(null),detail=useRef<HTMLDivElement>(null);
 const visible=useMemo(()=>resources.items.flatMap((item,index)=>`${item.title} ${item.uri} ${item.description??''}`.toLowerCase().includes(query.toLowerCase())?[index]:[]),[resources,query]);
 const item=resources.items[selected]!,href=resourceHref(item.uri),markdown=item.mime?.split(';')[0]?.trim().toLowerCase()==='text/markdown',formatted=markdown&&item.text!==undefined&&item.text.split('\n').length<=5000;
 const choose=(index:number)=>{setSelected(index);setDocument(false);setCopied('');if(detail.current)detail.current.scrollTop=0;};
 const copy=async(text:string)=>{try{await navigator.clipboard.writeText(text);setCopied('Copied');}catch{setCopied('Copy unavailable · select the text instead');}};
 return <ReadingDialog title="Captured resources" className="resource-reader" close={close}>
  <div className="resource-reader-body"><label className="data-find">Find reference<input type="search" aria-label="Find captured resources" maxLength={200} value={query} onChange={event=>{const next=event.target.value;setQuery(next);const index=resources.items.findIndex(item=>`${item.title} ${item.uri} ${item.description??''}`.toLowerCase().includes(next.toLowerCase()));if(index>=0)choose(index);}}/></label>
   <div className="resource-layout"><div ref={rail} className="resource-list" role="tablist" aria-label="Captured resource references" aria-orientation="vertical" onKeyDown={event=>{
    if(!['ArrowUp','ArrowDown','Home','End'].includes(event.key)||!(event.target as HTMLElement).matches('[role=tab]'))return;event.preventDefault();event.stopPropagation();const index=visible.indexOf(selected),next=event.key==='Home'?0:event.key==='End'?visible.length-1:Math.max(0,Math.min(visible.length-1,index+(event.key==='ArrowDown'?1:-1)));if(visible[next]===undefined)return;choose(visible[next]!);requestAnimationFrame(()=>rail.current?.querySelectorAll<HTMLElement>('[role=tab]')[next]?.focus({preventScroll:false}));
   }}>{visible.map(index=>{const reference=resources.items[index]!;return <button key={index} role="tab" aria-selected={index===selected} aria-controls={detailId} tabIndex={index===selected?0:-1} onClick={()=>choose(index)} title={reference.uri}><strong>{reference.title||reference.uri}</strong><span>{reference.text!==undefined?'Captured text':'Reference'}{reference.mime?` · ${reference.mime}`:''}</span></button>;})}{!visible.length&&<p className="material-context">No matching references</p>}</div>
    {visible.length>0&&<div ref={detail} id={detailId} role="tabpanel" aria-label="Selected captured resource" className="resource-detail" tabIndex={0}>
     <h3>{item.title||item.uri}</h3><code className="resource-uri">{item.uri}</code><small className="resource-provenance">Captured field {item.field||'root'}{item.mime?` · ${item.mime}`:''}</small>
     <div className="resource-actions">{href&&<a href={href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" title="Open the current destination in a new tab">Open current URL ↗</a>}<button onClick={()=>void copy(item.uri)}>Copy reference</button>{item.text!==undefined&&<button onClick={()=>void copy(item.text!)}>Copy captured text</button>}</div>
     {item.description&&<p className="resource-description">{item.description}</p>}
     {item.text!==undefined?<><div className="resource-modes" role="group" aria-label="Captured document view"><button aria-pressed={!document} onClick={()=>setDocument(false)}>Source</button>{formatted&&<button aria-pressed={document} onClick={()=>setDocument(true)}>Document</button>}</div>{markdown&&!formatted&&<p className="material-context">Formatted view supports up to5,000lines. Source remains available.</p>}
      {document&&formatted?<div className="resource-document"><Markdown text={item.text} document/></div>:<pre className="resource-source" tabIndex={0}>{item.text}</pre>}
      <DataInspection text={item.text}/><DelimitedInspection text={item.text}/>
     </>:<p className="material-context">No text body in this captured reference.{href?' Opening the link shows its current destination.':''}</p>}
    </div>}
   </div>
   <div className="resource-reader-footer"><span>{visible.length} of {resources.items.length} references{resources.limited?' · bounded preview; original result has remaining fields':''}</span><span role="status">{copied}</span></div>
  </div>
 </ReadingDialog>;
}
