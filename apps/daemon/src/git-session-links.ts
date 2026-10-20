import type {Store} from '@drishya/store';
import type {GitSessionLink} from './git-types.ts';

/**
 * Commits whose hash (full, or the seven characters `git commit` prints) appears in a tool result of this recording.
 * That is the evidence: the earliest such output, with its turn. It does not say this session created the commit,
 * because `git log` output also lists commits others made.
 */
export function sessionLinks(store:Store,recordingId:string,hashes:string[]):Record<string,GitSessionLink> {
  const links:Record<string,GitSessionLink>={};
  if(recordingId.includes('+'))return links;
  for(const hash of hashes.slice(0,100)){
    const hits=[...store.search(recordingId,hash.slice(0,7),20),...store.search(recordingId,hash,5)].filter(hit=>hit.kind==='tool.result');
    const first=hits.sort((a,b)=>(a.time??'').localeCompare(b.time??''))[0];
    if(first)links[hash]={observationId:first.observationId,...(first.operationId?{operationId:first.operationId}:{}),...(first.turn?{turn:first.turn}:{}),...(first.time?{time:first.time}:{})};
  }
  return links;
}
