import {useRef} from 'react';
import {FileIcon} from './FileIcon.tsx';
import {workspaceTabLabels} from '../lib/workspace-tab-labels.ts';
import type {FilePeekState} from '../lib/file-peek.ts';

export function FilePeekTabs({state,path,select,pin,close,error}:{state:FilePeekState;path:string;select:(path:string)=>void;pin:(path:string)=>void;close:(path:string)=>void;error:string}){
 const list=useRef<HTMLDivElement>(null);
 const dismiss=(file:string)=>{close(file);requestAnimationFrame(()=>list.current?.querySelector<HTMLElement>('[role=tab][aria-selected=true]')?.focus({preventScroll:true}));};
 const files=[...state.files,...(state.preview&&!state.files.includes(state.preview)?[state.preview]:[])],labels=workspaceTabLabels(files);
 return <><div ref={list} className="file-peek-tabs" role="tablist" aria-label="Open file previews" onKeyDown={event=>{
  if(!['ArrowLeft','ArrowRight','Home','End','Delete'].includes(event.key)||!(event.target as HTMLElement).matches('[role=tab]'))return;
  event.preventDefault();event.stopPropagation();if(event.key==='Delete'){dismiss(path);return;}
  const index=files.indexOf(path),next=event.key==='Home'?0:event.key==='End'?files.length-1:(index+(event.key==='ArrowRight'?1:-1)+files.length)%files.length;
  const list=event.currentTarget;select(files[next]!);requestAnimationFrame(()=>list.querySelectorAll<HTMLElement>('[role=tab]')[next]?.focus({preventScroll:true}));
 }}>{files.map(file=><div key={file} className={`file-peek-tab${file===state.preview?' preview':''}`} data-peek-path={file}><button type="button" role="tab" aria-controls="current-file-peek-source" aria-selected={path===file} tabIndex={path===file?0:-1} title={`${file}${file===state.preview?' · Preview · double-click to keep open':''}`} onClick={()=>select(file)} onDoubleClick={()=>pin(file)}><FileIcon path={file}/><span>{labels.get(file)}</span></button><button type="button" aria-label={`Close preview tab ${file}`} onClick={()=>dismiss(file)}>×</button></div>)}</div>{error&&<p className="file-peek-message" role="status">{error}</p>}</>;
}
