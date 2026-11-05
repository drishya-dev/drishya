import {basename,resolve} from 'node:path';
import {stat} from 'node:fs/promises';
import {headRecords} from '@drishya/capture-core';
import type {DiscoveredSource} from '@drishya/contracts';

export interface SessionSegment {
  source:DiscoveredSource;
  boundary:{ordinal:number;bytes:number};
}
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const sameRoot=(a:string,b:string)=>process.platform==='win32'?resolve(a).toLowerCase()===resolve(b).toLowerCase():resolve(a)===resolve(b);
async function metadata(path:string) {
  const records=await headRecords(path,256*1024,4);
  const row=records.find(value=>record(value)&&value.type==='session_meta');
  if(!record(row)||!record(row.payload)) return;
  const meta=row.payload;
  if(typeof meta.id!=='string'||!uuid.test(meta.id)||typeof meta.cwd!=='string') return;
  if(meta.session_id!==undefined&&meta.session_id!==meta.id) return;
  return {family:meta.id,cwd:meta.cwd,mode:meta.history_mode,base:meta.history_base};
}

/** Only native parent references qualify. Titles, time and workspace proximity do not. */
export async function sessionSegments(path:string,sources:DiscoveredSource[]):Promise<{items:SessionSegment[];partial:boolean}> {
  // A journal deleted since import has no newer work to find; that is not an error to show.
  const parent=await metadata(path).catch((error:NodeJS.ErrnoException)=>{if(error.code==='ENOENT')return undefined;throw error;});
  const thread=basename(path).match(/([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})\.jsonl$/i)?.[1];
  if(!parent||!thread) return {items:[],partial:false};
  const parentSize=(await stat(path)).size;
  const candidates=sources.filter(source=>source.adapterId==='codex'&&resolve(source.path)!==resolve(path)&&(!source.cwd||sameRoot(source.cwd,parent.cwd))).sort((a,b)=>b.modifiedAt.localeCompare(a.modifiedAt));
  const items:SessionSegment[]=[];
  let partial=candidates.length>64;
  for(const source of candidates.slice(0,64)) {
    try {
      const childThread=basename(source.path).match(/([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})\.jsonl$/i)?.[1];
      if(!childThread||childThread===thread) continue;
      const child=await metadata(source.path);
      if(!child||child.family!==parent.family||!sameRoot(child.cwd,parent.cwd)||child.mode!=='paginated'||!record(child.base)) continue;
      const base=child.base;
      if(base.thread_id!==thread||!Number.isSafeInteger(base.end_ordinal_exclusive)||Number(base.end_ordinal_exclusive)<0||!Number.isSafeInteger(base.end_byte_offset)||Number(base.end_byte_offset)<=0||Number(base.end_byte_offset)>parentSize) continue;
      items.push({source,boundary:{ordinal:Number(base.end_ordinal_exclusive),bytes:Number(base.end_byte_offset)}});
    } catch { partial=true; /* Unreadable evidence cannot establish a relationship. */ }
  }
  return {items,partial};
}
