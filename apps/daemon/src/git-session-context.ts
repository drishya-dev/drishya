import {createHash} from 'node:crypto';
import {redactText} from '@drishya/privacy';
import {HttpError} from './app.ts';
import {safeGitPath,gitDiffFlags} from './git-paths.ts';
import type {GitSessionQuery} from './git-session-evidence.ts';

type Git=(args:string[])=>Promise<string>;
type CurrentFile=(path:string)=>Promise<{text:string;hasMore:boolean;redacted:boolean}>;
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
/** Bounded current Git facts; no source or working-tree bytes are persisted. */
export async function gitSessionContext(git:Git,hashes:string[],includeWorking=true,readNew?:CurrentFile):Promise<{query:GitSessionQuery;omitted:number}> {
  const commits:GitSessionQuery['commits']=[];
  if(hashes.length){
    const raw=await git(['log','--no-show-signature','--no-notes','--no-walk=unsorted','--no-renames','--name-only','-z','--format=%x01%H%x00%cI',...hashes.slice(0,50),'--']).catch(error=>{if(error instanceof HttpError&&(error.status===413||error.status===422))return '';throw error;});
    for(const part of raw.split('\x01').slice(1)){
      const [hash,committedAt,...names]=part.split('\0');
      const paths=names.map(path=>path.replace(/^\n/,'')).filter(Boolean);
      // Protected, merged or oversized changes cannot provide an exact path-set assertion.
      if(hash&&committedAt&&paths.length<=500&&paths.every(safeGitPath))commits.push({hash,committedAt,paths});
    }
  }
  if(!includeWorking)return {query:{commits,working:[]},omitted:0};
  const statusArgs=['status','--porcelain=v1','-z','--untracked-files=all','--ignore-submodules=all'];
  const status=await git(statusArgs);
  const fields=status.split('\0'),paths:{status:string;path:string}[]=[];
  for(let n=0;n<fields.length;n++){const row=fields[n]!;if(!row)continue;paths.push({status:row.slice(0,2),path:row.slice(3)});if(/[RC]/.test(row.slice(0,2)))n++;}
  // This is a small contextual sample, not another all-files Git review. Older commit pages
  // never reread the working tree. A dirty large repository must keep its graph responsive.
  const candidates=paths.filter(item=>!/[RCU]/.test(item.status)&&safeGitPath(item.path)).slice(0,12);
  const working:GitSessionQuery['working']=[],signatures=new Map<string,string>();let budget=1024*1024;
  const readPatch=async(item:{status:string;path:string})=>{
    if(item.status!=='??')return git(['diff',...gitDiffFlags,'--unified=3','HEAD','--',item.path]);
    if(!readNew)return undefined;
    const current=await readNew(item.path);if(current.hasMore||current.redacted)return undefined;
    const lines=current.text.replace(/\r\n/g,'\n').split('\n');if(lines.at(-1)==='')lines.pop();
    return `@@ -0,0 +1,${lines.length} @@\n${lines.map(line=>'+'+line).join('\n')}\n`;
  };
  for(let n=0;n<candidates.length;n+=4){
    const batch=await Promise.all(candidates.slice(n,n+4).map(async item=>{
      try{const raw=await readPatch(item);return raw===undefined?undefined:{path:item.path,raw};}
      catch(error){if(error instanceof HttpError&&[403,404,413,422].includes(error.status))return;throw error;}
    }));
    for(const item of batch){
      if(!item)continue;const {raw,path}=item,clean=redactText(raw);
      if(clean.text!==raw||Buffer.byteLength(raw)>budget)continue;
      budget-=Buffer.byteLength(raw);signatures.set(path,digest(raw));working.push({path,patch:raw,...(candidates.find(candidate=>candidate.path===path)?.status==='??'?{created:true}:{})});
    }
  }
  // Current evidence must be one consistent sample, not a patch read halfway through an edit.
  for(let n=0;n<working.length;n+=4)await Promise.all(working.slice(n,n+4).map(async item=>{const raw=await readPatch(candidates.find(candidate=>candidate.path===item.path)!);if(raw===undefined||digest(raw)!==signatures.get(item.path))throw new HttpError(409,'Working tree changed during inspection. Refresh Git history.');}));
  if(await git(statusArgs)!==status)throw new HttpError(409,'Working tree changed during inspection. Refresh Git history.');
  return {query:{commits,working},omitted:Math.max(0,paths.length-working.length)};
}
