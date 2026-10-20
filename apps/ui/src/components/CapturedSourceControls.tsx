import type {ReactNode} from 'react';
import {SourceFind} from './SourceFind.tsx';
import {WorkspaceOptions} from './WorkspaceOptions.tsx';
import './workspace-source-controls.css';

/** Controls only; the caller retains its exact stored page and source-range checks. */
export function CapturedSourceControls({query,change,matches,active,move,context,wrap,toggleWrap,children}:{
 query:string;change:(value:string)=>void;matches:number[];active?:number;move:(direction:1|-1)=>void;
 context:string;wrap:boolean;toggleWrap:()=>void;children:ReactNode;
}){
 return <div className="captured-source-controls">
  <div className="captured-source-choices">
   <SourceFind query={query} change={change} matches={matches} activeLine={active} move={move} label="Find in loaded source page" idleLabel={context} compact/>
   <button className="btn ghost small captured-source-wrap" aria-label="Wrap lines" title="Wrap lines" aria-pressed={wrap} onClick={toggleWrap}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16M4 10h11M4 15h5m5-2h3a3 3 0 0 1 0 6h-4m2-2-2 2 2 2"/></svg></button>
   <WorkspaceOptions label="Stored source options"><div className="stored-source-menu-controls" onClick={event=>event.stopPropagation()}>{children}</div></WorkspaceOptions>
  </div>
  <small className="captured-source-context">{context}</small>
 </div>;
}
