import type {ReactNode} from 'react';
import {useApp} from '../state.ts';
import {prosePath,type ProsePath} from '../lib/prose-path.ts';
import {outputPaths} from '../lib/output-paths.ts';

export function openCapturedPath(reference:ProsePath,evidence?:string){
 const state=useApp.getState();
 state.set({filePanel:reference.path,filePanelLine:reference.line,filePanelEvidence:evidence,filePanelFocus:undefined,currentFile:undefined,selectedOp:undefined,developerWorkspace:false,searchOpen:false,follow:false,held:true});
}
export function CapturedPath({path,line,evidence,children}:{path:string;line?:number;evidence?:string;children?:ReactNode}){
 const root=useApp(s=>s.recording?.workspaceRoot),ref=prosePath(path,root,true);
 return ref?<button type="button" className="md-path" style={{textDecoration:'underline',textDecorationStyle:'dotted',textUnderlineOffset:'3px'}} title="Open captured file evidence · current disk reading is separate" aria-label={`Open captured work for ${ref.path}${line??ref.line?` at line ${line??ref.line}`:''}`} onClick={event=>{event.stopPropagation();openCapturedPath({...ref,line:line??ref.line},evidence);}}>{children??path}</button>:<>{children??path}</>;
}
/** Text nodes and link labels concatenate to the unchanged displayed output. */
export function outputPathNodes(text:string,root:string|undefined,budget={remaining:64,characters:131072}):ReactNode{
 if(!budget.remaining||text.length>budget.characters)return text;
 budget.characters-=text.length;
 const hits=outputPaths(text,root,Math.min(8,budget.remaining));budget.remaining-=hits.length;if(!hits.length)return text;
 const nodes:ReactNode[]=[];let at=0;
 for(const hit of hits){nodes.push(text.slice(at,hit.start),<CapturedPath key={hit.start} path={hit.path} line={hit.line}>{text.slice(hit.start,hit.end)}</CapturedPath>);at=hit.end;}
 nodes.push(text.slice(at));return nodes;
}
