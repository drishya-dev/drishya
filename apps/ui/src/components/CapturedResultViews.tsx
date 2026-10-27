import {useMemo,useState} from 'react';
import {capturedContent,type CapturedContentEvidence} from '../lib/captured-content.ts';
import {DataInspection} from './StructuredDataReader.tsx';
import {DelimitedInspection} from './DelimitedDataReader.tsx';
import {DocumentInspection,ResourceInspection} from './CapturedResources.tsx';

/** History and Inspector share the same choices; raw material retains its existing owner. */
export function CapturedResultViews({text,evidence,argumentsView=false}:{text:string;evidence?:CapturedContentEvidence;argumentsView?:boolean}){
 const content=useMemo(()=>capturedContent(text,evidence),[text,evidence?.mime,evidence?.partial,evidence?.unavailable]);
 const [field,setField]=useState('Whole captured result');
 const selected=content.data.find(item=>item.field===field)??content.data[0];
 return <div className="captured-result-views" role="group" aria-label={argumentsView?'Captured argument views':'Captured result views'} onClick={event=>event.stopPropagation()}>
  {content.data.length>1&&<label className="material-context">Data source <select aria-label="Captured content" value={selected?.field} onChange={event=>setField(event.target.value)}>{content.data.map(item=><option key={item.field} value={item.field}>{item.field}</option>)}</select></label>}
  {selected?.representation==='structured field'&&<span className="material-context">Captured structured field · JSON formatting derived · whole result retains original source</span>}
  <DataInspection text={selected?.text??text} available={content.json} label={argumentsView?'Inspect argument data':undefined}/>
  <DelimitedInspection text={text} candidates={content.delimited}/>
  <ResourceInspection text={text} candidates={content.resources??null}/>
  <DocumentInspection text={text} candidates={content.documents??null}/>
  {!argumentsView&&text.length<=262144&&!content.limited&&<details className="result-original"><summary>Choose reading format</summary>
   <span className="material-context">Explicit reading choice · supplied captured text only</span>
   {!content.json&&<DataInspection text={text} available label="Read as JSON"/>}
   {!content.delimited.length&&<DelimitedInspection text={text} candidates={[{field:'Supplied captured text',text}]}/>}
   {!content.documents&&<DocumentInspection text={text} candidates={{items:[{field:'Supplied captured text',text}],limited:false}}/>}
  </details>}
  {content.limited&&<span className="material-context">Reading choices limited to 256 KiB, 64 siblings, 8 nested levels and 8 content fields. Original captured preview remains available.</span>}
  {content.partial&&<span className="material-context">{content.partial} · inspection covers supplied captured text only</span>}
  {content.unavailable&&<span className="material-context">{content.unavailable}</span>}
 </div>;
}
