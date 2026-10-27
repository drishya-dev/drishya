import {useMemo,useState} from 'react';
import {capturedContent,type CapturedContentEvidence} from '../lib/captured-content.ts';
import {DataInspection} from './StructuredDataReader.tsx';
import {DelimitedInspection} from './DelimitedDataReader.tsx';
import {DocumentInspection,ResourceInspection} from './CapturedResources.tsx';
import './captured-content.css';

/** History and Inspector share the same choices; raw material retains its existing owner. */
export function CapturedResultViews({text,evidence,argumentsView=false}:{text:string;evidence?:CapturedContentEvidence;argumentsView?:boolean}){
 const content=useMemo(()=>capturedContent(text,evidence),[text,evidence?.mime,evidence?.partial,evidence?.unavailable]);
 const [field,setField]=useState<string>();
 const preferred=content.data.find(item=>item.representation==='structured field')??content.data.find(item=>item.field!=='Whole captured result'&&(item.mime==='application/json'||item.mime?.endsWith('+json')))??content.data[0];
 const selected=content.data.find(item=>item.field===field)??preferred;
 const manual=!content.limited&&text.length<=262144&&text.trim().length>=32&&text.includes('\n');
 const dataContext=[content.partial,selected&&selected.field!=='Whole captured result'?`Captured field ${selected.field}${selected.representation==='structured field'?' · captured structured values; JSON formatting derived · choose Whole captured result for original source':''}`:undefined].filter(Boolean).join(' · ')||undefined;
 return <div className="captured-result-views" role="group" aria-label={argumentsView?'Captured argument views':'Captured result views'} onClick={event=>event.stopPropagation()}>
  {content.data.length>1&&<details className="captured-data-sources"><summary title={selected?.field}>Sources · {content.data.length}</summary><label className="material-context captured-data-choice">Data source <select aria-label="Captured content" value={selected?.field} onChange={event=>setField(event.target.value)}>{content.data.map(item=><option key={item.field} value={item.field}>{item.field}</option>)}</select></label>
   {selected?.representation==='structured field'&&<span className="material-context">Captured structured field · JSON formatting derived · whole result retains original source</span>}
  </details>}
  <DataInspection text={selected?.text??text} available={content.json&&(!argumentsView||text.length>2)} label={argumentsView?'Inspect argument data':undefined} context={dataContext} sourceLabel={selected?.representation==='structured field'?'Formatted field':undefined}/>
  <ResourceInspection text={text} candidates={content.resources??null} context={content.partial}/>
  <DelimitedInspection text={text} candidates={content.delimited} context={content.partial}/>
  <DocumentInspection text={text} candidates={content.documents??null} context={content.partial}/>
  {!argumentsView&&<details className="result-original" hidden={!manual}><summary>Choose reading format</summary>
   <span className="material-context">Explicit reading choice · supplied captured text only</span>
   <DataInspection text={text} available={manual&&!content.json} label="Read as JSON" context={content.partial}/>
   <DelimitedInspection text={text} candidates={manual&&!content.delimited.length?[{field:'Supplied captured text',text}]:[]} context={content.partial}/>
   <DocumentInspection text={text} candidates={manual&&!content.documents?{items:[{field:'Supplied captured text',text}],limited:false}:null} context={content.partial}/>
  </details>}
  {content.limited&&<span className="material-context">Reading choices limited to 256 KiB, 64 siblings, 1,024 visits, 8 nested levels and 8 content fields. Original captured preview remains available.</span>}
  {content.partial&&<span className="material-context">{content.partial} · inspection covers supplied captured text only</span>}
  {content.unavailable&&<span className="material-context">{content.unavailable}</span>}
 </div>;
}
