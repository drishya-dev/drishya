import {useLayoutEffect,useRef,useState,type CSSProperties,type RefObject,type PointerEvent} from 'react';
import {useWorkspaceState} from '../lib/workspace-memory-react.ts';
import {readingWindowLayout,resizeReadingWindow,type ReadingWindowLayout,type ReadingEdge,type WindowRect,type ReadingWindowBounds} from '../lib/reading-window.ts';

/** One geometry owner anchors direct manipulation; it never changes evidence or drafts. */
export function useReadingWindow(ref:RefObject<HTMLDialogElement|null>,id:string|undefined) {
 const [saved,setSaved]=useWorkspaceState<ReadingWindowLayout>(id?`surface/${id}`:undefined,{});
 const [viewport,setViewport]=useState<ReadingWindowBounds>(()=>({width:innerWidth,height:innerHeight,top:64}));
 const [size,setSize]=useState({width:0,height:0});
 const enabled=!!id&&document.documentElement.dataset.uiVersion==='modern'&&viewport.width>820;
 const drag=useRef<{pointer:number;x:number;y:number;rect:WindowRect;edge?:ReadingEdge}|null>(null);
 useLayoutEffect(()=>{
  if(!id||!ref.current)return;
  const measure=()=>{
   const header=document.querySelector('.workspace-header')?.getBoundingClientRect();
   const peek=ref.current?.classList.contains('file-peek-reader')&&innerWidth>820;
   const controls=document.querySelector('.workspace-secondary')?.getBoundingClientRect();
   const composer=document.querySelector<HTMLElement>('.prompt-composer');
   // Layout height ignores the composer's finite scale animation; geometry must not chase it.
   const bottom=peek&&composer?innerHeight-composer.offsetHeight-(parseFloat(getComputedStyle(composer).bottom)||0)-12:innerHeight-12;
   const top=peek?Math.min(Math.max(100,(controls?.bottom??124)+12),bottom-120):(header?.bottom??52)+12;
   const next:ReadingWindowBounds={width:innerWidth,height:innerHeight,top,...(peek?{left:Math.round(innerWidth*.48),right:innerWidth-48,bottom}:{})};
   setViewport(previous=>JSON.stringify(previous)===JSON.stringify(next)?previous:next);
   const node=ref.current!;setSize(previous=>previous.width===node.offsetWidth&&previous.height===node.offsetHeight?previous:{width:node.offsetWidth,height:node.offsetHeight});
  };
  const observer=new ResizeObserver(measure);observer.observe(ref.current);const header=document.querySelector('.workspace-header');if(header)observer.observe(header);for(const selector of ['.prompt-composer','.workspace-secondary']){const element=document.querySelector(selector);if(element)observer.observe(element);}
  window.addEventListener('resize',measure);measure();return()=>{observer.disconnect();window.removeEventListener('resize',measure);};
 },[id,ref]);
 useLayoutEffect(()=>{drag.current=null;},[id,viewport.width,viewport.height]);
 const peek=enabled&&ref.current?.classList.contains('file-peek-reader');
 const maxWidth=(viewport.right??viewport.width-12)-(viewport.left??12),maxHeight=(viewport.bottom??viewport.height-12)-viewport.top;
 // Old modal coordinates are constrained to the adjacent reading lane, including on restore.
 const previewWidth=Math.max(360,Math.min(720,innerWidth*.28));
 const preference=peek?{width:previewWidth,height:Math.max(120,maxHeight-24),x:(viewport.right??innerWidth-48)-previewWidth,y:viewport.top+12,...saved}:saved;
 const layout=readingWindowLayout(preference,size,viewport);
 const style:CSSProperties=enabled?{...(layout.width!==undefined?{width:layout.width}:{}),...(layout.height!==undefined?{height:layout.height}:{}),maxWidth,maxHeight:Math.max(120,maxHeight),...(layout.x!==undefined?{position:'fixed',left:layout.x,top:layout.y,right:'auto',bottom:'auto',margin:0}: {})}:{};
 useLayoutEffect(()=>{window.dispatchEvent(new Event('drishya-reading-layout'));},[layout.x,layout.y,layout.width,layout.height]);
 const reset=()=>setSaved({});
 const move=(x:number,y:number)=>setSaved(previous=>readingWindowLayout({...previous,width:previous.width??size.width,height:previous.height??size.height,x,y},size,viewport));
 const begin=(event:PointerEvent<HTMLElement>,edge?:ReadingEdge)=>{
  if(!enabled||event.button!==0||!ref.current)return;
  const box=ref.current.getBoundingClientRect();drag.current={pointer:event.pointerId,x:event.clientX,y:event.clientY,rect:{x:box.x,y:box.y,width:box.width,height:box.height},edge};
  event.currentTarget.setPointerCapture(event.pointerId);event.preventDefault();
 };
 const update=(event:PointerEvent<HTMLElement>)=>{
  const start=drag.current;if(!start||start.pointer!==event.pointerId||!event.currentTarget.hasPointerCapture(event.pointerId))return;
  if(start.edge)setSaved(resizeReadingWindow(start.rect,start.edge,start.edge==='left'||start.edge==='right'?event.clientX-start.x:event.clientY-start.y,viewport));
  else move(start.rect.x+event.clientX-start.x,start.rect.y+event.clientY-start.y);
 };
 const end=(event:PointerEvent<HTMLElement>)=>{drag.current=null;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);};
 const events={onPointerMove:update,onPointerUp:end,onPointerCancel:end,onLostPointerCapture:()=>{drag.current=null;}};
 const moveKey:React.KeyboardEventHandler<HTMLElement>=event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(event.key))return;event.preventDefault();event.stopPropagation();if(event.key==='Home'){setSaved(previous=>({...(previous.width!==undefined?{width:previous.width}:{}),...(previous.height!==undefined?{height:previous.height}:{})}));return;}const box=ref.current!.getBoundingClientRect(),step=event.shiftKey?48:16;move(box.left+(event.key==='ArrowRight'?step:event.key==='ArrowLeft'?-step:0),box.top+(event.key==='ArrowDown'?step:event.key==='ArrowUp'?-step:0));};
 const headerDrag=enabled?{onPointerDown:(event:PointerEvent<HTMLElement>)=>{if((event.target as Element).closest('button,a,input,select,textarea,summary,[role=tab], [role=separator]'))return;begin(event);},...events,...(id==='File reader'?{tabIndex:0,role:'group','aria-label':'File reader title bar',onKeyDown:(event:React.KeyboardEvent<HTMLElement>)=>{if(event.target===event.currentTarget)moveKey(event);}}:{})}:{};
 return {enabled,style,reset,headerDrag,controls:enabled&&id!=='File reader'?<button className="icon-btn reading-window-move" aria-label={`Move ${id} window`} title="Drag title bar to move · arrow keys reposition · Home docks" onPointerDown={event=>begin(event)} {...events}
  onKeyDown={moveKey}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M3 12h18M8 7l4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4M17 8l4 4-4 4"/></svg></button>:null,
  heightControl:enabled?(['left','right','top','bottom'] as const).map(edge=><div key={edge} className={`reading-window-edge edge-${edge}${edge==='bottom'?' reading-window-height':''}`} role="separator" aria-label={edge==='bottom'?`Resize ${id} window height`:`Resize ${id} window ${edge}`} aria-orientation={edge==='left'||edge==='right'?'vertical':'horizontal'} aria-valuenow={Math.round(edge==='left'||edge==='right'?(layout.width??size.width):(layout.height??size.height))} aria-valuemin={edge==='left'||edge==='right'?360:220} aria-valuemax={edge==='left'||edge==='right'?maxWidth:maxHeight} tabIndex={0} title={`Drag ${edge} edge · double-click to reset`} onPointerDown={event=>begin(event,edge)} {...events} onDoubleClick={reset}
   onKeyDown={event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;event.preventDefault();event.stopPropagation();const node=ref.current!,box=node.getBoundingClientRect();const reverse=edge==='left'||edge==='top';const delta=event.key==='Home'?(reverse?100000:-100000):event.key==='End'?(reverse?-100000:100000):['ArrowRight','ArrowDown'].includes(event.key)?32:-32;setSaved(resizeReadingWindow({x:box.x,y:box.y,width:box.width,height:box.height},edge,delta,viewport));}}/>):null};
}
