import {createHash} from 'node:crypto';
import {redactText} from '@drishya/privacy';
import {HttpError} from './app.ts';
import {safeGitPath,gitDiffFlags} from './git-paths.ts';
import type {GitReference,GitHistoryPage,GitCommitDetail,GitCommit,GitFile,GitOmission} from './git-types.ts';

type Git=(args:string[])=>Promise<string>;
const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
const oid=/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const invalid=()=>new HttpError(400,'Invalid Git history request.');
const changed=()=>new HttpError(409,'Git references changed. Refresh history before continuing.');
const clean=(text:string)=>redactText(text).text;
const preview=(text:string,limit:number)=>{const value=clean(text);return value.length>limit?value.slice(0,limit)+'…':value;};
const page=(value:number)=>{if(!Number.isSafeInteger(value)||value<0||value>10_000_000)throw invalid();};

async function state(git:Git) {
  const raw=await git(['for-each-ref','--sort=refname','--format=%(refname)%00%(objectname)%00%(*objectname)%00','refs/heads','refs/remotes','refs/tags']);
  const head=(await git(['rev-parse','--verify','HEAD']).catch(()=>'')).trim();
  const branch=(await git(['symbolic-ref','-q','HEAD']).catch(()=>'')).trim();
  const refs=raw.split('\n').filter(Boolean).map(row=>{
    const [name,tip,peeled]=row.split('\0');
    if(!name||!oid.test(tip??''))throw new HttpError(422,'Git returned invalid reference metadata.');
    return {raw:name,id:hash(name),name:clean(name.replace(/^refs\/(heads|remotes|tags)\//,'')),tip:peeled&&oid.test(peeled)?peeled:tip!,kind:name.startsWith('refs/heads/')?'branch':name.startsWith('refs/remotes/')?'remote':'tag',current:name===branch} as GitReference&{raw:string};
  });
  return {raw,head,branch,refs,generation:hash(raw+'\0'+head+'\0'+branch)};
}
const publicRef=({raw,...reference}:GitReference&{raw:string}):GitReference=>reference;

// Revision walking treats shallow boundaries as roots; the object header retains the real parents.
async function objectParents(git:Git,id:string):Promise<string[]> {
  const header=(await git(['cat-file','-p',id])).split(/\r?\n\r?\n/,1)[0]!;
  const parents=header.split(/\r?\n/).filter(line=>line.startsWith('parent ')).map(line=>line.slice(7));
  if(parents.length>1024||parents.some(parent=>!oid.test(parent)))throw new HttpError(422,'Git returned unsupported parent metadata.');
  return parents;
}

export interface GitHistoryQuery {start?:number;referenceStart?:number;reference?:string;query?:string;generation?:string}
export async function gitHistory(git:Git,options:GitHistoryQuery={}):Promise<GitHistoryPage> {
  const {start=0,referenceStart=0,reference='all',query='',generation}=options;
  page(start);page(referenceStart);
  if(query.length>200||reference!=='all'&&!/^[a-f0-9]{64}$/.test(reference)||generation!==undefined&&!/^[a-f0-9]{64}$/.test(generation))throw invalid();
  const before=await state(git);if(generation&&generation!==before.generation)throw changed();
  const selected=reference==='all'?undefined:before.refs.find(ref=>ref.id===reference);
  if(reference!=='all'&&!selected)throw new HttpError(404,'This Git reference is no longer available.');
  const revision=selected?(await git(['rev-parse','--verify',`${selected.raw}^{commit}`])).trim():undefined;
  if(revision&&!oid.test(revision))throw new HttpError(422,'This reference does not point to a commit.');
  const log=await git(['log','--no-show-signature','--no-notes','--topo-order','--no-decorate','-z','--format=%H%x00%P%x00%an%x00%aI%x00%s','--max-count=51',`--skip=${start}`,...(revision?[revision]:['--all',...(before.head?[before.head]:[])]),'--']);
  const fields=log.split('\0');if(fields.at(-1)==='')fields.pop();
  if(fields.length%5)throw new HttpError(422,'Git returned incomplete commit metadata.');
  const shallow=(await git(['rev-parse','--is-shallow-repository'])).trim()==='true';
  const commits:GitCommit[]=[];
  for(let n=0;n<fields.length;n+=5){
    const [id,parentList,author,time,subject]=fields.slice(n,n+5);
    const parents=parentList?parentList.split(' '):shallow&&id&&oid.test(id)?await objectParents(git,id):[];
    if(!oid.test(id??'')||parents.some(parent=>!oid.test(parent))||parents.length>1024)throw new HttpError(422,'Git returned unsupported commit metadata.');
    const labels=before.refs.filter(ref=>ref.tip===id);
    commits.push({hash:id!,parents,author:preview(author!,256),time:time!,subject:preview(subject!,2048),labels:labels.slice(0,6).map(ref=>ref.name),omittedLabels:Math.max(0,labels.length-6)});
  }
  const matching=before.refs.filter(ref=>ref.name.toLowerCase().includes(query.toLowerCase()));
  if((await state(git)).generation!==before.generation)throw changed();
  const primary=before.refs.find(ref=>ref.raw==='refs/heads/main')??before.refs.find(ref=>ref.raw==='refs/heads/master');
  return {mainline:primary?{name:primary.name,tip:primary.tip}:before.head?{name:clean(before.branch.replace(/^refs\/heads\//,''))||'HEAD',tip:before.head}:undefined,generation:before.generation,head:before.head,branch:clean(before.branch.replace(/^refs\/heads\//,''))||'Detached HEAD',shallow,sampledAt:new Date().toISOString(),commits:commits.slice(0,50),start,more:commits.length>50,limit:50,references:matching.slice(referenceStart,referenceStart+100).map(publicRef),referenceStart,referenceCount:matching.length,referenceTotal:before.refs.length,selectedReference:selected?publicRef(selected):undefined};
}

export async function gitCommit(git:Git,id:string,parentIndex=0,start=0,generation?:string):Promise<GitCommitDetail> {
  if(!oid.test(id)||!Number.isSafeInteger(parentIndex)||parentIndex<0||parentIndex>1023||generation!==undefined&&!/^[a-f0-9]{64}$/.test(generation))throw invalid();page(start);
  const before=await state(git);if(generation&&generation!==before.generation)throw changed();
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
  if((await state(git)).generation!==before.generation)throw changed();
  return {hash:id,parents,parent,message,files,start,total:allowed.length,protectedCount:paths.length-allowed.length,omissions,limit:50};
}
