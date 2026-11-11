import type {Projection} from '@drishya/contracts';
import {evidencePath} from '../../../packages/scene/src/file-evidence.ts';
import type {CompareEvidence} from './git-compare-types.ts';

/**
 * GIT-8: which agents of this session wrote each path, from captured edit and write operations only (the rule FILES-1 uses
 * for its `E`/`A`/`D` marks). A failed or declined edit wrote nothing. No Git, no disk, no inference: a path with no captured
 * edit has no entry, which the window says as "no recorded edit", never "nobody changed it".
 */
export function compareEvidence(projection:Projection,paths:readonly string[]):CompareEvidence {
  const wanted=new Set(paths.filter(evidencePath)),out:CompareEvidence={};
  if(!wanted.size)return out;
  const byPath=new Map<string,Map<string,{edits:number;first:string;last:string;firstTime?:string}>>();
  for(const op of projection.operations){
    if(op.kind!=='edit'&&op.kind!=='write'||op.status!=='ok'&&op.status!=='unknown'||op.declined)continue;
    for(const path of new Set(op.paths.map(ref=>ref.path))){
      if(!wanted.has(path))continue;
      const agents=byPath.get(path)??byPath.set(path,new Map()).get(path)!,entry=agents.get(op.agentId);
      if(entry){entry.edits++;entry.last=op.id;}
      else agents.set(op.agentId,{edits:1,first:op.id,last:op.id,...(op.startTime?{firstTime:op.startTime}:{})});
    }
  }
  for(const [path,agents] of byPath)out[path]={agents:[...agents].map(([agentId,entry])=>({agentId,edits:entry.edits,firstOperationId:entry.first,lastOperationId:entry.last,...(entry.firstTime?{firstTime:entry.firstTime}:{})}))};
  return out;
}
