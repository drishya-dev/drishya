import {localFileUrlPath} from '@drishya/capture-core';
import {setImmediate as yieldTurn} from 'node:timers/promises';
import {createHash} from 'node:crypto';
import type {Store} from '@drishya/store';
import type {Projection} from '@drishya/contracts';
import {stat} from 'node:fs/promises';
import {isAbsolute} from 'node:path';
export interface RecordedRoot {root:string;prefix:string;recordedRoot?:string;branch?:string;fileCount?:number;lastFileSequence?:number;agents?:{id:string;label:string}[];onDisk?:'present'|'removed'|'unavailable'}
interface RootCache {count:number;revision:number;roots:Map<string,RecordedRoot>;truncated:boolean}
const caches=new WeakMap<Store,Map<string,RootCache>>();

/** Navigation metadata from already redacted observations; never a filesystem inventory. */
export async function recordedFileRoots(store: Store, ids: string[]) {
  let cache=caches.get(store);if(!cache){cache=new Map();caches.set(store,cache);}
  const roots=new Map<string,RecordedRoot>();let truncated=false;
  for(const id of ids){
    const recording=store.getRecording(id);if(!recording)continue;
    const count=recording.observationCount,revision=recording.revision??0;
    let saved=cache.get(id);
    if(!saved||count<saved.count||count===saved.count&&revision!==saved.revision)saved={count:0,revision:0,roots:new Map(),truncated:false};
    if(count!==saved.count&&!saved.truncated){
      // Decode only newly appended sealed rows after the first request. Large live journals
      // must not be scanned again whenever Files or its historical reader rerenders.
      for(let from=saved.count;from<count&&!saved.truncated;from+=256){
      const through=Math.min(count,from+256);
      const rows=store.db.prepare(`SELECT DISTINCT json_extract(body, '$.workspaceRoot') AS root FROM observations WHERE recording_id=? AND seq>=? AND seq<?
        UNION SELECT DISTINCT json_extract(body, '$.payload.cwd') AS root FROM observations WHERE recording_id=? AND seq>=? AND seq<?
        UNION SELECT DISTINCT json_extract(body, '$.payload.intent.cwd') AS root FROM observations WHERE recording_id=? AND seq>=? AND seq<?`).iterate(id,from,through,id,from,through,id,from,through);
      for(const row of rows){
        if(typeof row.root!=='string'||!row.root)continue;
        const path=row.root.replace(/\\/g,'/').replace(/\/+$/,'');
        const normalized=/^[a-z]:\//i.test(path)?path.toLowerCase():path;
        if(!saved.roots.has(normalized)&&saved.roots.size===256){saved.truncated=true;break;}
        const decoded=localFileUrlPath(row.root);
        if(!saved.roots.has(normalized))saved.roots.set(normalized,{root:decoded??row.root,...(decoded?{recordedRoot:row.root}:{}),prefix:`worktree-${createHash('sha256').update(normalized).digest('hex').slice(0,10)}`});
      }
      // Branch names are captured session metadata, never a current Git lookup.
      const branches=store.db.prepare(`SELECT json_extract(body,'$.payload.cwd') AS root,json_extract(body,'$.payload.branch') AS branch FROM observations WHERE recording_id=? AND seq>=? AND seq<? AND kind='session.meta' ORDER BY seq`).iterate(id,from,through);
      for(const row of branches)if(typeof row.root==='string'&&typeof row.branch==='string'){
        const path=row.root.replace(/\\/g,'/').replace(/\/+$/,'');const key=/^[a-z]:\//i.test(path)?path.toLowerCase():path;
        const root=saved.roots.get(key);if(root)root.branch=row.branch;
      }
      if(through<count)await yieldTurn();
      }
    }
    saved.count=count;saved.revision=revision;cache.delete(id);cache.set(id,saved);
    if(cache.size>16)cache.delete(cache.keys().next().value!);
    for(const [key,root]of saved.roots){if(!roots.has(key)&&roots.size===256){truncated=true;break;}const previous=roots.get(key);roots.set(key,root.branch===undefined&&previous?.branch!==undefined?{...root,branch:previous.branch}:root);}
    truncated ||= saved.truncated;
    if(truncated)break;
  }
  return {roots:[...roots.values()],truncated};
}

