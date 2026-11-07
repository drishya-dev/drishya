import{createContext,useMemo,type ReactNode}from'react';
import{useApp}from'../state.ts';
import{useFileRoots}from'../lib/use-file-roots.ts';
import{proseFileIndex,type ProseFileNavigation,type ProseFileReference}from'../lib/prose-file-index.ts';
import{currentWorkspacePath}from'../lib/worktree-files.ts';
export const ProseFiles=createContext<ProseFileNavigation|undefined>(undefined);
const noRoots:ReturnType<typeof useFileRoots>=[];
/** One shared evidence index for the conversation, not a filesystem lookup for each sentence. */
export function ProseFilesProvider({children,approved}:{children:ReactNode;approved:boolean}){
 const projection=useApp(s=>s.projection),graph=useApp(s=>s.graph),recording=useApp(s=>s.recording);
 const loadedRoots=useFileRoots(projection?.observationCount??0),roots=loadedRoots.length?loadedRoots:noRoots,root=recording?.workspaceRoot??projection?.workspaceRoot;
 const index=useMemo(()=>proseFileIndex([
  ...(graph?.nodes.map(node=>({path:node.path,captured:graph.temporal!=='current'}))??[]),
  ...(projection?.files.map(file=>({path:file.path,captured:true}))??[]),
  ...(projection?.operations.flatMap(op=>op.paths.map(path=>({path:path.path,captured:true})))??[]),
 ],root,roots),[projection?.files,projection?.operations,graph,root,roots]);
 const value=useMemo(()=>({...index,open(reference:ProseFileReference){
  const state=useApp.getState();
  if(reference.folder){state.set({foldersHidden:false,explore:false,follow:false,held:true});window.dispatchEvent(new CustomEvent('drishya-reveal-prose-folder',{detail:reference.path}));return;}
  const current=currentWorkspacePath(reference.path,roots,root);
  if(!reference.captured&&approved&&current!==undefined){state.set({developerWorkspace:false,explore:false,follow:false,held:true});window.dispatchEvent(new CustomEvent('drishya-preview-file',{detail:{path:current}}));return;}
  state.set({filePanel:reference.path,filePanelFocus:undefined,filePanelEvidence:undefined,filePanelLine:reference.line,currentFile:undefined,selectedOp:undefined,expandedOp:undefined,developerWorkspace:false,explore:false,follow:false,held:true});
 }}),[index,approved,roots,root]);
 return <ProseFiles.Provider value={value}>{children}</ProseFiles.Provider>;
}
