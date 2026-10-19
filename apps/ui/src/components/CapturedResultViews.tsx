import {useMemo} from 'react';
import {capturedContent} from '../lib/captured-content.ts';
import {DataInspection} from './StructuredDataReader.tsx';
import {DelimitedInspection} from './DelimitedDataReader.tsx';
import {ResourceInspection} from './CapturedResources.tsx';

/** History and Inspector share the same choices; raw material retains its existing owner. */
export function CapturedResultViews({text}:{text:string}){
 const content=useMemo(()=>capturedContent(text),[text]);
 return <div className="captured-result-views" role="group" aria-label="Captured result views" onClick={event=>event.stopPropagation()}>
  <DataInspection text={text} available={content.json}/>
  <DelimitedInspection text={text} candidates={content.delimited}/>
  <ResourceInspection text={text} candidates={content.resources??null}/>
 </div>;
}
