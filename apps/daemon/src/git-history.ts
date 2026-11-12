import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
import {redactText} from '@drishya/privacy';
import {HttpError} from './app.ts';
import {safeGitPath,gitDiffFlags} from './git-paths.ts';
import {compareBranch} from './git-branches.ts';
import type {GitReference,GitHistoryPage,GitCommitDetail,GitCommit,GitFile,GitOmission} from './git-types.ts';

type Git=(args:string[])=>Promise<string>;
const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
const oid=/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const invalid=()=>new HttpError(400,'Invalid Git history request.');
const changed=()=>new HttpError(409,'Git references changed. Refresh history before continuing.');
const clean=(text:string)=>redactText(text).text;
const preview=(text:string,limit:number)=>{const value=clean(text);return value.length>limit?value.slice(0,limit)+'…':value;};
const page=(value:number)=>{if(!Number.isSafeInteger(value)||value<0||value>10_000_000)throw invalid();};

interface RefSnapshot { raw: string; head: string; branch: string; generation: string }

async function refSnapshot(git:Git):Promise<RefSnapshot> {
  const [raw,head,branch]=await Promise.all([
    git(['for-each-ref','--sort=refname','--format=%(refname)%00%(objectname)%00%(*objectname)%00%(committerdate:iso-strict)%00%(upstream:short)%00%(symref)%00','refs/heads','refs/remotes','refs/tags']),
    git(['rev-parse','--verify','HEAD']).then(value=>value.trim()).catch(()=>''),
    git(['symbolic-ref','-q','HEAD']).then(value=>value.trim()).catch(()=>''),
  ]);
  return {raw,head,branch,generation:hash(raw+'\0'+head+'\0'+branch)};
}

