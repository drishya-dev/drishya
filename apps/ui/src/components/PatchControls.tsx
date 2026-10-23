import type { ReactNode } from 'react';
import {SourceFind} from './SourceFind.tsx';
import {WorkspaceOptions} from './WorkspaceOptions.tsx';
import './patch-controls.css';

/** Presentation only: DiffReader retains the patch, cursor and navigation state. */
export function PatchControls({layout,setLayout,wrap,toggleWrap,hunk,hunks,jump,query,change,matches,active,move,extra}:{
 layout:'unified'|'split';setLayout:(layout:'unified'|'split')=>void;
 wrap:boolean;toggleWrap:()=>void;hunk:number;hunks:number;jump:(index:number)=>void;
 query:string;change:(value:string)=>void;matches:number[];active?:number;move:(direction:1|-1)=>void;
 /** An action for the hunk being read (GIT-4); absent when nothing applies. */
 extra?:ReactNode;
}){
 return <div className="modern-patch-tools" role="group" aria-label="Patch reading controls">
  <div className="patch-layout-choice" role="group" aria-label="Change layout">
   <button className="btn ghost small" aria-pressed={layout==='unified'} onClick={()=>setLayout('unified')}>Changes</button>
   <button className="btn ghost small" aria-pressed={layout==='split'} onClick={()=>setLayout('split')}>Side by side</button>
  </div>
  <div className="patch-reading-options">
   <button className="btn ghost small patch-wrap" aria-label="Wrap lines" title="Wrap lines" aria-pressed={wrap} onClick={toggleWrap}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16M4 10h11M4 15h5m5-2h3a3 3 0 0 1 0 6h-4m2-2-2 2 2 2"/></svg></button>
   {hunks>1&&<WorkspaceOptions label="Patch options"><label className="patch-hunk-jump">Hunk <input type="number" aria-label="Jump to patch hunk" min={1} max={hunks} value={hunk} onChange={event=>{const index=Number(event.target.value)-1;if(Number.isInteger(index)&&index>=0&&index<hunks)jump(index);}}/> of {hunks}</label><small>Whole loaded patch</small></WorkspaceOptions>}
  </div>
  <SourceFind query={query} change={change} matches={matches} activeLine={active} move={move} label="Find in patch" idleLabel="Whole loaded patch" scopeLabel="this patch" compact/>
  {extra}
 </div>;
}
