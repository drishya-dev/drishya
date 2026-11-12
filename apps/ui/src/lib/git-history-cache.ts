import type {GitCommit,GitCommitDetail,GitHistoryPage} from '../../../daemon/src/git-types.ts';
import {gitNetworkLayout,type NetworkLayout} from './git-network-layout.ts';
import {gitThreadLayout} from './git-thread-layout.ts';
import type {LightBranch} from './git-light.ts';
import {resolveSquashJoins,squashEvidenceSignature,type SquashEvidence} from './git-squash.ts';

export interface NetworkLabel {
  hash:string;
  x:number;
  y:number;
  main:boolean;
  text:string;
  title:string;
}

export interface NetworkGraphBundle {
  mainTip?:string;
  layout:NetworkLayout;
  mainSeeds:Set<string>;
  main:Set<string>;
  branches:LightBranch[];
  branchOf:Map<string,LightBranch>;
  byHash:Map<string,GitCommit>;
  labels:NetworkLabel[];
}

/** Runs of first-parent commits off the main line: where each left, what it holds, and where it rejoined. Git links only. */
export function networkBranches(commits:GitCommit[],main:Set<string>,lanes:Map<string,number>):LightBranch[] {
  const byHash=new Map(commits.map(commit=>[commit.hash,commit])),children=new Map<string,string[]>();
  for(const commit of commits)for(const parent of commit.parents)children.set(parent,[...(children.get(parent)??[]),commit.hash]);
  const taken=new Set<string>(),branches:LightBranch[]=[];
  for(const commit of [...commits].reverse()){
    if(main.has(commit.hash)||taken.has(commit.hash))continue;
    const members=[commit.hash];taken.add(commit.hash);
    for(let cursor=commit.hash;;){
      const next=(children.get(cursor)??[]).map(hash=>byHash.get(hash)!).find(child=>child&&child.parents[0]===cursor&&!main.has(child.hash)&&!taken.has(child.hash));
      if(!next)break;members.push(next.hash);taken.add(next.hash);cursor=next.hash;
    }
    const head=members.at(-1)!,fork=commit.parents[0]&&byHash.has(commit.parents[0])?commit.parents[0]:undefined;
    const merge=(children.get(head)??[]).find(hash=>main.has(hash)&&byHash.get(hash)!.parents[0]!==head);
    branches.push({key:commit.hash,members,fork,merge,head,side:1,tier:lanes.get(commit.hash)??1});
  }
  return branches;
}

export function buildNetworkGraphBundle(
  commits:GitCommit[],
  primary?:{name:string;tip:string},
  seeds=new Set<string>(),
  offset=0,
  scale=1,
  evidence?:SquashEvidence,
):NetworkGraphBundle {
  // The main line starts at the primary branch's tip; when that tip is older than the loaded history (a stale local branch),
  // its remote-tracking ref stands in, then the newest commit.
  const tip=primary?.tip,name=primary?.name;
  const mainTip=(tip&&commits.some(commit=>commit.hash===tip))
    ?tip
    :(name?commits.find(commit=>commit.labels.some(label=>label===name||label.endsWith(`/${name}`))):undefined)?.hash??commits[0]?.hash;
  const baseLayout=gitNetworkLayout(commits,mainTip,{step:44*scale});
  // Paging the main line still follows the first-parent seeds the history reader keeps.
  const mainSeeds=new Set(gitThreadLayout(commits,primary?.tip,seeds,offset).mainSeeds);
  const main=new Set(baseLayout.nodes.filter(node=>node.main).map(node=>node.hash));
  const branches=networkBranches(commits,main,new Map(baseLayout.nodes.map(node=>[node.hash,node.lane])));
  const joins=resolveSquashJoins(commits,main,branches,baseLayout.nodes,evidence);
  const squashMap=joins.size?new Map([...joins.values()].map(join=>[join.head,join.target] as const)):undefined;
  for(const branch of branches){
    const join=joins.get(branch.head);
    if(!join)continue;
    branch.merge=join.target;
    branch.squash=true;
    branch.squashBasis=join.basis;
    if(join.pr!==undefined)branch.squashPr=join.pr;
  }
  const layout=squashMap?gitNetworkLayout(commits,mainTip,{step:44*scale,squash:squashMap}):baseLayout;
  const branchOf=new Map(branches.flatMap(branch=>branch.members.map(hash=>[hash,branch] as const)));
  const byHash=new Map(commits.map(commit=>[commit.hash,commit]));
  // Head labels never overlap: newest first, a label that would cover one already placed on its lane is left to the commit's peek.
  const taken=new Map<number,[number,number][]>(),labels:NetworkLabel[]=[];
  for(const node of [...layout.nodes].sort((a,b)=>b.x-a.x)){
    const names=byHash.get(node.hash)?.labels;if(!names?.length)continue;
    const text=`${names[0]}${names.length>1?` +${names.length-1}`:''}`,width=Math.min(160,text.length*6.6+14),x=Math.min(Math.max(node.x,width/2+2),layout.width-width/2-2),from=x-width/2-6,to=x+width/2+6,row=taken.get(node.lane)??[];
    if(row.some(([a,b])=>from<b&&to>a))continue;row.push([from,to]);taken.set(node.lane,row);labels.push({hash:node.hash,x,y:node.y,main:node.main,text,title:names.join(', ')});
  }
  return {mainTip,layout,mainSeeds,main,branches,branchOf,byHash,labels};
}