function parseRefs(snap:RefSnapshot) {
  const refs=snap.raw.split('\n').filter(Boolean).map(row=>{
    const [name,tip,peeled,lastCommit,upstream]=row.split('\0');
    if(!name||!oid.test(tip??''))throw new HttpError(422,'Git returned invalid reference metadata.');
    return {raw:name,id:hash(name),name:clean(name.replace(/^refs\/(heads|remotes|tags)\//,'')),tip:peeled&&oid.test(peeled)?peeled:tip!,kind:name.startsWith('refs/heads/')?'branch':name.startsWith('refs/remotes/')?'remote':'tag',current:name===snap.branch,...(lastCommit?{lastCommit}:{}),...(upstream?{upstream:clean(upstream)}:{})} as GitReference&{raw:string};
  });
  refs.sort((a,b)=>Number(b.current)-Number(a.current)||Number(b.kind==='branch')-Number(a.kind==='branch')||(Date.parse(b.lastCommit??'')||0)-(Date.parse(a.lastCommit??'')||0)||a.name.localeCompare(b.name));
  return {...snap,refs};
}

/** Compare (GIT-8) reads the same reference snapshot History does. */
export async function gitRefState(git:Git) {return parseRefs(await refSnapshot(git));}
export async function gitRefGeneration(git:Git):Promise<string> {return (await refSnapshot(git)).generation;}
const publicRef=({raw,...reference}:GitReference&{raw:string}):GitReference=>reference;
export async function verifyGitHistoryGeneration(git:Git,generation:string) {if((await refSnapshot(git)).generation!==generation)throw changed();}

export class GitHistoryCache {
  private entries=new Map<string,{root:string;generation:string;page:GitHistoryPage}>();
  private generations=new Map<string,string>();
  private maxEntries:number;
  constructor(maxEntries=64) {
    if(!Number.isSafeInteger(maxEntries)||maxEntries<1)throw new RangeError('GitHistoryCache maxEntries must be a positive integer.');
    this.maxEntries=maxEntries;
  }
  private key(root:string,generation:string,reference:string,referenceStart:number,query:string,start:number) {
    return JSON.stringify([root,generation,reference,referenceStart,query,start]);
  }
  syncGeneration(root:string,generation:string) {
    const previous=this.generations.get(root);
    if(previous!==undefined&&previous!==generation){
      for(const [k,entry] of this.entries)if(entry.root===root&&entry.generation!==generation)this.entries.delete(k);
    }
    this.generations.set(root,generation);
  }
  get(root:string,generation:string,reference:string,referenceStart:number,query:string,start:number):GitHistoryPage|undefined {
    this.syncGeneration(root,generation);
    const k=this.key(root,generation,reference,referenceStart,query,start);
    const hit=this.entries.get(k);
    if(!hit)return undefined;
    this.entries.delete(k);this.entries.set(k,hit);
    return hit.page;
  }
  set(root:string,generation:string,reference:string,referenceStart:number,query:string,start:number,value:GitHistoryPage) {
    this.syncGeneration(root,generation);
    const k=this.key(root,generation,reference,referenceStart,query,start);
    if(this.entries.has(k))this.entries.delete(k);
    while(this.entries.size>=this.maxEntries){
      const oldest=this.entries.keys().next().value;
      if(oldest===undefined)break;
      this.entries.delete(oldest);
    }
    this.entries.set(k,{root,generation,page:value});
  }
  clear(root?:string) {
    if(root===undefined){this.entries.clear();this.generations.clear();return;}
    this.generations.delete(root);
    for(const [k,entry] of this.entries)if(entry.root===root)this.entries.delete(k);
  }
  get size() {return this.entries.size;}
}

// Revision walking treats shallow boundaries as roots; the object header retains the real parents.
async function objectParents(git:Git,id:string):Promise<string[]> {
  const header=(await git(['cat-file','-p',id])).split(/\r?\n\r?\n/,1)[0]!;
  const parents=header.split(/\r?\n/).filter(line=>line.startsWith('parent ')).map(line=>line.slice(7));
  if(parents.length>1024||parents.some(parent=>!oid.test(parent)))throw new HttpError(422,'Git returned unsupported parent metadata.');
  return parents;
}

export interface GitHistoryQuery {start?:number;referenceStart?:number;reference?:string;query?:string;generation?:string}
export async function gitHistory(git:Git,options:GitHistoryQuery={},cacheOptions:{root?:string;cache?:GitHistoryCache}={}):Promise<GitHistoryPage> {
  const {start=0,referenceStart=0,reference='all',query='',generation}=options;
  page(start);page(referenceStart);
  if(query.length>200||reference!=='all'&&!/^[a-f0-9]{64}$/.test(reference)||generation!==undefined&&!/^[a-f0-9]{64}$/.test(generation))throw invalid();
  const snap=await refSnapshot(git);if(generation&&generation!==snap.generation)throw changed();
  if(cacheOptions.cache&&cacheOptions.root){
    const cached=cacheOptions.cache.get(cacheOptions.root,snap.generation,reference,referenceStart,query,start);
    if(cached)return cached;
  }
  const before=parseRefs(snap);
  const selected=reference==='all'?undefined:before.refs.find(ref=>ref.id===reference);
  if(reference!=='all'&&!selected)throw new HttpError(404,'This Git reference is no longer available.');
  const shallowPromise=git(['rev-parse','--is-shallow-repository']).then(value=>value.trim()==='true');
  const revision=selected?(await git(['rev-parse','--verify',`${selected.raw}^{commit}`])).trim():undefined;
  if(revision&&!oid.test(revision))throw new HttpError(422,'This reference does not point to a commit.');
  const [log,shallow]=await Promise.all([
    git(['log','--no-show-signature','--no-notes','--topo-order','--no-decorate','-z','--format=%H%x00%P%x00%an%x00%aI%x00%s','--max-count=51',`--skip=${start}`,...(revision?[revision]:['--all',...(before.head?[before.head]:[])]),'--']),
    shallowPromise,
  ]);
  const fields=log.split('\0');if(fields.at(-1)==='')fields.pop();
  if(fields.length%5)throw new HttpError(422,'Git returned incomplete commit metadata.');
  const commits:GitCommit[]=[];
  for(let n=0;n<fields.length;n+=5){
    const [id,parentList,author,time,subject]=fields.slice(n,n+5);
    const parents=parentList?parentList.split(' '):shallow&&id&&oid.test(id)?await objectParents(git,id):[];
    if(!oid.test(id??'')||parents.some(parent=>!oid.test(parent))||parents.length>1024)throw new HttpError(422,'Git returned unsupported commit metadata.');
    const labels=before.refs.filter(ref=>ref.tip===id);
    commits.push({hash:id!,parents,author:preview(author!,256),time:time!,subject:preview(subject!,2048),labels:labels.slice(0,6).map(ref=>ref.name),omittedLabels:Math.max(0,labels.length-6)});
  }
  const matching=before.refs.filter(ref=>ref.name.toLowerCase().includes(query.toLowerCase()));
  const primary=before.refs.find(ref=>ref.raw==='refs/heads/main')??before.refs.find(ref=>ref.raw==='refs/heads/master');
  // A locally stored remote HEAD is explicit default evidence. main/master are labelled conventions.
  const remoteHeads=before.raw.split('\n').map(row=>row.split('\0')).filter(row=>/^refs\/remotes\/[^/]+\/HEAD$/.test(row[0]??'')&&row[5]);
  const remoteHead=remoteHeads.find(row=>row[0]==='refs/remotes/origin/HEAD')??(remoteHeads.length===1?remoteHeads[0]:undefined);
  const target=remoteHead?.[5];
  const defaultRef=target?(before.refs.find(ref=>ref.raw===target.replace(/^refs\/remotes\/[^/]+\//,'refs/heads/'))??before.refs.find(ref=>ref.raw===target)):primary;
  const comparisonTip=selected?.kind==='branch'?selected.tip:reference==='all'?before.head:undefined;
  let diffTip=primary?.tip??before.head;
  if(primary?.tip){
    const remotePrimary=(primary.upstream?before.refs.find(ref=>ref.name===primary.upstream):undefined)??before.refs.find(ref=>ref.raw===`refs/remotes/origin/${primary.name}`);
    if(remotePrimary&&remotePrimary.tip!==primary.tip){
      const isAnc=await git(['merge-base','--is-ancestor',primary.tip,remotePrimary.tip]).then(()=>true,()=>false);
      if(isAnc)diffTip=remotePrimary.tip;
    }
  }
  const [branchComparison,signatures]=await Promise.all([
    comparisonTip?(async()=>{
      const [current,def]=await Promise.all([
        before.head?compareBranch(git,comparisonTip,{name:clean(before.branch.replace(/^refs\/heads\//,''))||'Detached HEAD',tip:before.head},shallow):Promise.resolve(undefined),
        defaultRef?compareBranch(git,comparisonTip,{name:defaultRef.name,tip:defaultRef.tip,basis:remoteHead?'remote-head':'conventional-name'},shallow):Promise.resolve(undefined),
      ]);
      return {...(current?{current}:{}),...(def?{default:def}:{})};
    })():Promise.resolve(undefined),
    squashEvidence(git,commits.slice(0,50),diffTip,primary?.tip),
  ]);
  if((await refSnapshot(git)).generation!==before.generation)throw changed();
  const result:GitHistoryPage={mainline:primary?{name:primary.name,tip:primary.tip}:before.head?{name:clean(before.branch.replace(/^refs\/heads\//,''))||'HEAD',tip:before.head}:undefined,generation:before.generation,head:before.head,branch:clean(before.branch.replace(/^refs\/heads\//,''))||'Detached HEAD',shallow,sampledAt:new Date().toISOString(),commits:commits.slice(0,50),start,more:commits.length>50,limit:50,references:matching.slice(referenceStart,referenceStart+100).map(publicRef),referenceStart,referenceCount:matching.length,referenceTotal:before.refs.length,localBranches:before.refs.filter(ref=>ref.kind==='branch').slice(0,100).map(publicRef),localBranchTotal:before.refs.filter(ref=>ref.kind==='branch').length,selectedReference:selected?publicRef(selected):undefined,branchComparison,...signatures};
  if(cacheOptions.cache&&cacheOptions.root)cacheOptions.cache.set(cacheOptions.root,before.generation,reference,referenceStart,query,start,result);
  return result;
}

/**
 * Evidence for squash merges, which leave no parent link in Git. Each non-merge commit and each branch head carries:
 * (1) a content signature of written paths and blob OIDs, (2) a stable `git patch-id` of its net diff, and
 * (3) bounded changed path -> blob maps (for branch heads, restricted to paths touched by the branch's own non-merge
 * commits). Git objects never change, so all entries are cached by object id.
 */
const MAX_FILES_PER_CHANGE=200;
const signatureCache=new Map<string,string>();
const patchIdCache=new Map<string,string>();
const filesCache=new Map<string,Record<string,string>|null>();
const rememberMap=<T>(cache:Map<string,T>,key:string,value:T,max=4000)=>{cache.set(key,value);if(cache.size>max)cache.delete(cache.keys().next().value!);return value;};
const remember=(key:string,value:string)=>rememberMap(signatureCache,key,value);
function parseRawFiles(raw:string):Map<string,string> {
  const entries=new Map<string,string>();
  const tokens=raw.split('\0');
  for(let i=0;i<tokens.length;i++){
    const meta=tokens[i]!.trim();if(!meta.startsWith(':'))continue;
    const fields=meta.slice(1).split(/\s+/),path=tokens[i+1]??'';i++;
    if(fields.length<5||!oid.test(fields[3]??'')||!path)continue;
    entries.set(path,fields[4]==='D'?'-':fields[3]!);
  }
  return entries;
}
function signatureFromFiles(files:Map<string,string>):string {
  if(!files.size)return '';
  return hash([...files.entries()].map(([path,blob])=>`${path}\0${blob}`).sort().join('\n')).slice(0,24);
}
function filesRecordFromMap(files:Map<string,string>):Record<string,string>|null {
  if(!files.size||files.size>MAX_FILES_PER_CHANGE)return null;
  const record:Record<string,string>={};
  for(const [path,blob] of files){
    const safePath=clean(path);
    if(safePath)record[safePath]=blob;
  }
  return Object.keys(record).length?record:null;
}
async function computePatchIds(input:string):Promise<Map<string,string>> {
  const out=new Map<string,string>();
  if(!input.trim())return out;
  const stdout=await new Promise<string>(resolve=>{
    const child=execFile('git',['patch-id','--stable'],{timeout:10_000,maxBuffer:2*1024*1024,encoding:'utf8',windowsHide:true},(error,data)=>resolve(error?'':data));
    child.stdin?.end(input);
  });
  for(const line of stdout.split(/\r?\n/)){
    const parts=line.trim().split(/\s+/);
    if(parts.length>=2&&oid.test(parts[0]!)&&oid.test(parts[1]!))out.set(parts[1]!,parts[0]!);
  }
  return out;
}
async function computeSinglePatchId(diff:string):Promise<string> {
  if(!diff.trim())return '';
  const stdout=await new Promise<string>(resolve=>{
    const child=execFile('git',['patch-id','--stable'],{timeout:10_000,maxBuffer:512*1024,encoding:'utf8',windowsHide:true},(error,data)=>resolve(error?'':data));
    child.stdin?.end(diff);
  });
  const first=stdout.trim().split(/\s+/)[0]??'';
  return oid.test(first)?first:'';
}
async function squashEvidence(git:Git,commits:GitCommit[],tip:string|undefined,primaryTip?:string) {
  const changeSignatures:Record<string,string>={},branchSignatures:Record<string,string>={};
  const changePatchIds:Record<string,string>={},branchPatchIds:Record<string,string>={};
  const changeFiles:Record<string,Record<string,string>>={},branchOwnFiles:Record<string,Record<string,string>>={};
  if(!tip||!oid.test(tip))return {changeSignatures,branchSignatures,changePatchIds,branchPatchIds,changeFiles,branchOwnFiles};
  const single=commits.filter(commit=>commit.parents.length===1);
  const missing=single.filter(commit=>!signatureCache.has(`c:${commit.hash}`)||!filesCache.has(`cf:${commit.hash}`)).map(commit=>commit.hash);
  if(missing.length){
    const log=await git(['log','--no-walk=unsorted','--no-renames','--no-abbrev','--raw','-z','--format=%x01%H',...missing,'--']).catch(()=>'');
    for(const chunk of log.split('\x01').slice(1)){
      const end=chunk.indexOf('\0');const id=chunk.slice(0,end).trim();
      if(oid.test(id)){
        const parsed=parseRawFiles(chunk.slice(end+1));
        remember(`c:${id}`,signatureFromFiles(parsed));
        rememberMap(filesCache,`cf:${id}`,filesRecordFromMap(parsed));
      }
    }
  }
  const missingPid=single.filter(commit=>!patchIdCache.has(`cp:${commit.hash}`)).map(commit=>commit.hash);
  for(let i=0;i<missingPid.length;i+=10){
    const batch=missingPid.slice(i,i+10);
    const diff=await git(['show','--no-show-signature','--no-notes',...gitDiffFlags,'-p','--format=%H',...batch,'--']).catch(()=>undefined);
    if(diff!==undefined){
      const ids=await computePatchIds(diff);
      for(const id of batch)rememberMap(patchIdCache,`cp:${id}`,ids.get(id)??'');
    }else{
      for(const id of batch){
        const one=await git(['show','--no-show-signature','--no-notes',...gitDiffFlags,'-p','--format=%H',id,'--']).catch(()=>'');
        const ids=await computePatchIds(one);
        rememberMap(patchIdCache,`cp:${id}`,ids.get(id)??'');
      }
    }
  }
  for(const commit of single){
    const sig=signatureCache.get(`c:${commit.hash}`);if(sig)changeSignatures[commit.hash]=sig;
    const pid=patchIdCache.get(`cp:${commit.hash}`);if(pid)changePatchIds[commit.hash]=pid;
    const files=filesCache.get(`cf:${commit.hash}`);if(files)changeFiles[commit.hash]=files;
  }
  const byHash=new Map(commits.map(c=>[c.hash,c]));
  const mainSet=new Set<string>();
  for(const seed of [tip,primaryTip]){
    for(let cursor=seed;cursor&&byHash.has(cursor)&&!mainSet.has(cursor);cursor=byHash.get(cursor)!.parents[0])mainSet.add(cursor);
  }
  const firstParentChildren=new Set(commits.map(commit=>commit.parents[0]).filter((h):h is string=>!!h));
  const children=new Set(commits.flatMap(commit=>commit.parents));
  const candidates=commits.filter(commit=>{
    if(mainSet.has(commit.hash)||commit.hash===tip||commit.hash===primaryTip)return false;
    if(commit.parents.length>1&&commit.parents[0]&&mainSet.has(commit.parents[0]))return false;
    return !firstParentChildren.has(commit.hash)||!children.has(commit.hash)||commit.labels.length>0;
  });
  candidates.sort((a,b)=>(b.labels.length>0?1:0)-(a.labels.length>0?1:0)||(!firstParentChildren.has(b.hash)?1:0)-(!firstParentChildren.has(a.hash)?1:0));
  const heads=candidates.slice(0,80);
  for(let i=0;i<heads.length;i+=4){
    await Promise.all(heads.slice(i,i+4).map(async commit=>{
      const h=commit.hash;
      const bKey=`b:${tip}:${h}`,bfKey=`bf:${tip}:${h}`,bpKey=`bp:${tip}:${h}`,boKey=`bo:${tip}:${h}`;
      if(!signatureCache.has(bKey)||!filesCache.has(bfKey)){
        const parsed=parseRawFiles(await git(['diff',...gitDiffFlags,'--raw','--no-abbrev','-z',`${tip}...${h}`,'--']).catch(()=>''));
        remember(bKey,signatureFromFiles(parsed));
        rememberMap(filesCache,bfKey,filesRecordFromMap(parsed));
      }
      const sig=signatureCache.get(bKey);
      if(!sig)return;
      branchSignatures[h]=sig;
      if(!patchIdCache.has(bpKey)){
        const diff=await git(['diff',...gitDiffFlags,`${tip}...${h}`,'--']).catch(()=>'');
        rememberMap(patchIdCache,bpKey,await computeSinglePatchId(diff));
      }
      const pid=patchIdCache.get(bpKey);
      if(pid)branchPatchIds[h]=pid;
      if(!filesCache.has(boKey)){
        const netFiles=filesCache.get(bfKey)??null;
        if(!netFiles)rememberMap(filesCache,boKey,null);
        else{
          const hasMerges=!!(await git(['rev-list','--merges','--max-count=1',`${tip}..${h}`,'--']).catch(()=>'')).trim();
          if(!hasMerges)rememberMap(filesCache,boKey,netFiles);
          else{
            const ownCommits=(await git(['rev-list','--no-merges','--max-count=64',`${tip}..${h}`,'--']).catch(()=>'')).trim().split(/\r?\n/).filter(Boolean);
            if(!ownCommits.length)rememberMap(filesCache,boKey,null);
            else{
              const namesRaw=await git(['show','--no-show-signature','--no-notes','--no-renames','--name-only','-z','--format=',...ownCommits,'--']).catch(()=>'');
              const ownPaths=new Set(namesRaw.split('\0').map(clean).filter(Boolean));
              const filtered:Record<string,string>={};
              for(const [path,blob] of Object.entries(netFiles))if(ownPaths.has(path))filtered[path]=blob;
              rememberMap(filesCache,boKey,Object.keys(filtered).length?filtered:null);
            }
          }
        }
      }
      const own=filesCache.get(boKey);
      if(own)branchOwnFiles[h]=own;
    }));
  }
  return {changeSignatures,branchSignatures,changePatchIds,branchPatchIds,changeFiles,branchOwnFiles};
}
export async function gitCommit(git:Git,id:string,parentIndex=0,start=0,generation?:string):Promise<GitCommitDetail> {
  if(!oid.test(id)||!Number.isSafeInteger(parentIndex)||parentIndex<0||parentIndex>1023||generation!==undefined&&!/^[a-f0-9]{64}$/.test(generation))throw invalid();page(start);
  const before=await refSnapshot(git);if(generation&&generation!==before.generation)throw changed();
  if((await git(['cat-file','-t',id])).trim()!=='commit')throw new HttpError(400,'Select a commit object.');
  const parents=await objectParents(git,id);
  if(parents.some(parent=>!oid.test(parent))||parents.length>1024||parentIndex>=Math.max(1,parents.length))throw invalid();
  const parent=parents[parentIndex];
  if(parent&&(await git(['cat-file','-t',parent]).catch(()=>'' )).trim()!=='commit')throw new HttpError(422,'Parent content is unavailable locally. This commit cannot be compared without its parent.');
  const args=parent?['diff',...gitDiffFlags,parent,id]:['diff-tree',...gitDiffFlags,'--root','-r','--no-commit-id',id];
  const names=(await git([...args,'--name-status','-z','--'])).split('\0');if(names.at(-1)==='')names.pop();
  if(names.length%2)throw new HttpError(422,'Git returned unsupported changed paths.');
  const paths=[];for(let n=0;n<names.length;n+=2)paths.push({status:names[n]!,path:names[n+1]!});
  const allowed=paths.filter(item=>safeGitPath(item.path)),files:GitFile[]=[],omissions:GitOmission[]=[];
  let budget=1024*1024;
  for(const item of allowed.slice(start,start+50)){
    try{
      const raw=await git([...args,'-p','--',item.path]);
      const patch=clean('Commit changes\n'+raw),bytes=Buffer.byteLength(patch);
      if(bytes>budget){omissions.push({path:clean(item.path),reason:'content-limit'});continue;}
      budget-=bytes;files.push({path:clean(item.path),status:item.status,patch,fingerprint:hash(id+'\0'+(parent??'root')+'\0'+item.path+'\0'+raw)});
    }catch(error){if(error instanceof HttpError&&error.status===413)omissions.push({path:clean(item.path),reason:'process-limit'});else throw error;}
  }
  const message=clean(await git(['show','--no-show-signature','--no-notes','--format=%B','--no-patch',id,'--']));
  if((await refSnapshot(git)).generation!==before.generation)throw changed();
  return {hash:id,parents,parent,message,files,start,total:allowed.length,protectedCount:paths.length-allowed.length,omissions,limit:50};
}
