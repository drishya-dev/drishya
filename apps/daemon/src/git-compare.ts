import {createHash} from 'node:crypto';
import {redactText} from '@drishya/privacy';
import {HttpError} from './app.ts';
import {safeGitPath,gitDiffFlags} from './git-paths.ts';
import {compareBranch} from './git-branches.ts';
import {gitRefState} from './git-history.ts';
import type {CompareFile,CompareFilePatch,CompareGroup,CompareRef,CompareRefs,CompareSide,CompareCommit,ComparePull,GitCompareResult} from './git-compare-types.ts';

// GIT-8 Compare. Everything here is a read: `for-each-ref`, `merge-base`, `rev-list`, `diff`, `log`, `cat-file`.
// Nothing fetches, checks out, merges, rebases or moves a ref, and the caller supplies the only Git runner (fixed argv, no shell).

type Git=(args:string[])=>Promise<string>;
type RefState=Awaited<ReturnType<typeof gitRefState>>;
const oid=/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const clean=(text:string)=>redactText(text).text;
const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
const FILE_LIMIT=400,COMMIT_LIMIT=30;
const invalid=()=>new HttpError(400,'Invalid comparison request.');
const changed=()=>new HttpError(409,'Git references changed. Choose the two sides again.');

const toRef=(ref:RefState['refs'][number]):CompareRef=>({ref:ref.raw,name:ref.name,kind:ref.kind,tip:ref.tip,current:ref.current,...(ref.lastCommit?{lastCommit:ref.lastCommit}:{})});

