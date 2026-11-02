import type {Operation} from '@drishya/contracts';
import {isDeniedPath} from '../../../../packages/privacy/src/index.ts';
import {currentWorkspacePath,type RecordedFileRoot} from './worktree-files.ts';

export const OUTSIDE_FILE_REASON='Outside this workspace, so the current file on disk is not read.';
const normalize=(value:string)=>value.replace(/\\/g,'/').replace(/\/+$/,'');

/** Lexical navigation only. The daemon still decides consent, identity, indexing and links. */
export function currentReadingTarget(path:string,roots:RecordedFileRoot[],workspaceRoot:string|undefined):{path?:string;reason?:string} {
  if(!workspaceRoot)return {reason:'This session has no available workspace. Read what the agent saw instead.'};
  if(/^worktree-[a-f0-9]{10}\//.test(path)&&!roots.some(root=>path.startsWith(root.prefix+'/')))return {reason:'This worktree’s folder is unknown. Read what the agent saw instead.'};
  let mapped=currentWorkspacePath(path,roots,workspaceRoot);
  if(mapped===undefined)return {reason:OUTSIDE_FILE_REASON};
  mapped=normalize(mapped);
  if(mapped.startsWith('/')||/^[a-z]:\//i.test(mapped)) {
    const prefix=normalize(workspaceRoot)+'/',windows=/^[a-z]:\//i.test(mapped);
    if(!(windows?mapped.toLowerCase().startsWith(prefix.toLowerCase()):mapped.startsWith(prefix)))return {reason:OUTSIDE_FILE_REASON};
    mapped=mapped.slice(prefix.length);
  }
  if(!mapped||mapped.split('/').some(part=>!part||part==='.'||part==='..'||part.includes(':'))||/[\x00-\x1f]/.test(mapped))return {reason:OUTSIDE_FILE_REASON};
  if(isDeniedPath(mapped))return {reason:'This path is protected from disk reading. Only what the session kept is shown.'};
  return {path:mapped};
}

/** These refusals cannot be repaired by repeatedly submitting the same disk read. */
export function currentReadingFailure(error:string|undefined):string|undefined {
  if(!error)return;
  if(/no longer there|ENOENT|not found/i.test(error))return 'This file is no longer on disk. What the agent saw is shown below.';
  if(/outside this workspace|not a readable workspace path/i.test(error))return OUTSIDE_FILE_REASON;
  if(/protected|linked files|outside the indexed workspace|file location changed|workspace.*changed|approve.*workspace/i.test(error))return 'Workspace access does not allow reading this file from disk. What the agent saw is shown below.';
}

export function capturedFileEvidence(op:Operation|undefined,path:string):string|undefined {
  const detail=op?.detail;
  if(detail?.kind==='read'&&detail.path===path)return `${op!.id}/read`;
  if(detail?.kind==='edit'&&detail.path===path) {
    if(op!.artifactIds.some(id=>id.endsWith('_after')))return `${op!.id}/after`;
    if(detail.hunks.length)return `${op!.id}/patch`;
    if(op!.artifactIds.some(id=>id.endsWith('_before')))return `${op!.id}/before`;
  }
}

export function recordedFileIdentity(path:string,files:readonly string[],roots:RecordedFileRoot[],workspaceRoot:string|undefined) {
  if(files.includes(path))return path;
  return roots.map(root=>`${root.prefix}/${path}`).find(candidate=>files.includes(candidate)&&currentReadingTarget(candidate,roots,workspaceRoot).path===path)??path;
}
