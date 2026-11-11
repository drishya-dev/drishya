import {surfaceDuration} from './surface-motion.ts';
import {useEffect,useLayoutEffect,useRef,type RefObject} from 'react';
import {useApp} from '../state.ts';
import {surfaceFrames,type SurfaceBounds} from './surface-reflow.ts';

/** Explicit dock changes only: no arrival, typing, capture or scrolling listeners. */
export function useSurfaceReflow(ref:RefObject<HTMLElement|null>,state:unknown,identity?:unknown){
 const before=useRef<SurfaceBounds|undefined>(undefined),animations=useRef<Animation[]>([]);
 const cancel=()=>{animations.current.forEach(animation=>animation.cancel());animations.current=[];};
 const allowed=()=>{const app=useApp.getState();return document.documentElement.dataset.uiVersion==='modern'&&document.documentElement.hasAttribute('data-ui-press')&&app.motion&&!app.lowResource&&!matchMedia('(prefers-reduced-motion: reduce)').matches;};
 const prepare=()=>{before.current=allowed()?ref.current?.getBoundingClientRect():undefined;if(!before.current)cancel();};
 useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)');window.addEventListener('resize',cancel);media.addEventListener('change',cancel);return()=>{window.removeEventListener('resize',cancel);media.removeEventListener('change',cancel);cancel();};},[]);
 useLayoutEffect(()=>{
  const from=before.current;before.current=undefined;const node=ref.current;cancel();
  if(!from||!node||!allowed())return;
  const transition=surfaceFrames(from,node.getBoundingClientRect(),getComputedStyle(node).transform);if(!transition)return;
  const easing=getComputedStyle(document.documentElement).getPropertyValue('--ease-out').trim()||'cubic-bezier(.23,1,.32,1)';
  const options={duration:surfaceDuration('panel'),easing};
  animations.current.push(node.animate(transition.frames,options));
  // Only the collapsed control label is counter-scaled; real editor/input text is never copied.
  for(const label of node.querySelectorAll<HTMLElement>('[data-surface-label]'))animations.current.push(label.animate([{transform:`scale(${1/transition.sx}, ${1/transition.sy})`},{transform:'none'}],options));
  return cancel;
 },[state,identity]);
 return prepare;
}