/** `origin/HEAD` when it is stored locally, else a branch named main or master: the same evidence the Git graph uses for "default". */
function defaultBase(before:RefState):RefState['refs'][number]|undefined {
  const rows=before.raw.split('\n').map(row=>row.split('\0')).filter(row=>/^refs\/remotes\/[^/]+\/HEAD$/.test(row[0]??'')&&row[5]);
  const remoteHead=rows.find(row=>row[0]==='refs/remotes/origin/HEAD')??(rows.length===1?rows[0]:undefined);
  const target=remoteHead?.[5];
  const named=(raw:string)=>before.refs.find(ref=>ref.raw===raw);
  if(target)return named(target.replace(/^refs\/remotes\/[^/]+\//,'refs/heads/'))??named(target);
  return named('refs/heads/main')??named('refs/heads/master');
}

export async function gitCompareRefs(git:Git):Promise<CompareRefs> {
  const before=await gitRefState(git);
  const shallow=(await git(['rev-parse','--is-shallow-repository'])).trim()==='true';
  const refs=before.refs.filter(ref=>!/^refs\/remotes\/[^/]+\/HEAD$/.test(ref.raw));
  const current=before.refs.find(ref=>ref.current),base=defaultBase(before);
  return {generation:before.generation,shallow,...(before.head?{head:before.head}:{}),...(current?{current:toRef(current)}:{}),...(base?{defaultBase:toRef(base)}:{}),refs:refs.slice(0,500).map(toRef),total:refs.length};
}

async function resolveSide(git:Git,before:RefState,value:string):Promise<CompareSide> {
  if(oid.test(value)){
    // A pull request's head commit: it must be a commit object this repository already holds.
    if((await git(['cat-file','-t',value]).catch(()=>'')).trim()!=='commit')throw new HttpError(404,'This commit is not on this machine.');
    return {ref:value,name:value.slice(0,10),tip:value};
  }
  const found=before.refs.find(ref=>ref.raw===value);
  if(!found)throw new HttpError(404,'This branch is no longer available.');
  return {ref:found.raw,name:found.name,tip:found.tip};
}

function pairs(raw:string,expect:number):string[][] {
  const tokens=raw.split('\0');if(tokens.at(-1)==='')tokens.pop();
  const rows:string[][]=[];
  for(let n=0;n+expect<=tokens.length;n+=expect)rows.push(tokens.slice(n,n+expect));
  return rows;
}

interface SideChange {status:string;added?:number;removed?:number;binary:boolean}
async function sideChanges(git:Git,from:string,to:string):Promise<Map<string,SideChange>> {
  const flags=['diff',...gitDiffFlags];
  const [names,numbers]=await Promise.all([git([...flags,'--name-status','-z',from,to,'--']),git([...flags,'--numstat','-z',from,to,'--'])]);
  const result=new Map<string,SideChange>();
  for(const [status,path] of pairs(names,2))result.set(path!,{status:status!.slice(0,1),binary:false});
  // numstat -z (no renames): "added\tremoved\tpath\0"
  for(const field of numbers.split('\0').filter(Boolean)){
    const [added,removed,...rest]=field.split('\t'),path=rest.join('\t'),entry=result.get(path);
    if(!entry)continue;
    if(added==='-'||removed==='-')entry.binary=true;else{entry.added=Number(added);entry.removed=Number(removed);}
  }
  return result;
}

async function commitsOf(git:Git,base:string,head:string):Promise<CompareCommit[]> {
  const log=await git(['log','--no-show-signature','--no-notes','--no-decorate','--topo-order','-z',`--max-count=${COMMIT_LIMIT}`,'--format=%H%x00%an%x00%aI%x00%s',`${base}..${head}`,'--']).catch(()=>'');
  const fields=log.split('\0');if(fields.at(-1)==='')fields.pop();
  const commits:CompareCommit[]=[];
  for(let n=0;n+4<=fields.length;n+=4){
    const [id,author,time,subject]=fields.slice(n,n+4);
    if(oid.test(id??''))commits.push({hash:id!,author:clean(author!).slice(0,256),time:time!,subject:clean(subject!).slice(0,2048)});
  }
  return commits;
}

/** The comparison of two sides from their merge-base: files only the compare side changed, only the base side changed, and both. */
export async function gitCompare(git:Git,query:{base:string;head:string}):Promise<GitCompareResult> {
  if(!query.base||!query.head||query.base.length>300||query.head.length>300)throw invalid();
  const before=await gitRefState(git);
  const [base,head]=await Promise.all([resolveSide(git,before,query.base),resolveSide(git,before,query.head)]);
  const shallow=(await git(['rev-parse','--is-shallow-repository'])).trim()==='true';
  const comparison=await compareBranch(git,head.tip,{name:base.name,tip:base.tip},shallow);
  const mergeBase=(await git(['merge-base',base.tip,head.tip]).catch(()=>'')).trim();
  let headChanges=new Map<string,SideChange>(),baseChanges=new Map<string,SideChange>();
  if(mergeBase&&oid.test(mergeBase)){
    [headChanges,baseChanges]=await Promise.all([sideChanges(git,mergeBase,head.tip),sideChanges(git,mergeBase,base.tip)]);
  }else if(comparison.state==='unrelated'){
    // No shared history: the plain difference is the only honest comparison, shown as the compare side's.
    headChanges=await sideChanges(git,base.tip,head.tip);
  }
  let protectedCount=0;
  const files:CompareFile[]=[];
  const rank:Record<CompareGroup,number>={both:0,head:1,base:2};
  for(const path of new Set([...headChanges.keys(),...baseChanges.keys()])){
    if(!safeGitPath(path)){protectedCount++;continue;}
    const own=headChanges.get(path),other=baseChanges.get(path);
    const group:CompareGroup=own&&other?'both':own?'head':'base';
    const shown=own??other!;
    files.push({
      path:clean(path),group,
      ...(own?{headStatus:own.status}:{}),...(other?{baseStatus:other.status}:{}),
      ...(shown.binary?{binary:true}:{added:shown.added,removed:shown.removed}),
      ...(group==='both'&&other&&!other.binary?{baseAdded:other.added,baseRemoved:other.removed}:{}),
    });
  }
  files.sort((a,b)=>rank[a.group]-rank[b.group]||a.path.localeCompare(b.path));
  const commits=mergeBase||comparison.state==='unrelated'?await commitsOf(git,base.tip,head.tip):[];
  if((await gitRefState(git)).generation!==before.generation)throw changed();
  return {
    base,head,...(mergeBase&&oid.test(mergeBase)?{mergeBase}:{}),
    state:comparison.state,...(comparison.ahead!==undefined?{ahead:comparison.ahead,behind:comparison.behind}:{}),
    files:files.slice(0,FILE_LIMIT),omitted:Math.max(0,files.length-FILE_LIMIT),protectedCount,
    commits,commitTotal:comparison.ahead??commits.length,source:'local',
    generation:before.generation,sampledAt:new Date().toISOString(),
  };
}

/** One file's patch on one side of the merge-base. The heading line is what the shared patch reader keys its section on. */
export async function gitCompareFile(git:Git,query:{base:string;head:string;path:string;side:'head'|'base'}):Promise<CompareFilePatch> {
  const {path,side}=query;
  if(!safeGitPath(path)||path.length>1024||side!=='head'&&side!=='base')throw invalid();
  const before=await gitRefState(git);
  const [base,head]=await Promise.all([resolveSide(git,before,query.base),resolveSide(git,before,query.head)]);
  const mergeBase=(await git(['merge-base',base.tip,head.tip]).catch(()=>'')).trim();
  const from=oid.test(mergeBase)?mergeBase:base.tip,to=side==='head'?head.tip:base.tip;
  // Unrelated histories have no merge-base; the base side then has nothing to show.
  const raw=!oid.test(mergeBase)&&side==='base'?'':await git(['diff',...gitDiffFlags,'-p',from,to,'--',path]);
  const binary=/^Binary files .* differ$/m.test(raw)||/^GIT binary patch$/m.test(raw);
  const patch=clean('Commit changes\n'+(raw||'No textual patch available (submodule, binary or metadata-only change).\n'));
  if((await gitRefState(git)).generation!==before.generation)throw changed();
  return {path,side,patch,fingerprint:hash(`${from}\0${to}\0${path}\0${raw}`),binary};
}

/** GitHub's own compare, for a pull request whose head is not here. Only the compare side's changes exist in it. */
export function githubCompareResult(raw:unknown,base:CompareSide,head:CompareSide):GitCompareResult {
  const value=raw&&typeof raw==='object'?raw as Record<string,unknown>:{};
  const number=(entry:unknown)=>typeof entry==='number'&&Number.isSafeInteger(entry)&&entry>=0?entry:undefined;
  const list=Array.isArray(value.files)?value.files as Record<string,unknown>[]:[];
  const files:CompareFile[]=[];let protectedCount=0,budget=1024*1024;
  for(const entry of list){
    const path=typeof entry.filename==='string'?entry.filename:'';
    if(!safeGitPath(path)){protectedCount++;continue;}
    const status=entry.status==='added'?'A':entry.status==='removed'?'D':'M';
    const text=typeof entry.patch==='string'?clean(`Commit changes\ndiff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n${entry.patch}\n`):undefined;
    const bytes=text?Buffer.byteLength(text):0;
    const keep=text!==undefined&&bytes<=budget;if(keep)budget-=bytes;
    files.push({path:clean(path),group:'head',headStatus:status,...(text===undefined?{binary:true}:{added:number(entry.additions),removed:number(entry.deletions)}),...(keep?{patch:text}:{})});
  }
  files.sort((a,b)=>a.path.localeCompare(b.path));
  const mergeBase=(value.merge_base_commit as {sha?:unknown}|undefined)?.sha;
  const commits:CompareCommit[]=(Array.isArray(value.commits)?value.commits as Record<string,unknown>[]:[]).slice(0,COMMIT_LIMIT).flatMap(entry=>{
    const id=entry.sha,detail=(entry.commit??{}) as {message?:unknown;author?:{name?:unknown;date?:unknown}};
    if(typeof id!=='string'||!oid.test(id))return [];
    return [{hash:id,author:clean(String(detail.author?.name??'')).slice(0,256),time:String(detail.author?.date??''),subject:clean(String(detail.message??'').split('\n')[0]!).slice(0,2048)}];
  }).reverse();
  return {
    base,head,...(typeof mergeBase==='string'&&oid.test(mergeBase)?{mergeBase}:{}),
    state:'remote',ahead:number(value.ahead_by),behind:number(value.behind_by),
    files:files.slice(0,FILE_LIMIT),omitted:Math.max(0,files.length-FILE_LIMIT),protectedCount,commits,commitTotal:number(value.total_commits)??commits.length,
    source:'github',generation:hash(JSON.stringify([base.tip,head.tip])),sampledAt:new Date().toISOString(),
  };
}

/** Which pulls have a head commit here, and which local ref stands for each base branch. */
export async function resolvePulls(git:Git,pulls:Omit<ComparePull,'local'|'baseRef'|'headRef'>[]):Promise<ComparePull[]> {
  const before=await gitRefState(git);
  const refs=before.refs.filter(ref=>!/^refs\/remotes\/[^/]+\/HEAD$/.test(ref.raw));
  const out:ComparePull[]=[];
  for(const pull of pulls){
    const local=oid.test(pull.headOid)&&(await git(['cat-file','-t',pull.headOid]).catch(()=>'')).trim()==='commit';
    const baseRef=refs.find(ref=>ref.raw===`refs/heads/${pull.baseName}`)??refs.find(ref=>ref.raw===`refs/remotes/origin/${pull.baseName}`);
    const headRef=local?refs.find(ref=>ref.tip===pull.headOid&&ref.kind!=='tag'):undefined;
    out.push({...pull,local,...(baseRef?{baseRef:toRef(baseRef)}:{}),...(headRef?{headRef:toRef(headRef)}:{})});
  }
  return out;
}

/** `owner/repo` of a GitHub remote URL (https or ssh), else undefined. */
export function githubRepoOf(url:string):string|undefined {
  const m=/^(?:https:\/\/(?:[^@/]+@)?github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([A-Za-z0-9][A-Za-z0-9-]{0,38})\/([A-Za-z0-9._-]{1,100}?)(?:\.git)?\/?$/.exec(url.trim());
  return m&&m[2]!=='.'&&m[2]!=='..'?`${m[1]}/${m[2]}`:undefined;
}
