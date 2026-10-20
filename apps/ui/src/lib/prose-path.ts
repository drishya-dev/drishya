export interface ProsePath {path:string;line?:number}

/** Resolve only lexical file references inside the captured workspace, never a URL or a filesystem probe. */
export function prosePath(value:string,workspaceRoot?:string):ProsePath|undefined {
 if(!value||value.length>2000||/[\x00-\x1f<>|?*]/.test(value))return;
 let path=value.trim(),line:number|undefined;
 const location=/(?::([1-9]\d{0,8})(?::[1-9]\d{0,8})?|#L([1-9]\d{0,8})(?:-L?[1-9]\d{0,8})?)$/.exec(path);
 if(location){line=Number(location[1]??location[2]);path=path.slice(0,location.index);}
 if(path.includes('#')||/^[a-z][a-z\d+.-]*:/i.test(path)&&!/^\/?[a-z]:[\\/]/i.test(path))return;
 path=path.replace(/\\/g,'/').replace(/^\/([a-z]:\/)/i,'$1');
 if(path.startsWith('//')||path.split('/').includes('..'))return;
 const absolute=path.startsWith('/')||/^[a-z]:\//i.test(path);
 if(absolute){
  if(!workspaceRoot)return;
  const root=workspaceRoot.replace(/\\/g,'/').replace(/\/+$/,'');
  if(!root||root.startsWith('//'))return;
  const windows=/^[a-z]:\//i.test(path),prefix=root+'/';
  if(!(windows?path.toLowerCase().startsWith(prefix.toLowerCase()):path.startsWith(prefix)))return;
  path=path.slice(prefix.length);
 }
 path=path.split('/').filter(part=>part!=='.').join('/');
 // Require a file-shaped reference, rather than turning ordinary code or commands into buttons.
 const parts=path.split('/');
 if(parts.some(part=>!part||part.includes(':'))||!parts.every(part=>/^[\p{L}\p{N}_.@ ()+-]+$/u.test(part)))return;
 const file=parts.at(-1)!;
 if(!/\.[\p{L}\p{N}_-]{1,16}$/u.test(file)&&!['LICENSE','README','Dockerfile','Makefile','Containerfile'].includes(file))return;
 return {path,...(line?{line}:{})};
}
