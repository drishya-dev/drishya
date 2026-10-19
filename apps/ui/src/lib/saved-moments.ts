import {redactText} from '../../../../packages/privacy/src/index.ts';
export interface SavedMoment {operationId:string;sequence:number;title:string;note:string}
export const momentKey=(kind:string,id:string)=>`drishya-moments-v1:${kind}:${id}`;
export function readMoments(raw:string):SavedMoment[] {
  if(raw.length>128*1024)return [];
  try {const items:unknown=JSON.parse(raw);if(!Array.isArray(items))return [];
    const seen=new Set<string>();
    return items.slice(0,50).flatMap(item=>{
      if(!item||typeof item.operationId!=='string'||item.operationId.length>512||seen.has(item.operationId)||!Number.isSafeInteger(item.sequence)||item.sequence<0||typeof item.title!=='string'||typeof item.note!=='string')return [];
      seen.add(item.operationId);return [{operationId:item.operationId,sequence:item.sequence,title:redactText(item.title.slice(0,240)).text,note:redactText(item.note.slice(0,1000)).text}];
    });
  }catch{return [];}
}
export function saveMoment(items:SavedMoment[],item:SavedMoment) {
  if(items.length>=50&&!items.some(row=>row.operationId===item.operationId))throw new Error('50 moments are saved. Remove one before saving another.');
  return readMoments(JSON.stringify([...items.filter(row=>row.operationId!==item.operationId),item]));
}
