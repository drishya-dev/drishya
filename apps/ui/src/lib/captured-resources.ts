export interface CapturedResource {field:string;uri:string;title:string;description?:string;mime?:string;text?:string;binary?:boolean;size?:number}
export interface ResourceSelection {items:CapturedResource[];limited:boolean}
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
/** Navigation is explicit and HTTP(S)-only. Never turn a captured URI into an automatic fetch. */
export function resourceHref(uri:string):string|undefined{
 if(uri.length>8192||/[\u0000-\u0020\u007f\\]/.test(uri))return;
 try{const url=new URL(uri);if(!['https:','http:'].includes(url.protocol)||url.username||url.password||!url.hostname)return;return url.href;}catch{return;}
}
/** Sealed content/resource/result fields only; no scraping prose, code, paths or HTML. */
export function capturedResources(text:string):ResourceSelection|undefined{
 if(text.length>262144||new TextEncoder().encode(text).length>262144)return;
 let value:unknown;try{value=JSON.parse(text);}catch{return;}
 const items:CapturedResource[]=[];let limited=false,visited=0;
 const push=(item:Record<string,unknown>,field:string,uri:unknown)=>{
  if(typeof uri!=='string'||!uri||uri.length>8192)return;
  if(items.length>=64){limited=true;return;}
  items.push({field,uri,title:typeof item.title==='string'?item.title:typeof item.name==='string'?item.name:uri,
   ...(typeof item.description==='string'?{description:item.description}:typeof item.snippet==='string'?{description:item.snippet}:{}),
   ...(typeof item.mimeType==='string'?{mime:item.mimeType}:{}),...(typeof item.text==='string'?{text:item.text}:{}),...(typeof item.blob==='string'?{binary:true}:{}),...(typeof item.size==='number'&&Number.isSafeInteger(item.size)&&item.size>=0?{size:item.size}:{})});
 };
 const visit=(value:unknown,field:string,depth:number)=>{
  if(++visited>1024){limited=true;return;}if(depth>8){limited=true;return;}
  if(Array.isArray(value)){if(value.length>64)limited=true;for(let i=0;i<Math.min(64,value.length);i++)visit(value[i],`${field}/${i}`,depth+1);return;}
  if(!record(value))return;
  if(value.type==='resource_link')push(value,field,value.uri);
  if(value.type==='resource'&&record(value.resource))push(value.resource,`${field}/resource`,value.resource.uri);
  if(Array.isArray(value.content))visit(value.content,`${field}/content`,depth+1);
  if(Array.isArray(value.results)){if(value.results.length>64)limited=true;for(let i=0;i<Math.min(value.results.length,64);i++){const item=value.results[i];if(record(item))push(item,`${field}/results/${i}`,item.url);}}
  if(value.status==='fulfilled')visit(value.value,`${field}/value`,depth+1);
  const embedded=value.type==='text'&&typeof value.text==='string'?{text:value.text,path:`${field}/text (JSON)`}:typeof value.output==='string'&&['exit_code','wall_time_seconds','chunk_id','session_id'].some(key=>key in value)?{text:value.output,path:`${field}/output (JSON)`}:undefined;
  if(embedded){let nested:unknown;try{nested=JSON.parse(embedded.text);}catch{return;}visit(nested,embedded.path,depth+1);}
 };
 visit(value,'',0);return items.length?{items,limited}:undefined;
}

export interface CapturedDocument {field:string;text:string;mime?:string;title?:string}
export interface DocumentSelection {items:CapturedDocument[];limited:boolean}
/** Only sealed text blocks/document bodies, never guessed paths or prose scraping. */
export function capturedDocuments(text:string):DocumentSelection|undefined{
 if(text.length>262144||new TextEncoder().encode(text).length>262144)return;
 let root:unknown;try{root=JSON.parse(text);}catch{return;}
 const items:CapturedDocument[]=[];let limited=false,visited=0;
 const push=(value:Record<string,unknown>,field:string)=>{
  if(typeof value.text!=='string')return;
  const mime=typeof value.mimeType==='string'?value.mimeType:undefined;
  // Binary MIME bodies are references, not decoded documents.
  if(mime&&!/^(text\/|application\/(?:json|[^;]+\+json)(?:;|$))/i.test(mime.trim()))return;
  if(items.length>=8){limited=true;return;}
  items.push({field,text:value.text,...(mime?{mime}:{}),...(typeof value.title==='string'?{title:value.title}:typeof value.name==='string'?{title:value.name}:{})});
 };
 const visit=(value:unknown,field:string,depth:number)=>{
  if(++visited>1024||depth>8){limited=true;return;}
  if(Array.isArray(value)){if(value.length>64)limited=true;for(let i=0;i<Math.min(64,value.length);i++)visit(value[i],`${field}/${i}`,depth+1);return;}
  if(!record(value))return;
  if(value.type==='resource'&&record(value.resource))push(value.resource,`${field}/resource/text`);
  else if(value.type==='text'||(depth===0&&typeof value.mimeType==='string'))push(value,`${field}/text`);
  if(Array.isArray(value.content))visit(value.content,`${field}/content`,depth+1);
  if(value.status==='fulfilled')visit(value.value,`${field}/value`,depth+1);
  const nested=value.type==='text'&&typeof value.text==='string'?{text:value.text,path:`${field}/text (JSON)`}:typeof value.output==='string'&&['exit_code','wall_time_seconds','chunk_id','session_id'].some(key=>key in value)?{text:value.output,path:`${field}/output (JSON)`}:undefined;
  if(nested){let parsed:unknown;try{parsed=JSON.parse(nested.text);}catch{return;}visit(parsed,nested.path,depth+1);}
 };
 visit(root,'',0);return items.length?{items,limited}:undefined;
}
