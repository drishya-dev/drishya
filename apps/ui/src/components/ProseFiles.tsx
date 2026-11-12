import{createContext,useEffect,useMemo,useState,type ReactNode}from'react';
import{ImageReader,PathImage}from'./OpImages.tsx';
import{ReadingDialog}from'./ProductShell.tsx';
import{asOfProjection,type Operation}from'@drishya/contracts';
import{useApp}from'../state.ts';
import{useFileRoots}from'../lib/use-file-roots.ts';
import{proseFileIndex,type ProseFileNavigation,type ProseFileReference}from'../lib/prose-file-index.ts';
import{currentWorkspacePath}from'../lib/worktree-files.ts';
export const ProseFiles=createContext<ProseFileNavigation|undefined>(undefined);
const noRoots:ReturnType<typeof useFileRoots>=[];
/** One shared evidence index for the conversation, not a filesystem lookup for each sentence. */
export function ProseFilesProvider({children,approved}:{children:ReactNode;approved:boolean}){
 const loaded=useApp(s=>s.projection),page=useApp(s=>s.historyPage),step=useApp(s=>s.step),graph=useApp(s=>s.graph),recording=useApp(s=>s.recording);
 const checkoutRoot=useApp(s=>s.checkoutRoot);
 const projection=useMemo(()=>page?.projection??(loaded?asOfProjection(loaded,step):undefined),[loaded,page?.projection,step]);
 const loadedRoots=useFileRoots(projection?.observationCount??0),roots=loadedRoots.length?loadedRoots:noRoots,root=checkoutRoot??recording?.workspaceRoot??projection?.workspaceRoot;
 const source=useApp(s=>s.source),id=useApp(s=>s.recordingId);
 const [image,setImage]=useState<{source:typeof source;id:typeof id;operation:string;url:string;image:NonNullable<NonNullable<typeof projection>['operations'][number]['images']>[number]}>();
 const [pathImage,setPathImage]=useState<{source:typeof source;id:typeof id;path:string;op:Operation}>();
 useEffect(()=>{setImage(undefined);setPathImage(undefined);},[source,id]);
 const imageFiles=useMemo(()=>projection?.operations.flatMap(op=>{
  if(op.detail.kind==='read'&&/\.(png|jpe?g|gif|webp)$/i.test(op.detail.path))return [{path:op.detail.path,op,image:op.endSequence!==undefined&&op.images?.length===1&&op.images[0]?.sha?op.images[0]:undefined}];
  if(op.detail.kind!=='other')return [];
  const input=op.detail.input as {image?:{path?:unknown;savedPath?:unknown}}|undefined,path=input?.image?.path??input?.image?.savedPath;
  return typeof path==='string'?[{path,op,image:op.endSequence!==undefined&&op.images?.length===1&&op.images[0]?.sha?op.images[0]:undefined}]:[];
 })??[],[projection?.operations]);
 const index=useMemo(()=>proseFileIndex([
  ...imageFiles.map(image=>({path:image.path,captured:true})),
  ...(projection?.operations.flatMap(op=>op.paths.map(path=>({path:path.path,captured:true})))??[]),
  ...(projection?.files.map(file=>({path:file.path,captured:true}))??[]),
  ...(graph?.nodes.map(node=>({path:node.path,captured:graph.temporal!=='current'}))??[]),
 ],root,roots),[projection?.files,projection?.operations,graph,root,roots,imageFiles]);
 const value=useMemo(()=>({...index,open(reference:ProseFileReference){
  const state=useApp.getState();
  if(reference.folder){state.set({developerWorkspace:false,foldersHidden:false,explore:false,follow:false,held:true});window.dispatchEvent(new CustomEvent('drishya-reveal-prose-folder',{detail:reference.path}));return;}
  const capturedImage=imageFiles.find(image=>index.resolve(image.path)?.path===reference.path);
  if(capturedImage?.image&&source?.imageUrl&&id){
   state.set({follow:false,held:true});setImage({source,id,operation:capturedImage.op.id,url:source.imageUrl(id,capturedImage.image.sha!),image:capturedImage.image});return;
  }
  if(capturedImage){state.set({follow:false,held:true});setPathImage({source,id,path:capturedImage.path,op:capturedImage.op});return;}
  const current=currentWorkspacePath(reference.path,roots,root);
  if(!reference.captured&&approved&&state.mode==='history'&&current!==undefined){
   state.set({developerWorkspace:false,explore:false,follow:false,held:true});
   if(document.documentElement.dataset.uiVersion==='modern')window.dispatchEvent(new CustomEvent('drishya-preview-file',{detail:{path:current}}));
   else state.set({currentFile:current,filePanel:undefined});
   return;
  }
  state.set({hoveredPath:reference.path,filePanel:reference.path,filePanelFocus:undefined,filePanelEvidence:undefined,filePanelLine:reference.line,currentFile:undefined,selectedOp:undefined,expandedOp:undefined,developerWorkspace:false,explore:false,follow:false,held:true});
 }}),[index,approved,roots,root,imageFiles,source,id]);
 return <ProseFiles.Provider value={value}>{children}{image&&image.source===source&&image.id===id&&projection?.operations.some(op=>op.id===image.operation&&op.endSequence!==undefined)&&<ImageReader src={image.url} image={image.image} onClose={()=>setImage(undefined)}/>}{pathImage&&pathImage.source===source&&pathImage.id===id&&projection?.operations.some(op=>op.id===pathImage.op.id)&&<ReadingDialog title={pathImage.path} close={()=>setPathImage(undefined)}><PathImage op={pathImage.op} path={pathImage.path}/></ReadingDialog>}</ProseFiles.Provider>;
}
