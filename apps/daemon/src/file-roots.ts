import {localFileUrlPath} from '@drishya/capture-core';
import {setImmediate as yieldTurn} from 'node:timers/promises';
import {createHash} from 'node:crypto';
import type {Store} from '@drishya/store';
interface RecordedRoot {root:string;prefix:string;recordedRoot?:string}
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
        UNION SELECT DISTINCT json_extract(body, '$.payload.cwd') AS root FROM observations WHERE recording_id=? AND seq>=? AND seq<?`).iterate(id,from,through,id,from,through);
      for(const row of rows){
        if(typeof row.root!=='string'||!row.root)continue;
        const path=row.root.replace(/\\/g,'/').replace(/\/+$/,'');
        const normalized=/^[a-z]:\//i.test(path)?path.toLowerCase():path;
        if(!saved.roots.has(normalized)&&saved.roots.size===256){saved.truncated=true;break;}
        const decoded=localFileUrlPath(row.root);
        if(!saved.roots.has(normalized))saved.roots.set(normalized,{root:decoded??row.root,...(decoded?{recordedRoot:row.root}:{}),prefix:`worktree-${createHash('sha256').update(normalized).digest('hex').slice(0,10)}`});
      }
      if(through<count)await yieldTurn();
      }
    }
    saved.count=count;saved.revision=revision;cache.delete(id);cache.set(id,saved);
    if(cache.size>16)cache.delete(cache.keys().next().value!);
    for(const [key,root]of saved.roots){if(!roots.has(key)&&roots.size===256){truncated=true;break;}roots.set(key,root);}
    truncated ||= saved.truncated;
    if(truncated)break;
  }
  return {roots:[...roots.values()],truncated};
}
