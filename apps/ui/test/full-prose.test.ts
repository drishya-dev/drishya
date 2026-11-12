import {expect,it} from 'vitest';
import type {Artifact,ArtifactSlice} from '@drishya/contracts';
import type {DataSource} from '../src/api.ts';
import {proseBody,readFullProse} from '../src/lib/full-prose.ts';

const artifact={id:'art_prose_one_prose',kind:'excerpt',blob:'immutable'} as Artifact;
it('joins UTF-8 chunks without losing multiline, non-ASCII or long single-line prose',async()=>{
 const parts=['A'.repeat(2_100_000),' दृश्य\n','Last paragraph'];let calls=0;
 const source={artifactChunk:async(_r:string,_id:string,start:number)=>{
  const text=parts[calls++]!,next=start+Buffer.byteLength(text);
  return{available:true,artifact,text,start,next,totalBytes:Buffer.byteLength(parts.join('')),hasMore:calls<parts.length};
 }} as DataSource;
 const result=await readFullProse(source,'rec',artifact.id);
 expect(result.text).toBe(parts.join(''));expect(result.truncated).toBe(false);expect(calls).toBe(3);
});
it.each(['missing','stalled','changed','cut'])('rejects %s continuation instead of claiming full prose',async(kind)=>{
 let call=0;
 const source={artifactChunk:async(_r:string,_a:string,start:number)=>{
  call++;
  if(kind==='missing')return{available:false,reason:'no-longer-stored'};
  return{available:true,artifact:{...artifact,blob:kind==='changed'&&call>1?'other':'immutable'},text:kind==='stalled'?'':'a',start,next:kind==='stalled'?start:start+1,totalBytes:3,hasMore:kind!=='cut'};
 }} as DataSource;
 await expect(readFullProse(source,'rec',artifact.id)).rejects.toThrow();
});
it('keeps literal routing-looking prose and omits only an evidence-qualified legacy wrapper',()=>{
 const text='Message Type: FINAL_ANSWER\nTask name: /root\nSender: /root/child\nPayload:\nCaptured child text';
 const slice={artifact,text} as ArtifactSlice;
 expect(proseBody(slice)).toBe(text);
 expect(proseBody({...slice,artifact:{...artifact,note:'The preview shows the captured child payload with its routing wrapper omitted. This is the original captured message.'}})).toBe('Captured child text');
});
it('refuses a capped line-only source',async()=>{
 const source={artifact:async()=>({artifact,available:true,text:'cut',truncated:true,hasMore:false})} as DataSource;
 await expect(readFullProse(source,'rec',artifact.id)).rejects.toThrow('cannot load');
});
