import {currentWorkspacePath, type RecordedFileRoot} from './worktree-files.ts';

const sources=new WeakMap<object,Map<string,Map<string,string>>>();
/** Navigation references only. Current paths never replace a captured file's identity. */
export function rememberCurrentFileOrigin(source:object|undefined,id:string,path:string,recordedPath:string) {
  if(!source||![path,recordedPath].every(value=>value.length>0&&value.length<=2048))return;
  let sessions=sources.get(source);if(!sessions){sessions=new Map();sources.set(source,sessions);}
  const paths=sessions.get(id)??new Map<string,string>();
  sessions.delete(id);sessions.set(id,paths);
  if(sessions.size>8)sessions.delete(sessions.keys().next().value!);
  paths.delete(path);paths.set(path,recordedPath);
  if(paths.size>32)paths.delete(paths.keys().next().value!);
}
export function currentFileOrigin(source:object|undefined,id:string,path:string,roots:RecordedFileRoot[],workspaceRoot:string|undefined):string|undefined {
  const recorded=source&&sources.get(source)?.get(id)?.get(path);
  // A stale or different root cannot turn a current reference into another history.
  if(!recorded)return path;
  return currentWorkspacePath(recorded,roots,workspaceRoot)===path?recorded:undefined;
}
