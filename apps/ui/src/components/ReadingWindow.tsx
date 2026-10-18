import {useLayoutEffect,useRef,useState,type CSSProperties,type RefObject} from 'react';
import {useWorkspaceState} from '../lib/workspace-memory-react.ts';
import {readingWindowLayout,type ReadingWindowLayout} from '../lib/reading-window.ts';

/** Docked by default; explicit desktop manipulation never changes evidence or drafts. */
export function useReadingWindow(ref:RefObject<HTMLDialogElement|null>,id:string|undefined) {
  const [saved,setSaved]=useWorkspaceState<ReadingWindowLayout>(id?`surface/${id}`:undefined,{});
  const [viewport,setViewport]=useState(()=>({width:innerWidth,height:innerHeight,top:64}));
  const [size,setSize]=useState({width:0,height:0});
  const enabled=!!id&&document.documentElement.dataset.uiVersion==='modern'&&viewport.width>820;
  const drag=useRef<{x:number;y:number;left:number;top:number;height:number}|null>(null);
  useLayoutEffect(()=>{
    if(!id||!ref.current)return;
    const measure=()=>{
      const header=document.querySelector('.workspace-header')?.getBoundingClientRect();
      setViewport(previous=>{
        const next={width:innerWidth,height:innerHeight,top:(header?.bottom??52)+12};
        return previous.width===next.width&&previous.height===next.height&&previous.top===next.top?previous:next;
      });
      const rect=ref.current!.getBoundingClientRect();
      setSize(previous=>previous.width===rect.width&&previous.height===rect.height?previous:{width:rect.width,height:rect.height});
    };
    const observer=new ResizeObserver(measure);observer.observe(ref.current);
    const header=document.querySelector('.workspace-header');if(header)observer.observe(header);
    window.addEventListener('resize',measure);measure();
    return()=>{observer.disconnect();window.removeEventListener('resize',measure);};
  },[id,ref]);
  const layout=readingWindowLayout(saved,size,viewport);
  const style:CSSProperties=enabled?{
    ...(layout.height!==undefined?{height:layout.height}:{}),
    maxHeight:Math.max(120,viewport.height-viewport.top-12),
    ...(layout.x!==undefined?{position:'fixed',left:layout.x,top:layout.y,right:'auto',bottom:'auto',margin:0}:{}),
  }:{};
  const reset=()=>setSaved({});
  const move=(x:number,y:number)=>setSaved({...saved,...readingWindowLayout({...saved,x,y},size,viewport)});
  return {enabled,style,reset,controls:enabled?<>
    <button className="icon-btn reading-window-move" aria-label={`Move ${id} window`} title="Drag to move · arrow keys to reposition · Home to dock"
      onPointerDown={e=>{if(e.button!==0)return;const box=ref.current!.getBoundingClientRect();drag.current={x:e.clientX,y:e.clientY,left:box.left,top:box.top,height:box.height};e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault();}}
      onPointerMove={e=>{const start=drag.current;if(start&&e.currentTarget.hasPointerCapture(e.pointerId))move(start.left+e.clientX-start.x,start.top+e.clientY-start.y);}}
      onPointerUp={e=>{drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}
      onLostPointerCapture={()=>{drag.current=null;}}
      onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key))return;e.preventDefault();e.stopPropagation();if(e.key==='Home'){setSaved(saved.height===undefined?{}:{height:saved.height});return;}const box=ref.current!.getBoundingClientRect(),step=e.shiftKey?48:16;move(box.left+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0),box.top+(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0));}}
    ><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M3 12h18M8 7l4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4M17 8l4 4-4 4"/></svg></button>
  </>:null,heightControl:enabled?<div className="reading-window-height" role="separator" aria-label={`Resize ${id} window height`} aria-orientation="horizontal" aria-valuemin={Math.min(220,viewport.height-viewport.top-12)} aria-valuemax={Math.max(120,viewport.height-viewport.top-12)} aria-valuenow={Math.round(layout.height??size.height)} tabIndex={0} title="Drag to resize height · double-click to reset"
    onPointerDown={e=>{if(e.button!==0)return;const box=ref.current!.getBoundingClientRect();drag.current={x:e.clientX,y:e.clientY,left:box.left,top:box.top,height:box.height};e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault();}}
    onPointerMove={e=>{const start=drag.current;if(start&&e.currentTarget.hasPointerCapture(e.pointerId))setSaved(previous=>({...previous,height:readingWindowLayout({...previous,height:start.height+e.clientY-start.y},size,viewport).height}));}}
    onPointerUp={e=>{drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}
    onLostPointerCapture={()=>{drag.current=null;}}
    onDoubleClick={()=>setSaved(previous=>previous.x===undefined?{}:{x:previous.x,y:previous.y!})}
    onKeyDown={e=>{if(!['ArrowUp','ArrowDown','Home','End'].includes(e.key))return;e.preventDefault();e.stopPropagation();setSaved(previous=>({...previous,height:readingWindowLayout({...previous,height:e.key==='Home'?220:e.key==='End'?viewport.height:(layout.height??size.height)+(e.key==='ArrowDown'?32:-32)},size,viewport).height}));}}/>:null};
}
