import type {Projection} from '@drishya/contracts';
/** Operation sequence fields are timeline positions; timeline entries retain ingest sequences. */
export function operationObservations(p:Projection) {
  const starts=new Map<string,number>(),ends=new Map<string,number>();
  for(const item of p.timeline){
    if(item.type==='op-start')starts.set(item.operationId,Math.min(starts.get(item.operationId)??Infinity,item.sequence));
    else if(item.type==='op-end')ends.set(item.operationId,Math.max(ends.get(item.operationId)??-1,item.sequence));
  }
  return {starts,ends};
}
export function operationObservation(p:Projection|undefined,id:string) {return p?operationObservations(p).starts.get(id):undefined;}
