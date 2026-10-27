import {capturedDocuments,capturedResources} from './captured-resources.ts';
import {delimitedBlocks, type DelimitedBlock} from './delimited-data.ts';
import {dataText, isDataRecord, parseCapturedJson, pointerKey} from './structured-data.ts';

export interface CapturedContentEvidence {
 /** Supplied captured metadata, never inferred from a filename or command. */
 mime?:string;
 partial?:string;
 unavailable?:string;
}
export interface CapturedDataCandidate {field:string;text:string;mime?:string;representation:'captured text'|'structured field'}
const byteLimit=262144;
const mimeOf=(value:unknown)=>typeof value==='string'?value.split(';')[0]!.trim().toLowerCase():undefined;
const jsonMime=(mime:string|undefined)=>mime==='application/json'||mime?.endsWith('+json');

/** Bounded reading choices from sealed fields. Never loads a path, URL or missing artifact. */
export function capturedContent(text:string,evidence:CapturedContentEvidence={}){
 const data:CapturedDataCandidate[]=[],delimited:DelimitedBlock[]=[];
 let limited=false,visited=0;
 const rootMime=mimeOf(evidence.mime);
 const result=()=>({json:data.length>0,data,delimited,resources:capturedResources(text),documents:capturedDocuments(text),limited,...(evidence.partial?{partial:evidence.partial}:{}),...(evidence.unavailable?{unavailable:evidence.unavailable}:{})});
 if(text.length>byteLimit||new TextEncoder().encode(text).length>byteLimit){limited=true;return result();}
 const add=(body:string,field:string,mime:string|undefined,representation:CapturedDataCandidate['representation'])=>{
  if((jsonMime(mime)||/^\s*[\[{]/.test(body))&&!data.some(item=>item.field===field)){
   if(data.length<9)data.push({field,text:body,...(mime?{mime}:{}),representation});else limited=true;
  }
  if(mime==='text/csv'||mime==='text/tab-separated-values'){
   if(delimited.length<8)delimited.push({field,text:body});else limited=true;
  }
 };
 add(text,'Whole captured result',rootMime,'captured text');
 const nested=(body:string,path:string,depth:number)=>{try{visit(parseCapturedJson(body),path,depth+1);}catch{/* Keep incomplete/non-JSON text in its original owner. */}};
 const visit=(value:unknown,path:string,depth:number)=>{
  if(++visited>1024||depth>8){limited=true;return;}
  if(Array.isArray(value)){
   if(value.length>64)limited=true;
   for(let index=0;index<Math.min(64,value.length);index++)visit(value[index],`${path}/${index}`,depth+1);
   return;
  }
  if(!isDataRecord(value))return;
  const mime=mimeOf(value.mimeType??value.mime);
  if((value.type==='text'||(depth===0&&mime))&&typeof value.text==='string'){
   add(value.text,`${path}/text`,mime,'captured text');nested(value.text,`${path}/text (JSON)`,depth);
  }
  if(value.type==='resource'&&isDataRecord(value.resource)&&typeof value.resource.text==='string'){
   add(value.resource.text,`${path}/resource/text`,mimeOf(value.resource.mimeType),'captured text');
  }
  if(Array.isArray(value.content))visit(value.content,`${path}/content`,depth+1);
  if(value.status==='fulfilled')visit(value.value,`${path}/value`,depth+1);
  if(typeof value.output==='string'&&['exit_code','wall_time_seconds','chunk_id','session_id'].some(key=>key in value)){
   add(value.output,`${path}/output`,mime,'captured text');nested(value.output,`${path}/output (JSON)`,depth);
  }
  for(const key of ['structuredContent','structured_content'] as const){
   const child=value[key];if(isDataRecord(child)||Array.isArray(child))add(dataText(child),`${path}/${pointerKey(key)}`, 'application/json','structured field');
  }
  if(isDataRecord(value.result)||Array.isArray(value.result))visit(value.result,`${path}/result`,depth+1);
 };
 nested(text,'',-1);
 for(const block of delimitedBlocks(text)){
  if(delimited.some(item=>item.field===block.field&&item.text===block.text))continue;
  if(delimited.length<8)delimited.push(block);else limited=true;
 }
 return result();
}