export class GitNetworkLayoutCache {
  private entries=new Map<string,NetworkGraphBundle>();
  private signatures=new WeakMap<GitCommit[],string>();
  private maxEntries:number;
  hits=0;
  misses=0;
  constructor(maxEntries=32) {
    if(!Number.isSafeInteger(maxEntries)||maxEntries<1)throw new RangeError('GitNetworkLayoutCache maxEntries must be a positive integer.');
    this.maxEntries=maxEntries;
  }
  private commitSignature(commits:GitCommit[]):string {
    const remembered=this.signatures.get(commits);
    if(remembered!==undefined)return remembered;
    const value=`${commits.length}:${commits.map(commit=>`${commit.hash}:${commit.parents.join(',')}:${commit.labels.join('\0')}`).join('|')}`;
    this.signatures.set(commits,value);
    return value;
  }
  resolve(
    commits:GitCommit[],
    primary?:{name:string;tip:string},
    seeds=new Set<string>(),
    offset=0,
    scale=1,
    evidence?:SquashEvidence,
  ):{bundle:NetworkGraphBundle;cached:boolean} {
    const key=JSON.stringify([this.commitSignature(commits),primary?.tip??'',primary?.name??'',offset,scale,squashEvidenceSignature(evidence)]);
    const hit=this.entries.get(key);
    if(hit){
      this.hits++;
      this.entries.delete(key);this.entries.set(key,hit);
      return {bundle:hit,cached:true};
    }
    this.misses++;
    const bundle=buildNetworkGraphBundle(commits,primary,seeds,offset,scale,evidence);
    while(this.entries.size>=this.maxEntries){
      const oldest=this.entries.keys().next().value;
      if(oldest===undefined)break;
      this.entries.delete(oldest);
    }
    this.entries.set(key,bundle);
    return {bundle,cached:false};
  }
  clear() {
    this.entries.clear();
    this.hits=0;this.misses=0;
  }
  get size() {return this.entries.size;}
}

export interface GitHistorySnapshot {
  approved?:boolean;
  start:number;
  reference:string;
  referenceStart:number;
  query:string;
  filter:string;
  retry:number;
  value?:{key:string;data:GitHistoryPage};
  pages:Map<number,GitHistoryPage>;
  selected:string;
  parent:number;
  fileStart:number;
  detail?:GitCommitDetail;
  detailKey:string;
  detailCache:Map<string,{detail:GitCommitDetail;path:string}>;
  path:string;
  reading:boolean;
  allRefs:boolean;
  scale:number;
  scrollLeft?:number;
  rowsScrollTop?:number;
  mainSeeds:string[];
}

export type CacheScope=object|string;

export class GitHistoryCacheStore {
  private scoped=new WeakMap<object,Map<string,GitHistorySnapshot>>();
  private fallback=new Map<string,Map<string,GitHistorySnapshot>>();
  readonly layouts:GitNetworkLayoutCache;
  private maxSnapshots:number;
  constructor(maxSnapshots=16,maxLayouts=32) {
    if(!Number.isSafeInteger(maxSnapshots)||maxSnapshots<1)throw new RangeError('GitHistoryCacheStore maxSnapshots must be a positive integer.');
    this.maxSnapshots=maxSnapshots;
    this.layouts=new GitNetworkLayoutCache(maxLayouts);
  }
  private mapFor(scope:CacheScope,create=false):Map<string,GitHistorySnapshot>|undefined {
    if(typeof scope==='string'){
      let entries=this.fallback.get(scope);
      if(!entries&&create){entries=new Map();this.fallback.set(scope,entries);}
      return entries;
    }
    let entries=this.scoped.get(scope);
    if(!entries&&create){entries=new Map();this.scoped.set(scope,entries);}
    return entries;
  }
  get(scope:CacheScope,key:string):GitHistorySnapshot|undefined {
    const entries=this.mapFor(scope);
    const hit=entries?.get(key);
    if(!hit||!entries)return undefined;
    entries.delete(key);entries.set(key,hit);
    return hit;
  }
  upsert(scope:CacheScope,key:string,snapshot:GitHistorySnapshot) {
    const entries=this.mapFor(scope,true)!;
    if(entries.has(key))entries.delete(key);
    while(entries.size>=this.maxSnapshots){
      const oldest=entries.keys().next().value;
      if(oldest===undefined)break;
      entries.delete(oldest);
    }
    entries.set(key,snapshot);
  }
  delete(scope:CacheScope,key:string) {
    this.mapFor(scope)?.delete(key);
  }
  size(scope:CacheScope):number {
    return this.mapFor(scope)?.size??0;
  }
  clear(scope?:CacheScope) {
    if(scope===undefined){this.scoped=new WeakMap();this.fallback.clear();this.layouts.clear();return;}
    if(typeof scope==='string')this.fallback.delete(scope);
    else this.scoped.delete(scope);
  }
  resolveBundle(
    commits:GitCommit[],
    primary?:{name:string;tip:string},
    seeds=new Set<string>(),
    offset=0,
    scale=1,
    evidence?:SquashEvidence,
  ) {
    return this.layouts.resolve(commits,primary,seeds,offset,scale,evidence);
  }
}

export const gitHistoryStore=new GitHistoryCacheStore();
