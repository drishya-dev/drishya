import type {GitCommit} from '../../../daemon/src/git-types.ts';
export interface RailSegment {from:number;to:number;start:number;end:number}
export interface RailRow {lane:number;segments:RailSegment[];hidden:number}
/** Only actual parent IDs make edges. Excess lanes are omitted, never merged together. */
export function commitRail(commits:Pick<GitCommit,'hash'|'parents'>[],limit=16):{rows:RailRow[];lanes:number;continuations:number} {
  const active:(string|undefined)[]=[],rows:RailRow[]=[];let lanes=1;
  const free=()=>{const empty=active.indexOf(undefined);return empty>=0?empty:active.length<limit?active.length:-1;};
  for(const commit of commits){
    let lane=active.indexOf(commit.hash);const incoming=lane>=0;
    if(lane<0){lane=free();if(lane>=0)active[lane]=commit.hash;}
    const segments:RailSegment[]=[];
    for(let n=0;n<active.length;n++)if(active[n]&&n!==lane)segments.push({from:n,to:n,start:0,end:1});
    if(incoming)segments.push({from:lane,to:lane,start:0,end:.5});
    if(lane>=0)active[lane]=undefined;
    let hidden=0;
    for(const parent of commit.parents){
      let target=active.indexOf(parent);
      if(target<0){target=lane>=0&&!active[lane]?lane:free();if(target>=0)active[target]=parent;}
      if(lane>=0&&target>=0)segments.push({from:lane,to:target,start:.5,end:1});else hidden++;
    }
    lanes=Math.max(lanes,lane+1,active.length);
    rows.push({lane:lane>=0?lane:limit,segments,hidden});if(lane<0)lanes=limit+1;
  }
  return {rows,lanes,continuations:active.filter(Boolean).length};
}
