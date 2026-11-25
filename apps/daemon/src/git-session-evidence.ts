import { isPersonTurn } from '@drishya/contracts';
import type {Hunk, Observation, Operation, Projection} from '@drishya/contracts';
import type {GitSessionLink} from './git-types.ts';

export interface GitSessionQuery {
  commits: {hash:string; committedAt:string; paths:string[]}[];
  working: {path:string; patch:string; created?:boolean}[];
}
export interface GitWorkingMatch {path:string; links:GitSessionLink[]}
export interface GitSessionEvidence {links:Record<string,GitSessionLink>; working:GitWorkingMatch[]}

// Deliberately a small literal-command grammar. A script, pipeline, glob, changed cwd,
// custom date or implicit staging cannot supply an exact commit/path assertion.
export function explicitCommitPaths(command:string):string[]|undefined {
  if(/[\r\n;$`|&<>]/.test(command))return;
  const tokens=command.match(/"[^"\n]*"|'[^'\n]*'|[^\s]+/g)?.map(word=>/^['"]/.test(word)?word.slice(1,-1):word);
  if(!tokens||tokens[0]!=='git'||tokens[1]!=='commit')return;
  const boundary=tokens.indexOf('--');if(boundary<2)return;
  for(let n=2;n<boundary;n++){
    if(tokens[n]==='-m'||tokens[n]==='--message'){if(++n>=boundary)return;}
    else if(tokens[n]!=='--only'&&tokens[n]!=='-o'&&tokens[n]!=='--quiet'&&tokens[n]!=='-q')return;
  }
  const paths=tokens.slice(boundary+1).map(path=>path.replace(/^\.\//,''));
  if(!paths.length||paths.some(path=>!relative(path)||/[*?[\]{}:]/.test(path)))return;
  return [...new Set(paths)].sort();
}
const relative=(path:string)=>!!path&&!/^(?:\/|[A-Za-z]:)/.test(path)&&!path.split(/[\\/]/).includes('..');
const same=(a:string[],b:string[])=>a.length===b.length&&a.every((value,n)=>value===b[n]);
const delta=(hunks:Hunk[])=>hunks.flatMap(h=>h.lines.filter(line=>line[0]==='+'||line[0]==='-'));
function patchDelta(patch:string):string[] {
  let inHunk=false;const lines:string[]=[];
  for(const line of patch.split(/\r?\n/)){
    if(line.startsWith('@@'))inHunk=true;
    else if(line.startsWith('diff --git'))inHunk=false;
    else if(inHunk&&(line[0]==='+'||line[0]==='-'))lines.push(line);
  }
  return lines;
}
const cached=new WeakMap<Projection,{commands:Operation[]; edits:Map<string,Operation[]>; turns:Map<string,number[]>}>();
export function commandAtWorkspace(observations:Observation[],root:string|undefined):boolean {
  if(!root)return false;
  const canonical=(path:string)=>{const p=path.replace(/\\/g,'/').replace(/\/$/,'');return /^[A-Za-z]:\//.test(p)?p.toLowerCase():p;};
  const native=observations.filter(o=>o.kind==='item.completed'&&(o.payload as Record<string,unknown>).item==='command');
  // A standalone native command records its actual execution directory, even
  // when the enclosing code-mode request is not one literal terminal call.
  if(native.length)return native.every(o=>typeof (o.payload as Record<string,unknown>).cwd==='string'&&canonical((o.payload as {cwd:string}).cwd)===canonical(root));
  const call=observations.find(o=>o.kind==='tool.call');if(!call||call.workspaceRoot&&canonical(call.workspaceRoot)!==canonical(root))return false;
  const input=(call.payload as {input?:unknown}).input;
  if(typeof input==='string')return !!call.workspaceRoot;
  if(!input||typeof input!=='object'||Array.isArray(input))return false;
  const args=input as Record<string,unknown>,cwd=args.workdir??args.cwd;
  // An explicitly captured override must be the same absolute root; no relative cwd inference.
  return cwd===undefined?!!call.workspaceRoot:typeof cwd==='string'&&canonical(cwd)===canonical(root);
}
function intervalStart(op:Operation):number {
  if(op.startTime)return Date.parse(op.startTime);
  // Native CommandExecution completion records carry elapsed time but no
  // start event. This derives an interval, not a fabricated captured timestamp.
  const end=Date.parse(op.endTime??'');
  return op.tool==='CommandExecution'&&Number.isFinite(end)&&typeof op.durationMs==='number'&&Number.isFinite(op.durationMs)&&op.durationMs>=0?end-op.durationMs:NaN;
}
/** Runs inside the existing history worker; never transfers a complete projection to the daemon. */
export function gitSessionEvidence(projection:Projection,query:GitSessionQuery,atWorkspace:(op:Operation)=>boolean=()=>false):GitSessionEvidence {
  let index=cached.get(projection);
  if(!index){
    index={commands:[],edits:new Map(),turns:new Map()};
    for(const item of projection.timeline)if(item.type==='turn'&&isPersonTurn(item)){
      const turns=index.turns.get(item.agentId)??[];turns.push(item.sequence);index.turns.set(item.agentId,turns);
    }
    for(const op of projection.operations){
      if(op.detail.kind==='shell'&&op.status==='ok'&&op.detail.exitCode===0&&explicitCommitPaths(op.detail.command))index.commands.push(op);
      if(op.detail.kind==='edit'&&op.status==='ok'&&!op.declined&&relative(op.detail.path)&&op.detail.hunks.length&&op.detail.hunks.every(h=>h.lines.filter(line=>line[0]!=='+'&&line[0]!=='\\').length===h.oldLines&&h.lines.filter(line=>line[0]!=='-'&&line[0]!=='\\').length===h.newLines)){
        const edits=index.edits.get(op.detail.path)??[];edits.push(op);index.edits.set(op.detail.path,edits);
      }
    }
    cached.set(projection,index);
  }
  const link=(op:Operation,basis:GitSessionLink['basis']):GitSessionLink=>{
      const sequence=projection.timeline[op.startSequence]?.sequence;
      const turn=sequence===undefined?undefined:index!.turns.get(op.agentId)?.filter(value=>value<=sequence).length;
    return {observationId:op.observationIds[0]!,operationId:op.id,basis,...(turn?{turn}:{}),...(op.startTime?{time:op.startTime}:{})};
  };
  const links:Record<string,GitSessionLink>={};
  for(const commit of query.commits.slice(0,50)){
    if(!commit.paths.length||commit.paths.some(path=>!relative(path)))continue;
    const time=Math.floor(Date.parse(commit.committedAt)/1000),paths=[...commit.paths].sort();
    const matches=index.commands.filter(op=>{
      const start=Math.floor(intervalStart(op)/1000),end=Math.floor(Date.parse(op.endTime??'')/1000);
      return atWorkspace(op)&&Number.isFinite(time)&&Number.isFinite(start)&&Number.isFinite(end)&&start<=time&&time<=end&&
        op.detail.kind==='shell'&&same(explicitCommitPaths(op.detail.command)!,paths);
    });
    // One command matching multiple commits is ambiguous too (e.g. same-second cherry-pick).
    if(matches.length===1){
      const op=matches[0]!;
      const candidates=query.commits.filter(other=>same([...other.paths].sort(),paths)&&Math.floor(Date.parse(other.committedAt)/1000)>=Math.floor(intervalStart(op)/1000)&&Math.floor(Date.parse(other.committedAt)/1000)<=Math.floor(Date.parse(op.endTime!)/1000));
      if(candidates.length===1)links[commit.hash]=link(op,'commit-time-paths');
    }
  }
  const working:GitWorkingMatch[]=[];
  for(const file of query.working.slice(0,50)){
    const wanted=patchDelta(file.patch);
    if(wanted.join('').replace(/\s/g,'').length<12||file.patch.includes('[REDACTED:'))continue;
    const matches=(index.edits.get(file.path)??[]).filter(op=>{
      if(!atWorkspace(op)||op.detail.kind!=='edit')return false;
      const captured=delta(op.detail.hunks);
      // Full Write snapshots retain split('\n')'s final empty token. Git's added-line
      // records do not: that token is the preceding line's terminator, not a blank line.
      if(file.created&&op.detail.reconstruction==='complete'&&op.detail.hunks.every(h=>h.oldLines===0)&&captured.at(-1)==='+')captured.pop();
      return same(captured,wanted);
    });
    if(matches.length)working.push({path:file.path,links:matches.slice(-20).reverse().map(op=>link(op,'working-patch'))});
  }
  return {links,working};
}
