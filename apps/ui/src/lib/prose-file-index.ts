import type {RecordedFileRoot} from './worktree-files.ts';
export interface ProseFileReference {path:string;folder:boolean;captured:boolean;line?:number}
export interface ProseFileNavigation {resolve:(value:string)=>ProseFileReference|undefined;open:(reference:ProseFileReference)=>void}
const absolute=(path:string)=>path.startsWith('/')||/^[a-z]:\//i.test(path);
function clean(value:string):{path:string;line?:number}|undefined {
  if(!value||value.length>2000||/[\x00-\x1f<>|?*]/.test(value))return;
  let path=value.trim(),line:number|undefined;
  const anchor=/(?::([1-9]\d{0,8})(?::[1-9]\d{0,8})?|#L([1-9]\d{0,8})(?:-L?[1-9]\d{0,8})?)$/.exec(path);
  if(anchor){line=Number(anchor[1]??anchor[2]);path=path.slice(0,anchor.index);}
  if(/^file:\/\/\//i.test(path)){try{path=decodeURIComponent(path.slice(7));}catch{return;}}
  path=path.replace(/\\/g,'/').replace(/^\/([a-z]:\/)/i,'$1').replace(/\/+$/,'').replace(/^\.\//,'');
  if(!path||path.startsWith('//')||path.includes('#')||path.split('/').some(p=>p==='.'||p==='..')||(/^[a-z][a-z\d+.-]*:/i.test(path)&&!/^([a-z]:\/)/i.test(path)))return;
  return {path,...(line?{line}:{})};
}

/** Exact evidence identities win; a shortened name is navigable only when it has one meaning. No disk probes. */
export function proseFileIndex(files:readonly {path:string;captured:boolean}[],workspaceRoot?:string,roots:readonly RecordedFileRoot[]=[]):Pick<ProseFileNavigation,'resolve'> {
  const windows=/^[a-z]:[\\/]/i.test(workspaceRoot??'');
  const key=(s:string)=>windows||/^[a-z]:\//i.test(s)?s.toLowerCase():s;
  const exact=new Map<string,ProseFileReference>(),aliases=new Map<string,ProseFileReference|null>();
  const alias=(name:string,ref:ProseFileReference)=>{if(aliases.size>=200000)return;const k=key(name),previous=aliases.get(k);aliases.set(k,previous===undefined?ref:previous&&previous.path===ref.path&&previous.folder===ref.folder?ref:null);};
  const root=workspaceRoot?.replace(/\\/g,'/').replace(/\/+$/,'');
  const logicalFiles=new Map<string,{reference:ProseFileReference;names:Set<string>}>();
  for(const file of files){
    const parsed=clean(file.path);if(!parsed)continue;
    const located=roots.find(r=>parsed.path.startsWith(r.prefix+'/'));
    let logical=parsed.path;
    if(located&&root&&key(located.root.replace(/\\/g,'/').replace(/\/+$/,''))===key(root))logical=parsed.path.slice(located.prefix.length+1);
    if(absolute(logical)&&root&&key(logical).startsWith(key(root+'/')))logical=logical.slice(root.length+1);
    const k=key(logical),previous=logicalFiles.get(k);
    if(!previous&&logicalFiles.size>=20000)continue;
    const identity=located?parsed.path:logical;
    const reference=previous?.reference.captured?previous.reference:{path:identity,folder:false,captured:file.captured};
    const names=previous?.names??new Set<string>();names.add(parsed.path);names.add(logical);
    logicalFiles.set(k,{reference,names});
  }
  for(const {reference,names}of logicalFiles.values())for(const name of names)exact.set(key(name),reference);
  for(const ref of [...exact.values()]){
    const located=roots.find(r=>ref.path.startsWith(r.prefix+'/'));
    const relative=located?ref.path.slice(located.prefix.length+1):ref.path;
    alias(ref.path,ref);
    if(located){alias(`${located.root.replace(/[\\/]$/,'')}/${relative}`,ref);if(located.recordedRoot)alias(`${located.recordedRoot.replace(/[\\/]$/,'')}/${relative}`,ref);}
    else if(root&&!absolute(ref.path))alias(`${root}/${ref.path}`,ref);
    const parts=relative.split('/');
    for(let i=0;i<Math.min(parts.length,64);i++)alias(parts.slice(i).join('/'),ref);
    // Only folders actually represented in Files are navigable. Outside absolute paths stay captured-file identities.
    if(absolute(ref.path))continue;
    const full=ref.path.split('/');
    for(let n=1;n<Math.min(full.length,64);n++){
      const path=full.slice(0,n).join('/');if(located&&n===1)continue;
      const folder={path,folder:true,captured:ref.captured};
      if(!exact.has(key(path)))exact.set(key(path),folder);
      alias(path,folder);
      const start=located?1:0;for(let i=start;i<n;i++)alias(full.slice(i,n).join('/'),folder);
      if(located)alias(`${located.root.replace(/[\\/]$/,'')}/${full.slice(1,n).join('/')}`,folder);
      else if(root)alias(`${root}/${path}`,folder);
    }
  }
  return {resolve(value){const parsed=clean(value);if(!parsed)return;const found=exact.get(key(parsed.path))??aliases.get(key(parsed.path));return found?{...found,...(parsed.line?{line:parsed.line}:{})}:undefined;}};
}
