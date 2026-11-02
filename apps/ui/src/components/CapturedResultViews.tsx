import {useMemo,useState,type ReactNode} from 'react';
import {capturedContent,type CapturedContentEvidence} from '../lib/captured-content.ts';
import {DataInspection,InlineData} from './StructuredDataReader.tsx';
import {structuredData} from '../lib/structured-data.ts';
import {DelimitedInspection} from './DelimitedDataReader.tsx';
import {DocumentInspection,ResourceInspection} from './CapturedResources.tsx';
import './captured-content.css';

/** Every reading shares the same choices; raw material retains its existing owner. */
/** `fallback` is the result's own body. When given and the whole captured result is one complete JSON value with no other candidate readings, an inline reading replaces it
 *  (CONTENT-10) and the "Inspect data" row disappears; a field inside a wrapper never replaces its siblings; everything else keeps its explicit, hover-revealed choices. */
export function CapturedResultViews({text,evidence,argumentsView=false,fallback,inlineReading=true}:{text:string;evidence?:CapturedContentEvidence;argumentsView?:boolean;fallback?:ReactNode;inlineReading?:boolean}){
 const content=useMemo(()=>capturedContent(text,evidence),[text,evidence?.mime,evidence?.partial,evidence?.unavailable]);
 const [field,setField]=useState<string>();
 const preferred=content.data.find(item=>item.representation==='structured field')??content.data.find(item=>item.field!=='Whole result'&&(item.mime==='application/json'||item.mime?.endsWith('+json')))??content.data[0];
 const selected=content.data.find(item=>item.field===field)??preferred;
 const inline=useMemo(()=>fallback!==undefined&&inlineReading&&!argumentsView&&content.data.length===1&&!content.limited&&!content.resources&&!content.documents&&!content.delimited.length&&selected?.field==='Whole result'?structuredData(selected.text)!==undefined:false,[fallback!==undefined,inlineReading,argumentsView,content,selected?.field,selected?.text]);
 const manual=!content.limited&&text.length<=262144&&text.trim().length>=32&&text.includes('\n');
 const dataContext=[content.partial,selected&&selected.field!=='Whole result'?`Field ${selected.field}${selected.representation==='structured field'?' · formatted by Drishya · choose Whole result for the original':''}`:undefined].filter(Boolean).join(' · ')||undefined;
 const chips=<div className={inline?'captured-result-views captured-result-views-inline':'captured-result-views'} role="group" aria-label={argumentsView?'Argument views':'Result views'} onClick={event=>event.stopPropagation()}>
  {content.data.length>1&&<details className="captured-data-sources"><summary title={selected?.field}>Sources · {content.data.length}</summary><label className="material-context captured-data-choice">Data source <select aria-label="Content" value={selected?.field} onChange={event=>setField(event.target.value)}>{content.data.map(item=><option key={item.field} value={item.field}>{item.field}</option>)}</select></label>
   {selected?.representation==='structured field'&&<span className="material-context">Structured field · formatted by Drishya · whole result keeps the original</span>}
  </details>}
  <DataInspection text={selected?.text??text} available={!inline&&content.json&&(!argumentsView||text.length>2)} label={argumentsView?'Inspect argument data':undefined} context={dataContext} sourceLabel={selected?.representation==='structured field'?'Formatted field':undefined}/>
  <ResourceInspection text={text} candidates={content.resources??null} context={content.partial}/>
  <DelimitedInspection text={text} candidates={content.delimited} context={content.partial}/>
  <DocumentInspection text={text} candidates={content.documents??null} context={content.partial}/>
  {!argumentsView&&!inline&&<details className="result-original" hidden={!manual}><summary>Choose reading format</summary>
   <span className="material-context">Your reading choice · supplied text only</span>
   <DataInspection text={text} available={manual&&!content.json} label="Read as JSON" context={content.partial}/>
   <DelimitedInspection text={text} candidates={manual&&!content.delimited.length?[{field:'Text as supplied',text}]:[]} context={content.partial}/>
   <DocumentInspection text={text} candidates={manual&&!content.documents?{items:[{field:'Text as supplied',text}],limited:false}:null} context={content.partial}/>
  </details>}
  {content.limited&&<span className="material-context">Reading choices limited to 256 KiB, 64 siblings, 1,024 visits, 8 nested levels and 8 content fields. Original preview remains available.</span>}
  {content.partial&&<span className="material-context">{content.partial} · inspection covers supplied text only</span>}
  {content.unavailable&&<span className="material-context">{content.unavailable}</span>}
 </div>;
 if(fallback===undefined)return chips;
 return <>{chips}{inline&&selected?<InlineData text={selected.text} context={dataContext} sourceLabel={selected.representation==='structured field'?'Formatted field':undefined}/>:fallback}</>;
}
