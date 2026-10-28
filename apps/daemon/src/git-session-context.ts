import {createHash} from 'node:crypto';
import {redactText} from '@drishya/privacy';
import {HttpError} from './app.ts';
import {safeGitPath,gitDiffFlags} from './git-paths.ts';
import type {GitSessionQuery} from './git-session-evidence.ts';

type Git=(args:string[])=>Promise<string>;
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
/** Bounded current Git facts; no source or working-tree bytes are persisted. */
export async function gitSessionContext(git:Git,hashes:string[]):Promise<{query:GitSessionQuery;omitted:number}> {
  const commits:GitSessionQuery['commits']=[];
  if(hashes.length){
    const raw=await git(['log','--no-show-signature','--no-notes','--no-walk=unsorted','--no-renames','--name-only','-z','--format=%x01%H%x00%cI',...hashes.slice(0,50),'--']);
    for(const part of raw.split('\x01').slice(1)){
      const [hash,committedAt,...names]=part.split('\0');
      const paths=names.map(path=>path.replace(/^\n/,'')).filter(Boolean);
      // Protected, merged or oversized changes cannot provide an exact path-set assertion.
      if(hash&&committedAt&&paths.length<=500&&paths.every(safeGitPath))commits.push({hash,committedAt,paths});
    }
  }
  const status=await git(['status','--porcelain=v1','-z','--untracked-files=no','--ignore-submodules=all']);
  const paths=status.split('\0').filter(Boolean).map(row=>({status:row.slice(0,2),path:row.slice(3)}));
  const candidates=paths.filter(item=>!/[RCU]/.test(item.status)&&safeGitPath(item.path)).slice(0,50);
  const working:GitSessionQuery['working']=[],signatures=new Map<string,string>();let budget=1024*1024;
  for(const item of candidates){
    const raw=await git(['diff',...gitDiffFlags,'--unified=3','HEAD','--',item.path]);
    const clean=redactText(raw);
    if(clean.text!==raw||Buffer.byteLength(raw)>budget)continue;
    budget-=Buffer.byteLength(raw);signatures.set(item.path,digest(raw));working.push({path:item.path,patch:raw});
  }
  // Current evidence must be one consistent sample, not a patch read halfway through an edit.
  for(const item of working)if(digest(await git(['diff',...gitDiffFlags,'--unified=3','HEAD','--',item.path]))!==signatures.get(item.path))throw new HttpError(409,'Working tree changed during inspection. Refresh Git history.');
  if(await git(['status','--porcelain=v1','-z','--untracked-files=no','--ignore-submodules=all'])!==status)throw new HttpError(409,'Working tree changed during inspection. Refresh Git history.');
  return {query:{commits,working},omitted:Math.max(0,paths.length-working.length)};
}
