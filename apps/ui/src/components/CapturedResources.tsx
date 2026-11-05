import {useId,useMemo,useRef,useState} from 'react';
import {OriginalToggle} from './OriginalToggle.tsx';
import {capturedResources,capturedDocuments,resourceHref,type ResourceSelection,type DocumentSelection} from '../lib/captured-resources.ts';
import {ReadingDialog} from './ProductShell.tsx';
import {Markdown} from '../lib/markdown.tsx';
import {DataInspection} from './StructuredDataReader.tsx';
import {DelimitedInspection} from './DelimitedDataReader.tsx';
import './captured-resources.css';

export function ResourceInspection({text,candidates,context}:{text:string;candidates?:ResourceSelection|null;context?:string}){
 const references=useMemo(()=>candidates===undefined?capturedResources(text):candidates,[text,candidates]),[opened,setOpened]=useState<{resources:ResourceSelection;text:string;context?:string}>();
 if(!references&&!opened)return null;
 return <div className="data-inspection" onClick={event=>event.stopPropagation()}>{references&&<button onClick={()=>setOpened({resources:references,text,context})}>Inspect resources · {references.items.length}{references.limited?'+':''}</button>}{opened&&<ResourceReader resources={opened.resources} original={opened.text} context={opened.context} close={()=>setOpened(undefined)}/>}</div>;
}
function ResourceReader({resources,original,context,close}:{resources:ResourceSelection;original:string;context?:string;close:()=>void}){
 const [selected,setSelected]=useState(0),[query,setQuery]=useState(''),[document,setDocument]=useState(false),[copied,setCopied]=useState(''),[raw,setRaw]=useState(false);
 const detailId=useId();
 const rail=useRef<HTMLDivElement>(null),detail=useRef<HTMLDivElement>(null);
 const visible=useMemo(()=>resources.items.flatMap((item,index)=>`${item.title} ${item.uri} ${item.description??''}`.toLowerCase().includes(query.toLowerCase())?[index]:[]),[resources,query]);
 const item=resources.items[selected]!,href=resourceHref(item.uri),markdown=item.mime?.split(';')[0]?.trim().toLowerCase()==='text/markdown',formatted=markdown&&item.text!==undefined&&item.text.split('\n').length<=5000;
 const choose=(index:number)=>{setSelected(index);setDocument(false);setCopied('');if(detail.current)detail.current.scrollTop=0;};
 const copy=async(text:string)=>{try{await navigator.clipboard.writeText(text);setCopied('Copied');}catch{setCopied('Copy unavailable · select the text instead');}};
 return <ReadingDialog title="Resources" className="resource-reader" close={close}>
  <div className="resource-reader-body">{context&&<p className="material-context">{context}</p>}<div className="resource-modes" role="group" aria-label="Resource result view"><OriginalToggle original={raw} onToggle={()=>setRaw(value=>!value)}/><button onClick={()=>void copy(original)}>Copy original result</button></div>{raw?<pre className="resource-source resource-original" tabIndex={0}>{original}</pre>:<><label className="data-find">Find reference<input type="search" aria-label="Find resources" maxLength={200} value={query} onChange={event=>{const next=event.target.value;setQuery(next);const index=resources.items.findIndex(item=>`${item.title} ${item.uri} ${item.description??''}`.toLowerCase().includes(next.toLowerCase()));if(index>=0)choose(index);}}/></label>
   <div className="resource-layout"><div ref={rail} className="resource-list" role="tablist" aria-label="Resource references" aria-orientation="vertical" onKeyDown={event=>{
    if(!['ArrowUp','ArrowDown','Home','End'].includes(event.key)||!(event.target as HTMLElement).matches('[role=tab]'))return;event.preventDefault();event.stopPropagation();const index=visible.indexOf(selected),next=event.key==='Home'?0:event.key==='End'?visible.length-1:Math.max(0,Math.min(visible.length-1,index+(event.key==='ArrowDown'?1:-1)));if(visible[next]===undefined)return;choose(visible[next]!);requestAnimationFrame(()=>rail.current?.querySelectorAll<HTMLElement>('[role=tab]')[next]?.focus({preventScroll:false}));
   }}>{visible.map(index=>{const reference=resources.items[index]!;return <button key={index} role="tab" aria-selected={index===selected} aria-controls={detailId} tabIndex={index===selected?0:-1} onClick={()=>choose(index)} title={reference.uri}><strong>{reference.title||reference.uri}</strong><span>{reference.text!==undefined?'Text':'Reference'}{reference.mime?` · ${reference.mime}`:''}</span></button>;})}{!visible.length&&<p className="material-context">No matching references</p>}</div>
    {visible.length>0&&<div ref={detail} id={detailId} role="tabpanel" aria-label="Selected resource" className="resource-detail" tabIndex={0}>
     <h3>{item.title||item.uri}</h3><code className="resource-uri">{item.uri}</code><small className="resource-provenance">Field {item.field||'root'}{item.mime?` · ${item.mime}`:''}{item.size!==undefined?` · ${item.size} reported bytes`:''}</small>
     <div className="resource-actions">{href&&<a href={href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" title="Open the current destination in a new tab">Open current URL ↗</a>}<button onClick={()=>void copy(item.uri)}>Copy reference</button>{item.text!==undefined&&<button onClick={()=>void copy(item.text!)}>Copy text</button>}</div>
     {item.description&&<p className="resource-description">{item.description}</p>}
     {item.text!==undefined?<><div className="resource-modes" role="group" aria-label="Document view"><button aria-pressed={!document} onClick={()=>setDocument(false)}>Source</button>{formatted&&<button aria-pressed={document} onClick={()=>setDocument(true)}>Document</button>}</div>{markdown&&!formatted&&<p className="material-context">Formatted view supports up to 5,000 lines. Source remains available.</p>}
      {document&&formatted?<div className="resource-document"><Markdown text={item.text} document/></div>:<pre className="resource-source" tabIndex={0}>{item.text}</pre>}
      <DataInspection text={item.text} context={context}/><DelimitedInspection text={item.text} context={context}/>
     </>:<p className="material-context">{item.binary?'Binary body is present in Original result; this reader does not decode it.':'No text body in this reference.'}{href?' Opening the link shows its current destination.':''}</p>}
    </div>}
   </div>
   </>}<div className="resource-reader-footer"><span>{visible.length} of {resources.items.length} references{resources.limited?' · bounded preview; original result has remaining fields':''}</span><span role="status">{copied}</span></div>
  </div>
 </ReadingDialog>;
}

/** A separate owner keeps this snapshot open while live output changes. */
export function DocumentInspection({text,candidates,context}:{text:string;candidates?:DocumentSelection|null;context?:string}){
 const documents=useMemo(()=>candidates===undefined?capturedDocuments(text):candidates,[text,candidates]),[opened,setOpened]=useState<{documents:DocumentSelection;original:string;context?:string}>();
 if(!documents&&!opened)return null;
 return <div className="data-inspection" onClick={event=>event.stopPropagation()}>{documents&&<button onClick={()=>setOpened({documents,original:text,context})}>Inspect documents · {documents.items.length}{documents.limited?'+':''}</button>}{opened&&<DocumentReader documents={opened.documents} original={opened.original} context={opened.context} close={()=>setOpened(undefined)}/>}</div>;
}
function DocumentReader({documents,original,context,close}:{documents:DocumentSelection;original:string;context?:string;close:()=>void}){
 const [selected,setSelected]=useState(0),[mode,setMode]=useState<'source'|'document'|'original'>('source'),[copied,setCopied]=useState('');
 const item=documents.items[selected]!,formatted=item.text.split('\n').length<=5000;
 const copy=async(value:string)=>{try{await navigator.clipboard.writeText(value);setCopied('Copied');}catch{setCopied('Copy unavailable · select the text instead');}};
 return <ReadingDialog title="Documents" className="resource-reader" close={close}><div className="resource-reader-body">{context&&<p className="material-context">{context}</p>}
  {documents.items.length>1&&<label className="document-selection">Text<select aria-label="Document" value={selected} onChange={event=>{setSelected(Number(event.target.value));setMode('source');setCopied('');}}>{documents.items.map((item,index)=><option key={index} value={index}>{item.title||item.field||'root'}</option>)}</select></label>}
  <small className="resource-provenance">Field {item.field||'root'}{item.mime?` · ${item.mime}`:''} · supplied text; no current file or URL loaded</small>
  <div className="resource-modes" role="group" aria-label="Document view"><button aria-pressed={mode==='source'} onClick={()=>setMode('source')}>Source</button>{formatted&&<button aria-pressed={mode==='document'} onClick={()=>setMode('document')}>{item.mime?.split(';')[0]?.trim().toLowerCase()==='text/markdown'?'Document':'Read as Markdown'}</button>}<OriginalToggle original={mode==='original'} onToggle={()=>setMode(value=>value==='original'?'source':'original')}/><button onClick={()=>void copy(mode==='original'?original:item.text)}>{mode==='original'?'Copy original result':'Copy text'}</button></div>
  {!formatted&&<p className="material-context">Formatted view supports up to 5,000 lines. Complete supplied Source remains available.</p>}
  <div className="document-material" key={selected} tabIndex={0}>{mode==='document'&&formatted?<div className="resource-document"><Markdown text={item.text} document/></div>:<pre className="resource-source">{mode==='original'?original:item.text}</pre>}</div>
  {mode!=='original'&&<div className="document-handoffs"><DataInspection text={item.text} context={context}/><DelimitedInspection text={item.text} context={context}/></div>}
  <div className="resource-reader-footer"><span>{documents.items.length} text fields{documents.limited?' · bounded selection; Original result retains remaining fields':''}</span><span role="status">{copied}</span></div>
 </div></ReadingDialog>;
}
