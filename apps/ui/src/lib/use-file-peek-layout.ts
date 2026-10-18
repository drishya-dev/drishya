import {useLayoutEffect,type RefObject} from 'react';

/** Allocate the larger free side from actual window bounds; the world itself never moves. */
export function useFilePeekLayout(ref:RefObject<HTMLDivElement|null>,enabled:boolean){
 useLayoutEffect(()=>{
  if(!enabled)return;
  const viewer=ref.current?.closest<HTMLElement>('.viewer');if(!viewer)return;
  let frame=0;const observed=new Set<Element>();
  const observer=new ResizeObserver(()=>schedule());
  const measure=()=>{
   frame=0;const reader=document.querySelector<HTMLElement>('.file-peek-reader[open]');if(!reader)return;
   const controls=viewer.querySelector<HTMLElement>('.workspace-secondary');
   const topValue=`${Math.max(100,(controls?.getBoundingClientRect().bottom??124)+12)}px`;if(reader.style.getPropertyValue('--peek-top')!==topValue)reader.style.setProperty('--peek-top',topValue);
   const composer=viewer.querySelector<HTMLElement>('.prompt-composer');
   for(const element of [reader,composer,controls])if(element&&!observed.has(element)){observed.add(element);observer.observe(element);}
   const bottom=composer?Math.max(12,innerHeight-composer.getBoundingClientRect().top+12):24;
   const bottomValue=`${bottom}px`;if(reader.style.getPropertyValue('--peek-bottom')!==bottomValue)reader.style.setProperty('--peek-bottom',bottomValue);
   const box=reader.getBoundingClientRect(),onRight=box.left>=innerWidth-box.right;
   const left=onRight?0:Math.max(0,box.right+12),right=onRight?Math.max(0,innerWidth-box.left+12):0;
   viewer.style.setProperty('--peek-left',`${left}px`);viewer.style.setProperty('--peek-right',`${right}px`);
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(measure);};
  const portals=new MutationObserver(schedule);portals.observe(document.body,{childList:true});
  window.addEventListener('drishya-reading-layout',schedule);window.addEventListener('resize',schedule);schedule();
  return()=>{cancelAnimationFrame(frame);observer.disconnect();portals.disconnect();window.removeEventListener('drishya-reading-layout',schedule);window.removeEventListener('resize',schedule);viewer.style.removeProperty('--peek-left');viewer.style.removeProperty('--peek-right');};
 },[ref,enabled]);
}
