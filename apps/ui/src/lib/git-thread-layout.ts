import type {GitCommit} from '../../../daemon/src/git-types.ts';
import {commitRail} from './commit-rail.ts';
/** One horizontal time axis; lanes come from actual pending parent IDs, never branch-name guesses. */
export function gitThreadLayout(commits:Pick<GitCommit,'hash'|'parents'>[],primaryTip=commits[0]?.hash,seeds=new Set<string>(),offset=0) {
  const byCommit=new Map(commits.map(commit=>[commit.hash,commit]));
  const primary=new Set<string>(),nextSeeds=new Set<string>();let cursor=primaryTip;
  for(const seed of [primaryTip,...seeds]){cursor=seed;while(cursor&&byCommit.has(cursor)&&!primary.has(cursor)){primary.add(cursor);const parent=byCommit.get(cursor)!.parents[0];if(parent)nextSeeds.add(parent);cursor=parent;}}
  const rail=commitRail(commits),height=Math.max(300,rail.lanes*72+144),width=Math.max(640,(commits.length-1)*76+180);
  const nodes=commits.map((commit,index)=>({hash:commit.hash,x:width-90-index*76,y:primary.has(commit.hash)?height/2+Math.sin((index+offset)*.13)*Math.min(70,height*.18):height/2+(rail.rows[index]!.lane%2?1:-1)*(55+Math.floor(rail.rows[index]!.lane/2)*38),lane:rail.rows[index]!.lane,primary:primary.has(commit.hash)}));
  const byHash=new Map(nodes.map(node=>[node.hash,node]));
  const children=new Map<string,number>();for(const commit of commits)for(const parent of commit.parents)children.set(parent,(children.get(parent)??0)+1);
  const groups=new Map<string,string>(),population=new Map<string,number>();
  for(const node of nodes){if(node.primary)continue;let key=node.hash;const visited=new Set<string>();
    while(!visited.has(key)){visited.add(key);const parent=byCommit.get(key)?.parents[0];if(!parent||primary.has(parent)||(children.get(parent)??0)>1||!byCommit.has(parent))break;key=parent;}
    groups.set(node.hash,key);population.set(key,(population.get(key)??0)+1);
  }
  const largest=Math.max(1,...population.values());
  let edgeCount=0,omitted=0;
  const edges=commits.flatMap(commit=>commit.parents.flatMap(parent=>{
    const from=byHash.get(parent),to=byHash.get(commit.hash);if(!from||!to)return [];if(edgeCount>=2000){omitted++;return [];}edgeCount++;
    const bend=Math.max(28,(to.x-from.x)*.45);
    return [{from:parent,to:commit.hash,lane:to.lane,primary:from.primary&&to.primary,width:from.primary&&to.primary?32:Math.min(16,2+14*(population.get(groups.get(to.primary?from.hash:to.hash)??'')??1)/largest),path:`M${from.x},${from.y} C${from.x+bend},${from.y} ${to.x-bend},${to.y} ${to.x},${to.y}`}];
  }));
  const outside=commits.reduce((count,commit)=>count+commit.parents.filter(parent=>!byHash.has(parent)).length,0);
  return {nodes,edges,width,height,outside,omitted,primaryFound:primary.size>0,mainSeeds:[...primary,...nextSeeds]};
}
