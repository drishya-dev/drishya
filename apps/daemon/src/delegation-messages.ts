import type {Observation} from '@drishya/contracts';
import type {Store} from '@drishya/store';
import type {DelegationStep} from './delegation-types.ts';

const metadata=(o:Observation)=>{
  const p=o.payload as Record<string,any>;
  return o.source.adapterId==='codex'&&o.kind==='message.assistant'&&p.delivery&&typeof p.delivery==='object'?p.delivery:undefined;
};

/** A delivery marked FINAL_ANSWER is the child's message, never a parent lifecycle event. */
export function childMessageLabel(o:Observation|undefined):string {
  const delivery=o&&metadata(o);
  return delivery?.state==='partial'?'Child message · partially recorded':'Child message';
}

/** Textless native deliveries have no prose beat. Keep their captured availability in the exact child thread. */
export function unavailableChildMessages(store:Store,recordingId:string,call:Observation,address:string|undefined,recipient:string,rank:(sequence:number)=>number,cutoff:number):DelegationStep[] {
  if(!address)return [];
  const rows=store.db.prepare(`SELECT body FROM observations WHERE recording_id=? AND kind='message.assistant'
    AND json_extract(body,'$.source.sourceId')=? AND json_extract(body,'$.source.generation')=?
    AND json_extract(body,'$.payload.delivery.sender')=? AND json_extract(body,'$.payload.delivery.recipient')=?
    AND json_extract(body,'$.payload.text')='' ORDER BY seq`).all(recordingId,call.source.sourceId,call.source.generation,address,recipient) as {body:string}[];
  return rows.flatMap(row=>{
    const o=JSON.parse(row.body) as Observation,delivery=metadata(o),sequence=rank(o.receivedSequence);
    if(sequence<rank(call.receivedSequence)||sequence>cutoff||!delivery||!['encrypted','empty'].includes(delivery.state))return [];
    return [{id:o.id,kind:'message' as const,label:delivery.state==='encrypted'?'Child message unavailable · Codex stored the payload encrypted':'Child message · no payload recorded',sequence,time:o.sourceTime}];
  });
}
