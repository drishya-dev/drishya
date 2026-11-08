import type {ArtifactSlice} from '@drishya/contracts';
import {legacyDeliveryEnvelope} from '@drishya/projection';
import type {DataSource} from '../api.ts';

/** Load immutable captured prose in bounded UTF-8 responses, not line slices. */
export async function readFullProse(source:DataSource,recording:string,id:string):Promise<ArtifactSlice> {
 if(!source.artifactChunk){
  const slice=await source.artifact(recording,id,{start:0,count:20_000});
  if(!slice.available)throw Error(slice.reason==='no-longer-stored'?'This message is no longer stored.':'The full message was not recorded.');
  if(slice.available&&(slice.hasMore||slice.truncated))throw Error('This source cannot load the complete recorded message.');
  return slice;
 }
 const pieces:string[]=[];let start=0,blob:string|undefined,total:number|undefined;
 for(;;){
  const chunk=await source.artifactChunk(recording,id,start);
  if(!chunk.available)throw Error(chunk.reason==='no-longer-stored'?'This message is no longer stored.':'The full message was not recorded.');
  if(!chunk.artifact||typeof chunk.text!=='string'||chunk.start!==start||!Number.isSafeInteger(chunk.next)||!Number.isSafeInteger(chunk.totalBytes))throw Error('The recorded message response is incomplete.');
  if(start===0){blob=chunk.artifact.blob;total=chunk.totalBytes;}
  if(chunk.artifact.blob!==blob||chunk.totalBytes!==total)throw Error('The recorded message changed while loading. Retry it.');
  const next=chunk.next!;
  if(next<start||next>total!||(chunk.hasMore&&next===start)||new TextEncoder().encode(chunk.text).length!==next-start||(!chunk.hasMore&&next!==total))throw Error('The recorded message response is incomplete.');
  pieces.push(chunk.text);
  if(!chunk.hasMore){
   const text=pieces.join('');
   const lines=text.split('\n').length;
   return {artifact:chunk.artifact,available:true,start:0,text,returnedLines:lines,totalLines:lines,totalBytes:total!,truncated:false,hasMore:false};
  }
  start=next;
 }
}

/** Only the projection's qualified legacy-delivery artifacts hide routing text. */
export function proseBody(slice:ArtifactSlice):string {
 if(slice.artifact.note==='The preview shows the captured child payload with its routing wrapper omitted. This is the original captured message.')return legacyDeliveryEnvelope(slice.text)?.text??slice.text;
 return slice.text;
}