/** Exact captured main-root proof only; directory ancestry and realpath similarity grant nothing. */
export function recordedMainRootPrefixes(roots: readonly RecordedRoot[], workspaceRoot: string | undefined): string[] {
  if (!workspaceRoot) return [];
  const normalize = (value: string) => {
    const path = value.replace(/\\/g, '/').replace(/\/+$/, '');
    return /^[a-z]:\//i.test(path) ? path.toLowerCase() : path;
  };
  const main = normalize(workspaceRoot);
  return roots.filter(root => normalize(root.root) === main).map(root => root.prefix);
}

/** File activity comes from the worker's existing complete projection, not cwd mentions or a page of visible cards. */
export function withFileRootEvidence(roots:RecordedRoot[],projection:Projection,workspaceRoot:string|undefined):RecordedRoot[] {
  const same=(a:string,b:string)=>{const normal=(v:string)=>{const p=v.replace(/\\/g,'/').replace(/\/+$/,'');return /^[a-z]:\//i.test(p)?p.toLowerCase():p;};return normal(a)===normal(b);};
  const byPrefix=new Map(roots.map(root=>[root.prefix,root]));
  const primary=workspaceRoot?roots.find(root=>same(root.root,workspaceRoot)):undefined;
  const evidence=new Map<string,{paths:Set<string>;last:number;agents:Map<string,string>}>();
  const labels=new Map(projection.agents.map(agent=>[agent.id,agent.nickname??agent.label]));
  // Unresolved operation references are not tree leaves and must not inflate a checkout.
  const leaves=new Set(projection.files.filter(file=>file.roles.some(role=>role==='read'||role==='write')).map(file=>file.path));
  for(const op of projection.operations)for(const ref of op.paths){
    if(ref.role!=='read'&&ref.role!=='write'||!leaves.has(ref.path))continue;
    const path=ref.path,first=path.split('/')[0]!;
    // Namespaced paths have an exact captured root. A relative path without that
    // namespace belongs only to the recorded primary checkout, never a guessed sibling.
    const root=byPrefix.get(first)??(!/^worktree-[a-f0-9]{10}\//.test(path)&&!path.startsWith('/')&&!/^[a-z]:/i.test(path)&&!path.split('/').includes('..')?primary:undefined);
    if(!root)continue;
    let entry=evidence.get(root.prefix);if(!entry){entry={paths:new Set(),last:0,agents:new Map()};evidence.set(root.prefix,entry);}
    entry.paths.add(path);entry.last=Math.max(entry.last,op.endSequence??op.startSequence);entry.agents.set(op.agentId,labels.get(op.agentId)??op.agentId);
  }
  return roots.map(root=>{const item=evidence.get(root.prefix);return {...root,fileCount:item?.paths.size??0,lastFileSequence:item?.last??0,agents:[...(item?.agents??[])].map(([id,label])=>({id,label}))};});
}

/** Existence is a read-only snapshot of recorded directories, not permission to read their contents. */
export async function withFileRootDiskState(value:{roots:RecordedRoot[];truncated:boolean}) {
  const roots=await Promise.all(value.roots.map(async root=>{
    if(!isAbsolute(root.root)||process.platform==='win32'&&root.root.startsWith('/')&&!root.root.startsWith('//'))return {...root,onDisk:'unavailable' as const};
    try{return {...root,onDisk:(await stat(root.root)).isDirectory()?'present' as const:'removed' as const};}
    catch(error){return {...root,onDisk:(error as NodeJS.ErrnoException).code==='ENOENT'?'removed' as const:'unavailable' as const};}
  }));return {...value,roots};
}
