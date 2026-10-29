import type {RealCase} from './types.ts';
import {capturedContent} from '../../apps/ui/src/lib/captured-content.ts';
import {delimitedData} from '../../apps/ui/src/lib/delimited-data.ts';

/** Discovery suggestions only: recognizing rectangular text never chooses the product's delimiter. */
function candidates(text:unknown) {
 if(typeof text!=='string')return {hits:0,only:0};
 let hits=0,only=0;
 for(const block of capturedContent(text).delimited)for(const delimiter of[',','\t']as const){
  const data=delimitedData(block.text,delimiter).data;
  const records=data?.rows.filter(row=>row.length!==1||row[0]!=='');
  if(data&&records&&records.length>=3&&data.columns>=2&&records.every(row=>row.length===data.columns)){hits++;if(delimiter==='\t')only++;}
 }
 return {hits,only};
}
export const readingDelimited:RealCase={
 name:'reading-delimited',about:'Rectangular captured CSV/TSV candidates; delimiter selection remains explicit',harnesses:['codex','claude-code'],prefilter:',',
 scan(row,harness){
  if(harness==='claude-code'){
   const blocks=(row.message as {content?:unknown}|undefined)?.content;if(!Array.isArray(blocks))return;
   let hits=0,only=0;for(const block of blocks){if(block?.type!=='tool_result')continue;const text=typeof block.content==='string'?block.content:JSON.stringify({content:block.content});const result=candidates(text);hits+=result.hits;only+=result.only;}return hits?{hits,only}:undefined;
  }
  const payload=row.payload as {type?:string;output?:unknown;item?:{type?:string;aggregated_output?:unknown;stdout?:unknown}}|undefined;
  const text=payload?.type==='item_completed'&&payload.item?.type==='CommandExecution'?payload.item.aggregated_output??payload.item.stdout:payload?.type==='function_call_output'||payload?.type==='custom_tool_call_output'?payload.output:undefined;
  const result=candidates(text);return result.hits?result:undefined;
 },
 verify(projection){let hits=0,only=0;for(const op of projection.operations){const detail=op.detail as {outputPreview?:string;resultPreview?:string};const result=candidates(detail.outputPreview??detail.resultPreview);hits+=result.hits;only+=result.only;}return[`${hits} strict rectangular candidates in stored previews (${only} TSV); syntax alone does not establish a dataset or infer its delimiter`];},
};
