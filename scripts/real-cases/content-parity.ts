import type {RealCase} from './types.ts';

/** Inventory native calls, then count their actual projections. Tool mentions are not calls. */
export const contentParity:RealCase={
 name:'content-parity',about:'Cross-tool content families, unknown results and truthful absence on genuine captures',
 harnesses:['claude-code','codex'],prefilter:{'claude-code':'tool_use',codex:'response_item'},
 scan(row,harness){
  if(harness==='codex'){
   const payload=row.payload as Record<string,unknown>|undefined;
   return row.type==='response_item'&&['function_call','custom_tool_call','local_shell_call'].includes(String(payload?.type))?{hits:1}:undefined;
  }
  const content=(row.message as {content?:unknown})?.content;
  if(!Array.isArray(content))return;
  const hits=content.filter(block=>block?.type==='tool_use').length;
  return hits?{hits}:undefined;
 },
 verify(projection,found){
  const counts=new Map<string,number>();let missing=0,large=0,incomplete=0;
  for(const op of projection.operations){
   counts.set(op.detail.kind,(counts.get(op.detail.kind)??0)+1);
   const detail=op.detail as unknown as Record<string,unknown>;
   const text=typeof detail.resultPreview==='string'?detail.resultPreview:typeof detail.outputPreview==='string'?detail.outputPreview:undefined;
   if(text===undefined)missing++;
   else{
    if(text.length>16000)large++;
    if(/^\s*[[{]/.test(text)){try{JSON.parse(text);}catch{incomplete++;}}
   }
  }
  return[`${found.hits>0&&!projection.operations.length?'FAIL ':''}${found.hits} native calls; ${projection.operations.length} projected operations`,
   ...[...counts].sort(([a],[b])=>a.localeCompare(b)).map(([kind,count])=>`${kind}: ${count}`),
   `${large} results over 16000 characters; ${incomplete} incomplete JSON-like originals; ${missing} operations without textual result fields (not necessarily missing artifacts)`];
 }
};
