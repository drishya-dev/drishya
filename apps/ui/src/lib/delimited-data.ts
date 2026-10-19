export type Delimiter=','|'\t';
export interface DelimitedData {rows:string[][];columns:number}
export type DelimitedResult={data:DelimitedData;error?:never}|{data?:never;error:string};
/** Strict, bounded literal parsing. No type coercion, formula evaluation or delimiter inference. */
export function delimitedData(text:string,delimiter:Delimiter):DelimitedResult {
 if(text.length>262144||new TextEncoder().encode(text).length>262144)return {error:'Grid supports up to 256 KiB. Original text remains available.'};
 if(delimiter!==','&&delimiter!=='\t')return {error:'Choose CSV or TSV explicitly.'};
 const rows:string[][]=[];let row:string[]=[],field='',quoted=false,closed=false,fields=0,columns=0;
 const cell=()=>{row.push(field);field='';closed=false;fields++;return row.length<=32&&fields<=50000;};
 const record=()=>{columns=Math.max(columns,row.length);rows.push(row);row=[];return rows.length<=5000;};
 const limit=()=>({error:'Grid supports 5,000 records, 32 columns and 50,000 cells. Original text remains available.'} as const);
 for(let index=text.charCodeAt(0)===0xfeff?1:0;index<text.length;index++){
  const char=text[index]!;
  if(quoted){if(char==='"'){if(text[index+1]==='"'){field+='"';index++;}else{quoted=false;closed=true;}}else field+=char;continue;}
  if(char===delimiter){if(!cell())return limit();continue;}
  if(char==='\n'||char==='\r'){if(!cell()||!record())return limit();if(char==='\r'&&text[index+1]==='\n')index++;continue;}
  if(char==='"'&&!field&&!closed){quoted=true;continue;}
  if(closed||char==='"')return {error:'Malformed quoting. No partial grid is shown; inspect Original.'};
  field+=char;
 }
 if(quoted)return {error:'Unclosed quoted cell. The supplied text may be incomplete; inspect Original.'};
 if(field||closed||row.length){if(!cell()||!record())return limit();}
 return {data:{rows,columns}};
}
export interface DelimitedBlock {text:string;field:string}
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
/** Suggestions only; the user chooses the delimiter. Unknown siblings stay in the original result. */
export function delimitedBlocks(text:string):DelimitedBlock[]{
 if(text.length>262144||new TextEncoder().encode(text).length>262144)return [];
 const blocks:DelimitedBlock[]=[];
 const add=(value:unknown,field:string)=>{if(blocks.length<8&&typeof value==='string'&&/[\r\n]/.test(value)&&/[,\t]/.test(value))blocks.push({text:value,field});};
 let value:unknown;try{value=JSON.parse(text);}catch{add(text,'Captured text');return blocks;}
 const visit=(value:unknown,path:string,depth:number)=>{
  if(depth>4||blocks.length>=8)return;
  if(typeof value==='string'){add(value,path||'Captured JSON string');return;}
  if(Array.isArray(value)){for(let i=0;i<Math.min(value.length,64);i++)visit(value[i],`${path}/${i}`,depth+1);return;}
  if(!record(value))return;
  if(typeof value.output==='string'&&['exit_code','wall_time_seconds','chunk_id','session_id'].some(key=>key in value))add(value.output,`${path}/output`);
  if(value.status==='fulfilled')visit(value.value,`${path}/value`,depth+1);
  if(Array.isArray(value.content))for(let i=0;i<Math.min(value.content.length,64);i++){const block=value.content[i];if(record(block)&&block.type==='text')add(block.text,`${path}/content/${i}/text`);}
 };
 visit(value,'',0);return blocks;
}
