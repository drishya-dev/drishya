import {createContext,useContext,useLayoutEffect,useRef,useState,type MouseEvent,type ReactNode,type RefObject} from 'react';
import {ToolTrailBar} from '../components/ToolsPanel.tsx';
import {toolboxAllocation,toolboxTransform} from '../lib/toolbox-window.ts';
import type {SurfaceBounds} from '../lib/surface-reflow.ts';
import {useApp} from '../state.ts';
import './tools-window.css';

type Part={id:string;title:string;material:HTMLElement;home:RefObject<HTMLDivElement|null>};
type Reading=Part&{origin:HTMLElement};
type WindowApi={active?:string;register:(part:Part)=>()=>void;open:(id:string,origin:HTMLElement,pointer:boolean)=>void};
const composerRaised='.native-turn-details,.queued-input-receipts,.send-confirmation,.native-options-menu';

/** Layout offsets exclude the composer's temporary FLIP scale, including raised native controls. */
function composerClearance(composer:HTMLElement|undefined){
 if(!composer)return innerHeight;
 const top=innerHeight-composer.offsetHeight-(parseFloat(getComputedStyle(composer).bottom)||0);
 let clearance=top;
 for(const element of composer.querySelectorAll<HTMLElement>(composerRaised)){
  if(!element.checkVisibility({visibilityProperty:true}))continue;
  let offset=0,parent:HTMLElement|null=element;
  while(parent&&parent!==composer){offset+=parent.offsetTop;parent=parent.offsetParent as HTMLElement|null;}
  if(parent===composer)clearance=Math.min(clearance,top+composer.clientTop+offset);
 }
 return clearance;
}

const WindowContext=createContext<WindowApi|undefined>(undefined);
export function useToolboxWindow(){const value=useContext(WindowContext);if(!value)throw Error('Toolbox window owner missing');return value;}

/** The portal target stays the SAME element at home and in the reader: no captured content clone, lost query or remount. */
export function useToolboxPart(id:string,title:string){
 const owner=useToolboxWindow(),home=useRef<HTMLDivElement>(null);
 const [material]=useState(()=>{const node=document.createElement('div');node.className='toolbox-material';node.dataset.toolboxPart=id;return node;});
 useLayoutEffect(()=>{if(!material.isConnected)home.current?.append(material);return owner.register({id,title,material,home});},[id,title,material,owner.register]);
 // Remote inventories may mount their home after this hook's first layout effect.
 const attachHome=(node:HTMLDivElement|null)=>{home.current=node;if(node&&!material.isConnected)node.append(material);};
 return {home:attachHome,material,expanded:owner.active===id,open:(event:MouseEvent<HTMLElement>)=>{event.preventDefault();owner.open(id,event.currentTarget,event.detail>0);}};
}

