import type { Operation, OperationStatus } from '@drishya/contracts';

export interface CommandQuery { q?:string; status?:OperationStatus; cursor?:string; direction?:'older'|'newer' }
export interface CapturedCommand { id:string; command:string; truncated:boolean; inputArtifactId?:string; status:OperationStatus; sequence:number; time?:string; tool:string; exitCode?:number|null }
export interface CommandPage { items:CapturedCommand[]; total:number; older?:string; newer?:string }
export function commandCursor(value:string):[number,string] {
  if(value.length>1024)throw new Error('Invalid command cursor');
  let row:unknown;try{row=JSON.parse(value);}catch{throw new Error('Invalid command cursor');}
  if(!Array.isArray(row)||row.length!==2||!Number.isSafeInteger(row[0])||row[0]<0||typeof row[1]!=='string'||row[1].length>512)throw new Error('Invalid command cursor');
  return row as [number,string];
}
const compare=(sequence:number,id:string,other:[number,string])=>other[0]-sequence||(id<other[1]?1:id>other[1]?-1:0);
const cursor=(row:Operation)=>JSON.stringify([row.startSequence,row.id]);
/** Captured shell/test inputs only. Search covers stored previews, never unseen blob text. */
export function commandPage(operations:Operation[],query:CommandQuery={}):CommandPage {
  const needle=(query.q??'').trim().toLowerCase();
  const all=operations.filter(op=>(op.detail.kind==='shell'||op.detail.kind==='test')&&(!query.status||op.status===query.status)&&(!needle||`${op.detail.command} ${op.tool}`.toLowerCase().includes(needle))).sort((a,b)=>compare(a.startSequence,a.id,[b.startSequence,b.id]));
  const anchor=query.cursor?commandCursor(query.cursor):undefined;
  const candidates=anchor?all.filter(op=>query.direction==='newer'?compare(op.startSequence,op.id,anchor)<0:compare(op.startSequence,op.id,anchor)>0):all;
  const selected=query.direction==='newer'&&anchor?candidates.slice(-25):candidates.slice(0,25);
  const first=selected[0],last=selected.at(-1);
  return {total:all.length,newer:first&&all.some(op=>compare(op.startSequence,op.id,[first.startSequence,first.id])<0)?cursor(first):undefined,older:last&&all.some(op=>compare(op.startSequence,op.id,[last.startSequence,last.id])>0)?cursor(last):undefined,items:selected.map(op=>{
    const detail=op.detail as Extract<Operation['detail'],{kind:'shell'|'test'}>;
    return {id:op.id,command:detail.command.slice(0,4096),truncated:detail.command.length>4096||op.artifactIds.some(id=>id.endsWith('_input')),inputArtifactId:op.artifactIds.find(id=>id.endsWith('_input')),status:op.status,sequence:op.startSequence,time:op.startTime,tool:op.tool,exitCode:detail.exitCode};
  })};
}
