import{useLayoutEffect,useRef,useState,type RefObject}from'react';
import{useApp}from'../state.ts';
export type SurfaceKind='menu'|'panel'|'dialog';
export function surfaceMotionAllowed(){const state=useApp.getState();return document.documentElement.dataset.uiVersion==='modern'&&document.documentElement.hasAttribute('data-ui-press')&&state.motion&&!state.lowResource&&!document.hidden&&!matchMedia('(prefers-reduced-motion: reduce)').matches;}
export function surfaceDuration(kind:SurfaceKind,closing=false){
 const fallback={menu:[180,140],panel:[220,160],dialog:[240,180]}[kind][closing?1:0]!;
 const raw=getComputedStyle(document.documentElement).getPropertyValue(`--motion-${kind}-${closing?'exit':'enter'}`).trim(),match=/^(\d+(?:\.\d+)?)(ms|s)$/.exec(raw);
 const value=match?Number(match[1])*(match[2]==='s'?1000:1):fallback;return value>0&&value<300?value:fallback;
}
interface MotionPolicy{allowed:()=>boolean;duration:(kind:SurfaceKind,closing:boolean)=>number;style:(node:HTMLElement)=>Pick<CSSStyleDeclaration,'opacity'|'transform'>;easing:()=>string;}
const policy:MotionPolicy={allowed:surfaceMotionAllowed,duration:surfaceDuration,style:node=>getComputedStyle(node),easing:()=>getComputedStyle(document.documentElement).getPropertyValue('--ease-out').trim()||'cubic-bezier(.23,1,.32,1)'};
/** A single real surface; generation guards prevent cancelled exits closing a newer reading intent. */
export function surfaceMotion(node:HTMLElement,kind:SurfaceKind='panel',rules:MotionPolicy=policy){
 let animation:Animation|undefined,generation=0,closing=false;
 node.dataset.surfaceMotion='';
 const original={inert:node.inert,pointer:node.style.pointerEvents},base=kind==='menu'?'none':rules.style(node).transform;
 const closed=`${base==='none'?'':base} translateY(${kind==='menu'?2:4}px) scale(${kind==='dialog'?'.98':'.99'})`.trim();
 const restore=()=>{node.inert=original.inert;node.style.pointerEvents=original.pointer;};
 const cancel=()=>{generation++;animation?.cancel();animation=undefined;closing=false;restore();node.dataset.surfacePhase='open';};
 const run=(exit:boolean,done?:()=>void,fresh=false)=>{
  const from=fresh?{opacity:'0',transform:closed}:rules.style(node),opacity=from.opacity,transform=from.transform;
  generation++;const ticket=generation;animation?.cancel();animation=undefined;closing=exit;node.dataset.surfacePhase=exit?'closing':'opening';
  if(exit){node.inert=true;node.style.pointerEvents='none';}else restore();
  if(!rules.allowed()){cancel();if(exit)done?.();return;}
  animation=node.animate([{opacity,transform},{opacity:exit?0:1,transform:exit?closed:base}],{duration:rules.duration(kind,exit),easing:rules.easing(),fill:'both'});
  const current=animation;
  void current.finished.then(()=>{if(ticket!==generation||!node.isConnected)return;if(exit)done?.();else{node.dataset.surfacePhase='open';current.cancel();if(animation===current)animation=undefined;}},()=>{});
 };
 return{open:(fresh=false)=>run(false,undefined,fresh),close:(done:()=>void)=>{if(!closing||!rules.allowed())run(true,done);},cancel,get closing(){return closing;},dispose:()=>{cancel();delete node.dataset.surfaceMotion;delete node.dataset.surfacePhase;}};
}
/** Retain a conditional owner through a finite pointer exit, with no cloned text or delayed navigation state. */
export function useSurfacePresence<T>(value:T|undefined,ref:RefObject<HTMLElement|null>,kind:SurfaceKind='panel',identity?:unknown):T|undefined{
 const [retained,setRetained]=useState({identity,value});
 if(retained.identity!==identity||value!==undefined&&retained.value!==value)setRetained({identity,value});
 const shown=value??(retained.identity===identity?retained.value:undefined),wanted=value!==undefined;
 const desired=useRef(wanted);desired.current=wanted;
 const controller=useRef<ReturnType<typeof surfaceMotion>|undefined>(undefined),owner=useRef<HTMLElement|null>(null),previous=useRef<boolean|undefined>(undefined);
 useApp(state=>state.motion);useApp(state=>state.lowResource);const [,refresh]=useState(0);
 useLayoutEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)'),changed=()=>refresh(value=>value+1);media.addEventListener('change',changed);document.addEventListener('visibilitychange',changed);return()=>{media.removeEventListener('change',changed);document.removeEventListener('visibilitychange',changed);};},[]);
 useLayoutEffect(()=>{
  const node=ref.current;
  if(!node){controller.current?.dispose();controller.current=undefined;owner.current=null;previous.current=undefined;return;}
  const fresh=owner.current!==node;
  if(fresh){controller.current?.dispose();controller.current=surfaceMotion(node,kind);owner.current=node;}
  const current=controller.current!;
  if(wanted){if(fresh||previous.current===false)current.open(fresh);else if(!surfaceMotionAllowed())current.cancel();}
  else if(previous.current!==false||!surfaceMotionAllowed())current.close(()=>{if(!desired.current)setRetained({identity,value:undefined});});
  previous.current=wanted;
 });
 useLayoutEffect(()=>()=>{controller.current?.dispose();controller.current=undefined;owner.current=null;previous.current=undefined;},[identity]);
 return shown;
}
