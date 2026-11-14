import {surfaceDuration,surfaceEasing,surfaceMotionAllowed,watchSurfaceMotion} from './surface-motion.ts';
import {useEffect,useLayoutEffect,useRef,type RefObject} from 'react';
import {surfaceFrames,type SurfaceBounds} from './surface-reflow.ts';

/** Explicit dock changes only: no arrival, typing, capture or scrolling listeners. */
export function useSurfaceReflow(ref:RefObject<HTMLElement|null>,state:unknown,identity?:unknown){
 const before=useRef<SurfaceBounds|undefined>(undefined),animations=useRef<Animation[]>([]);
 const cancel=()=>{animations.current.forEach(animation=>animation.cancel());animations.current=[];};
 const prepare=()=>{before.current=surfaceMotionAllowed()?ref.current?.getBoundingClientRect():undefined;if(!before.current)cancel();};
 useEffect(()=>{
  const unwatch=watchSurfaceMotion(cancel);
  window.addEventListener('resize',cancel);
  return()=>{unwatch();window.removeEventListener('resize',cancel);cancel();};
 },[]);
 useLayoutEffect(()=>{
  const from=before.current;before.current=undefined;const node=ref.current;cancel();
  if(!from||!node||!surfaceMotionAllowed())return;
  const transition=surfaceFrames(from,node.getBoundingClientRect(),getComputedStyle(node).transform);if(!transition)return;
  const options={duration:surfaceDuration('panel'),easing:surfaceEasing()};
  animations.current.push(node.animate(transition.frames,options));
  // Only the collapsed control label is counter-scaled; real editor/input text is never copied.
  for(const label of node.querySelectorAll<HTMLElement>('[data-surface-label]'))animations.current.push(label.animate([{transform:`scale(${1/transition.sx}, ${1/transition.sy})`},{transform:'none'}],options));
  return cancel;
 },[state,identity]);
 return prepare;
}