/** One modeless reading window; presentation never owns inventory requests, filters, replay or capture. */
export function ToolboxWindowOwner({children}:{children:ReactNode}){
 const [active,setActive]=useState<{id:string;title:string;request:number}>();
 const parts=useRef(new Map<string,Part>()),reading=useRef<Reading|undefined>(undefined);
 const frame=useRef<HTMLDivElement>(null),body=useRef<HTMLDivElement>(null),anchor=useRef<HTMLSpanElement>(null);
 const animation=useRef<Animation|undefined>(undefined),generation=useRef(0),closing=useRef(false);
 const from=useRef<{bounds:SurfaceBounds;opacity:number;pointer:boolean}|undefined>(undefined);
 const filter=useApp(s=>s.filter),setFilter=useApp(s=>s.setFilter);
 const motion=useApp(s=>s.motion),lowResource=useApp(s=>s.lowResource);
 const cancel=()=>{generation.current++;animation.current?.cancel();animation.current=undefined;};
 const returnHome=(part:Part)=>part.home.current?.append(part.material);
 const restoreFocus=(origin:HTMLElement)=>{
  const fallback=[...anchor.current?.closest('.connected-workspace')?.querySelectorAll<HTMLElement>('.toolbox-collapse,.catalog-toggle')??[]].find(node=>node.checkVisibility());
  (origin.isConnected&&origin.checkVisibility()?origin:fallback)?.focus({preventScroll:true});
 };
 const finish=(focus:boolean)=>{
  cancel();const selected=reading.current;reading.current=undefined;closing.current=false;
  if(selected)returnHome(selected);
  frame.current?.hidePopover();setActive(undefined);
  if(focus&&selected)restoreFocus(selected.origin);
 };
 const mode=(pointer:boolean)=>{
  const root=document.documentElement,state=useApp.getState();
  if(!pointer||!state.motion||!root.hasAttribute('data-ui-motion'))return 'instant';
  return state.lowResource||root.hasAttribute('data-low-resource')||matchMedia('(prefers-reduced-motion: reduce)').matches?'fade':'move';
 };
 const run=(frames:Keyframe[],duration:number,done:()=>void)=>{
  const node=frame.current;if(!node){done();return;}
  const token=++generation.current;
  const easing=getComputedStyle(document.documentElement).getPropertyValue('--ease-out').trim()||'cubic-bezier(.16,1,.3,1)';
  const next=node.animate(frames,{duration,easing,fill:'both'});animation.current=next;
  next.onfinish=()=>{if(token!==generation.current)return;animation.current=undefined;next.cancel();done();};
 };
 const close=(pointer=false,focus=true)=>{
  const selected=reading.current,node=frame.current;if(!selected||!node)return;
  const current=node.getBoundingClientRect(),opacity=Number(getComputedStyle(node).opacity);cancel();closing.current=true;node.dataset.phase='closing';
  const fallback=mode(pointer);
  if(fallback==='instant'||!selected.origin.isConnected||!selected.origin.checkVisibility()){finish(focus);return;}
  const resting={x:node.offsetLeft,y:node.offsetTop,width:node.offsetWidth,height:node.offsetHeight};
  run(fallback==='fade'?[{opacity},{opacity:0}]:[
   {transform:toolboxTransform(current,resting),opacity},
   {transform:toolboxTransform(selected.origin.getBoundingClientRect(),resting),opacity:0},
  ],120,()=>finish(focus));
 };
 const place=()=>{
  const node=frame.current,viewer=anchor.current?.closest<HTMLElement>('.connected-workspace');if(!node)return;
  const visible=(element:HTMLElement|null)=>element&&element.checkVisibility()?element:undefined;
  const header=visible(viewer?.querySelector<HTMLElement>('.workspace-header')??null);
  const composer=visible(viewer?.querySelector<HTMLElement>('.prompt-composer')??null);
  const stage=viewer?.getBoundingClientRect()??{x:0,y:0,width:innerWidth,height:innerHeight};
  const bounds={x:Math.max(0,stage.x),y:Math.max(0,stage.y),width:Math.min(innerWidth,stage.x+stage.width)-Math.max(0,stage.x),height:Math.min(innerHeight,stage.y+stage.height)-Math.max(0,stage.y)};
  // Match the existing reader contract: compositor scale is transient; the composer LAYOUT owns clearance.
  const bottom=composerClearance(composer);
  const space=toolboxAllocation(bounds,header?.getBoundingClientRect().bottom??0,bottom,{width:640,height:innerHeight});
  node.style.maxWidth=`${space.width}px`;node.style.minWidth=`${Math.min(320,space.width)}px`;node.style.maxHeight=`${space.height}px`;
  const allocation=toolboxAllocation(bounds,header?.getBoundingClientRect().bottom??0,bottom,{width:node.offsetWidth,height:node.offsetHeight});
  node.style.left=`${allocation.x}px`;node.style.top=`${allocation.y}px`;
 };
 // Stable registration keeps a portal host at its home across ordinary projection/native updates.
 const [register]=useState(()=>(part:Part)=>{
  parts.current.set(part.id,part);
  return()=>{if(reading.current?.material===part.material)finish(false);parts.current.delete(part.id);part.material.remove();};
 });
 const open=(id:string,origin:HTMLElement,pointer:boolean)=>{
  const part=parts.current.get(id);if(!part||!origin.isConnected)return;
  if(reading.current?.id===id&&!closing.current){close(pointer);return;}
  const previous=reading.current,same=previous?.id===id;
  const current=same&&frame.current?frame.current.getBoundingClientRect():origin.getBoundingClientRect();
  const opacity=same&&frame.current?Number(getComputedStyle(frame.current).opacity):0;
  cancel();if(previous&&!same)returnHome(previous);
  reading.current={...part,origin};closing.current=false;from.current={bounds:current,opacity,pointer};
  setActive({id,title:part.title,request:generation.current});
 };
 useLayoutEffect(()=>{
  const selected=reading.current,node=frame.current,start=from.current;if(!active||!selected||!node||!body.current||!start)return;
  body.current.append(selected.material);if(!node.matches(':popover-open'))node.showPopover();place();node.dataset.phase='opening';
  node.querySelector<HTMLButtonElement>('.toolbox-window-close')?.focus({preventScroll:true});
  const fallback=mode(start.pointer),resting=node.getBoundingClientRect();
  if(fallback==='instant'){node.dataset.phase='open';return;}
  run(fallback==='fade'?[{opacity:start.opacity},{opacity:1}]:[
   {transform:toolboxTransform(start.bounds,resting),opacity:start.opacity},
   {transform:'none',opacity:1},
  ],160,()=>{node.dataset.phase='open';});
 },[active]);
 useLayoutEffect(()=>{
  if(!active)return;
  const node=frame.current!,viewer=anchor.current?.closest<HTMLElement>('.connected-workspace');
  const dock=viewer?.querySelector<HTMLElement>('.modern-tool-station');
  // A narrow viewport hides the dock, but the reader must survive resize.
  // Navigation away from the work view or an unavailable owner dismisses it.
  const unavailable=()=>!viewer?.isConnected||viewer.inert||!viewer.checkVisibility({visibilityProperty:true})||viewer.matches('.developer-workspace-open,.exploring')||!dock?.isConnected||dock.inert||dock.hidden;
  const settle=()=>{if(closing.current){finish(false);return;}cancel();place();node.dataset.phase='open';};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!event.isComposing){event.preventDefault();event.stopImmediatePropagation();close(false);}};
  const outside=(event:PointerEvent)=>{
   const selected=reading.current;if(!selected||event.composedPath().includes(node)||event.composedPath().includes(selected.origin))return;
   const focusable=event.target instanceof Element&&event.target.closest('button,a,input,textarea,select,summary,[tabindex]');
   close(true,!focusable);
  };
  const visibility=()=>{if(document.hidden)settle();};
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  // Observe actual layout changes, not every transformed animation frame. Ignore the initial observer delivery.
  const boundaries=()=>[...viewer?.querySelectorAll<HTMLElement>(`.workspace-header,.prompt-composer,.prompt-composer :is(${composerRaised})`)??[]];
  const signature=()=>[node.offsetWidth,node.offsetHeight,composerClearance(viewer?.querySelector<HTMLElement>('.prompt-composer')??undefined),...boundaries().flatMap(el=>[el.offsetTop,el.offsetWidth,el.offsetHeight])].join('/');
  let previous=signature();
  const resize=new ResizeObserver(()=>{const next=signature();if(next!==previous){previous=next;settle();}});
  resize.observe(node);
  const observed=new Set<HTMLElement>();
  const observeBoundaries=()=>{
   const current=new Set(boundaries());
   for(const element of observed)if(!current.has(element)){resize.unobserve(element);observed.delete(element);}
   for(const element of current)if(!observed.has(element)){resize.observe(element);observed.add(element);}
  };
  observeBoundaries();
  const removed=new MutationObserver(()=>{
   if(unavailable()||reading.current&&!reading.current.origin.isConnected){finish(false);return;}
   observeBoundaries();const next=signature();if(next!==previous){previous=next;settle();}
  });
  if(viewer)removed.observe(viewer,{childList:true,subtree:true});
  const composerChanges=new MutationObserver(()=>{observeBoundaries();const next=signature();if(next!==previous){previous=next;settle();}});
  const composer=viewer?.querySelector('.prompt-composer');
  if(composer)composerChanges.observe(composer,{attributes:true,subtree:true,attributeFilter:['class','style','hidden','open']});
  // Workspace hides the dock, not this sibling top-layer frame. Observe its stable owner,
  // never the moved material/origin, and preserve focus on the newly selected view control.
  const availability=new MutationObserver(()=>{if(unavailable())finish(false);});
  for(const owner of [viewer,dock])if(owner)availability.observe(owner,{attributes:true,attributeFilter:['class','inert','style','hidden']});
  document.addEventListener('keydown',escape,true);document.addEventListener('pointerdown',outside,true);document.addEventListener('visibilitychange',visibility);
  window.addEventListener('resize',settle);media.addEventListener('change',settle);
  return()=>{resize.disconnect();removed.disconnect();composerChanges.disconnect();availability.disconnect();document.removeEventListener('keydown',escape,true);document.removeEventListener('pointerdown',outside,true);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('resize',settle);media.removeEventListener('change',settle);};
 },[active]);
 useLayoutEffect(()=>{if(active){cancel();if(closing.current)finish(false);else{place();if(frame.current)frame.current.dataset.phase='open';}}},[motion,lowResource]);
 useLayoutEffect(()=>()=>{cancel();if(reading.current)returnHome(reading.current);},[]);
 return <WindowContext.Provider value={{active:active?.id,register,open}}><span ref={anchor} hidden/>{children}{active&&
  <div ref={frame} popover="manual" role="dialog" aria-modal="false" aria-label={active.title} className="modern-toolbox toolbox-window" data-toolbox-window="" data-toolbox-window-part={active.id}>
   <header className="toolbox-window-heading"><h2>{active.title}</h2><button className="toolbox-window-close" aria-label="Close toolbox" title="Close toolbox (Escape)" onClick={event=>close(event.detail>0)}>×</button></header>
   <div ref={body} className="toolbox-window-body"/>
   <footer className="toolbox-window-trail"><ToolTrailBar/>{filter&&<button className="md-clear-filter" onClick={()=>setFilter(undefined)}>Clear focus ×</button>}</footer>
  </div>
 }</WindowContext.Provider>;
}
