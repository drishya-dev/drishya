/** Bounded consecutive metadata pages; loading an edge releases only the opposite edge. */
export function withGitPage<T extends {start:number}>(previous:Map<number,T>,next:T,limit=6):Map<number,T> {
  const cache=new Map(previous);cache.set(next.start,next);
  while(cache.size>limit){const keys=[...cache.keys()].sort((a,b)=>a-b);cache.delete(next.start>=keys.at(-1)!?keys[0]!:keys.at(-1)!);}
  return cache;
}
