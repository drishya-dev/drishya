import {isDeniedPath} from '../../../../packages/privacy/src/index.ts';
/** Relative proposal only. The native harness must still check existence and policy. */
export function newWorkspacePath(value:string,existing:Iterable<string>):string {
  const path=value.trim();
  if(!path||path.length>500||path.includes('\\')||path.startsWith('/')||path.toLowerCase().startsWith('.local/')||/[\x00-\x1f]/.test(path)||path.split('/').some(part=>!part||part==='.'||part==='..'||part.toLowerCase()==='.git'||part.includes(':'))||isDeniedPath(path))throw new Error('Choose an ordinary file path relative to this workspace.');
  if([...existing].some(item=>item.toLowerCase()===path.toLowerCase()))throw new Error('This file already exists. Open it from Files to edit.');
  return path;
}
